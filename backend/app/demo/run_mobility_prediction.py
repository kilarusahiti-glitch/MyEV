from datetime import UTC, date, datetime, timedelta

from app.mobility.history import VehicleUsageHistoryStore
from app.mobility.predictor import MobilityPredictor
from app.mobility.synthetic import populate_synthetic_demo_history
from app.models import ChargingMode
from app.optimizer.engine import OptimizationEngine
from app.state.models import (
    ChargerState,
    EnergyState,
    SessionState,
    SiteState,
    SystemState,
    TariffState,
    VehicleState,
)
from app.vehicle_intelligence import PlannedTrip
from app.vehicle_intelligence.readiness import VehicleReadinessEngine


NOW = datetime(2026, 9, 21, 6, 20, tzinfo=UTC)


def main() -> None:
    store = VehicleUsageHistoryStore()
    populate_synthetic_demo_history(store, start_date=date(2026, 8, 1), days=52)
    predictor = MobilityPredictor(store)

    predictable_vehicle = _vehicle("EV-01", soc=38, soh=90)
    irregular_vehicle = _vehicle("EV-03", soc=45, soh=100)
    predictable = predictor.predict("EV-01", NOW, predictable_vehicle)
    irregular = predictor.predict("EV-03", NOW, irregular_vehicle)

    assert predictable is not None
    assert irregular is not None

    print("PREDICTABLE VEHICLE EV-01")
    print(f"History: {len(store.get_records('EV-01'))} records")
    _print_prediction(predictable, predictable_vehicle)

    print("\nIRREGULAR VEHICLE EV-03")
    print(f"History: {len(store.get_records('EV-03'))} records")
    _print_prediction(irregular, irregular_vehicle)

    state = _state(
        vehicles=[predictable_vehicle, irregular_vehicle],
        sessions=[
            _session("S-01", "EV-01", "CH-01", predictable_vehicle.current_soc, prediction=predictable),
            _session("S-03", "EV-03", "CH-03", irregular_vehicle.current_soc, prediction=irregular),
        ],
        chargers=[
            _charger("CH-01", "EV-01", "S-01"),
            _charger("CH-03", "EV-03", "S-03"),
        ],
    )
    result = OptimizationEngine().optimize(state)
    print("\nOPTIMIZER WITH PREDICTIONS")
    for decision in result.decisions:
        reasons = ",".join(code.value for code in decision.reason_codes)
        print(
            f"{decision.vehicle_id}: {decision.allocated_power_kw:.2f} kW "
            f"priority={decision.priority_score:.3f} reasons={reasons}"
        )

    explicit_trip_session = _session(
        "S-override",
        "EV-01",
        "CH-01",
        predictable_vehicle.current_soc,
        prediction=predictable,
        trip=PlannedTrip(
            trip_id="USER-TRIP",
            vehicle_id="EV-01",
            distance_km=220,
            departure_time=NOW + timedelta(minutes=25),
            reserve_soc_percent=20,
            source="USER_EXPLICIT",
        ),
    )
    override_requirement = VehicleReadinessEngine().build_requirement(
        predictable_vehicle,
        explicit_trip_session,
        _charger("CH-01", "EV-01", "S-override"),
    )
    print("\nEXPLICIT OVERRIDE")
    print(
        f"prediction deadline={predictable.readiness.planning_deadline.time()} "
        f"recommended={predictable.readiness.recommended_soc:.1f}%"
    )
    print(
        f"explicit trip deadline={explicit_trip_session.planned_trip.departure_time.time()} "
        f"active_source={override_requirement.requirement_source.value}"
    )


def _print_prediction(prediction, vehicle: VehicleState) -> None:
    departure = prediction.departure_prediction
    energy = prediction.energy_prediction
    readiness = prediction.readiness
    print(f"Likely departure: {departure.most_likely_departure.strftime('%H:%M')}")
    print(
        "Likely window: "
        f"{departure.window_start.strftime('%H:%M')}-{departure.window_end.strftime('%H:%M')}"
    )
    print(f"Probability in window: {departure.probability_within_window:.2f}")
    print(f"Expected energy: {energy.expected_energy_kwh:.1f} kWh")
    print(f"Safe energy requirement: {energy.safe_energy_requirement_kwh:.1f} kWh")
    print(f"Current usable capacity: {vehicle.usable_capacity_kwh:.1f} kWh")
    print(f"Minimum readiness: {vehicle.minimum_readiness_soc:.0f}%")
    print(f"Predicted recommended SOC: {readiness.recommended_soc:.1f}%")
    print(f"Confidence: {prediction.confidence:.2f}")
    print(f"Readiness risk: {readiness.readiness_risk:.2f}")


def _state(
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
        timestamp=NOW,
        site=SiteState(
            site_id="mobility-demo",
            name="Mobility Demo",
            grid_import_limit_kw=100,
            safety_reserve_kw=5,
            transformer_rated_kva=160,
            transformer_operational_limit_kw=120,
            solar_peak_kw=10,
        ),
        energy=EnergyState(
            building_load_kw=65,
            solar_generation_kw=10,
            ev_load_kw=0,
            site_demand_kw=65,
            grid_import_kw=55,
            solar_export_kw=0,
        ),
        tariff=TariffState(current_level="NORMAL", current_price_per_kwh=0.18),
        vehicles=vehicles,
        chargers=chargers,
        sessions=sessions,
        telemetry=[],
    )


def _vehicle(vehicle_id: str, soc: float, soh: float) -> VehicleState:
    usable = 60 * soh / 100
    return VehicleState(
        vehicle_id=vehicle_id,
        current_soc=soc,
        connected=True,
        battery_capacity_kwh=60,
        nominal_battery_capacity_kwh=60,
        max_ac_kw=11,
        max_dc_kw=50,
        connector_types=["TYPE2"],
        minimum_readiness_soc=30,
        estimated_consumption_kwh_per_km=0.15,
        estimated_soh_percent=soh,
        soh_source="DEMO",
        usable_capacity_kwh=usable,
        current_battery_acceptance_limit_kw=11,
    )


def _session(
    session_id: str,
    vehicle_id: str,
    charger_id: str,
    current_soc: float,
    prediction=None,
    trip: PlannedTrip | None = None,
) -> SessionState:
    return SessionState(
        session_id=session_id,
        vehicle_id=vehicle_id,
        charger_id=charger_id,
        current_soc=current_soc,
        target_soc=85,
        arrival_time=NOW,
        explicit_departure_time=None,
        mode=ChargingMode.FAST.value,
        urgent=False,
        effective_max_kw=0,
        allocated_kw=0,
        commanded_power_kw=0,
        energy_delivered_kwh=0,
        status="CONNECTED",
        planned_trip=trip,
        mobility_prediction=prediction,
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


if __name__ == "__main__":
    main()
