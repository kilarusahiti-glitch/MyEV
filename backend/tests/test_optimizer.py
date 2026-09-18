from datetime import UTC, datetime, timedelta
import math

import pytest

from app.models import (
    Charger,
    ChargerStatus,
    ChargerType,
    ChargingMode,
    ChargingSession,
    SiteConfig,
    Vehicle,
    VehicleType,
)
from app.optimizer.allocation import AllocationEngine
from app.optimizer.constraints import calculate_ev_power_budget
from app.optimizer.engine import OptimizationEngine
from app.optimizer.feasibility import FeasibilityEngine, energy_remaining_kwh
from app.optimizer.models import OptimizationResult, ReasonCode
from app.optimizer.priority import PriorityEngine
from app.optimizer.validator import DecisionValidationError, DecisionValidator
from app.simulator import (
    SimulationClock,
    SimulationEngine,
    VirtualBuilding,
    VirtualCharger,
    VirtualEV,
    VirtualSolar,
    VirtualTariff,
)
from app.state.models import (
    ChargerState,
    EnergyState,
    SessionState,
    SiteState,
    SystemState,
    TariffState,
    VehicleState,
)


NOW = datetime(2026, 9, 18, 8, tzinfo=UTC)


def test_available_ev_budget_formula_and_safety_reserve() -> None:
    state = _state(building_kw=62, solar_kw=12, grid_limit_kw=100, reserve_kw=5)

    budget = calculate_ev_power_budget(state)

    assert budget.grid_based_ev_budget_kw == 45
    assert budget.effective_ev_budget_kw == 45


def test_transformer_constraint_can_be_tighter_than_grid() -> None:
    state = _state(
        building_kw=65,
        solar_kw=10,
        grid_limit_kw=100,
        transformer_limit_kw=90,
        reserve_kw=5,
    )

    budget = calculate_ev_power_budget(state)

    assert budget.grid_based_ev_budget_kw == 40
    assert budget.transformer_based_ev_budget_kw == 30
    assert budget.effective_ev_budget_kw == 30


def test_effective_budget_never_negative() -> None:
    state = _state(building_kw=120, solar_kw=0, grid_limit_kw=100, reserve_kw=5)

    assert calculate_ev_power_budget(state).effective_ev_budget_kw == 0


def test_feasibility_energy_required_average_and_slack() -> None:
    state = _state(
        vehicles=[_vehicle(soc=40, battery_kwh=60, max_ac_kw=20)],
        chargers=[_charger(max_kw=20)],
        sessions=[_session(target_soc=80, departure_hours=2)],
    )

    info = FeasibilityEngine().analyze(state)["s1"]

    assert energy_remaining_kwh(60, 40, 80) == 24
    assert info.energy_remaining_kwh == 24
    assert info.required_wall_energy_kwh == pytest.approx(24 / 0.92)
    assert info.required_average_power_kw == pytest.approx((24 / 0.92) / 2)
    assert info.slack_hours == pytest.approx(2 - ((24 / 0.92) / 20))
    assert info.feasible_by_deadline is True


def test_negative_slack_marks_impossible_deadline() -> None:
    state = _state(
        vehicles=[_vehicle(soc=30, battery_kwh=60)],
        chargers=[_charger(max_kw=20)],
        sessions=[_session(target_soc=80, departure_hours=0.5)],
    )

    info = FeasibilityEngine().analyze(state)["s1"]

    assert info.slack_hours is not None and info.slack_hours < 0
    assert info.feasible_by_deadline is False
    assert info.achievable_soc_by_departure is not None
    assert info.achievable_soc_by_departure < 80


