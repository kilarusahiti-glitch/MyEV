from datetime import UTC, datetime, timedelta

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
from app.optimizer.engine import OptimizationEngine
from app.simulator import (
    SimulationClock,
    SimulationEngine,
    VirtualBuilding,
    VirtualCharger,
    VirtualEV,
    VirtualSolar,
    VirtualTariff,
)


def main() -> None:
    start_time = datetime(2026, 9, 18, 11, 59, tzinfo=UTC)
    site = SiteConfig(
        id="optimizer-demo-site",
        name="Optimizer Demo Site",
        grid_import_limit_kw=100,
        safety_reserve_kw=5,
        transformer_rated_kva=160,
        transformer_operational_limit_kw=120,
        solar_peak_kw=10,
    )
    evs = _build_evs()
    chargers = _build_chargers()
    sessions = _build_sessions(start_time)

    for charger, ev, session in zip(chargers, evs, sessions, strict=True):
        charger.connect(ev, session)

    engine = SimulationEngine(
        clock=SimulationClock(start_time=start_time, speed=60),
        building=VirtualBuilding(base_load_kw=58.5, variation_kw=0, seed=3),
        solar=VirtualSolar(solar_peak_kw=site.solar_peak_kw),
        tariff=VirtualTariff(),
        chargers=chargers,
        site_config=site,
        evs=evs,
    )
    optimizer = OptimizationEngine()

    snapshot_0 = engine.tick(60)
    assert snapshot_0.system_state is not None
    state_0 = snapshot_0.system_state
    result_0 = optimizer.optimize(state_0)

    print("SITE")
    print(f"Building: {state_0.energy.building_load_kw:.2f} kW")
    print(f"Solar: {state_0.energy.solar_generation_kw:.2f} kW")
    print(f"Grid Limit: {state_0.site.grid_import_limit_kw:.2f} kW")
    print(f"Reserve: {state_0.site.safety_reserve_kw:.2f} kW")
    print(f"EV Budget: {result_0.effective_ev_budget_kw:.2f} kW")

    print("\nBEFORE OPTIMIZATION")
    for session in state_0.sessions:
        charger = next(item for item in state_0.chargers if item.charger_id == session.charger_id)
        print(
            f"{session.vehicle_id}: max {charger.max_power_kw:.1f} kW, "
            f"mode={session.mode}, target={session.target_soc:.0f}%"
        )

    print("\nOPTIMIZATION")
    for decision in result_0.decisions:
        reasons = ",".join(code.value for code in decision.reason_codes)
        print(
            f"{decision.vehicle_id} -> {decision.allocated_power_kw:.2f} kW "
            f"Priority: {decision.priority_score:.3f} Reason: {reasons}"
        )
    print(f"Total allocated: {result_0.total_allocated_kw:.2f} kW")
    print(f"Budget: {result_0.effective_ev_budget_kw:.2f} kW")
    print(f"VALID: {result_0.valid}")

    engine.apply_optimization(result_0)
    snapshot_1 = engine.tick(60)
    assert snapshot_1.system_state is not None

    print("\nAFTER APPLY + NEXT TICK")
    for charger in snapshot_1.chargers:
        print(f"{charger.charger_id}: actual {charger.actual_kw:.2f} kW")
    for vehicle in snapshot_1.vehicles:
        print(f"{vehicle.vehicle_id}: SOC {vehicle.soc:.2f}%")
    print(
        "SystemState grid import: "
        f"{snapshot_1.system_state.energy.grid_import_kw:.2f} kW"
    )


