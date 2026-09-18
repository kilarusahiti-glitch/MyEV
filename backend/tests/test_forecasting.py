from datetime import UTC, datetime, timedelta

import pytest

from app.alerts import AlertEngine, AlertType
from app.explanations import DecisionExplanationService
from app.forecasting import EnergyHistorySample, EnergyHistoryStore, ForecastConfig, ForecastEngine
from app.forecasting.models import EnergyForecast, ForecastPoint, TariffForecastPoint
from app.models import ChargingMode
from app.optimizer.engine import OptimizationEngine
from app.optimizer.models import ReasonCode
from app.optimizer.validator import DecisionValidator
from app.simulator.tariff import VirtualTariff
from app.state.models import ChargerState, EnergyState, SessionState, SiteState, SystemState, TariffState, VehicleState
from app.vehicle_intelligence.readiness import VehicleReadinessEngine
from app.vehicle_intelligence.readiness import VehicleReadinessEngine


NOW = datetime(2026, 9, 18, 17, 30, tzinfo=UTC)


def test_energy_history_store_records_bounds_recent_and_state_values() -> None:
    store = EnergyHistoryStore(max_samples=3)
    state = _state(building=40, solar=5)
    store.add_state(state)
    store.add(_sample(1, 41, 6))
    store.add(_sample(2, 42, 7))
    store.add(_sample(3, 43, 8))

    assert len(store.get_all()) == 3
    assert store.get_all()[-1].building_load_kw == 43
    assert store.get_recent(limit=2)[0].building_load_kw == 42
    assert store.get_all()[0].building_load_kw != 40


def test_building_forecast_stable_rising_falling_finite_and_horizons() -> None:
    stable = _forecast_for([50, 50, 50, 50], [5, 5, 5, 5])
    rising = _forecast_for([45, 50, 55, 60], [5, 5, 5, 5])
    falling = _forecast_for([60, 55, 50, 45], [5, 5, 5, 5])

    assert stable.building_load[0].predicted_value == pytest.approx(50)
    assert rising.building_load[-1].predicted_value > rising.building_load[0].predicted_value
    assert falling.building_load[-1].predicted_value <= falling.building_load[0].predicted_value
    assert all(point.predicted_value >= 0 for point in rising.building_load)
    assert {point.horizon_minutes for point in rising.building_load} == {15, 30, 60}


def test_solar_forecast_trend_nonnegative_and_night_zero() -> None:
    rising = _forecast_for([50, 50, 50, 50], [0, 3, 6, 9])
    night = _forecast_for([50, 50, 50, 50], [0, 0, 0, 0], solar_current=0)

    assert rising.solar_generation[-1].predicted_value > rising.solar_generation[0].predicted_value
    assert all(point.predicted_value >= 0 for point in rising.solar_generation)
    assert all(point.predicted_value == 0 for point in night.solar_generation)


def test_tariff_forecast_schedule_lookup_across_boundary() -> None:
    forecast = _forecast_for(
        [50, 50, 50, 50],
        [5, 5, 5, 5],
        timestamp=datetime(2026, 9, 18, 17, 45, tzinfo=UTC),
    )

    tariffs = {point.horizon_minutes: point.tariff_state for point in forecast.tariff}

    assert tariffs[15] == "PEAK"
    assert tariffs[30] == "PEAK"
    assert all(point.confidence == 1 for point in forecast.tariff)


def test_forecast_confidence_cold_stable_horizon_and_bounds() -> None:
    cold = _forecast_for([50], [5])
    stable = _forecast_for([50, 50, 50, 50, 50, 50, 50, 50], [5] * 8)

    assert cold.confidence < stable.confidence
    assert stable.building_load[-1].confidence <= stable.building_load[0].confidence
    assert all(0 <= point.confidence <= 1 for point in stable.building_load + stable.solar_generation)


def test_optimizer_works_without_forecast_and_validator_accepts() -> None:
    state = _state()
    result = OptimizationEngine().optimize(state, forecast=None)

    DecisionValidator().validate(state, result)
    assert result.valid is True