def test_priority_urgent_deadline_fast_cheapest_greenest_components() -> None:
    urgent_state = _state(sessions=[_session(urgent=True)])
    normal_state = _state(sessions=[_session(id="s2", vehicle_id="v1", charger_id="c1")])
    priority = PriorityEngine()

    urgent = priority.score(
        urgent_state,
        urgent_state.sessions[0],
        FeasibilityEngine().analyze(urgent_state)["s1"],
    )
    normal = priority.score(
        normal_state,
        normal_state.sessions[0],
        FeasibilityEngine().analyze(normal_state)["s2"],
    )

    assert urgent.score > normal.score
    assert ReasonCode.URGENT_REQUEST in urgent.reason_codes

    soon = _state(sessions=[_session(departure_hours=1)])
    later = _state(sessions=[_session(departure_hours=5)])
    soon_score = priority.score(soon, soon.sessions[0], FeasibilityEngine().analyze(soon)["s1"])
    later_score = priority.score(later, later.sessions[0], FeasibilityEngine().analyze(later)["s1"])
    assert soon_score.score > later_score.score

    fast = _state(sessions=[_session(mode=ChargingMode.FAST.value)])
    cheap_peak = _state(
        tariff_level="PEAK",
        sessions=[_session(mode=ChargingMode.CHEAPEST.value, departure_hours=8)],
    )
    green = _state(
        solar_kw=20,
        sessions=[_session(mode=ChargingMode.GREENEST.value, departure_hours=8)],
    )
    assert priority.score(fast, fast.sessions[0], FeasibilityEngine().analyze(fast)["s1"]).mode_component == 1
    assert ReasonCode.DEFERRED_FOR_HIGH_TARIFF in priority.score(
        cheap_peak,
        cheap_peak.sessions[0],
        FeasibilityEngine().analyze(cheap_peak)["s1"],
    ).reason_codes
    assert ReasonCode.SOLAR_AVAILABLE in priority.score(
        green,
        green.sessions[0],
        FeasibilityEngine().analyze(green)["s1"],
    ).reason_codes


def test_deadline_requirement_overrides_cheapest_peak_deferral() -> None:
    state = _state(
        tariff_level="PEAK",
        sessions=[_session(mode=ChargingMode.CHEAPEST.value, departure_hours=0.75)],
    )

    score = PriorityEngine().score(
        state,
        state.sessions[0],
        FeasibilityEngine().analyze(state)["s1"],
    )

    assert ReasonCode.DEFERRED_FOR_HIGH_TARIFF not in score.reason_codes
    assert score.deadline_component > 0


def test_allocation_respects_budget_charger_vehicle_and_target_rules() -> None:
    state = _state(
        building_kw=65,
        solar_kw=10,
        grid_limit_kw=100,
        reserve_kw=5,
        vehicles=[
            _vehicle(id="v1", max_ac_kw=11, soc=40),
            _vehicle(id="v2", max_ac_kw=7.2, soc=40),
        ],
        chargers=[
            _charger(id="c1", max_kw=22, vehicle_id="v1", session_id="s1"),
            _charger(id="c2", max_kw=22, vehicle_id="v2", session_id="s2"),
        ],
        sessions=[
            _session(id="s1", vehicle_id="v1", charger_id="c1", target_soc=80),
            _session(id="s2", vehicle_id="v2", charger_id="c2", target_soc=80),
        ],
    )

    result = OptimizationEngine().optimize(state)

    assert result.total_allocated_kw <= 40
    assert _decision(result, "s1").allocated_power_kw <= 11
    assert _decision(result, "s2").allocated_power_kw <= 7.2


