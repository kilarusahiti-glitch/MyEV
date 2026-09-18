from datetime import UTC, datetime, timedelta

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
from app.vehicle_intelligence import (
    PlannedTrip,
    VehicleReadinessEngine,
    battery_acceptance_limit_kw,
)
from app.vehicle_intelligence.trip import buffered_trip_energy_kwh


NOW = datetime(2026, 9, 18, 18, 0, tzinfo=UTC)


def main() -> None:
    vehicles = [
        _vehicle("EV-01", soc=22, soh=100, minimum=30),
        _vehicle("EV-02", soc=60, soh=100, minimum=30),
        _vehicle("EV-03", soc=42, soh=100, minimum=30),
        _vehicle("EV-04", soc=70, soh=100, minimum=30),
        _vehicle("EV-05", soc=42, soh=80, minimum=30),
        _vehicle("EV-06", soc=92, soh=100, minimum=30, max_ac=11),
    ]
    trips = {
        "EV-03": _trip("TRIP-03", "EV-03", distance=110, departure_hours=1.5),
        "EV-04": _trip("TRIP-04", "EV-04", distance=80, departure_hours=1.5),
        "EV-05": _trip("TRIP-05", "EV-05", distance=110, departure_hours=1.5),
    }
    sessions = [
        _session("S-01", "EV-01", "CH-01", 80, ChargingMode.CHEAPEST.value),
        _session("S-02", "EV-02", "CH-02", 85, ChargingMode.CHEAPEST.value),
        _session("S-03", "EV-03", "CH-03", 85, ChargingMode.FAST.value, trips["EV-03"]),
        _session("S-04", "EV-04", "CH-04", 85, ChargingMode.FAST.value, trips["EV-04"]),
        _session("S-05", "EV-05", "CH-05", 85, ChargingMode.FAST.value, trips["EV-05"]),
        _session("S-06", "EV-06", "CH-06", 100, ChargingMode.FAST.value),
    ]
    chargers = [
        _charger("CH-01", "EV-01", "S-01", 11),
        _charger("CH-02", "EV-02", "S-02", 11),
        _charger("CH-03", "EV-03", "S-03", 11),
        _charger("CH-04", "EV-04", "S-04", 11),
        _charger("CH-05", "EV-05", "S-05", 11),
        _charger("CH-06", "EV-06", "S-06", 11),
    ]

    state = _state(vehicles, chargers, sessions)
    result = OptimizationEngine().optimize(state)

    print("VEHICLE INTELLIGENCE")
    for session in state.sessions:
        vehicle = next(item for item in state.vehicles if item.vehicle_id == session.vehicle_id)
        requirement = session.charging_requirement
        trip_energy = (
            buffered_trip_energy_kwh(
                session.planned_trip,
                vehicle.estimated_consumption_kwh_per_km,
            )
            if session.planned_trip
            else None
        )
        print(
            f"{vehicle.vehicle_id}: SOC={vehicle.current_soc:.1f}% "
            f"SOH={vehicle.estimated_soh_percent:.0f}% "
            f"usable={vehicle.usable_capacity_kwh:.1f} kWh "
            f"min={vehicle.minimum_readiness_soc:.0f}% "
            f"trip_energy={trip_energy:.1f} kWh" if trip_energy else
            f"{vehicle.vehicle_id}: SOC={vehicle.current_soc:.1f}% "
            f"SOH={vehicle.estimated_soh_percent:.0f}% "
            f"usable={vehicle.usable_capacity_kwh:.1f} kWh "
            f"min={vehicle.minimum_readiness_soc:.0f}%"
        )
        assert requirement is not None
        print(
            f"  required={requirement.effective_required_soc:.1f}% "
            f"state={requirement.readiness_state.value} "
            f"acceptance={vehicle.current_battery_acceptance_limit_kw:.2f} kW "
            f"eta_min={_fmt(requirement.eta_to_minimum_readiness_hours)} "
            f"eta_trip={_fmt(requirement.eta_to_trip_ready_hours)} "
            f"eta_target={_fmt(requirement.eta_to_user_target_hours)}"
        )

    print("\nOPTIMIZER ALLOCATION")
    print(f"Budget: {result.effective_ev_budget_kw:.2f} kW")
    for decision in result.decisions:
        reasons = ",".join(code.value for code in decision.reason_codes)
        print(
            f"{decision.vehicle_id}: {decision.allocated_power_kw:.2f} kW "
            f"priority={decision.priority_score:.3f} reasons={reasons}"
        )
    print(f"Total allocated: {result.total_allocated_kw:.2f} kW")


