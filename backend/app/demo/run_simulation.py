from datetime import UTC, datetime

from app.demo.bootstrap import (
    build_demo_chargers,
    build_demo_site_config,
    build_demo_vehicles,
)
from app.models import ChargingMode, ChargingSession
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
    site = build_demo_site_config()
    vehicles = {vehicle.id: VirtualEV(vehicle) for vehicle in build_demo_vehicles()}
    chargers = {
        charger.id: VirtualCharger(charger) for charger in build_demo_chargers()
    }
    start_time = datetime(2026, 9, 18, 7, 30, tzinfo=UTC)

    _connect(
        chargers["dc-001"],
        vehicles["car-001"],
        "session-car-001",
        target_soc=80,
        start_time=start_time,
    )
    _connect(
        chargers["ac-001"],
        vehicles["car-002"],
        "session-car-002",
        target_soc=70,
        start_time=start_time,
    )
    _connect(
        chargers["ac-lev-001"],
        vehicles["scooter-001"],
        "session-scooter-001",
        target_soc=90,
        start_time=start_time,
    )

    chargers["dc-001"].set_commanded_power_kw(45.0)
    chargers["ac-001"].set_commanded_power_kw(6.0)
    chargers["ac-lev-001"].set_commanded_power_kw(2.5)

    engine = SimulationEngine(
        clock=SimulationClock(start_time=start_time, speed=60),
        building=VirtualBuilding(base_load_kw=32.0, seed=7),
        solar=VirtualSolar(solar_peak_kw=site.solar_peak_kw, cloud_factor=0.82),
        tariff=VirtualTariff(),
        chargers=list(chargers.values()),
        site_config=site,
        evs=list(vehicles.values()),
    )

    for tick_number in range(1, 7):
        snapshot = engine.tick(delta_real_seconds=60)
        print(f"Tick {tick_number} | {snapshot.simulated_time.isoformat()}")
        print(
            "  "
            f"building={snapshot.building_load_kw:.2f} kW, "
            f"solar={snapshot.solar_generation_kw:.2f} kW, "
            f"ev_load={snapshot.ev_load_kw:.2f} kW, "
            f"grid_import={snapshot.grid_import_kw:.2f} kW, "
            f"tariff={snapshot.tariff.level.value}"
        )
        for charger in snapshot.chargers:
            print(
                "  "
                f"{charger.charger_id}: actual={charger.actual_kw:.2f} kW, "
                f"commanded={charger.commanded_kw:.2f} kW, "
                f"vehicle={charger.vehicle_id}, status={charger.status}"
            )
        for vehicle in snapshot.vehicles:
            print(
                "  "
                f"{vehicle.vehicle_id}: soc={vehicle.soc:.2f}%, "
                f"energy={vehicle.cumulative_energy_received_kwh:.2f} kWh"
            )
        print("  telemetry:")
        for reading in snapshot.telemetry_readings[:6]:
            value = (
                f"{reading.value:.2f}"
                if isinstance(reading.value, float)
                else str(reading.value)
            )
            print(
                "    "
                f"{reading.sensor_id} {reading.metric} "
                f"{value} {reading.unit} {reading.quality.value}"
            )
        if snapshot.system_state:
            agrees = (
                snapshot.system_state.energy.building_load_kw
                == snapshot.building_load_kw
                and snapshot.system_state.energy.grid_import_kw
                == snapshot.grid_import_kw
            )
            print(f"  system_state_matches_physics={agrees}")


def _connect(
    charger: VirtualCharger,
    ev: VirtualEV,
    session_id: str,
    target_soc: float,
    start_time: datetime,
) -> None:
    session = ChargingSession(
        id=session_id,
        vehicle_id=ev.vehicle.id,
        charger_id=charger.charger.id,
        target_soc=target_soc,
        arrival_time=start_time,
        charging_mode=ChargingMode.FAST,
        urgent=False,
        effective_max_kw=0,
    )
    charger.connect(ev, session)


if __name__ == "__main__":
    main()