def test_faulted_offline_incompatible_and_target_reached_sessions_get_zero() -> None:
    state = _state(
        vehicles=[
            _vehicle(id="v1", connector_types=["TYPE2"]),
            _vehicle(id="v2", connector_types=["TYPE2"]),
            _vehicle(id="v3", connector_types=["TYPE2"]),
            _vehicle(id="v4", soc=80, connector_types=["TYPE2"]),
        ],
        chargers=[
            _charger(id="c1", vehicle_id="v1", session_id="s1", status="FAULTED"),
            _charger(id="c2", vehicle_id="v2", session_id="s2", status="OFFLINE"),
            _charger(id="c3", vehicle_id="v3", session_id="s3", connector_type="CCS2"),
            _charger(id="c4", vehicle_id="v4", session_id="s4"),
        ],
        sessions=[
            _session(id="s1", vehicle_id="v1", charger_id="c1"),
            _session(id="s2", vehicle_id="v2", charger_id="c2"),
            _session(id="s3", vehicle_id="v3", charger_id="c3"),
            _session(id="s4", vehicle_id="v4", charger_id="c4", current_soc=80, target_soc=80),
        ],
    )

    result = OptimizationEngine().optimize(state)

    assert all(decision.allocated_power_kw == 0 for decision in result.decisions)


def test_zero_capacity_crisis_produces_all_zero_allocations() -> None:
    state = _state(building_kw=150, solar_kw=0, grid_limit_kw=100)

    result = OptimizationEngine().optimize(state)

    assert result.effective_ev_budget_kw == 0
    assert result.constrained is True
    assert all(decision.allocated_power_kw == 0 for decision in result.decisions)
    assert ReasonCode.CAPACITY_LIMIT in result.decisions[0].reason_codes


def test_two_pass_allocator_respects_baseline_and_remaining_capacity() -> None:
    state = _state(
        building_kw=75,
        solar_kw=0,
        grid_limit_kw=100,
        reserve_kw=5,
        vehicles=[
            _vehicle(id="v1", max_ac_kw=20),
            _vehicle(id="v2", max_ac_kw=20),
        ],
        chargers=[
            _charger(id="c1", max_kw=20, vehicle_id="v1", session_id="s1"),
            _charger(id="c2", max_kw=20, vehicle_id="v2", session_id="s2"),
        ],
        sessions=[
            _session(id="s1", vehicle_id="v1", charger_id="c1", departure_hours=1),
            _session(id="s2", vehicle_id="v2", charger_id="c2", departure_hours=8),
        ],
    )

    result = OptimizationEngine().optimize(state)

    assert result.effective_ev_budget_kw == 20
    assert _decision(result, "s1").allocated_power_kw >= _decision(result, "s2").allocated_power_kw
    assert result.total_allocated_kw <= 20


def test_unconstrained_system_does_not_unnecessarily_throttle_sessions() -> None:
    state = _state(
        building_kw=10,
        solar_kw=0,
        grid_limit_kw=100,
        vehicles=[
            _vehicle(id="v1", max_ac_kw=7.2),
            _vehicle(id="v2", max_ac_kw=3.3),
        ],
        chargers=[
            _charger(id="c1", max_kw=7.2, vehicle_id="v1", session_id="s1"),
            _charger(id="c2", max_kw=7.2, vehicle_id="v2", session_id="s2"),
        ],
        sessions=[
            _session(id="s1", vehicle_id="v1", charger_id="c1"),
            _session(id="s2", vehicle_id="v2", charger_id="c2"),
        ],
    )

    result = OptimizationEngine().optimize(state)

    assert _decision(result, "s1").allocated_power_kw == pytest.approx(7.2)
    assert _decision(result, "s2").allocated_power_kw == pytest.approx(3.3)


def test_fairness_credit_increases_for_underserved_session() -> None:
    state = _state(
        building_kw=94,
        solar_kw=0,
        grid_limit_kw=100,
        reserve_kw=5,
        sessions=[_session()],
    )
    optimizer = OptimizationEngine()

    optimizer.optimize(state)
    optimizer.optimize(state)

    assert optimizer.fairness_credit_by_session_id["s1"] > 0


