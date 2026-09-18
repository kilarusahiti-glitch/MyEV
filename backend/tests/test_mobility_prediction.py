from datetime import UTC, date, datetime, time, timedelta

import pytest

from app.mobility import MobilityPredictor, MobilityPredictorConfig, VehicleUsageHistoryStore
from app.mobility.models import VehicleUsageRecord
from app.mobility.synthetic import generate_synthetic_history
from app.models import ChargingMode
from app.optimizer.engine import OptimizationEngine
from app.optimizer.models import ReasonCode
from app.state.models import ChargerState, EnergyState, SessionState, SiteState, SystemState, TariffState, VehicleState
from app.vehicle_intelligence import PlannedTrip, RequirementSource, VehicleReadinessEngine


NOW = datetime(2026, 9, 21, 6, 0, tzinfo=UTC)  # Monday


def test_history_store_add_get_recent_and_vehicle_isolation() -> None:
    store = VehicleUsageHistoryStore()
    first = _record("v1", date(2026, 9, 1), time(7, 40), 12)
    second = _record("v2", date(2026, 9, 2), time(9, 15), 8)
    store.add(first)
    store.add(second)

    assert store.get_records("v1") == [first]
    assert store.get_records("v2") == [second]
    assert store.get_recent_records("v1", since=date(2026, 9, 1)) == [first]


def test_synthetic_history_is_deterministic() -> None:
    a = generate_synthetic_history("EV-01", date(2026, 8, 1), seed=123)
    b = generate_synthetic_history("EV-01", date(2026, 8, 1), seed=123)

    assert a == b
    assert 30 <= len(a) <= 60


def test_context_weekday_weekend_and_fallback_behavior() -> None:
    store = VehicleUsageHistoryStore()
    monday = _record("v1", date(2026, 9, 14), time(7, 30), 12)
    tuesday = _record("v1", date(2026, 9, 15), time(9, 30), 8)
    saturday = _record("v1", date(2026, 9, 19), time(11, 0), 5)
    for record in [monday, tuesday, saturday]:
        store.add(record)
    predictor = MobilityPredictor(store)

    weighted = predictor._weighted_records(store.get_records("v1"), NOW)
    weights = {record.departure_time: weight for record, weight in weighted}

    assert weights[time(7, 30)] > weights[time(9, 30)]
    assert weights[time(7, 30)] > weights[time(11, 0)]
    assert predictor.predict("v1", NOW, _vehicle()) is not None


def test_outlier_departure_does_not_move_routine_and_record_is_preserved() -> None:
    store = VehicleUsageHistoryStore()
    for day in range(20):
        store.add(_record("v1", date(2026, 8, 31) + timedelta(days=day), time(7, 40), 12))
    store.add(_record("v1", date(2026, 9, 20), time(11, 30), 12))

    prediction = MobilityPredictor(store).predict("v1", NOW, _vehicle())

    assert prediction is not None
    assert prediction.departure_prediction.most_likely_departure.hour == 7
    assert len(store.get_records("v1")) == 21


def test_mad_zero_is_safe_and_energy_outlier_does_not_dominate() -> None:
    store = VehicleUsageHistoryStore()
    for day in range(10):
        store.add(_record("v1", date(2026, 9, 1) + timedelta(days=day), time(7, 40), 10))
    store.add(_record("v1", date(2026, 9, 11), time(7, 40), 80))

    prediction = MobilityPredictor(store).predict("v1", NOW, _vehicle())

    assert prediction is not None
    assert prediction.energy_prediction.safe_energy_requirement_kwh < 80


def test_patterns_find_clusters_and_not_arithmetic_mean_between_them() -> None:
    store = VehicleUsageHistoryStore()
    for day in range(21):
        store.add(_record("v1", date(2026, 8, 31) + timedelta(days=day), time(7, 40), 12))
    for day in range(8):
        store.add(_record("v1", date(2026, 8, 31) + timedelta(days=day), time(10, 30), 9))

    prediction = MobilityPredictor(store).predict("v1", NOW, _vehicle())

    assert prediction is not None
    assert len(prediction.departure_prediction.patterns) >= 2
    assert prediction.departure_prediction.most_likely_departure.hour == 7
    assert 0 <= prediction.departure_prediction.dominant_pattern_probability <= 1


