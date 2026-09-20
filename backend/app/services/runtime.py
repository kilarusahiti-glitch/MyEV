from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from app.alerts import Alert, AlertEngine
from app.demo.bootstrap import build_demo_chargers, build_demo_site_config, build_demo_vehicles
from app.explanations import DecisionExplanation, DecisionExplanationService
from app.forecasting import EnergyForecast, EnergyHistoryStore, ForecastEngine
from app.models import ChargingMode, ChargingSession, Charger, ChargerType
from app.mobility import MobilityPredictor, MobilityPredictorConfig, VehicleUsageHistoryStore
from app.optimizer.engine import OptimizationEngine
from app.scenarios import ScenarioEvent, ScenarioManager, ScenarioType
from app.services.coordinator import SmartChargingCoordinator, SmartChargingCycleResult
from app.services.persistence import PersistenceRepository, build_persistence_repository
from app.services.firebase_sync import ImportedVehicle, map_vehicle_record
from app.services.websocket import WebSocketManager
from app.simulator import SimulationClock, SimulationEngine, VirtualBuilding, VirtualCharger, VirtualEV, VirtualSolar, VirtualTariff
from app.state.models import SystemState
from app.vehicle_intelligence.range import estimated_range_km
from app.vehicle_intelligence.models import PlannedTrip, TripRequirementSource


