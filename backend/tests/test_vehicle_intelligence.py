from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.models import Charger, ChargerStatus, ChargerType, ChargingMode, ChargingSession, SiteConfig, Vehicle, VehicleType
from app.optimizer.engine import OptimizationEngine
from app.optimizer.feasibility import FeasibilityEngine
from app.optimizer.models import ReasonCode
from app.simulator import SimulationClock, SimulationEngine, VirtualBuilding, VirtualCharger, VirtualEV, VirtualSolar, VirtualTariff
from app.state.models import ChargerState, EnergyState, SessionState, SiteState, SystemState, TariffState, VehicleState
from app.vehicle_intelligence import (
    PlannedTrip,
    RequirementSource,
    SOHSource,
    VehicleReadinessEngine,
    acceptance_factor,
    battery_acceptance_limit_kw,
    estimate_charging_eta_hours,
    estimate_soh_percent,
    usable_capacity_kwh,
)
from app.vehicle_intelligence.trip import (
    buffered_trip_energy_kwh,
    required_departure_soc_percent,
    total_trip_distance_km,
    trip_energy_kwh,
)


NOW = datetime(2026, 9, 18, 8, tzinfo=UTC)


def test_minimum_readiness_deficit_and_config_validation() -> None:
    below = _requirement(soc=24, minimum=30, target=80)
    above = _requirement(soc=68, minimum=30, target=80)

    assert below.readiness_deficit_soc == 6
    assert below.requirement_source == RequirementSource.MINIMUM_READINESS
    assert above.readiness_deficit_soc == 0
    assert above.flexible_target_soc == 80

    with pytest.raises(ValidationError):
        Vehicle(
            id="bad",
            name="Bad Readiness",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=60,
            max_ac_kw=11,
            max_dc_kw=50,
            connector_types=["TYPE2"],
            current_soc=50,
            estimated_range_km=100,
            minimum_readiness_soc=101,
        )


def test_cheapest_peak_defers_flexible_target_but_not_minimum_readiness() -> None:
    flexible = _state(
        tariff_level="PEAK",
        vehicles=[_vehicle(soc=65, minimum=30)],
        sessions=[_session(target=85, mode=ChargingMode.CHEAPEST.value)],
    )
    necessary = _state(
        tariff_level="PEAK",
        vehicles=[_vehicle(soc=22, minimum=30)],
        sessions=[_session(current_soc=22, target=85, mode=ChargingMode.CHEAPEST.value)],
    )

    flexible_result = OptimizationEngine().optimize(flexible)
    necessary_result = OptimizationEngine().optimize(necessary)

    assert flexible_result.decisions[0].allocated_power_kw == 0
    assert ReasonCode.TARGET_DEFERRED in flexible_result.decisions[0].reason_codes
    assert necessary_result.decisions[0].allocated_power_kw > 0
    assert ReasonCode.BELOW_MINIMUM_READINESS in necessary_result.decisions[0].reason_codes


def test_trip_distance_energy_buffer_reserve_and_required_soc() -> None:
    one_way = _trip(distance=60, return_trip=False)
    round_trip = _trip(distance=60, return_trip=True)
    explicit_total = _trip(distance=60, return_trip=True, total=75)

    assert total_trip_distance_km(one_way) == 60
    assert total_trip_distance_km(round_trip) == 120
    assert total_trip_distance_km(explicit_total) == 75
    assert trip_energy_kwh(one_way, 0.15) == pytest.approx(9)
    assert buffered_trip_energy_kwh(one_way, 0.15, 15) == pytest.approx(10.35)

    required_soc, feasible = required_departure_soc_percent(one_way, 50, 0.15, 15)
    assert required_soc == pytest.approx(40.7)
    assert feasible is True

    with pytest.raises(ValidationError):
        _trip(distance=-1)


def test_trip_readiness_and_infeasible_full_charge() -> None:
    ready = _requirement(soc=55, minimum=30, target=85, trip=_trip(distance=60))
    not_ready = _requirement(soc=30, minimum=30, target=85, trip=_trip(distance=60))
    impossible = _requirement(
        soc=90,
        minimum=30,
        target=100,
        trip=_trip(distance=900),
    )

    assert ready.trip_ready is True
    assert not_ready.trip_ready is False
    assert impossible.trip_feasible_on_full_charge is False
    assert impossible.requirement_feasible is False