def test_flexible_cheapest_defers_for_expected_lower_tariff_but_readiness_does_not() -> None:
    forecast = _manual_forecast(tariffs=["NORMAL", "LOW", "LOW"])
    flexible = _state(
        vehicle=_vehicle(soc=65, minimum=30),
        session=_session(current_soc=65, mode=ChargingMode.CHEAPEST.value),
    )
    required = _state(
        vehicle=_vehicle(soc=25, minimum=30),
        session=_session(current_soc=25, mode=ChargingMode.CHEAPEST.value),
    )

    flexible_result = OptimizationEngine().optimize(flexible, forecast=forecast)
    required_result = OptimizationEngine().optimize(required, forecast=forecast)

    assert flexible_result.decisions[0].allocated_power_kw == 0
    assert ReasonCode.DEFERRED_FOR_EXPECTED_LOW_TARIFF in flexible_result.decisions[0].reason_codes
    assert required_result.decisions[0].allocated_power_kw > 0


def test_deadline_and_urgent_not_deferred_by_forecast() -> None:
    forecast = _manual_forecast(peak_risk=0.9, tariffs=["LOW", "LOW", "LOW"])
    deadline_state = _state(
        session=_session(
            departure=NOW + timedelta(hours=1),
            mode=ChargingMode.CHEAPEST.value,
        )
    )
    urgent_state = _state(session=_session(urgent=True, mode=ChargingMode.GREENEST.value))

    deadline = OptimizationEngine().optimize(deadline_state, forecast=forecast)
    urgent = OptimizationEngine().optimize(urgent_state, forecast=forecast)

    assert deadline.decisions[0].allocated_power_kw > 0
    assert urgent.decisions[0].allocated_power_kw > 0


def test_greenest_flexible_defers_for_expected_solar_and_limits_hold() -> None:
    forecast = _manual_forecast(solar_opportunity=0.9)
    state = _state(
        vehicle=_vehicle(soc=65, minimum=30),
        session=_session(current_soc=65, mode=ChargingMode.GREENEST.value),
    )

    result = OptimizationEngine().optimize(state, forecast=forecast)

    assert result.decisions[0].allocated_power_kw == 0
    assert ReasonCode.DEFERRED_FOR_EXPECTED_SOLAR in result.decisions[0].reason_codes
    assert result.total_allocated_kw <= result.effective_ev_budget_kw
    assert result.decisions[0].allocated_power_kw <= result.decisions[0].effective_max_kw


def test_forecast_explanation_only_when_forecast_affects_decision() -> None:
    state = _state(
        vehicle=_vehicle(soc=65, minimum=30),
        session=_session(current_soc=65, mode=ChargingMode.GREENEST.value),
    )
    no_forecast = OptimizationEngine().optimize(state)
    with_forecast = OptimizationEngine().optimize(state, forecast=_manual_forecast(solar_opportunity=0.9))

    service = DecisionExplanationService()
    no_text = service.explain(no_forecast, state)[0].headline
    forecast_text = service.explain(with_forecast, state)[0].headline

    assert "expected" not in no_text.lower()
    assert "expected" in forecast_text.lower() or "forecast" in forecast_text.lower()


def test_forecast_alerts_high_confidence_dedup_and_low_confidence_suppressed() -> None:
    state = _state()
    result = OptimizationEngine().optimize(state)
    alerts = AlertEngine()
    high = _manual_forecast(peak_risk=0.9, confidence=0.9)
    low = _manual_forecast(peak_risk=0.9, confidence=0.2)

    emitted = alerts.evaluate(state, result, forecast=high)
    repeated = alerts.evaluate(state, result, forecast=high)
    low_engine = AlertEngine()
    suppressed = low_engine.evaluate(state, result, forecast=low)

    assert AlertType.FORECAST_BUILDING_PEAK in {alert.type for alert in emitted}
    assert not [alert for alert in repeated if alert.type == AlertType.FORECAST_BUILDING_PEAK and alert.active]
    assert AlertType.FORECAST_BUILDING_PEAK not in {alert.type for alert in suppressed}