def test_validator_accepts_valid_and_rejects_invalid_results() -> None:
    state = _state()
    result = OptimizationEngine().optimize(state)
    DecisionValidator().validate(state, result)

    invalid_over_budget = OptimizationResult(
        **{
            **result.__dict__,
            "total_allocated_kw": result.effective_ev_budget_kw + 1,
            "decisions": [
                _replace_decision(result.decisions[0], result.effective_ev_budget_kw + 1)
            ],
        }
    )
    with pytest.raises(DecisionValidationError):
        DecisionValidator().validate(state, invalid_over_budget)

    invalid_over_limit = OptimizationResult(
        **{
            **result.__dict__,
            "total_allocated_kw": 99,
            "decisions": [_replace_decision(result.decisions[0], 99)],
        }
    )
    with pytest.raises(DecisionValidationError):
        DecisionValidator().validate(state, invalid_over_limit)

    invalid_nan = OptimizationResult(
        **{
            **result.__dict__,
            "total_allocated_kw": math.nan,
            "decisions": [_replace_decision(result.decisions[0], math.nan)],
        }
    )
    with pytest.raises(DecisionValidationError):
        DecisionValidator().validate(state, invalid_nan)


def test_optimizer_output_applies_to_chargers_and_tick_updates_soc_and_state() -> None:
    engine = _simulation_engine_for_feedback_loop()
    state_0 = engine.tick(0).system_state
    assert state_0 is not None

    result = OptimizationEngine().optimize(state_0)
    engine.apply_optimization(result)

    assert engine.chargers[0].commanded_power_kw == _decision(result, "session-1").allocated_power_kw
    before_soc = state_0.vehicles[0].current_soc
    state_1 = engine.tick(60).system_state
    assert state_1 is not None

    assert state_1.vehicles[0].current_soc > before_soc
    assert state_1.chargers[0].actual_delivered_power_kw > 0


def test_repeated_optimize_apply_tick_closed_loop_is_deterministic() -> None:
    first = _run_feedback_loop_trace()
    second = _run_feedback_loop_trace()

    assert first == second
    assert first[0] < first[-1]


def _run_feedback_loop_trace() -> list[float]:
    engine = _simulation_engine_for_feedback_loop()
    optimizer = OptimizationEngine()
    socs: list[float] = []
    for _ in range(3):
        snapshot = engine.tick(60)
        assert snapshot.system_state is not None
        result = optimizer.optimize(snapshot.system_state)
        engine.apply_optimization(result)
        socs.append(snapshot.system_state.vehicles[0].current_soc)
    return socs


def _simulation_engine_for_feedback_loop() -> SimulationEngine:
    ev = VirtualEV(
        Vehicle(
            id="v1",
            name="Feedback EV",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=60,
            max_ac_kw=11,
            max_dc_kw=50,
            connector_types=["TYPE2"],
            current_soc=40,
            estimated_range_km=180,
            connected=True,
        )
    )
    charger = VirtualCharger(
        Charger(
            id="c1",
            name="Charger",
            charger_type=ChargerType.AC,
            max_power_kw=11,
            connector_type="TYPE2",
            status=ChargerStatus.AVAILABLE,
        )
    )
    charger.connect(
        ev,
        ChargingSession(
            id="session-1",
            vehicle_id="v1",
            charger_id="c1",
            target_soc=80,
            arrival_time=NOW,
            explicit_departure_time=NOW + timedelta(hours=4),
            charging_mode=ChargingMode.FAST,
            urgent=False,
            effective_max_kw=11,
        ),
    )
    return SimulationEngine(
        clock=SimulationClock(NOW, speed=60),
        building=VirtualBuilding(base_load_kw=20, variation_kw=0),
        solar=VirtualSolar(solar_peak_kw=10),
        tariff=VirtualTariff(),
        chargers=[charger],
        site_config=SiteConfig(
            id="site",
            name="Site",
            grid_import_limit_kw=100,
            safety_reserve_kw=5,
            transformer_rated_kva=160,
            transformer_operational_limit_kw=120,
            solar_peak_kw=10,
        ),
        evs=[ev],
    )