def _build_evs() -> list[VirtualEV]:
    vehicles = [
        Vehicle(
            id="EV-01",
            name="Soon Departure Car",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=60,
            max_ac_kw=11,
            max_dc_kw=100,
            connector_types=["TYPE2"],
            current_soc=38,
            estimated_range_km=160,
            connected=True,
        ),
        Vehicle(
            id="EV-02",
            name="Later Departure Car",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=75,
            max_ac_kw=7.2,
            max_dc_kw=75,
            connector_types=["TYPE2"],
            current_soc=45,
            estimated_range_km=220,
            connected=True,
        ),
        Vehicle(
            id="EV-03",
            name="Fast Mode Car",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=50,
            max_ac_kw=11,
            max_dc_kw=50,
            connector_types=["TYPE2"],
            current_soc=50,
            estimated_range_km=180,
            connected=True,
        ),
        Vehicle(
            id="EV-04",
            name="Cheapest Mode Car",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=64,
            max_ac_kw=11,
            max_dc_kw=50,
            connector_types=["TYPE2"],
            current_soc=35,
            estimated_range_km=150,
            connected=True,
        ),
        Vehicle(
            id="EV-05",
            name="Greenest Scooter",
            vehicle_type=VehicleType.SCOOTER,
            battery_capacity_kwh=4.5,
            max_ac_kw=3.3,
            max_dc_kw=0,
            connector_types=["LEV-AC"],
            current_soc=25,
            estimated_range_km=35,
            connected=True,
        ),
        Vehicle(
            id="EV-06",
            name="Urgent Bike",
            vehicle_type=VehicleType.BIKE,
            battery_capacity_kwh=3.2,
            max_ac_kw=2.0,
            max_dc_kw=0,
            connector_types=["LEV-AC"],
            current_soc=20,
            estimated_range_km=25,
            connected=True,
        ),
    ]
    return [VirtualEV(vehicle) for vehicle in vehicles]


def _build_chargers() -> list[VirtualCharger]:
    specs = [
        ("CH-01", ChargerType.AC, 11, "TYPE2"),
        ("CH-02", ChargerType.AC, 7.2, "TYPE2"),
        ("CH-03", ChargerType.AC, 11, "TYPE2"),
        ("CH-04", ChargerType.AC, 11, "TYPE2"),
        ("CH-05", ChargerType.AC, 3.3, "LEV-AC"),
        ("CH-06", ChargerType.AC, 2.0, "LEV-AC"),
    ]
    return [
        VirtualCharger(
            Charger(
                id=charger_id,
                name=charger_id,
                charger_type=charger_type,
                max_power_kw=max_power_kw,
                connector_type=connector,
                status=ChargerStatus.AVAILABLE,
            )
        )
        for charger_id, charger_type, max_power_kw, connector in specs
    ]


def _build_sessions(start_time: datetime) -> list[ChargingSession]:
    return [
        _session("S-01", "EV-01", "CH-01", 80, start_time, 1.5, ChargingMode.FAST),
        _session("S-02", "EV-02", "CH-02", 80, start_time, 7, ChargingMode.FAST),
        _session("S-03", "EV-03", "CH-03", 80, start_time, None, ChargingMode.FAST),
        _session("S-04", "EV-04", "CH-04", 80, start_time, 8, ChargingMode.CHEAPEST),
        _session("S-05", "EV-05", "CH-05", 90, start_time, 4, ChargingMode.GREENEST),
        _session("S-06", "EV-06", "CH-06", 90, start_time, 3, ChargingMode.FAST, True),
    ]


def _session(
    session_id: str,
    vehicle_id: str,
    charger_id: str,
    target_soc: float,
    start_time: datetime,
    departure_hours: float | None,
    mode: ChargingMode,
    urgent: bool = False,
) -> ChargingSession:
    return ChargingSession(
        id=session_id,
        vehicle_id=vehicle_id,
        charger_id=charger_id,
        target_soc=target_soc,
        arrival_time=start_time,
        explicit_departure_time=(
            start_time + timedelta(hours=departure_hours)
            if departure_hours is not None
            else None
        ),
        charging_mode=mode,
        urgent=urgent,
        effective_max_kw=0,
    )


if __name__ == "__main__":
    main()
