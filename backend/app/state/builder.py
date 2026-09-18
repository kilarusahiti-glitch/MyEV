from typing import Any

from app.models.site import SiteConfig
from app.simulator.charger import VirtualCharger
from app.simulator.ev import VirtualEV
from app.state.models import (
    ChargerState,
    EnergyState,
    SessionState,
    SiteState,
    SystemState,
    TariffState,
    VehicleState,
)
from app.telemetry.models import TelemetryReading
from app.vehicle_intelligence.battery_health import usable_capacity_kwh
from app.vehicle_intelligence.charging_curve import battery_acceptance_limit_kw
from app.vehicle_intelligence.readiness import VehicleReadinessEngine


class SystemStateBuilder:
    def __init__(self, site_config: SiteConfig) -> None:
        self.site_config = site_config
        self.planned_trips: dict[str, PlannedTrip] = {}

    def set_planned_trips(self, trips: dict[str, PlannedTrip]) -> None:
        self.planned_trips = trips

    def build(
        self,
        snapshot: Any,
        telemetry: list[TelemetryReading],
        evs: list[VirtualEV],
        chargers: list[VirtualCharger],
    ) -> SystemState:
        return SystemState(
            timestamp=snapshot.simulated_time,
            site=SiteState(
                site_id=self.site_config.id,
                name=self.site_config.name,
                grid_import_limit_kw=self.site_config.grid_import_limit_kw,
                safety_reserve_kw=self.site_config.safety_reserve_kw,
                transformer_rated_kva=self.site_config.transformer_rated_kva,
                transformer_operational_limit_kw=(
                    self.site_config.transformer_operational_limit_kw
                ),
                solar_peak_kw=self.site_config.solar_peak_kw,
            ),
            energy=EnergyState(
                building_load_kw=snapshot.building_load_kw,
                solar_generation_kw=snapshot.solar_generation_kw,
                ev_load_kw=snapshot.ev_load_kw,
                site_demand_kw=snapshot.site_demand_kw,
                grid_import_kw=snapshot.grid_import_kw,
                solar_export_kw=snapshot.solar_export_kw,
            ),
            tariff=TariffState(
                current_level=snapshot.tariff.level.value,
                current_price_per_kwh=snapshot.tariff.price_per_kwh,
            ),
            vehicles=[
                VehicleState(
                    vehicle_id=ev.vehicle.id,
                    current_soc=ev.current_soc,
                    connected=ev.vehicle.connected,
                    battery_capacity_kwh=ev.vehicle.battery_capacity_kwh,
                    nominal_battery_capacity_kwh=ev.vehicle.battery_capacity_kwh,
                    max_ac_kw=ev.vehicle.max_ac_kw,
                    max_dc_kw=ev.vehicle.max_dc_kw,
                    connector_types=ev.vehicle.connector_types,
                    minimum_readiness_soc=ev.vehicle.minimum_readiness_soc,
                    estimated_consumption_kwh_per_km=(
                        ev.vehicle.estimated_consumption_kwh_per_km
                    ),
                    estimated_soh_percent=ev.vehicle.estimated_soh_percent,
                    soh_source=ev.vehicle.soh_source.value,
                    usable_capacity_kwh=usable_capacity_kwh(
                        ev.vehicle.battery_capacity_kwh,
                        ev.vehicle.estimated_soh_percent,
                    ),
                    current_battery_acceptance_limit_kw=battery_acceptance_limit_kw(
                        max(ev.vehicle.max_ac_kw, ev.vehicle.max_dc_kw),
                        ev.current_soc,
                    ),
                )
                for ev in evs
            ],
            chargers=[
                ChargerState(
                    charger_id=charger.charger.id,
                    charger_type=charger.charger.charger_type.value,
                    status=charger.charger.status.value,
                    connected_vehicle_id=(
                        charger.connected_ev.vehicle.id if charger.connected_ev else None
                    ),
                    connected_session_id=(
                        charger.connected_session.id
                        if charger.connected_session
                        else None
                    ),
                    commanded_power_kw=charger.commanded_power_kw,
                    actual_delivered_power_kw=charger.actual_delivered_power_kw,
                    max_power_kw=charger.charger.max_power_kw,
                    connector_type=charger.charger.connector_type,
                )
                for charger in chargers
            ],
            sessions=[
                self._build_session_state(
                    SessionState(
                    session_id=charger.connected_session.id,
                    vehicle_id=charger.connected_session.vehicle_id,
                    charger_id=charger.connected_session.charger_id,
                    current_soc=charger.connected_ev.current_soc,
                    target_soc=charger.connected_session.target_soc,
                    arrival_time=charger.connected_session.arrival_time,
                    explicit_departure_time=(
                        charger.connected_session.explicit_departure_time
                    ),
                    mode=charger.connected_session.charging_mode.value,
                    urgent=charger.connected_session.urgent,
                    effective_max_kw=charger.connected_session.effective_max_kw,
                    allocated_kw=charger.connected_session.allocated_kw,
                    commanded_power_kw=charger.commanded_power_kw,
                    energy_delivered_kwh=charger.connected_session.energy_delivered_kwh,
                    status=charger.connected_session.status.value,
                    ),
                    charger,
                    evs,
                )
                for charger in chargers
                if charger.connected_session and charger.connected_ev
            ],
            telemetry=telemetry,
        )

    def _build_session_state(
        self,
        session_state: SessionState,
        charger: VirtualCharger,
        evs: list[VirtualEV],
    ) -> SessionState:
        vehicle_state = VehicleState(
            vehicle_id=charger.connected_ev.vehicle.id,
            current_soc=charger.connected_ev.current_soc,
            connected=charger.connected_ev.vehicle.connected,
            battery_capacity_kwh=charger.connected_ev.vehicle.battery_capacity_kwh,
            nominal_battery_capacity_kwh=charger.connected_ev.vehicle.battery_capacity_kwh,
            max_ac_kw=charger.connected_ev.vehicle.max_ac_kw,
            max_dc_kw=charger.connected_ev.vehicle.max_dc_kw,
            connector_types=charger.connected_ev.vehicle.connector_types,
            minimum_readiness_soc=charger.connected_ev.vehicle.minimum_readiness_soc,
            estimated_consumption_kwh_per_km=(
                charger.connected_ev.vehicle.estimated_consumption_kwh_per_km
            ),
            estimated_soh_percent=charger.connected_ev.vehicle.estimated_soh_percent,
            soh_source=charger.connected_ev.vehicle.soh_source.value,
            usable_capacity_kwh=usable_capacity_kwh(
                charger.connected_ev.vehicle.battery_capacity_kwh,
                charger.connected_ev.vehicle.estimated_soh_percent,
            ),
            current_battery_acceptance_limit_kw=battery_acceptance_limit_kw(
                max(charger.connected_ev.vehicle.max_ac_kw, charger.connected_ev.vehicle.max_dc_kw),
                charger.connected_ev.current_soc,
            ),
        )
        charger_state = ChargerState(
            charger_id=charger.charger.id,
            charger_type=charger.charger.charger_type.value,
            status=charger.charger.status.value,
            connected_vehicle_id=charger.connected_ev.vehicle.id,
            connected_session_id=charger.connected_session.id,
            commanded_power_kw=charger.commanded_power_kw,
            actual_delivered_power_kw=charger.actual_delivered_power_kw,
            max_power_kw=charger.charger.max_power_kw,
            connector_type=charger.charger.connector_type,
        )
        session_state = session_state.model_copy(
            update={"planned_trip": next((trip for trip in self.planned_trips.values() if trip.vehicle_id == session_state.vehicle_id), None)}
        )
        requirement = VehicleReadinessEngine().build_requirement(
            vehicle_state,
            session_state,
            charger_state,
        )
        return session_state.model_copy(update={"charging_requirement": requirement})
