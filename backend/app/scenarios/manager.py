import copy
from datetime import UTC, datetime, timedelta

from app.models import Charger, ChargerStatus, ChargerType, ChargingMode, ChargingSession, Vehicle, VehicleType
from app.scenarios.models import ScenarioEvent, ScenarioType
from app.simulator import VirtualCharger, VirtualEV
from app.simulator.engine import SimulationEngine


class ScenarioManager:
    def __init__(
        self,
        engine: SimulationEngine,
        building_peak_offset_kw: float = 23.0,
        solar_surge_multiplier: float = 1.8,
        fault_charger_id: str | None = None,
    ) -> None:
        self.engine = engine
        self.building_peak_offset_kw = building_peak_offset_kw
        self.solar_surge_multiplier = solar_surge_multiplier
        self.fault_charger_id = fault_charger_id
        self.current_scenario = ScenarioType.NORMAL
        self.scenario_history: list[ScenarioEvent] = []
        self._baseline_evs = copy.deepcopy(engine.evs)
        self._baseline_chargers = copy.deepcopy(engine.chargers)
        self._baseline_building_offset = engine.building.scenario_load_offset_kw
        self._baseline_building_multiplier = engine.building.scenario_load_multiplier
        self._baseline_solar_multiplier = engine.solar.scenario_generation_multiplier

    def activate(self, scenario: ScenarioType) -> ScenarioEvent:
        if scenario == ScenarioType.RESET:
            return self.reset()
        if scenario == ScenarioType.NORMAL:
            self._normal_modifiers()
            event = self._event(scenario, ["BUILDING", "SOLAR", "CHARGERS"], "Normal operating conditions restored.")
        elif scenario == ScenarioType.BUILDING_PEAK:
            self.engine.building.scenario_load_offset_kw = self.building_peak_offset_kw
            event = self._event(
                scenario,
                ["BUILDING"],
                "Simulated building demand peak activated.",
                {"load_offset_kw": self.building_peak_offset_kw},
            )
        elif scenario == ScenarioType.SOLAR_SURGE:
            self.engine.solar.scenario_generation_multiplier = self.solar_surge_multiplier
            event = self._event(
                scenario,
                ["SOLAR"],
                "Simulated rooftop solar surge activated.",
                {"solar_multiplier": self.solar_surge_multiplier},
            )
        elif scenario == ScenarioType.EV_RUSH:
            added = self._add_rush_evs()
            event = self._event(
                scenario,
                added,
                "Additional EV rush vehicles connected through normal charger sessions.",
            )
        elif scenario == ScenarioType.CHARGER_FAULT:
            charger = self._fault_charger()
            event = self._event(
                scenario,
                [charger],
                "Deterministic demo charger fault activated.",
            )
        else:
            raise ValueError(f"Unsupported scenario: {scenario}")
        self.current_scenario = scenario
        self._record(event)
        return event

    def reset(self) -> ScenarioEvent:
        self.engine.building.scenario_load_offset_kw = self._baseline_building_offset
        self.engine.building.scenario_load_multiplier = self._baseline_building_multiplier
        self.engine.solar.scenario_generation_multiplier = self._baseline_solar_multiplier
        self.engine.replace_physical_assets(self._baseline_evs, self._baseline_chargers)
        self.current_scenario = ScenarioType.NORMAL
        event = self._event(
            ScenarioType.RESET,
            ["BUILDING", "SOLAR", "CHARGERS", "EVS"],
            "Scenario state reset to deterministic normal baseline.",
        )
        self._record(event)
        return event

    def _normal_modifiers(self) -> None:
        self.engine.building.scenario_load_offset_kw = self._baseline_building_offset
        self.engine.building.scenario_load_multiplier = self._baseline_building_multiplier
        self.engine.solar.scenario_generation_multiplier = self._baseline_solar_multiplier
        for charger in self.engine.chargers:
            if charger.charger.status == ChargerStatus.FAULTED:
                charger.charger.status = ChargerStatus.CONNECTED if charger.connected_ev else ChargerStatus.AVAILABLE

    def _add_rush_evs(self) -> list[str]:
        existing = {charger.charger.id for charger in self.engine.chargers}
        specs = [
            ("rush-car-01", VehicleType.CAR, 48.0, 11.0, "TYPE2", "rush-ch-01", 11.0, 82.0, ChargingMode.FAST, True),
            ("rush-scooter-01", VehicleType.SCOOTER, 4.2, 3.3, "LEV-AC", "rush-ch-02", 3.3, 90.0, ChargingMode.GREENEST, False),
            ("rush-bike-01", VehicleType.BIKE, 3.0, 2.0, "LEV-AC", "rush-ch-03", 2.0, 85.0, ChargingMode.CHEAPEST, False),
        ]
        added: list[str] = []
        now = self.engine.clock.current_time
        for vehicle_id, vehicle_type, capacity, max_ac, connector, charger_id, charger_kw, target, mode, urgent in specs:
            if charger_id in existing:
                continue
            ev = VirtualEV(
                Vehicle(
                    id=vehicle_id,
                    name=vehicle_id,
                    vehicle_type=vehicle_type,
                    battery_capacity_kwh=capacity,
                    max_ac_kw=max_ac,
                    max_dc_kw=0.0,
                    connector_types=[connector],
                    current_soc=24.0 if urgent else 35.0,
                    estimated_range_km=80.0,
                    connected=True,
                    minimum_readiness_soc=30.0,
                    estimated_consumption_kwh_per_km=0.15 if vehicle_type == VehicleType.CAR else 0.035,
                    estimated_soh_percent=100.0,
                    soh_source="DEMO",
                )
            )
            charger = VirtualCharger(
                Charger(
                    id=charger_id,
                    name=charger_id,
                    charger_type=ChargerType.AC,
                    max_power_kw=charger_kw,
                    connector_type=connector,
                    status=ChargerStatus.AVAILABLE,
                )
            )
            session = ChargingSession(
                id=f"session-{vehicle_id}",
                vehicle_id=vehicle_id,
                charger_id=charger_id,
                target_soc=target,
                arrival_time=now,
                explicit_departure_time=now + timedelta(hours=1.5) if urgent else None,
                charging_mode=mode,
                urgent=urgent,
                effective_max_kw=0,
            )
            charger.connect(ev, session)
            self.engine.evs.append(ev)
            self.engine.chargers.append(charger)
            added.extend([vehicle_id, charger_id, session.id])
        self.engine.rebuild_telemetry_gateway()
        return added

    def _fault_charger(self) -> str:
        target_id = self.fault_charger_id or self.engine.chargers[0].charger.id
        for charger in self.engine.chargers:
            if charger.charger.id == target_id:
                charger.charger.status = ChargerStatus.FAULTED
                charger.actual_delivered_power_kw = 0.0
                return charger.charger.id
        raise ValueError(f"No charger found for fault scenario: {target_id}")

    def _event(
        self,
        scenario: ScenarioType,
        affected_entities: list[str],
        summary: str,
        parameters: dict | None = None,
    ) -> ScenarioEvent:
        return ScenarioEvent(
            scenario=scenario,
            timestamp=self.engine.clock.current_time,
            affected_entities=affected_entities,
            summary=summary,
            parameters=parameters or {},
        )

    def _record(self, event: ScenarioEvent) -> None:
        self.scenario_history.append(event)
        self.scenario_history = self.scenario_history[-100:]
