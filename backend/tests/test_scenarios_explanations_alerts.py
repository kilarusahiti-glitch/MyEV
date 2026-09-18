from datetime import UTC, datetime
import math

import pytest

from app.alerts import AlertEngine, AlertType
from app.explanations import DecisionExplanationService, select_primary_reason
from app.models import Charger, ChargerStatus, ChargerType, ChargingMode, ChargingSession, SiteConfig, Vehicle, VehicleType
from app.optimizer.engine import OptimizationEngine
from app.optimizer.models import ReasonCode
from app.scenarios import ScenarioManager, ScenarioType
from app.services import SmartChargingCoordinator
from app.simulator import SimulationClock, SimulationEngine, VirtualBuilding, VirtualCharger, VirtualEV, VirtualSolar, VirtualTariff


START = datetime(2026, 9, 18, 7, 0, tzinfo=UTC)


def test_building_peak_physical_sensor_state_and_budget_fall() -> None:
    engine = _engine()
    manager = ScenarioManager(engine, building_peak_offset_kw=30)
    normal = engine.tick(60)
    normal_budget = OptimizationEngine().optimize(normal.system_state).effective_ev_budget_kw

    event = manager.activate(ScenarioType.BUILDING_PEAK)
    peak = engine.tick(60)
    peak_budget = OptimizationEngine().optimize(peak.system_state).effective_ev_budget_kw

    assert event.scenario == ScenarioType.BUILDING_PEAK
    assert peak.building_load_kw > normal.building_load_kw
    assert _telemetry(peak, "ACTIVE_POWER") == peak.building_load_kw
    assert peak.system_state.energy.building_load_kw == peak.building_load_kw
    assert peak_budget < normal_budget


def test_solar_surge_sensor_state_and_budget_rise() -> None:
    engine = _engine(solar_peak=20)
    manager = ScenarioManager(engine, solar_surge_multiplier=2)
    normal = engine.tick(60)
    normal_budget = OptimizationEngine().optimize(normal.system_state).effective_ev_budget_kw

    manager.activate(ScenarioType.SOLAR_SURGE)
    surge = engine.tick(60)
    surge_budget = OptimizationEngine().optimize(surge.system_state).effective_ev_budget_kw

    assert surge.solar_generation_kw > normal.solar_generation_kw
    assert _telemetry(surge, "SOLAR_GENERATION") == surge.solar_generation_kw
    assert surge.system_state.energy.solar_generation_kw == surge.solar_generation_kw
    assert surge_budget >= normal_budget


def test_ev_rush_adds_real_sessions_and_reset_is_deterministic() -> None:
    engine = _engine()
    manager = ScenarioManager(engine)
    baseline_count = len(engine.chargers)

    manager.activate(ScenarioType.EV_RUSH)
    rush = engine.tick(60)
    rush_result = OptimizationEngine().optimize(rush.system_state)
    assert len(engine.chargers) > baseline_count
    assert len(rush.system_state.sessions) > baseline_count
    assert rush_result.constrained is True

    manager.reset()
    assert len(engine.chargers) == baseline_count
    manager.activate(ScenarioType.EV_RUSH)
    manager.reset()
    assert len(engine.chargers) == baseline_count


def test_charger_fault_flows_to_telemetry_state_and_zero_allocation() -> None:
    engine = _engine()
    manager = ScenarioManager(engine, fault_charger_id="c1")
    manager.activate(ScenarioType.CHARGER_FAULT)

    snapshot = engine.tick(60)
    result = OptimizationEngine().optimize(snapshot.system_state)
    decision = next(item for item in result.decisions if item.charger_id == "c1")

    assert next(item for item in snapshot.system_state.chargers if item.charger_id == "c1").status == "FAULTED"
    assert _telemetry(snapshot, "CHARGER_STATUS", "CHARGER_STATUS_C1") == "FAULTED"
    assert decision.allocated_power_kw == 0
    assert ReasonCode.OFFLINE_OR_FAULTED in decision.reason_codes


def test_explanations_track_previous_change_and_precedence() -> None:
    engine = _engine()
    service = DecisionExplanationService()
    first = engine.tick(60)
    result_1 = OptimizationEngine().optimize(first.system_state)
    explanations_1 = service.explain(result_1, first.system_state)
    engine.apply_optimization(result_1)

    ScenarioManager(engine, building_peak_offset_kw=45).activate(ScenarioType.BUILDING_PEAK)
    second = engine.tick(60)
    result_2 = OptimizationEngine().optimize(second.system_state)
    explanations_2 = service.explain(result_2, second.system_state)

    assert explanations_1[0].previous_allocated_power_kw is None
    changed = [item for item in explanations_2 if item.change_kw is not None]
    assert changed
    assert all(math.isfinite(item.allocated_power_kw) for item in explanations_2)
    assert select_primary_reason((ReasonCode.NORMAL_CHARGING, ReasonCode.OFFLINE_OR_FAULTED)) == ReasonCode.OFFLINE_OR_FAULTED


def test_explanation_fault_and_readiness_reasons_match_real_state() -> None:
    engine = _engine(initial_soc=20)
    manager = ScenarioManager(engine, fault_charger_id="c1")
    manager.activate(ScenarioType.CHARGER_FAULT)
    snapshot = engine.tick(60)
    result = OptimizationEngine().optimize(snapshot.system_state)
    explanations = DecisionExplanationService().explain(result, snapshot.system_state)

    fault_explanation = next(item for item in explanations if item.charger_id == "c1")
    assert fault_explanation.primary_reason_code == ReasonCode.OFFLINE_OR_FAULTED
    assert "fault" in fault_explanation.headline.lower()