def test_trip_deadline_feeds_feasibility_and_outranks_flexible_target() -> None:
    trip = _trip(distance=120, departure_hours=2)
    state = _state(
        vehicles=[_vehicle(soc=45, minimum=30, usable=60)],
        sessions=[_session(current_soc=45, target=85, trip=trip)],
    )

    info = FeasibilityEngine().analyze(state)["s1"]

    assert info.time_remaining_hours == pytest.approx(2)
    assert state.sessions[0].charging_requirement is not None
    assert state.sessions[0].charging_requirement.requirement_source == RequirementSource.TRIP
    assert info.energy_remaining_kwh < (85 - 45) / 100 * 60


def test_soh_usable_capacity_and_estimation() -> None:
    assert usable_capacity_kwh(60, 100) == 60
    assert usable_capacity_kwh(60, 90) == 54
    with pytest.raises(ValueError):
        usable_capacity_kwh(60, 0)

    explicit, source = estimate_soh_percent(60, 5000, 87, SOHSource.DEMO)
    estimated_a, source_a = estimate_soh_percent(60, 120)
    estimated_b, source_b = estimate_soh_percent(60, 120)

    assert explicit == 87
    assert source == SOHSource.DEMO
    assert estimated_a == estimated_b
    assert source_a == source_b == SOHSource.ESTIMATED


def test_lower_usable_capacity_requires_higher_trip_soc() -> None:
    trip = _trip(distance=100)
    healthy, _ = required_departure_soc_percent(trip, 60, 0.15, 15)
    degraded, _ = required_departure_soc_percent(trip, 48, 0.15, 15)

    assert degraded > healthy


def test_charging_taper_and_acceptance_limits() -> None:
    assert acceptance_factor(79) == 1.0
    assert acceptance_factor(80) == 0.75
    assert acceptance_factor(90) == 0.5
    assert battery_acceptance_limit_kw(70, 92) == 35

    state = _state(
        vehicles=[_vehicle(soc=92, max_ac=70, usable=60)],
        chargers=[_charger(max_kw=70)],
        sessions=[_session(current_soc=92, target=100)],
    )
    result = OptimizationEngine().optimize(state)
    assert result.decisions[0].allocated_power_kw <= 35
    assert ReasonCode.BATTERY_ACCEPTANCE_LIMIT in result.decisions[0].reason_codes or result.decisions[0].effective_max_kw == 35


def test_physical_charger_respects_battery_acceptance() -> None:
    ev = VirtualEV(
        Vehicle(
            id="v1",
            name="High SOC EV",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=60,
            max_ac_kw=70,
            max_dc_kw=70,
            connector_types=["TYPE2"],
            current_soc=92,
            estimated_range_km=100,
        )
    )
    charger = VirtualCharger(
        Charger(
            id="c1",
            name="AC",
            charger_type=ChargerType.AC,
            max_power_kw=70,
            connector_type="TYPE2",
            status=ChargerStatus.AVAILABLE,
        )
    )
    charger.connect(ev, _physical_session("s1", "v1", "c1", 100))
    charger.set_commanded_power_kw(70)

    assert charger.step(0.1) == pytest.approx(35)


def test_eta_integrates_taper_bands_and_limits() -> None:
    below_80 = estimate_charging_eta_hours(50, 60, 60, 60, 30)
    crossing_80 = estimate_charging_eta_hours(70, 85, 60, 60, 30)
    crossing_90 = estimate_charging_eta_hours(70, 95, 60, 60, 30)
    faster = estimate_charging_eta_hours(50, 70, 60, 60, 30)
    slower = estimate_charging_eta_hours(50, 70, 60, 60, 10)
    acceptance_limited_a = estimate_charging_eta_hours(90, 95, 60, 20, 100)
    acceptance_limited_b = estimate_charging_eta_hours(90, 95, 60, 20, 40)

    assert below_80 > 0
    assert crossing_80 > below_80
    assert crossing_90 > crossing_80
    assert faster < slower
    assert acceptance_limited_a == pytest.approx(acceptance_limited_b)
    assert estimate_charging_eta_hours(80, 80, 60, 10, 10) == 0
    assert crossing_90 >= 0