def _fmt(hours: float | None) -> str:
    if hours is None:
        return "n/a"
    minutes = round(hours * 60)
    return f"{minutes} min"


def _state(
    vehicles: list[VehicleState],
    chargers: list[ChargerState],
    sessions: list[SessionState],
) -> SystemState:
    vehicles_by_id = {vehicle.vehicle_id: vehicle for vehicle in vehicles}
    chargers_by_id = {charger.charger_id: charger for charger in chargers}
    readiness = VehicleReadinessEngine()
    sessions = [
        session.model_copy(
            update={
                "current_soc": vehicles_by_id[session.vehicle_id].current_soc,
                "charging_requirement": readiness.build_requirement(
                    vehicles_by_id[session.vehicle_id],
                    session.model_copy(
                        update={
                            "current_soc": vehicles_by_id[session.vehicle_id].current_soc
                        }
                    ),
                    chargers_by_id[session.charger_id],
                )
            }
        )
        for session in sessions
    ]
    return SystemState(
        timestamp=NOW,
        site=SiteState(
            site_id="vehicle-intelligence-demo",
            name="Vehicle Intelligence Demo",
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
        tariff=TariffState(current_level="PEAK", current_price_per_kwh=0.32),
        vehicles=vehicles,
        chargers=chargers,
        sessions=sessions,
        telemetry=[],
    )


def _vehicle(
    vehicle_id: str,
    soc: float,
    soh: float,
    minimum: float,
    max_ac: float = 11,
) -> VehicleState:
    usable = 60 * soh / 100
    return VehicleState(
        vehicle_id=vehicle_id,
        current_soc=soc,
        connected=True,
        battery_capacity_kwh=60,
        nominal_battery_capacity_kwh=60,
        max_ac_kw=max_ac,
        max_dc_kw=50,
        connector_types=["TYPE2"],
        minimum_readiness_soc=minimum,
        estimated_consumption_kwh_per_km=0.15,
        estimated_soh_percent=soh,
        soh_source="DEMO",
        usable_capacity_kwh=usable,
        current_battery_acceptance_limit_kw=battery_acceptance_limit_kw(max_ac, soc),
    )


def _trip(
    trip_id: str,
    vehicle_id: str,
    distance: float,
    departure_hours: float,
) -> PlannedTrip:
    return PlannedTrip(
        trip_id=trip_id,
        vehicle_id=vehicle_id,
        distance_km=distance,
        departure_time=NOW + timedelta(hours=departure_hours),
        return_trip=False,
        reserve_soc_percent=20,
        source="DEMO",
    )


def _session(
    session_id: str,
    vehicle_id: str,
    charger_id: str,
    target_soc: float,
    mode: str,
    trip: PlannedTrip | None = None,
) -> SessionState:
    return SessionState(
        session_id=session_id,
        vehicle_id=vehicle_id,
        charger_id=charger_id,
        current_soc=0,
        target_soc=target_soc,
        arrival_time=NOW,
        explicit_departure_time=None,
        mode=mode,
        urgent=False,
        effective_max_kw=0,
        allocated_kw=0,
        commanded_power_kw=0,
        energy_delivered_kwh=0,
        status="CONNECTED",
        planned_trip=trip,
    )


def _charger(
    charger_id: str,
    vehicle_id: str,
    session_id: str,
    max_kw: float,
) -> ChargerState:
    return ChargerState(
        charger_id=charger_id,
        charger_type="AC",
        status="CONNECTED",
        connected_vehicle_id=vehicle_id,
        connected_session_id=session_id,
        commanded_power_kw=0,
        actual_delivered_power_kw=0,
        max_power_kw=max_kw,
        connector_type="TYPE2",
    )


if __name__ == "__main__":
    main()