def test_recency_can_shift_prediction_and_is_deterministic() -> None:
    store = VehicleUsageHistoryStore()
    for day in range(20):
        store.add(_record("v1", date(2026, 7, 1) + timedelta(days=day), time(7, 30), 12))
    for day in range(10):
        store.add(_record("v1", date(2026, 9, 10) + timedelta(days=day), time(8, 30), 12))

    predictor = MobilityPredictor(store, MobilityPredictorConfig(recency_lambda=0.12))
    first = predictor.predict("v1", NOW, _vehicle())
    second = predictor.predict("v1", NOW, _vehicle())

    assert first == second
    assert first is not None
    assert first.departure_prediction.most_likely_departure.hour == 8


def test_departure_buckets_probability_and_conservative_deadline() -> None:
    store = _routine_store()
    prediction = MobilityPredictor(store).predict("v1", NOW, _vehicle())

    assert prediction is not None
    probabilities = [bucket.probability for bucket in prediction.departure_prediction.probability_buckets]
    assert probabilities
    assert sum(probabilities) == pytest.approx(1.0)
    assert prediction.departure_prediction.planning_deadline.time() <= prediction.departure_prediction.most_likely_departure


def test_energy_prediction_and_soh_affect_required_soc() -> None:
    store = _routine_store()
    healthy = MobilityPredictor(store).predict("v1", NOW, _vehicle(usable=60))
    degraded = MobilityPredictor(store).predict("v1", NOW, _vehicle(usable=48))

    assert healthy is not None and degraded is not None
    assert healthy.energy_prediction.expected_energy_kwh > 0
    assert healthy.energy_prediction.safe_energy_requirement_kwh >= healthy.energy_prediction.expected_energy_kwh
    assert degraded.readiness.predicted_required_soc > healthy.readiness.predicted_required_soc


def test_confidence_cold_start_tiny_consistent_and_irregular() -> None:
    empty = MobilityPredictor(VehicleUsageHistoryStore()).predict("v1", NOW, _vehicle())
    tiny_store = VehicleUsageHistoryStore()
    tiny_store.add(_record("v1", date(2026, 9, 20), time(7, 30), 12))
    consistent = _routine_store()
    irregular = VehicleUsageHistoryStore()
    for index, hour in enumerate([6, 8, 11, 15, 20, 7, 13, 22]):
        irregular.add(_record("v1", date(2026, 9, 1) + timedelta(days=index), time(hour, 0), 5 + index))

    tiny = MobilityPredictor(tiny_store).predict("v1", NOW, _vehicle())
    strong = MobilityPredictor(consistent).predict("v1", NOW, _vehicle())
    weak = MobilityPredictor(irregular).predict("v1", NOW, _vehicle())

    assert empty is None
    assert tiny is not None and tiny.confidence < 0.4
    assert strong is not None and strong.confidence > tiny.confidence
    assert weak is not None and weak.confidence < strong.confidence
    assert 0 <= strong.confidence <= 1


def test_authority_explicit_trip_departure_urgent_and_minimum_override_prediction() -> None:
    prediction = MobilityPredictor(_routine_store()).predict("v1", NOW, _vehicle(soc=38))
    assert prediction is not None

    explicit_trip = _session(prediction=prediction, trip=_trip(required_vehicle="v1"))
    explicit_departure = _session(prediction=prediction, departure=NOW + timedelta(hours=1), target=85)
    urgent = _session(prediction=prediction, urgent=True, target=85)
    low_confidence = prediction.model_copy(update={"confidence": 0.2})
    low_conf_session = _session(prediction=low_confidence)

    vehicle = _vehicle(soc=38, minimum=30)
    engine = VehicleReadinessEngine()

    assert engine.build_requirement(vehicle, explicit_trip, _charger()).requirement_source == RequirementSource.TRIP
    assert engine.build_requirement(vehicle, explicit_departure, _charger()).requirement_source == RequirementSource.EXPLICIT_DEPARTURE_TARGET
    assert engine.build_requirement(vehicle, urgent, _charger()).requirement_source == RequirementSource.URGENT
    assert engine.build_requirement(vehicle, low_conf_session, _charger()).requirement_source in {RequirementSource.NONE, RequirementSource.MINIMUM_READINESS}