def test_optimizer_readiness_trip_urgent_and_budget_integration() -> None:
    trip = _trip(distance=140, departure_hours=1.5)
    state = _state(
        building=65,
        solar=10,
        grid_limit=100,
        vehicles=[
            _vehicle(id="v1", soc=22, minimum=30, usable=60),
            _vehicle(id="v2", soc=60, minimum=30, usable=60),
            _vehicle(id="v3", soc=42, minimum=30, usable=60),
            _vehicle(id="v4", soc=70, minimum=30, usable=60),
            _vehicle(id="v5", soc=40, minimum=30, max_ac=11, usable=60),
        ],
        chargers=[
            _charger(id="c1", vehicle="v1", session="s1", max_kw=11),
            _charger(id="c2", vehicle="v2", session="s2", max_kw=11),
            _charger(id="c3", vehicle="v3", session="s3", max_kw=11),
            _charger(id="c4", vehicle="v4", session="s4", max_kw=11),
            _charger(id="c5", vehicle="v5", session="s5", max_kw=11),
        ],
        sessions=[
            _session(id="s1", vehicle="v1", charger="c1", current_soc=22, target=80, mode=ChargingMode.CHEAPEST.value),
            _session(id="s2", vehicle="v2", charger="c2", current_soc=60, target=85, mode=ChargingMode.CHEAPEST.value),
            _session(id="s3", vehicle="v3", charger="c3", current_soc=42, target=85, trip=trip),
            _session(id="s4", vehicle="v4", charger="c4", current_soc=70, target=85, trip=trip),
            _session(id="s5", vehicle="v5", charger="c5", current_soc=40, target=80, urgent=True),
        ],
        tariff_level="PEAK",
    )

    result = OptimizationEngine().optimize(state)

    assert result.total_allocated_kw <= result.effective_ev_budget_kw
    assert _decision(result, "s1").allocated_power_kw > 0
    assert _decision(result, "s2").allocated_power_kw == 0
    assert _decision(result, "s3").priority_score > _decision(result, "s4").priority_score
    assert _decision(result, "s5").allocated_power_kw <= result.effective_ev_budget_kw


def test_optimize_apply_tick_still_updates_soc_with_vehicle_intelligence() -> None:
    engine = _feedback_engine()
    state_0 = engine.tick(0).system_state
    assert state_0 is not None
    before = state_0.vehicles[0].current_soc

    result = OptimizationEngine().optimize(state_0)
    engine.apply_optimization(result)
    state_1 = engine.tick(60).system_state

    assert state_1 is not None
    assert state_1.vehicles[0].current_soc > before


def _requirement(
    soc: float,
    minimum: float,
    target: float,
    trip: PlannedTrip | None = None,
) :
    vehicle = _vehicle(soc=soc, minimum=minimum)
    session = _session(current_soc=soc, target=target, trip=trip)
    return VehicleReadinessEngine().build_requirement(vehicle, session, _charger())


def _trip(distance: float, return_trip: bool = False, total: float | None = None, departure_hours: float = 4) -> PlannedTrip:
    return PlannedTrip(
        trip_id="trip-1",
        vehicle_id="v1",
        distance_km=distance,
        departure_time=NOW + timedelta(hours=departure_hours),
        return_trip=return_trip,
        total_distance_km=total,
        reserve_soc_percent=20,
        source="DEMO",
    )


