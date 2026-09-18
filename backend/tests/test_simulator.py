from datetime import UTC, datetime, time

import pytest

from app.models import (
    Charger,
    ChargerStatus,
    ChargerType,
    ChargingMode,
    ChargingSession,
    Vehicle,
    VehicleType,
)
from app.simulator import (
    SimulationClock,
    SimulationEngine,
    VirtualBuilding,
    VirtualCharger,
    VirtualEV,
    VirtualSolar,
    VirtualTariff,
)


def test_clock_speeds_advance_simulated_time() -> None:
    start = datetime(2026, 9, 18, 12, 0, tzinfo=UTC)

    assert SimulationClock(start, speed=1).advance(1).second == 1
    assert SimulationClock(start, speed=10).advance(1).second == 10
    assert SimulationClock(start, speed=60).advance(1).minute == 1


def test_solar_night_daylight_and_peak_bounds() -> None:
    solar = VirtualSolar(
        solar_peak_kw=40,
        sunrise=time(hour=6),
        sunset=time(hour=18),
        cloud_factor=0.75,
    )

    assert solar.update(datetime(2026, 9, 18, 2, 0, tzinfo=UTC)) == 0
    daylight_kw = solar.update(datetime(2026, 9, 18, 12, 0, tzinfo=UTC))
    assert daylight_kw > 0
    assert daylight_kw <= 40


def test_building_load_remains_non_negative() -> None:
    building = VirtualBuilding(base_load_kw=0.5, variation_kw=10, seed=1)

    for hour in range(24):
        load_kw = building.update(datetime(2026, 9, 18, hour, 0, tzinfo=UTC))
        assert load_kw >= 0


def test_ev_soc_increases_only_from_delivered_energy() -> None:
    ev = VirtualEV(_vehicle(current_soc=50, battery_capacity_kwh=50))
    session = _session(vehicle_id=ev.vehicle.id, charger_id="charger-1", target_soc=80)

    assert ev.apply_charging(0, 1, session=session) == 0
    assert ev.current_soc == 50

    ev.apply_charging(10, 1, session=session)

    assert ev.current_soc > 50


def test_ev_soc_never_exceeds_100() -> None:
    ev = VirtualEV(_vehicle(current_soc=99, battery_capacity_kwh=50))

    ev.apply_charging(50, 2)

    assert ev.current_soc == 100


def test_target_soc_is_not_overshot() -> None:
    ev = VirtualEV(_vehicle(current_soc=79, battery_capacity_kwh=50))
    session = _session(vehicle_id=ev.vehicle.id, charger_id="charger-1", target_soc=80)

    ev.apply_charging(50, 1, session=session)

    assert ev.current_soc == 80


def test_charger_respects_command_vehicle_and_charger_limits() -> None:
    vehicle_limited = _connected_charger(
        vehicle=_vehicle(max_ac_kw=3.3, connector_types=["TYPE2"]),
        charger=_charger(charger_type=ChargerType.AC, max_power_kw=7.2),
    )
    vehicle_limited.set_commanded_power_kw(7.2)
    assert vehicle_limited.step(1) == pytest.approx(3.3)

    charger_limited = _connected_charger(
        vehicle=_vehicle(max_ac_kw=11, connector_types=["TYPE2"]),
        charger=_charger(charger_type=ChargerType.AC, max_power_kw=7.2),
    )
    charger_limited.set_commanded_power_kw(11)
    assert charger_limited.step(1) == pytest.approx(7.2)

    command_limited = _connected_charger(
        vehicle=_vehicle(max_ac_kw=11, connector_types=["TYPE2"]),
        charger=_charger(charger_type=ChargerType.AC, max_power_kw=7.2),
    )
    command_limited.set_commanded_power_kw(5)
    assert command_limited.step(1) == pytest.approx(5)


def test_faulted_offline_and_incompatible_chargers_deliver_zero() -> None:
    faulted = _connected_charger(
        vehicle=_vehicle(connector_types=["TYPE2"]),
        charger=_charger(status=ChargerStatus.FAULTED),
    )
    faulted.set_commanded_power_kw(5)
    assert faulted.step(1) == 0

    offline = _connected_charger(
        vehicle=_vehicle(connector_types=["TYPE2"]),
        charger=_charger(status=ChargerStatus.OFFLINE),
    )
    offline.set_commanded_power_kw(5)
    assert offline.step(1) == 0

    incompatible = VirtualCharger(_charger(connector_type="CCS2"))
    connected = incompatible.connect(
        VirtualEV(_vehicle(connector_types=["TYPE2"])),
        _session(vehicle_id="vehicle-1", charger_id="charger-1", target_soc=80),
    )
    incompatible.set_commanded_power_kw(5)
    assert connected is False
    assert incompatible.step(1) == 0