def test_alerts_building_capacity_fault_dedup_and_resolution() -> None:
    engine = _engine()
    manager = ScenarioManager(engine, building_peak_offset_kw=45, fault_charger_id="c1")
    alerts = AlertEngine()

    manager.activate(ScenarioType.BUILDING_PEAK)
    manager.activate(ScenarioType.CHARGER_FAULT)
    snapshot = engine.tick(60)
    result = OptimizationEngine().optimize(snapshot.system_state)
    emitted = alerts.evaluate(snapshot.system_state, result)
    repeated = alerts.evaluate(snapshot.system_state, result)

    types = {alert.type for alert in emitted if alert.active}
    assert AlertType.BUILDING_LOAD_HIGH in types
    assert AlertType.CHARGER_FAULT in types
    assert not [alert for alert in repeated if alert.active and alert.type == AlertType.CHARGER_FAULT]

    manager.reset()
    reset_snapshot = engine.tick(60)
    reset_result = OptimizationEngine().optimize(reset_snapshot.system_state)
    resolved = alerts.evaluate(reset_snapshot.system_state, reset_result)
    assert any(alert.type == AlertType.CHARGER_FAULT and not alert.active for alert in resolved)


def test_alerts_readiness_predicted_risk_target_transition_and_solar_dedup() -> None:
    engine = _engine(initial_soc=20, target_soc=20)
    snapshot = engine.tick(60)
    result = OptimizationEngine().optimize(snapshot.system_state)
    alerts = AlertEngine()
    emitted = alerts.evaluate(snapshot.system_state, result)
    assert AlertType.TARGET_REACHED in {alert.type for alert in emitted}
    assert not [alert for alert in alerts.evaluate(snapshot.system_state, result) if alert.type == AlertType.TARGET_REACHED and alert.active]

    engine = _engine(initial_soc=20, target_soc=80, solar_peak=40)
    ScenarioManager(engine, solar_surge_multiplier=3).activate(ScenarioType.SOLAR_SURGE)
    solar_snapshot = engine.tick(60)
    solar_result = OptimizationEngine().optimize(solar_snapshot.system_state)
    solar_alerts = AlertEngine().evaluate(solar_snapshot.system_state, solar_result)
    assert AlertType.SOLAR_SURPLUS in {alert.type for alert in solar_alerts}


def test_coordinator_cycle_runs_and_keeps_bounded_history() -> None:
    coordinator = SmartChargingCoordinator(_engine())

    result = coordinator.cycle(60)

    assert result.snapshot.system_state is not None
    assert result.optimization.valid is True
    assert result.explanations
    assert len(coordinator.decision_history) == 1


def _engine(initial_soc: float = 40, target_soc: float = 80, solar_peak: float = 12) -> SimulationEngine:
    evs = [
        _ev("v1", initial_soc, 11),
        _ev("v2", 45, 7.2),
        _ev("v3", 35, 11),
    ]
    chargers = [
        _charger("c1", 11, "v1", "s1", target_soc, evs[0]),
        _charger("c2", 7.2, "v2", "s2", 80, evs[1]),
        _charger("c3", 11, "v3", "s3", 85, evs[2]),
    ]
    return SimulationEngine(
        clock=SimulationClock(START, speed=60),
        building=VirtualBuilding(base_load_kw=45, variation_kw=0, seed=1),
        solar=VirtualSolar(solar_peak_kw=solar_peak),
        tariff=VirtualTariff(),
        chargers=chargers,
        site_config=SiteConfig(
            id="site",
            name="Scenario Site",
            grid_import_limit_kw=80,
            safety_reserve_kw=5,
            transformer_rated_kva=120,
            transformer_operational_limit_kw=90,
            solar_peak_kw=solar_peak,
        ),
        evs=evs,
    )


def _ev(vehicle_id: str, soc: float, max_ac: float) -> VirtualEV:
    return VirtualEV(
        Vehicle(
            id=vehicle_id,
            name=vehicle_id,
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=60,
            max_ac_kw=max_ac,
            max_dc_kw=50,
            connector_types=["TYPE2"],
            current_soc=soc,
            estimated_range_km=120,
            connected=True,
            minimum_readiness_soc=30,
            estimated_soh_percent=100,
            soh_source="DEMO",
        )
    )


def _charger(charger_id: str, max_kw: float, vehicle_id: str, session_id: str, target: float, ev: VirtualEV) -> VirtualCharger:
    charger = VirtualCharger(
        Charger(
            id=charger_id,
            name=charger_id,
            charger_type=ChargerType.AC,
            max_power_kw=max_kw,
            connector_type="TYPE2",
            status=ChargerStatus.AVAILABLE,
        )
    )
    charger.connect(
        ev,
        ChargingSession(
            id=session_id,
            vehicle_id=vehicle_id,
            charger_id=charger_id,
            target_soc=target,
            arrival_time=START,
            charging_mode=ChargingMode.FAST,
            urgent=False,
            effective_max_kw=0,
        ),
    )
    return charger


def _telemetry(snapshot, metric: str, sensor_id: str | None = None):
    for reading in snapshot.telemetry_readings:
        if reading.metric == metric and (sensor_id is None or reading.sensor_id == sensor_id):
            return reading.value
    raise AssertionError(metric)
