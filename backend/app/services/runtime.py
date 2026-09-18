from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from app.alerts import Alert, AlertEngine
from app.demo.bootstrap import build_demo_chargers, build_demo_site_config, build_demo_vehicles
from app.explanations import DecisionExplanation, DecisionExplanationService
from app.forecasting import EnergyForecast, EnergyHistoryStore, ForecastEngine
from app.models import ChargingMode, ChargingSession, ChargerStatus
from app.mobility import MobilityPredictor, MobilityPredictorConfig, VehicleUsageHistoryStore
from app.optimizer.engine import OptimizationEngine
from app.scenarios import ScenarioEvent, ScenarioManager, ScenarioType
from app.services.coordinator import SmartChargingCoordinator, SmartChargingCycleResult
from app.services.persistence import InMemoryPersistenceRepository, PersistenceRepository
from app.services.websocket import WebSocketManager
from app.simulator import SimulationClock, SimulationEngine, VirtualBuilding, VirtualCharger, VirtualEV, VirtualSolar, VirtualTariff
from app.state.models import SystemState
from app.vehicle_intelligence.range import estimated_range_km
from app.vehicle_intelligence.models import PlannedTrip, TripRequirementSource


class ApplicationRuntime:
    """The single owner of physical state, control services, and API-facing history."""

    def __init__(self, persistence: PersistenceRepository | None = None) -> None:
        vehicles = build_demo_vehicles()
        chargers = build_demo_chargers()
        by_id = {vehicle.id: vehicle for vehicle in vehicles}
        virtual_chargers: list[VirtualCharger] = []
        sessions: dict[str, ChargingSession] = {}
        assignments = [("car-001", "dc-001", ChargingMode.FAST, 80.0, True), ("car-002", "ac-001", ChargingMode.CHEAPEST, 80.0, False), ("scooter-001", "ac-lev-001", ChargingMode.GREENEST, 85.0, False)]
        now = datetime(2026, 1, 1, 12, tzinfo=UTC)
        charger_by_id = {charger.id: charger for charger in chargers}
        for vehicle_id, charger_id, mode, target, urgent in assignments:
            session = ChargingSession(id=f"session-{vehicle_id}", vehicle_id=vehicle_id, charger_id=charger_id, target_soc=target, arrival_time=now, explicit_departure_time=now + timedelta(hours=3) if urgent else None, charging_mode=mode, urgent=urgent, effective_max_kw=0.0)
            virtual = VirtualCharger(charger_by_id[charger_id])
            virtual.connect(VirtualEV(by_id[vehicle_id]), session)
            virtual_chargers.append(virtual)
            sessions[session.id] = session
        self.sessions = sessions
        self.simulation_engine = SimulationEngine(SimulationClock(now), VirtualBuilding(42.0, variation_kw=0.0, seed=7), VirtualSolar(35.0, cloud_factor=0.8), VirtualTariff(), virtual_chargers, build_demo_site_config())
        self.optimizer = OptimizationEngine()
        self.energy_history = EnergyHistoryStore()
        self.forecast_engine = ForecastEngine(self.energy_history, tariff=self.simulation_engine.tariff)
        self.mobility_history = VehicleUsageHistoryStore()
        self.mobility_predictor = MobilityPredictor(self.mobility_history, MobilityPredictorConfig())
        self.explanation_service = DecisionExplanationService()
        self.alert_engine = AlertEngine()
        self.coordinator = SmartChargingCoordinator(self.simulation_engine, self.optimizer, self.explanation_service, self.alert_engine, self.energy_history, self.forecast_engine)
        self.scenario_manager = ScenarioManager(self.simulation_engine, fault_charger_id="dc-001")
        self.persistence = persistence or InMemoryPersistenceRepository()
        self.websocket_manager = WebSocketManager()
        self.current_result: SmartChargingCycleResult | None = None
        self.current_state: SystemState | None = None
        self.current_forecast: EnergyForecast | None = None
        self.current_scenario = ScenarioType.NORMAL
        self.mode = "SMART_OPTIMIZER"
        self.last_explanations: list[DecisionExplanation] = []
        self.last_alerts: list[Alert] = []
        self.trips: dict[str, PlannedTrip] = {}
        assert self.simulation_engine.system_state_builder is not None
        self.simulation_engine.system_state_builder.set_planned_trips(self.trips)
        self.session_started_at: dict[str, datetime] = {key: value.arrival_time for key, value in sessions.items()}
        self.run_control_cycle(0.0)

    def run_control_cycle(self, delta_real_seconds: float = 1.0) -> SmartChargingCycleResult:
        result = self.coordinator.cycle(delta_real_seconds)
        self.current_result = result
        self.current_state = result.snapshot.system_state
        self.current_forecast = result.forecast
        self.last_explanations = result.explanations
        self.last_alerts = result.alerts
        return result

    def get_current_state(self) -> SystemState:
        if self.current_state is None:
            self.run_control_cycle(0.0)
        assert self.current_state is not None
        return self.current_state

    def activate_scenario(self, scenario: ScenarioType) -> ScenarioEvent:
        event = self.scenario_manager.activate(scenario)
        self._sync_sessions_from_physical_state()
        self.current_scenario = self.scenario_manager.current_scenario
        self.run_control_cycle(0.0)
        return event

    def _sync_sessions_from_physical_state(self) -> None:
        for charger in self.simulation_engine.chargers:
            if charger.connected_session is not None:
                self.sessions[charger.connected_session.id] = charger.connected_session

    def reset_scenario(self) -> ScenarioEvent:
        return self.activate_scenario(ScenarioType.RESET)

    def set_speed(self, speed: int) -> None:
        if speed not in {1, 10, 60}:
            raise ValueError("speed must be one of 1, 10, or 60")
        self.simulation_engine.clock.speed = speed

    def vehicle(self, vehicle_id: str):
        for ev in self.simulation_engine.evs:
            if ev.vehicle.id == vehicle_id:
                return ev
        return None

    def session(self, session_id: str) -> ChargingSession | None:
        return self.sessions.get(session_id)

    def set_trip(self, trip: PlannedTrip) -> PlannedTrip:
        if self.vehicle(trip.vehicle_id) is None:
            raise KeyError(trip.vehicle_id)
        self.trips[trip.trip_id] = trip
        assert self.simulation_engine.system_state_builder is not None
        self.simulation_engine.system_state_builder.set_planned_trips(self.trips)
        for session in self.sessions.values():
            if session.vehicle_id == trip.vehicle_id:
                session.explicit_departure_time = trip.departure_time
        self.run_control_cycle(0.0)
        return trip

    def clear_trip(self, trip_id: str) -> None:
        self.trips.pop(trip_id, None)
        assert self.simulation_engine.system_state_builder is not None
        self.simulation_engine.system_state_builder.set_planned_trips(self.trips)
        self.run_control_cycle(0.0)

    def update_preferences(self, session_id: str, **changes: Any) -> ChargingSession:
        session = self.sessions.get(session_id)
        if session is None:
            raise KeyError(session_id)
        updates = {key: value for key, value in changes.items() if value is not None}
        if "mode" in updates:
            session.charging_mode = updates["mode"]
        if "target_soc" in updates:
            session.target_soc = updates["target_soc"]
        if "departure_time" in updates:
            session.explicit_departure_time = updates["departure_time"]
        if "urgent" in updates:
            session.urgent = updates["urgent"]
        self.run_control_cycle(0.0)
        return session

    def charge_faster(self, vehicle_id: str) -> ChargingSession:
        for session in self.sessions.values():
            if session.vehicle_id == vehicle_id:
                session.urgent = True
                self.run_control_cycle(0.0)
                return session
        raise KeyError(vehicle_id)

    def finalize_session(self, session: ChargingSession, status: str = "COMPLETED") -> dict[str, Any]:
        ev = self.vehicle(session.vehicle_id)
        started = self.session_started_at.get(session.id, session.arrival_time)
        ended = self.simulation_engine.clock.current_time
        record = {"session_id": session.id, "vehicle_id": session.vehicle_id, "charger_id": session.charger_id, "start_time": started.isoformat(), "end_time": ended.isoformat(), "start_soc": None, "target_soc": session.target_soc, "final_soc": ev.current_soc if ev else None, "energy_delivered_kwh": session.energy_delivered_kwh, "charging_duration_minutes": max(0.0, (ended - started).total_seconds() / 60), "mode": session.charging_mode.value, "status": status}
        self.persistence.save_session(record)
        return record

    def range_for(self, ev: Any) -> float:
        return estimated_range_km(ev.vehicle.battery_capacity_kwh * ev.vehicle.estimated_soh_percent / 100, ev.current_soc, ev.vehicle.estimated_consumption_kwh_per_km)
