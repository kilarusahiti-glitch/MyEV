from datetime import UTC, datetime, timedelta

from app.explanations import DecisionExplanationService
from app.forecasting import EnergyHistorySample, EnergyHistoryStore, ForecastEngine
from app.models import ChargingMode
from app.optimizer.engine import OptimizationEngine
from app.simulator.tariff import VirtualTariff
from app.state.models import ChargerState, EnergyState, SessionState, SiteState, SystemState, TariffState, VehicleState
from app.vehicle_intelligence.readiness import VehicleReadinessEngine


def main() -> None:
    print("FORECASTING DEMO")
    peak_state, peak_forecast = _build_peak_and_tariff_case()
    _print_forecast("PEAK / LOWER TARIFF CASE", peak_state, peak_forecast)
    _print_allocations(peak_state, peak_forecast)

    solar_state, solar_forecast = _build_solar_case()
    _print_forecast("SOLAR INCREASE CASE", solar_state, solar_forecast)
    _print_allocations(solar_state, solar_forecast)


def _print_forecast(title: str, state: SystemState, forecast) -> None:
    print(f"\n{title}")
    print(
        f"CURRENT: Building={state.energy.building_load_kw:.1f} kW "
        f"Solar={state.energy.solar_generation_kw:.1f} kW "
        f"Tariff={state.tariff.current_level}"
    )
    print("FORECAST:")
    for building, solar, tariff in zip(
        forecast.building_load,
        forecast.solar_generation,
        forecast.tariff,
        strict=True,
    ):
        print(
            f"  {building.horizon_minutes}m: "
            f"building={building.predicted_value:.1f} kW "
            f"solar={solar.predicted_value:.1f} kW "
            f"tariff={tariff.tariff_state}"
        )
    print(
        f"Peak risk={forecast.peak_risk:.2f} "
        f"Solar opportunity={forecast.solar_opportunity:.2f} "
        f"Confidence={forecast.confidence:.2f}"
    )


def _print_allocations(state: SystemState, forecast) -> None:
    optimizer = OptimizationEngine()
    result = optimizer.optimize(state, forecast=forecast)
    explanations = DecisionExplanationService().explain(result, state)
    print("ALLOCATIONS:")
    for decision in result.decisions:
        explanation = next(item for item in explanations if item.session_id == decision.session_id)
        reasons = ",".join(code.value for code in decision.reason_codes)
        print(
            f"  {decision.vehicle_id}: {decision.allocated_power_kw:.1f} kW "
            f"| {explanation.headline} | {reasons}"
        )


def _build_peak_and_tariff_case():
    timestamp = datetime(2026, 9, 18, 23, 30, tzinfo=UTC)
    state = _state(
        timestamp=timestamp,
        building=58,
        solar=0,
        tariff="NORMAL",
        vehicles=[
            _vehicle("EV-A", 65, 30),
            _vehicle("EV-B", 25, 30),
        ],
        sessions=[
            _session("S-A", "EV-A", "CH-A", 65, ChargingMode.CHEAPEST.value),
            _session("S-B", "EV-B", "CH-B", 25, ChargingMode.CHEAPEST.value),
        ],
        chargers=[
            _charger("CH-A", "EV-A", "S-A"),
            _charger("CH-B", "EV-B", "S-B"),
        ],
    )
    history = EnergyHistoryStore()
    building_values = [44, 46, 48, 50, 52, 54, 56, 58]
    for index, building in enumerate(building_values):
        history.add(_sample(timestamp - timedelta(minutes=(len(building_values) - 1 - index) * 15), building, 0, "NORMAL"))
    forecast = ForecastEngine(history, tariff=VirtualTariff()).forecast(state)
    assert forecast is not None
    return state, forecast


def _build_solar_case():
    timestamp = datetime(2026, 9, 18, 7, 0, tzinfo=UTC)
    state = _state(
        timestamp=timestamp,
        building=45,
        solar=14,
        tariff="NORMAL",
        vehicles=[
            _vehicle("EV-C", 62, 30),
            _vehicle("EV-D", 24, 30),
        ],
        sessions=[
            _session("S-C", "EV-C", "CH-C", 62, ChargingMode.GREENEST.value),
            _session("S-D", "EV-D", "CH-D", 24, ChargingMode.GREENEST.value),
        ],
        chargers=[
            _charger("CH-C", "EV-C", "S-C"),
            _charger("CH-D", "EV-D", "S-D"),
        ],
    )
    history = EnergyHistoryStore()
    solar_values = [0, 2, 4, 6, 8, 10, 12, 14]
    for index, solar in enumerate(solar_values):
        history.add(_sample(timestamp - timedelta(minutes=(len(solar_values) - 1 - index) * 15), 45, solar, "NORMAL"))
    forecast = ForecastEngine(history, tariff=VirtualTariff()).forecast(state)
    assert forecast is not None
    return state, forecast


def _state(
    timestamp: datetime,
    building: float,
    solar: float,
    tariff: str,
    vehicles: list[VehicleState],
    sessions: list[SessionState],
    chargers: list[ChargerState],
) -> SystemState:
    vehicles_by_id = {vehicle.vehicle_id: vehicle for vehicle in vehicles}
    chargers_by_id = {charger.charger_id: charger for charger in chargers}
    readiness = VehicleReadinessEngine()
    sessions = [
        session.model_copy(
            update={
                "charging_requirement": readiness.build_requirement(
                    vehicles_by_id[session.vehicle_id],
                    session,
                    chargers_by_id[session.charger_id],
                )
            }
        )
        for session in sessions
    ]
    return SystemState(
        timestamp=timestamp,
        site=SiteState(
            site_id="forecast-demo",
            name="Forecast Demo",
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
        tariff=TariffState(current_level=tariff, current_price_per_kwh=0.18),
        vehicles=vehicles,
        chargers=chargers,
        sessions=sessions,
        telemetry=[],
    )


def _vehicle(vehicle_id: str, soc: float, minimum: float) -> VehicleState:
    return VehicleState(
        vehicle_id=vehicle_id,
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


def _charger(charger_id: str, vehicle_id: str, session_id: str) -> ChargerState:
    return ChargerState(
        charger_id=charger_id,
        charger_type="AC",
        status="CONNECTED",
        connected_vehicle_id=vehicle_id,
        connected_session_id=session_id,
        commanded_power_kw=0,
        actual_delivered_power_kw=0,
        max_power_kw=11,
        connector_type="TYPE2",
    )


def _session(
    session_id: str,
    vehicle_id: str,
    charger_id: str,
    current_soc: float,
    mode: str,
) -> SessionState:
    return SessionState(
        session_id=session_id,
        vehicle_id=vehicle_id,
        charger_id=charger_id,
        current_soc=current_soc,
        target_soc=85,
        arrival_time=datetime(2026, 9, 18, tzinfo=UTC),
        explicit_departure_time=None,
        mode=mode,
        urgent=False,
        effective_max_kw=0,
        allocated_kw=0,
        commanded_power_kw=0,
        energy_delivered_kwh=0,
        status="CONNECTED",
    )


def _sample(timestamp: datetime, building: float, solar: float, tariff: str) -> EnergyHistorySample:
    return EnergyHistorySample(
        timestamp=timestamp,
        building_load_kw=building,
        solar_generation_kw=solar,
        grid_import_kw=max(0, building - solar),
        ev_load_kw=0,
        tariff_state=tariff,
    )


if __name__ == "__main__":
    main()