def test_site_energy_balance_import_and_export() -> None:
    engine = SimulationEngine(
        clock=SimulationClock(datetime(2026, 9, 18, 11, 59, tzinfo=UTC), speed=60),
        building=VirtualBuilding(base_load_kw=10, variation_kw=0),
        solar=VirtualSolar(solar_peak_kw=50),
        tariff=VirtualTariff(),
        chargers=[],
    )

    snapshot = engine.tick(60)

    assert snapshot.grid_import_kw == pytest.approx(
        max(0, snapshot.building_load_kw + snapshot.ev_load_kw - snapshot.solar_generation_kw)
    )
    assert snapshot.solar_export_kw == pytest.approx(
        max(0, snapshot.solar_generation_kw - snapshot.site_demand_kw)
    )


def test_repeated_ticks_evolve_state_deterministically() -> None:
    snapshots_a = _run_deterministic_engine()
    snapshots_b = _run_deterministic_engine()

    assert snapshots_a == snapshots_b
    assert snapshots_a[0][0] < snapshots_a[-1][0]
    assert snapshots_a[0][1] != snapshots_a[-1][1]


def _run_deterministic_engine() -> list[tuple[datetime, float, float, float]]:
    charger = _connected_charger(
        vehicle=_vehicle(max_ac_kw=7.2, connector_types=["TYPE2"]),
        charger=_charger(charger_type=ChargerType.AC, max_power_kw=7.2),
    )
    charger.set_commanded_power_kw(6)
    engine = SimulationEngine(
        clock=SimulationClock(datetime(2026, 9, 18, 6, 0, tzinfo=UTC), speed=60),
        building=VirtualBuilding(base_load_kw=20, seed=123),
        solar=VirtualSolar(solar_peak_kw=25),
        tariff=VirtualTariff(),
        chargers=[charger],
    )

    return [
        (
            snapshot.simulated_time,
            snapshot.building_load_kw,
            snapshot.solar_generation_kw,
            snapshot.vehicles[0].soc,
        )
        for snapshot in [engine.tick(60), engine.tick(60), engine.tick(60)]
    ]


def _connected_charger(vehicle: Vehicle, charger: Charger) -> VirtualCharger:
    virtual_charger = VirtualCharger(charger)
    virtual_ev = VirtualEV(vehicle)
    session = _session(vehicle_id=vehicle.id, charger_id=charger.id, target_soc=90)
    virtual_charger.connect(virtual_ev, session)
    return virtual_charger


def _vehicle(
    current_soc: float = 50,
    battery_capacity_kwh: float = 50,
    max_ac_kw: float = 7.2,
    max_dc_kw: float = 50,
    connector_types: list[str] | None = None,
) -> Vehicle:
    return Vehicle(
        id="vehicle-1",
        name="Test Vehicle",
        vehicle_type=VehicleType.CAR,
        battery_capacity_kwh=battery_capacity_kwh,
        max_ac_kw=max_ac_kw,
        max_dc_kw=max_dc_kw,
        connector_types=connector_types or ["TYPE2"],
        current_soc=current_soc,
        estimated_range_km=100,
        connected=True,
    )


def _charger(
    charger_type: ChargerType = ChargerType.AC,
    max_power_kw: float = 7.2,
    connector_type: str = "TYPE2",
    status: ChargerStatus = ChargerStatus.AVAILABLE,
) -> Charger:
    return Charger(
        id="charger-1",
        name="Test Charger",
        charger_type=charger_type,
        max_power_kw=max_power_kw,
        connector_type=connector_type,
        status=status,
    )


def _session(vehicle_id: str, charger_id: str, target_soc: float) -> ChargingSession:
    return ChargingSession(
        id="session-1",
        vehicle_id=vehicle_id,
        charger_id=charger_id,
        target_soc=target_soc,
        arrival_time=datetime(2026, 9, 18, tzinfo=UTC),
        charging_mode=ChargingMode.FAST,
        urgent=False,
        effective_max_kw=0,
    )