def _state(
    building: float = 30,
    solar: float = 10,
    grid_limit: float = 100,
    transformer_limit: float = 120,
    tariff_level: str = "NORMAL",
    vehicles: list[VehicleState] | None = None,
    chargers: list[ChargerState] | None = None,
    sessions: list[SessionState] | None = None,
) -> SystemState:
    vehicles = vehicles or [_vehicle()]
    chargers = chargers or [_charger()]
    sessions = sessions or [_session()]
    vehicles_by_id = {vehicle.vehicle_id: vehicle for vehicle in vehicles}
    chargers_by_id = {charger.charger_id: charger for charger in chargers}
    engine = VehicleReadinessEngine()
    sessions = [
        session.model_copy(
            update={
                "charging_requirement": engine.build_requirement(
                    vehicles_by_id[session.vehicle_id],
                    session,
                    chargers_by_id.get(session.charger_id),
                )
            }
        )
        for session in sessions
    ]
    return SystemState(
        timestamp=NOW,
        site=SiteState(
            site_id="site",
            name="Site",
            grid_import_limit_kw=grid_limit,
            safety_reserve_kw=5,
            transformer_rated_kva=160,
            transformer_operational_limit_kw=transformer_limit,
            solar_peak_kw=35,
        ),
        energy=EnergyState(
            building_load_kw=building,
            solar_generation_kw=solar,
            ev_load_kw=0,
            site_demand_kw=building,
            grid_import_kw=max(0, building - solar),
            solar_export_kw=max(0, solar - building),
        ),
        tariff=TariffState(
            current_level=tariff_level,
            current_price_per_kwh=0.32 if tariff_level == "PEAK" else 0.18,
        ),
        vehicles=vehicles,
        chargers=chargers,
        sessions=sessions,
        telemetry=[],
    )


def _vehicle(
    id: str = "v1",
    soc: float = 40,
    minimum: float = 30,
    max_ac: float = 11,
    usable: float = 60,
    connector_types: list[str] | None = None,
) -> VehicleState:
    return VehicleState(
        vehicle_id=id,
        current_soc=soc,
        connected=True,
        battery_capacity_kwh=60,
        nominal_battery_capacity_kwh=60,
        max_ac_kw=max_ac,
        max_dc_kw=50,
        connector_types=connector_types or ["TYPE2"],
        minimum_readiness_soc=minimum,
        estimated_consumption_kwh_per_km=0.15,
        estimated_soh_percent=usable / 60 * 100,
        soh_source="DEMO",
        usable_capacity_kwh=usable,
        current_battery_acceptance_limit_kw=battery_acceptance_limit_kw(max_ac, soc),
    )


def _charger(
    id: str = "c1",
    vehicle: str = "v1",
    session: str = "s1",
    max_kw: float = 11,
) -> ChargerState:
    return ChargerState(
        charger_id=id,
        charger_type="AC",
        status="CONNECTED",
        connected_vehicle_id=vehicle,
        connected_session_id=session,
        commanded_power_kw=0,
        actual_delivered_power_kw=0,
        max_power_kw=max_kw,
        connector_type="TYPE2",
    )


def _session(
    id: str = "s1",
    vehicle: str = "v1",
    charger: str = "c1",
    current_soc: float = 40,
    target: float = 80,
    mode: str = ChargingMode.FAST.value,
    urgent: bool = False,
    trip: PlannedTrip | None = None,
) -> SessionState:
    return SessionState(
        session_id=id,
        vehicle_id=vehicle,
        charger_id=charger,
        current_soc=current_soc,
        target_soc=target,
        arrival_time=NOW,
        explicit_departure_time=None,
        mode=mode,
        urgent=urgent,
        effective_max_kw=0,
        allocated_kw=0,
        commanded_power_kw=0,
        energy_delivered_kwh=0,
        status="CONNECTED",
        planned_trip=trip,
    )


def _physical_session(session_id: str, vehicle: str, charger: str, target: float) -> ChargingSession:
    return ChargingSession(
        id=session_id,
        vehicle_id=vehicle,
        charger_id=charger,
        target_soc=target,
        arrival_time=NOW,
        charging_mode=ChargingMode.FAST,
        urgent=False,
        effective_max_kw=0,
    )


def _feedback_engine() -> SimulationEngine:
    ev = VirtualEV(
        Vehicle(
            id="v1",
            name="Readiness EV",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=60,
            max_ac_kw=11,
            max_dc_kw=50,
            connector_types=["TYPE2"],
            current_soc=22,
            estimated_range_km=90,
            minimum_readiness_soc=30,
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
    charger.connect(ev, _physical_session("s1", "v1", "c1", 80))
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


def _decision(result, session_id: str):
    for decision in result.decisions:
        if decision.session_id == session_id:
            return decision
    raise AssertionError(session_id)
