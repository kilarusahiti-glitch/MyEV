from datetime import UTC, datetime

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
from app.simulator import (
    SimulationClock,
    SimulationEngine,
    VirtualBuilding,
    VirtualCharger,
    VirtualEV,
    VirtualSolar,
    VirtualTariff,
)
from app.simulator.sensors import (
    BuildingPowerMeter,
    ChargerPowerMeter,
    ChargerStatusSensor,
    EVSOCSensor,
    GridPowerMeter,
    SolarPowerMeter,
    TariffSensor,
)
from app.telemetry import TelemetryGateway, TelemetryQuality


def test_sensors_equal_physical_truth() -> None:
    engine, ev, charger = _engine_with_one_charging_ev()
    snapshot = engine.tick(60)
    timestamp = snapshot.simulated_time

    building = BuildingPowerMeter("BUILDING", engine.building).read(timestamp)[0]
    solar = SolarPowerMeter("SOLAR", engine.solar).read(timestamp)[0]
    grid = GridPowerMeter(
        "GRID",
        lambda: snapshot.grid_import_kw,
        lambda: snapshot.solar_export_kw,
    ).read(timestamp)
    charger_power = ChargerPowerMeter("CHARGER_POWER", charger).read(timestamp)[0]
    ev_soc = EVSOCSensor("SOC", ev).read(timestamp)[0]
    charger_status = ChargerStatusSensor("CHARGER_STATUS", charger).read(timestamp)[0]
    tariff = TariffSensor("TARIFF", engine.tariff).read(timestamp)

    assert building.value == snapshot.building_load_kw
    assert solar.value == snapshot.solar_generation_kw
    assert _reading(grid, "GRID_IMPORT").value == snapshot.grid_import_kw
    assert _reading(grid, "GRID_EXPORT").value == snapshot.solar_export_kw
    assert charger_power.value == charger.actual_delivered_power_kw
    assert charger_power.value != charger.commanded_power_kw
    assert ev_soc.value == ev.current_soc
    assert charger_status.value == charger.charger.status.value
    assert _reading(tariff, "CURRENT_TARIFF_PRICE").value == (
        engine.tariff.current_period.price_per_kwh
    )
    assert _reading(tariff, "CURRENT_TARIFF_LEVEL").value == (
        engine.tariff.current_period.level.value
    )
    assert all(reading.quality == TelemetryQuality.GOOD for reading in grid + tariff)


def test_telemetry_gateway_collects_expected_sensors_with_good_quality() -> None:
    engine, _, _ = _engine_with_one_charging_ev()
    snapshot = engine.tick(60)

    metrics = {reading.metric for reading in snapshot.telemetry_readings}

    assert {
        "ACTIVE_POWER",
        "SOLAR_GENERATION",
        "GRID_IMPORT",
        "GRID_EXPORT",
        "ACTUAL_CHARGING_POWER",
        "STATE_OF_CHARGE",
        "CHARGER_STATUS",
        "CURRENT_TARIFF_PRICE",
        "CURRENT_TARIFF_LEVEL",
    }.issubset(metrics)
    assert all(
        reading.quality == TelemetryQuality.GOOD
        for reading in snapshot.telemetry_readings
    )


def test_gateway_can_collect_registered_sensor_generically() -> None:
    building = VirtualBuilding(base_load_kw=10, variation_kw=0)
    timestamp = datetime(2026, 9, 18, 8, tzinfo=UTC)
    building.update(timestamp)
    gateway = TelemetryGateway([BuildingPowerMeter("BUILDING_METER_01", building)])

    readings = gateway.collect(timestamp)

    assert len(readings) == 1
    assert readings[0].sensor_id == "BUILDING_METER_01"
    assert readings[0].metric == "ACTIVE_POWER"


