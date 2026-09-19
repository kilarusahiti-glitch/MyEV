from app.models import (
    Charger,
    ChargerStatus,
    ChargerType,
    SiteConfig,
    Vehicle,
    VehicleType,
)


def build_demo_vehicles() -> list[Vehicle]:
    return [
        Vehicle(
            id="car-001",
            name="Apartment Sedan",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=60.0,
            max_ac_kw=11.0,
            max_dc_kw=100.0,
            connector_types=["CCS2", "TYPE2"],
            current_soc=42.0,
            estimated_range_km=210.0,
            connected=True,
        ),
        Vehicle(
            id="car-002",
            name="Fleet SUV",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=82.0,
            max_ac_kw=7.2,
            max_dc_kw=75.0,
            connector_types=["CCS2", "TYPE2"],
            current_soc=28.0,
            estimated_range_km=145.0,
            connected=True,
        ),
        Vehicle(
            id="car-003",
            name="Solar Commuter",
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=58.0,
            max_ac_kw=11.0,
            max_dc_kw=50.0,
            connector_types=["TYPE2", "CCS2"],
            current_soc=68.0,
            estimated_range_km=315.0,
            connected=True,
        ),
        Vehicle(
            id="bike-001",
            name="Delivery E-Bike",
            vehicle_type=VehicleType.BIKE,
            battery_capacity_kwh=3.2,
            max_ac_kw=1.8,
            max_dc_kw=0.0,
            connector_types=["LEV-AC"],
            current_soc=55.0,
            estimated_range_km=62.0,
            connected=True,
        ),
        Vehicle(
            id="scooter-001",
            name="Campus Scooter",
            vehicle_type=VehicleType.SCOOTER,
            battery_capacity_kwh=4.5,
            max_ac_kw=3.3,
            max_dc_kw=0.0,
            connector_types=["LEV-AC"],
            current_soc=18.0,
            estimated_range_km=24.0,
            connected=True,
        ),
        Vehicle(
            id="bike-002",
            name="Parked E-Bike",
            vehicle_type=VehicleType.BIKE,
            battery_capacity_kwh=2.8,
            max_ac_kw=1.5,
            max_dc_kw=0.0,
            connector_types=["LEV-AC"],
            current_soc=76.0,
            estimated_range_km=82.0,
            connected=False,
        ),
    ]


def build_demo_chargers() -> list[Charger]:
    return [
        Charger(
            id="dc-001",
            name="Main DC Charger",
            charger_type=ChargerType.DC,
            max_power_kw=70.0,
            connector_type="CCS2",
            status=ChargerStatus.AVAILABLE,
        ),
        Charger(
            id="ac-001",
            name="Parking AC Charger",
            charger_type=ChargerType.AC,
            max_power_kw=7.2,
            connector_type="TYPE2",
            status=ChargerStatus.AVAILABLE,
        ),
        Charger(
            id="ac-lev-001",
            name="Two-Wheeler AC Charger",
            charger_type=ChargerType.AC,
            max_power_kw=3.3,
            connector_type="LEV-AC",
            status=ChargerStatus.AVAILABLE,
        ),
        Charger(
            id="ac-003",
            name="Solar Parking AC Charger",
            charger_type=ChargerType.AC,
            max_power_kw=11.0,
            connector_type="TYPE2",
            status=ChargerStatus.AVAILABLE,
        ),
        Charger(
            id="ac-lev-002",
            name="Delivery Bike Charger",
            charger_type=ChargerType.AC,
            max_power_kw=1.8,
            connector_type="LEV-AC",
            status=ChargerStatus.AVAILABLE,
        ),
    ]


def build_demo_site_config() -> SiteConfig:
    return SiteConfig(
        id="site-001",
        name="Hackathon EV Cluster",
        grid_import_limit_kw=120.0,
        safety_reserve_kw=10.0,
        transformer_rated_kva=160.0,
        transformer_operational_limit_kw=130.0,
        solar_peak_kw=35.0,
    )
