from dataclasses import dataclass
import copy
from datetime import datetime

from app.models.site import SiteConfig
from app.optimizer.models import OptimizationResult
from app.simulator.building import VirtualBuilding
from app.simulator.charger import VirtualCharger
from app.simulator.clock import SimulationClock
from app.simulator.ev import VirtualEV
from app.simulator.sensors import (
    BuildingPowerMeter,
    ChargerPowerMeter,
    ChargerStatusSensor,
    EVSOCSensor,
    GridPowerMeter,
    SolarPowerMeter,
    TariffSensor,
)
from app.simulator.solar import VirtualSolar
from app.simulator.tariff import TariffPeriod, VirtualTariff
from app.state.builder import SystemStateBuilder
from app.state.models import SystemState
from app.telemetry import TelemetryGateway, TelemetryReading


@dataclass(frozen=True)
class ChargerSnapshot:
    charger_id: str
    actual_kw: float
    commanded_kw: float
    status: str
    vehicle_id: str | None


@dataclass(frozen=True)
class VehicleSnapshot:
    vehicle_id: str
    soc: float
    cumulative_energy_received_kwh: float


@dataclass(frozen=True)
class SimulationSnapshot:
    simulated_time: datetime
    building_load_kw: float
    solar_generation_kw: float
    ev_load_kw: float
    site_demand_kw: float
    grid_import_kw: float
    solar_export_kw: float
    tariff: TariffPeriod
    chargers: list[ChargerSnapshot]
    vehicles: list[VehicleSnapshot]
    telemetry_readings: list[TelemetryReading]
    system_state: SystemState | None


class SimulationEngine:
    def __init__(
        self,
        clock: SimulationClock,
        building: VirtualBuilding,
        solar: VirtualSolar,
        tariff: VirtualTariff,
        chargers: list[VirtualCharger],
        site_config: SiteConfig | None = None,
        evs: list[VirtualEV] | None = None,
        telemetry_gateway: TelemetryGateway | None = None,
    ) -> None:
        self.clock = clock
        self.building = building
        self.solar = solar
        self.tariff = tariff
        self.chargers = chargers
        self.site_config = site_config
        self.evs = list(evs or self._connected_evs())
        self._latest_grid_import_kw = 0.0
        self._latest_solar_export_kw = 0.0
        self.telemetry_gateway = telemetry_gateway or self._build_default_gateway()
        self.system_state_builder = (
            SystemStateBuilder(site_config) if site_config else None
        )

    def tick(self, delta_real_seconds: float) -> SimulationSnapshot:
        if delta_real_seconds < 0:
            raise ValueError("delta_real_seconds must be non-negative")

        simulated_time = self.clock.advance(delta_real_seconds)
        delta_time_hours = delta_real_seconds * self.clock.speed / 3600

        building_load_kw = self.building.update(simulated_time)
        solar_generation_kw = self.solar.update(simulated_time)
        tariff_period = self.tariff.update(simulated_time)

        ev_load_kw = sum(
            charger.step(delta_time_hours) for charger in self.chargers
        )
        site_demand_kw = building_load_kw + ev_load_kw
        grid_import_kw = max(0.0, site_demand_kw - solar_generation_kw)
        solar_export_kw = max(0.0, solar_generation_kw - site_demand_kw)
        self._latest_grid_import_kw = grid_import_kw
        self._latest_solar_export_kw = solar_export_kw

        snapshot = SimulationSnapshot(
            simulated_time=simulated_time,
            building_load_kw=building_load_kw,
            solar_generation_kw=solar_generation_kw,
            ev_load_kw=ev_load_kw,
            site_demand_kw=site_demand_kw,
            grid_import_kw=grid_import_kw,
            solar_export_kw=solar_export_kw,
            tariff=tariff_period,
            chargers=[
                ChargerSnapshot(
                    charger_id=charger.charger.id,
                    actual_kw=charger.actual_delivered_power_kw,
                    commanded_kw=charger.commanded_power_kw,
                    status=charger.charger.status.value,
                    vehicle_id=(
                        charger.connected_ev.vehicle.id if charger.connected_ev else None
                    ),
                )
                for charger in self.chargers
            ],
            vehicles=[
                VehicleSnapshot(
                    vehicle_id=charger.connected_ev.vehicle.id,
                    soc=charger.connected_ev.current_soc,
                    cumulative_energy_received_kwh=(
                        charger.connected_ev.cumulative_energy_received_kwh
                    ),
                )
                for charger in self.chargers
                if charger.connected_ev
            ],
            telemetry_readings=[],
            system_state=None,
        )
        telemetry_readings = self.telemetry_gateway.collect(simulated_time)
        system_state = (
            self.system_state_builder.build(
                snapshot=snapshot,
                telemetry=telemetry_readings,
                evs=self.evs,
                chargers=self.chargers,
            )
            if self.system_state_builder
            else None
        )

        return SimulationSnapshot(
            **{
                **snapshot.__dict__,
                "telemetry_readings": telemetry_readings,
                "system_state": system_state,
            }
        )

    def apply_optimization(self, result: OptimizationResult) -> None:
        chargers_by_id = {charger.charger.id: charger for charger in self.chargers}
        for decision in result.decisions:
            charger = chargers_by_id.get(decision.charger_id)
            if charger:
                charger.set_commanded_power_kw(decision.allocated_power_kw)

    def replace_physical_assets(
        self,
        evs: list[VirtualEV],
        chargers: list[VirtualCharger],
    ) -> None:
        self.evs = copy.deepcopy(evs)
        self.chargers = copy.deepcopy(chargers)
        self.rebuild_telemetry_gateway()

    def rebuild_telemetry_gateway(self) -> None:
        self.telemetry_gateway = self._build_default_gateway()

    def _build_default_gateway(self) -> TelemetryGateway:
        gateway = TelemetryGateway()
        gateway.register(BuildingPowerMeter("BUILDING_METER_01", self.building))
        gateway.register(SolarPowerMeter("SOLAR_METER_01", self.solar))
        gateway.register(
            GridPowerMeter(
                "GRID_METER_01",
                grid_import_kw=lambda: self._latest_grid_import_kw,
                solar_export_kw=lambda: self._latest_solar_export_kw,
            )
        )
        gateway.register(TariffSensor("TARIFF_FEED_01", self.tariff))

        for charger in self.chargers:
            charger_id = charger.charger.id.upper()
            gateway.register(ChargerPowerMeter(f"CHARGER_{charger_id}", charger))
            gateway.register(
                ChargerStatusSensor(f"CHARGER_STATUS_{charger_id}", charger)
            )

        for ev in self.evs:
            gateway.register(EVSOCSensor(f"SOC_{ev.vehicle.id.upper()}", ev))

        return gateway

    def _connected_evs(self) -> list[VirtualEV]:
        seen: set[str] = set()
        evs: list[VirtualEV] = []
        for charger in self.chargers:
            if charger.connected_ev and charger.connected_ev.vehicle.id not in seen:
                seen.add(charger.connected_ev.vehicle.id)
                evs.append(charger.connected_ev)
        return evs