def test_prediction_raises_priority_smoothly_and_respects_constraints() -> None:
    store = _routine_store()
    predictor = MobilityPredictor(store)
    far_prediction = predictor.predict("v1", datetime(2026, 9, 21, 1, 0, tzinfo=UTC), _vehicle(soc=35))
    near_prediction = predictor.predict("v1", datetime(2026, 9, 21, 7, 0, tzinfo=UTC), _vehicle(soc=35))
    assert far_prediction is not None and near_prediction is not None

    far_state = _state(_session(prediction=far_prediction, current_soc=35), timestamp=datetime(2026, 9, 21, 1, 0, tzinfo=UTC), soc=35)
    near_state = _state(_session(prediction=near_prediction, current_soc=35), timestamp=datetime(2026, 9, 21, 7, 0, tzinfo=UTC), soc=35)
    far_result = OptimizationEngine().optimize(far_state)
    near_result = OptimizationEngine().optimize(near_state)

    assert near_result.decisions[0].priority_score >= far_result.decisions[0].priority_score
    assert ReasonCode.PREDICTED_USAGE in near_result.decisions[0].reason_codes
    assert near_result.total_allocated_kw <= near_result.effective_ev_budget_kw
    assert near_result.decisions[0].allocated_power_kw <= near_result.decisions[0].effective_max_kw


def _routine_store() -> VehicleUsageHistoryStore:
    store = VehicleUsageHistoryStore()
    for day in range(30):
        current = date(2026, 8, 17) + timedelta(days=day)
        if current.weekday() < 5:
            minute = 35 + (day % 5)
            store.add(_record("v1", current, time(7, minute), 12 + (day % 4)))
    return store


def _record(vehicle_id: str, record_date: date, departure: time, energy: float) -> VehicleUsageRecord:
    return VehicleUsageRecord(
        vehicle_id=vehicle_id,
        date=record_date,
        departure_time=departure,
        return_time=time(18, 0),
        departure_soc=80,
        return_soc=60,
        energy_used_kwh=energy,
        day_of_week=record_date.weekday(),
        trip_distance_km=energy / 0.15,
        source="DEMO",
    )


def _vehicle(soc: float = 40, minimum: float = 30, usable: float = 60) -> VehicleState:
    return VehicleState(
        vehicle_id="v1",
        current_soc=soc,
        connected=True,
        battery_capacity_kwh=60,
        nominal_battery_capacity_kwh=60,
        max_ac_kw=11,
        max_dc_kw=50,
        connector_types=["TYPE2"],
        minimum_readiness_soc=minimum,
        estimated_consumption_kwh_per_km=0.15,
        estimated_soh_percent=usable / 60 * 100,
        soh_source="DEMO",
        usable_capacity_kwh=usable,
        current_battery_acceptance_limit_kw=11,
    )


def _charger() -> ChargerState:
    return ChargerState(
        charger_id="c1",
        charger_type="AC",
        status="CONNECTED",
        connected_vehicle_id="v1",
        connected_session_id="s1",
        commanded_power_kw=0,
        actual_delivered_power_kw=0,
        max_power_kw=11,
        connector_type="TYPE2",
    )


def _session(
    prediction=None,
    trip: PlannedTrip | None = None,
    departure: datetime | None = None,
    target: float = 80,
    urgent: bool = False,
    current_soc: float = 40,
) -> SessionState:
    return SessionState(
        session_id="s1",
        vehicle_id="v1",
        charger_id="c1",
        current_soc=current_soc,
        target_soc=target,
        arrival_time=NOW,
        explicit_departure_time=departure,
        mode=ChargingMode.FAST.value,
        urgent=urgent,
        effective_max_kw=0,
        allocated_kw=0,
        commanded_power_kw=0,
        energy_delivered_kwh=0,
        status="CONNECTED",
        planned_trip=trip,
        mobility_prediction=prediction,
    )


def _trip(required_vehicle: str) -> PlannedTrip:
    return PlannedTrip(
        trip_id="trip",
        vehicle_id=required_vehicle,
        distance_km=180,
        departure_time=NOW + timedelta(minutes=45),
        reserve_soc_percent=20,
        source="DEMO",
    )


def _state(session: SessionState, timestamp: datetime = NOW, soc: float = 40) -> SystemState:
    vehicle = _vehicle(soc=soc)
    charger = _charger()
    requirement = VehicleReadinessEngine().build_requirement(vehicle, session, charger)
    session = session.model_copy(update={"charging_requirement": requirement})
    return SystemState(
        timestamp=timestamp,
        site=SiteState(
            site_id="site",
            name="Site",
            grid_import_limit_kw=100,
            safety_reserve_kw=5,
            transformer_rated_kva=160,
            transformer_operational_limit_kw=120,
            solar_peak_kw=10,
        ),
        energy=EnergyState(
            building_load_kw=50,
            solar_generation_kw=0,
            ev_load_kw=0,
            site_demand_kw=50,
            grid_import_kw=50,
            solar_export_kw=0,
        ),
        tariff=TariffState(current_level="NORMAL", current_price_per_kwh=0.18),
        vehicles=[vehicle],
        chargers=[charger],
        sessions=[session],
        telemetry=[],
    )