def _forecast_for(
    building_values: list[float],
    solar_values: list[float],
    timestamp: datetime = NOW,
    solar_current: float | None = None,
) -> EnergyForecast:
    store = EnergyHistoryStore()
    start = timestamp - timedelta(minutes=15 * (len(building_values) - 1))
    for index, (building, solar) in enumerate(zip(building_values, solar_values, strict=True)):
        store.add(
            EnergyHistorySample(
                timestamp=start + timedelta(minutes=15 * index),
                building_load_kw=building,
                solar_generation_kw=solar,
                grid_import_kw=max(0, building - solar),
                ev_load_kw=0,
                tariff_state="NORMAL",
            )
        )
    state = _state(building=building_values[-1], solar=solar_current if solar_current is not None else solar_values[-1], timestamp=timestamp)
    forecast = ForecastEngine(store, tariff=VirtualTariff()).forecast(state)
    assert forecast is not None
    return forecast


def _manual_forecast(
    peak_risk: float = 0.0,
    solar_opportunity: float = 0.0,
    confidence: float = 0.9,
    tariffs: list[str] | None = None,
) -> EnergyForecast:
    tariffs = tariffs or ["NORMAL", "NORMAL", "NORMAL"]
    return EnergyForecast(
        timestamp=NOW,
        building_load=[
            ForecastPoint(horizon_minutes=15, predicted_value=50, confidence=confidence),
            ForecastPoint(horizon_minutes=30, predicted_value=50, confidence=confidence),
            ForecastPoint(horizon_minutes=60, predicted_value=50, confidence=confidence),
        ],
        solar_generation=[
            ForecastPoint(horizon_minutes=15, predicted_value=5, confidence=confidence),
            ForecastPoint(horizon_minutes=30, predicted_value=10, confidence=confidence),
            ForecastPoint(horizon_minutes=60, predicted_value=12, confidence=confidence),
        ],
        tariff=[
            TariffForecastPoint(horizon_minutes=15, tariff_state=tariffs[0], confidence=1),
            TariffForecastPoint(horizon_minutes=30, tariff_state=tariffs[1], confidence=1),
            TariffForecastPoint(horizon_minutes=60, tariff_state=tariffs[2], confidence=1),
        ],
        peak_risk=peak_risk,
        solar_opportunity=solar_opportunity,
        confidence=confidence,
    )


def _state(
    building: float = 40,
    solar: float = 5,
    timestamp: datetime = NOW,
    vehicle: VehicleState | None = None,
    session: SessionState | None = None,
) -> SystemState:
    vehicle = vehicle or _vehicle()
    charger = _charger()
    session = session or _session()
    requirement = VehicleReadinessEngine().build_requirement(vehicle, session, charger)
    session = session.model_copy(update={"charging_requirement": requirement})
    return SystemState(
        timestamp=timestamp,
        site=SiteState(
            site_id="site",
            name="Forecast Site",
            grid_import_limit_kw=100,
            safety_reserve_kw=5,
            transformer_rated_kva=160,
            transformer_operational_limit_kw=120,
            solar_peak_kw=30,
        ),
        energy=EnergyState(
            building_load_kw=building,
            solar_generation_kw=solar,
            ev_load_kw=0,
            site_demand_kw=building,
            grid_import_kw=max(0, building - solar),
            solar_export_kw=max(0, solar - building),
        ),
        tariff=TariffState(current_level="NORMAL", current_price_per_kwh=0.18),
        vehicles=[vehicle],
        chargers=[charger],
        sessions=[session],
        telemetry=[],
    )


def _vehicle(soc: float = 65, minimum: float = 30) -> VehicleState:
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
        estimated_soh_percent=100,
        soh_source="DEMO",
        usable_capacity_kwh=60,
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
    current_soc: float = 65,
    mode: str = ChargingMode.FAST.value,
    urgent: bool = False,
    departure: datetime | None = None,
) -> SessionState:
    return SessionState(
        session_id="s1",
        vehicle_id="v1",
        charger_id="c1",
        current_soc=current_soc,
        target_soc=85,
        arrival_time=NOW,
        explicit_departure_time=departure,
        mode=mode,
        urgent=urgent,
        effective_max_kw=0,
        allocated_kw=0,
        commanded_power_kw=0,
        energy_delivered_kwh=0,
        status="CONNECTED",
    )


def _sample(offset: int, building: float, solar: float) -> EnergyHistorySample:
    return EnergyHistorySample(
        timestamp=NOW + timedelta(minutes=offset),
        building_load_kw=building,
        solar_generation_kw=solar,
        grid_import_kw=max(0, building - solar),
        ev_load_kw=0,
        tariff_state="NORMAL",
    )