class ApplicationRuntime:
    """The single owner of physical state, control services, and API-facing history."""

    def __init__(self, persistence: PersistenceRepository | None = None) -> None:
        self.persistence = persistence or build_persistence_repository()
        vehicles = build_demo_vehicles()
        chargers = build_demo_chargers()
        by_id = {vehicle.id: vehicle for vehicle in vehicles}
        virtual_chargers: list[VirtualCharger] = []
        sessions: dict[str, ChargingSession] = {}
        assignments = [
            ("car-001", "dc-001", ChargingMode.FAST, 80.0, True, timedelta(minutes=55)),
            ("car-002", "ac-001", ChargingMode.CHEAPEST, 80.0, False, timedelta(hours=3, minutes=30)),
            ("scooter-001", "ac-lev-001", ChargingMode.GREENEST, 85.0, False, timedelta(minutes=80)),
            ("bike-001", "ac-lev-002", ChargingMode.FAST, 85.0, True, timedelta(hours=2)),
            ("car-003", "ac-003", ChargingMode.GREENEST, 80.0, False, timedelta(hours=4)),
        ]
        now = datetime(2026, 1, 1, 12, tzinfo=UTC)
        charger_by_id = {charger.id: charger for charger in chargers}
        virtual_by_id = {vehicle.id: VirtualEV(vehicle) for vehicle in vehicles}
        for vehicle_id, charger_id, mode, target, urgent, departure_after in assignments:
            session = ChargingSession(id=f"session-{vehicle_id}", vehicle_id=vehicle_id, charger_id=charger_id, target_soc=target, arrival_time=now, explicit_departure_time=now + departure_after, charging_mode=mode, urgent=urgent, effective_max_kw=0.0)
            virtual = VirtualCharger(charger_by_id[charger_id])
            virtual.connect(virtual_by_id[vehicle_id], session)
            virtual_chargers.append(virtual)
            sessions[session.id] = session
        self.sessions = sessions
        self.simulation_engine = SimulationEngine(SimulationClock(now), VirtualBuilding(58.0, variation_kw=0.0, seed=7), VirtualSolar(35.0, cloud_factor=0.7), VirtualTariff(), virtual_chargers, build_demo_site_config(), evs=list(virtual_by_id.values()))
        self.owner_names: dict[str, str] = {}
        self.owner_emails: dict[str, str] = {}
        self.firebase_preferences: dict[str, ImportedVehicle] = {}
        self.charger_health_samples: list[dict[str, Any]] = []
        self._last_charger_health_sample_at: datetime | None = None
        self.optimizer = OptimizationEngine()
        self.energy_history = EnergyHistoryStore()
        self.forecast_engine = ForecastEngine(self.energy_history, tariff=self.simulation_engine.tariff)
        self.mobility_history = VehicleUsageHistoryStore()
        self.mobility_predictor = MobilityPredictor(self.mobility_history, MobilityPredictorConfig())
        self.explanation_service = DecisionExplanationService()
        self.alert_engine = AlertEngine()
        self.coordinator = SmartChargingCoordinator(self.simulation_engine, self.optimizer, self.explanation_service, self.alert_engine, self.energy_history, self.forecast_engine)
        self.scenario_manager = ScenarioManager(self.simulation_engine, fault_charger_id="dc-001")
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
        self.session_started_at: dict[str, datetime] = {key: value.arrival_time for key, value in self.sessions.items()}
        self.run_control_cycle(0.0)
        self.run_control_cycle(1.0)
        self.sync_firebase_vehicles()
        self.record_charger_health_sample()

    def sync_firebase_vehicles(self) -> bool:
        """Merge valid Firebase vehicles without replacing live/demo assets.

        Cloud connection state is mirrored, but cloud registration alone does
        not create a charger assignment, session, or power allocation.
        """
        try:
            records = self.persistence.load_vehicle_records()
            users = self.persistence.load_user_records()
        except Exception as exc:  # pragma: no cover - defensive for custom repositories
            import logging
            logging.getLogger(__name__).warning("Firebase vehicle import skipped: %s", exc)
            return False

        changed = False
        seen: set[str] = set()
        for record in records:
            item = map_vehicle_record(record, user_records=users)
            if not item or item.vehicle.id in seen:
                continue
            seen.add(item.vehicle.id)
            self.firebase_preferences[item.vehicle.id] = item
            if item.display_name != self.owner_names.get(item.vehicle.id):
                self.owner_names[item.vehicle.id] = item.display_name or ""
                changed = True
            self.owner_emails[item.vehicle.id] = item.owner_email or ""
            ev = self.vehicle(item.vehicle.id)
            if ev is None:
                self.simulation_engine.evs.append(VirtualEV(item.vehicle))
                changed = True
                continue

            # Firebase owns profile/capability data; live SOC/connection state
            # remains under the physical backend control loop.
            profile_fields = (
                "owner_uid", "name", "vehicle_type", "battery_capacity_kwh",
                "max_ac_kw", "max_dc_kw", "connector_types",
                "estimated_range_km", "minimum_readiness_soc",
                "estimated_consumption_kwh_per_km", "connected",
            )
            for field in profile_fields:
                incoming = getattr(item.vehicle, field)
                if getattr(ev.vehicle, field) != incoming:
                    setattr(ev.vehicle, field, incoming)
                    changed = True
            session = next((value for value in self.sessions.values() if value.vehicle_id == item.vehicle.id), None)
            if session is not None:
                session_fields = {
                    "target_soc": item.target_soc,
                    "explicit_departure_time": item.departure_time,
                    "charging_mode": item.charging_mode,
                    "urgent": item.urgent,
                }
                for field, incoming in session_fields.items():
                    if incoming is not None and getattr(session, field) != incoming:
                        setattr(session, field, incoming)
                        changed = True

        if changed:
            self.simulation_engine.rebuild_telemetry_gateway()
            self.run_control_cycle(0.0)
        return changed

    def record_charger_health_sample(self, sampled_at: datetime | None = None) -> bool:
        """Capture a bounded hourly snapshot from the virtual charger sensors."""
        timestamp = sampled_at or datetime.now(UTC)
        if self._last_charger_health_sample_at and (
            timestamp - self._last_charger_health_sample_at
        ).total_seconds() < 3600:
            return False

        readings = self.simulation_engine.telemetry_gateway.collect(timestamp)
        by_sensor = {reading.sensor_id: reading for reading in readings}
        state = self.get_current_state()
        chargers: list[dict[str, Any]] = []
        for charger in state.chargers:
            key = charger.charger_id.upper()
            power_reading = by_sensor.get(f"CHARGER_{key}")
            status_reading = by_sensor.get(f"CHARGER_STATUS_{key}")
            quality_readings = [item for item in (power_reading, status_reading) if item]
            quality = (
                "GOOD"
                if len(quality_readings) == 2 and all(item.quality.value == "GOOD" for item in quality_readings)
                else "UNAVAILABLE" if not quality_readings else "DEGRADED"
            )
            chargers.append({
                "charger_id": charger.charger_id,
                "status": status_reading.value if status_reading else charger.status,
                "actual_power_kw": power_reading.value if power_reading else charger.actual_delivered_power_kw,
                "max_power_kw": charger.max_power_kw,
                "connector_type": charger.connector_type,
                "connected_vehicle_id": charger.connected_vehicle_id,
                "power_sensor_id": power_reading.sensor_id if power_reading else None,
                "status_sensor_id": status_reading.sensor_id if status_reading else None,
                "quality": quality,
            })

        self.charger_health_samples.append({
            "sampled_at": timestamp.isoformat(),
            "simulated_at": state.timestamp.isoformat(),
            "source": "VIRTUAL_SENSORS",
            "chargers": chargers,
        })
        self.charger_health_samples = self.charger_health_samples[-168:]
        self._last_charger_health_sample_at = timestamp
        return True

    def run_control_cycle(self, delta_real_seconds: float = 1.0) -> SmartChargingCycleResult:
        result = self.coordinator.cycle(delta_real_seconds)
        self.current_result = result
        self.current_state = result.snapshot.system_state
        self.current_forecast = result.forecast
        self.last_explanations = result.explanations
        self.last_alerts = result.alerts
        self._persist_optimization_results()
        return result

    def _persist_optimization_results(self) -> None:
        if not self.current_result or not self.current_state:
            return
        decisions = {item.vehicle_id: item for item in self.current_result.optimization.decisions}
        chargers = {item.charger_id: item for item in self.current_state.chargers}
        sessions = {item.vehicle_id: item for item in self.current_state.sessions}
        vehicles = {item.vehicle_id: item for item in self.current_state.vehicles}
        for vehicle_id, session in sessions.items():
            decision = decisions.get(vehicle_id)
            vehicle = vehicles.get(vehicle_id)
            charger = chargers.get(session.charger_id)
            if not decision or not vehicle or not charger:
                continue
            if not vehicle.connected:
                status = "DISCONNECTED"
            elif charger.status in {"FAULTED", "OFFLINE"}:
                status = "FAULTED"
            elif session.current_soc >= session.target_soc:
                status = "TARGET_REACHED"
            elif decision.allocated_power_kw > 0:
                status = "CHARGING"
            else:
                status = "WAITING"
            requirement = session.charging_requirement
            explanation = next((item for item in reversed(self.last_explanations) if item.vehicle_id == vehicle_id), None)
            ev = self.vehicle(vehicle_id)
            if ev is None:
                continue
            record = {
                "session_id": session.session_id,
                "owner_uid": ev.vehicle.owner_uid,
                "vehicle_id": vehicle_id,
                "vehicle_name": ev.vehicle.name,
                "charger_id": session.charger_id,
                "status": status,
                "current_soc": vehicle.current_soc,
                "target_soc": session.target_soc,
                "allocated_kw": decision.allocated_power_kw,
                "actual_kw": charger.actual_delivered_power_kw,
                "priority": decision.priority_score,
                "feasible": decision.feasible_by_deadline,
                "estimated_range_km": self.range_for(ev),
                "estimated_time_remaining_min": requirement.eta_to_user_target_hours * 60 if requirement and requirement.eta_to_user_target_hours is not None else None,
                "readiness_status": requirement.readiness_state.value if requirement else None,
                "reason_codes": [code.value for code in decision.reason_codes],
                "explanation": explanation.detail if explanation else None,
                "charging_mode": session.mode,
                "validator_safe": self.current_result.optimization.valid,
                "updated_at": self.current_state.timestamp.isoformat(),
            }
            try:
                self.persistence.save_optimization_result(record)
            except Exception as exc:  # pragma: no cover - defensive for external persistence
                import logging
                logging.getLogger(__name__).warning("Optimization result persistence skipped: %s", exc)

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
        self.run_control_cycle(1.0)
        self.persistence.save_event({"event_id": f"scenario-{event.timestamp.isoformat()}", "timestamp": event.timestamp.isoformat(), "type": "SCENARIO", "scenario": scenario.value})
        self._persist_current_snapshot()
        return event

    def _persist_current_snapshot(self) -> None:
        state = self.get_current_state()
        self.persistence.save_snapshot({
            "simulation_time": state.timestamp.isoformat(),
            "scenario": self.current_scenario.value,
            "grid_limit_kw": state.site.grid_import_limit_kw,
            "building_load_kw": state.energy.building_load_kw,
            "solar_kw": state.energy.solar_generation_kw,
            "ev_load_kw": state.energy.ev_load_kw,
            "grid_import_kw": state.energy.grid_import_kw,
            "available_ev_capacity_kw": self.current_result.optimization.effective_ev_budget_kw if self.current_result else 0.0,
            "registered_count": len(state.vehicles),
            "connected_count": sum(vehicle.connected for vehicle in state.vehicles),
            "charging_count": sum(charger.actual_delivered_power_kw > 0.01 for charger in state.chargers),
            "validator_safe": self.current_result.optimization.valid if self.current_result else True,
            "updated_at": state.timestamp.isoformat(),
        })

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
        self.persistence.save_event({"event_id": f"session-{session.id}-{ended.isoformat()}", "timestamp": ended.isoformat(), "type": "SESSION_COMPLETED", "session_id": session.id})
        return record

    def range_for(self, ev: Any) -> float:
        return estimated_range_km(ev.vehicle.battery_capacity_kwh * ev.vehicle.estimated_soh_percent / 100, ev.current_soc, ev.vehicle.estimated_consumption_kwh_per_km)


def _select_charger(
    item: ImportedVehicle,
    chargers: list[Charger],
    used: set[str],
) -> Charger | None:
    candidates = [charger for charger in chargers if charger.id not in used and charger.connector_type in item.vehicle.connector_types]
    if item.charger_id:
        candidates = sorted(candidates, key=lambda charger: charger.id != item.charger_id)
    for charger in candidates:
        vehicle_limit = item.vehicle.max_ac_kw if charger.charger_type == ChargerType.AC else item.vehicle.max_dc_kw
        if vehicle_limit > 0:
            used.add(charger.id)
            return charger
    return None
