from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.models import (
    Charger,
    ChargerType,
    ChargingMode,
    ChargingSession,
    Vehicle,
    VehicleType,
)
from app.optimizer.constraints import (
    effective_charging_limit_kw,
    effective_session_max_power_kw,
    is_connector_compatible,
)


def test_dc_car_limited_by_dc_charger_power() -> None:
    vehicle = Vehicle(
        id="car-1",
        name="100 kW DC Car",
        vehicle_type=VehicleType.CAR,
        battery_capacity_kwh=60,
        max_ac_kw=11,
        max_dc_kw=100,
        connector_types=["CCS2"],
        current_soc=50,
        estimated_range_km=220,
        connected=True,
    )
    charger = Charger(
        id="charger-1",
        name="70 kW DC Charger",
        charger_type=ChargerType.DC,
        max_power_kw=70,
        connector_type="CCS2",
    )

    assert effective_charging_limit_kw(vehicle, charger) == 70


def test_ac_bike_limited_by_vehicle_ac_capability() -> None:
    vehicle = Vehicle(
        id="bike-1",
        name="3.3 kW AC Bike",
        vehicle_type=VehicleType.BIKE,
        battery_capacity_kwh=4,
        max_ac_kw=3.3,
        max_dc_kw=0,
        connector_types=["LEV-AC"],
        current_soc=40,
        estimated_range_km=55,
        connected=True,
    )
    charger = Charger(
        id="charger-2",
        name="7.2 kW AC Charger",
        charger_type=ChargerType.AC,
        max_power_kw=7.2,
        connector_type="LEV-AC",
    )

    assert effective_charging_limit_kw(vehicle, charger) == 3.3


def test_incompatible_connectors_are_detected_and_rejected() -> None:
    vehicle = Vehicle(
        id="vehicle-1",
        name="Type 2 Vehicle",
        vehicle_type=VehicleType.CAR,
        battery_capacity_kwh=45,
        max_ac_kw=7.2,
        max_dc_kw=50,
        connector_types=["TYPE2"],
        current_soc=35,
        estimated_range_km=150,
        connected=True,
    )
    charger = Charger(
        id="charger-3",
        name="CCS2 Charger",
        charger_type=ChargerType.DC,
        max_power_kw=50,
        connector_type="CCS2",
    )

    assert is_connector_compatible(vehicle, charger) is False
    with pytest.raises(ValueError, match="not compatible"):
        effective_charging_limit_kw(vehicle, charger)


def test_effective_session_max_power_checks_session_links() -> None:
    vehicle = Vehicle(
        id="car-1",
        name="Session Car",
        vehicle_type=VehicleType.CAR,
        battery_capacity_kwh=60,
        max_ac_kw=11,
        max_dc_kw=100,
        connector_types=["CCS2"],
        current_soc=50,
        estimated_range_km=220,
        connected=True,
    )
    charger = Charger(
        id="charger-1",
        name="70 kW DC Charger",
        charger_type=ChargerType.DC,
        max_power_kw=70,
        connector_type="CCS2",
    )
    session = ChargingSession(
        id="session-1",
        vehicle_id="car-1",
        charger_id="charger-1",
        target_soc=90,
        arrival_time=datetime(2026, 9, 18, tzinfo=UTC),
        charging_mode=ChargingMode.FAST,
        urgent=False,
        effective_max_kw=70,
    )

    assert effective_session_max_power_kw(session, vehicle, charger) == 70


def test_invalid_soc_greater_than_100_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Vehicle(
            id="bad-soc",
            name="Invalid SOC Vehicle",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=50,
            max_ac_kw=7.2,
            max_dc_kw=50,
            connector_types=["CCS2"],
            current_soc=101,
            estimated_range_km=100,
            connected=False,
        )


def test_negative_power_and_capacity_values_are_rejected() -> None:
    with pytest.raises(ValidationError):
        Vehicle(
            id="bad-capacity",
            name="Invalid Capacity Vehicle",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=-1,
            max_ac_kw=7.2,
            max_dc_kw=50,
            connector_types=["CCS2"],
            current_soc=50,
            estimated_range_km=100,
            connected=False,
        )

    with pytest.raises(ValidationError):
        Charger(
            id="bad-power",
            name="Invalid Charger",
            charger_type=ChargerType.AC,
            max_power_kw=-7.2,
            connector_type="TYPE2",
        )