def test_system_state_values_equal_snapshot_and_physical_models() -> None:
    engine, ev, charger = _engine_with_one_charging_ev()
    snapshot = engine.tick(60)

    assert snapshot.system_state is not None
    state = snapshot.system_state

    assert state.energy.building_load_kw == snapshot.building_load_kw
    assert state.energy.solar_generation_kw == snapshot.solar_generation_kw
    assert state.energy.ev_load_kw == snapshot.ev_load_kw
    assert state.energy.site_demand_kw == snapshot.site_demand_kw
    assert state.energy.grid_import_kw == snapshot.grid_import_kw
    assert state.energy.solar_export_kw == snapshot.solar_export_kw
    assert state.vehicles[0].current_soc == ev.current_soc
    assert state.chargers[0].actual_delivered_power_kw == (
        charger.actual_delivered_power_kw
    )
    assert state.site.grid_import_limit_kw == 120
    assert state.site.safety_reserve_kw == 10
    assert state.site.transformer_rated_kva == 160
    assert state.site.transformer_operational_limit_kw == 130
    assert state.site.solar_peak_kw == 35
    assert state.telemetry == snapshot.telemetry_readings


def test_system_state_sessions_include_optimizer_inputs_without_scores() -> None:
    engine, _, charger = _engine_with_one_charging_ev()
    snapshot = engine.tick(60)

    assert snapshot.system_state is not None
    session = snapshot.system_state.sessions[0]

    assert session.session_id == charger.connected_session.id
    assert session.vehicle_id == charger.connected_session.vehicle_id
    assert session.charger_id == charger.connected_session.charger_id
    assert session.target_soc == charger.connected_session.target_soc
    assert session.mode == ChargingMode.FAST.value
    assert session.commanded_power_kw == charger.commanded_power_kw
    assert not hasattr(session, "priority_score")
    assert not hasattr(session, "predicted_departure")


def test_repeated_ticks_update_telemetry_timestamps_and_state() -> None:
    engine, _, _ = _engine_with_one_charging_ev()

    first = engine.tick(60)
    second = engine.tick(60)

    assert first.simulated_time < second.simulated_time
    assert first.telemetry_readings[0].timestamp == first.simulated_time
    assert second.telemetry_readings[0].timestamp == second.simulated_time
    assert first.system_state is not None
    assert second.system_state is not None
    assert first.system_state.timestamp < second.system_state.timestamp
    assert first.system_state.vehicles[0].current_soc < (
        second.system_state.vehicles[0].current_soc
    )


def _engine_with_one_charging_ev() -> tuple[SimulationEngine, VirtualEV, VirtualCharger]:
    ev = VirtualEV(
        Vehicle(
            id="ev-1",
            name="Limit Test EV",
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
            id="ch-1",
            name="AC Charger",
            charger_type=ChargerType.AC,
            max_power_kw=22,
            connector_type="TYPE2",
            status=ChargerStatus.AVAILABLE,
        )
    )
    session = ChargingSession(
        id="session-1",
        vehicle_id=ev.vehicle.id,
        charger_id=charger.charger.id,
        target_soc=80,
        arrival_time=datetime(2026, 9, 18, 7, tzinfo=UTC),
        charging_mode=ChargingMode.FAST,
        urgent=True,
        effective_max_kw=11,
    )
    charger.connect(ev, session)
    charger.set_commanded_power_kw(20)

    engine = SimulationEngine(
        clock=SimulationClock(datetime(2026, 9, 18, 7, 59, tzinfo=UTC), speed=60),
        building=VirtualBuilding(base_load_kw=30, variation_kw=0),
        solar=VirtualSolar(solar_peak_kw=35),
        tariff=VirtualTariff(),
        chargers=[charger],
        site_config=SiteConfig(
            id="site-1",
            name="Test Site",
            grid_import_limit_kw=120,
            safety_reserve_kw=10,
            transformer_rated_kva=160,
            transformer_operational_limit_kw=130,
            solar_peak_kw=35,
        ),
        evs=[ev],
    )
    return engine, ev, charger


def _reading(readings: list, metric: str):
    for reading in readings:
        if reading.metric == metric:
            return reading
    raise AssertionError(f"Missing reading for metric {metric}")