def _state(
    building_kw: float = 30,
    solar_kw: float = 10,
    grid_limit_kw: float = 100,
    transformer_limit_kw: float = 120,
    reserve_kw: float = 5,
    tariff_level: str = "NORMAL",
    vehicles: list[VehicleState] | None = None,
    chargers: list[ChargerState] | None = None,
    sessions: list[SessionState] | None = None,
) -> SystemState:
    vehicles = vehicles or [_vehicle()]
    chargers = chargers or [_charger()]
    sessions = sessions or [_session()]
    return SystemState(
        timestamp=NOW,
        site=SiteState(
            site_id="site",
            name="Test Site",
            grid_import_limit_kw=grid_limit_kw,
            safety_reserve_kw=reserve_kw,
            transformer_rated_kva=160,
            transformer_operational_limit_kw=transformer_limit_kw,
            solar_peak_kw=35,
        ),
        energy=EnergyState(
            building_load_kw=building_kw,
            solar_generation_kw=solar_kw,
            ev_load_kw=0,
            site_demand_kw=building_kw,
            grid_import_kw=max(0, building_kw - solar_kw),
            solar_export_kw=max(0, solar_kw - building_kw),
        ),
        tariff=TariffState(current_level=tariff_level, current_price_per_kwh=0.32 if tariff_level == "PEAK" else 0.18),
        vehicles=vehicles,
        chargers=chargers,
        sessions=sessions,
        telemetry=[],
    )


def _vehicle(
    id: str = "v1",
    soc: float = 40,
    battery_kwh: float = 60,
    max_ac_kw: float = 11,
    max_dc_kw: float = 50,
    connector_types: list[str] | None = None,
) -> VehicleState:
    return VehicleState(
        vehicle_id=id,
        current_soc=soc,
        connected=True,
        battery_capacity_kwh=battery_kwh,
        max_ac_kw=max_ac_kw,
        max_dc_kw=max_dc_kw,
        connector_types=connector_types or ["TYPE2"],
    )


def _charger(
    id: str = "c1",
    charger_type: str = "AC",
    max_kw: float = 22,
    connector_type: str = "TYPE2",
    vehicle_id: str = "v1",
    session_id: str = "s1",
    status: str = "CONNECTED",
) -> ChargerState:
    return ChargerState(
        charger_id=id,
        charger_type=charger_type,
        status=status,
        connected_vehicle_id=vehicle_id,
        connected_session_id=session_id,
        commanded_power_kw=0,
        actual_delivered_power_kw=0,
        max_power_kw=max_kw,
        connector_type=connector_type,
    )


def _session(
    id: str = "s1",
    vehicle_id: str = "v1",
    charger_id: str = "c1",
    current_soc: float = 40,
    target_soc: float = 80,
    departure_hours: float | None = None,
    mode: str = ChargingMode.FAST.value,
    urgent: bool = False,
) -> SessionState:
    return SessionState(
        session_id=id,
        vehicle_id=vehicle_id,
        charger_id=charger_id,
        current_soc=current_soc,
        target_soc=target_soc,
        arrival_time=NOW,
        explicit_departure_time=(
            NOW + timedelta(hours=departure_hours)
            if departure_hours is not None
            else None
        ),
        mode=mode,
        urgent=urgent,
        effective_max_kw=0,
        allocated_kw=0,
        commanded_power_kw=0,
        energy_delivered_kwh=0,
        status="CONNECTED",
    )


def _decision(result: OptimizationResult, session_id: str):
    for decision in result.decisions:
        if decision.session_id == session_id:
            return decision
    raise AssertionError(f"Missing decision {session_id}")


def _replace_decision(decision, allocated_power_kw: float):
    return type(decision)(
        session_id=decision.session_id,
        vehicle_id=decision.vehicle_id,
        charger_id=decision.charger_id,
        allocated_power_kw=allocated_power_kw,
        effective_max_kw=decision.effective_max_kw,
        priority_score=decision.priority_score,
        feasible_by_deadline=decision.feasible_by_deadline,
        slack_hours=decision.slack_hours,
        reason_codes=decision.reason_codes,
    )
