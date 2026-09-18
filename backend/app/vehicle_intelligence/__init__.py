from app.vehicle_intelligence.battery_health import (
    estimate_soh_percent,
    usable_capacity_kwh,
)
from app.vehicle_intelligence.charging_curve import (
    ChargingAcceptanceConfig,
    acceptance_factor,
    battery_acceptance_limit_kw,
)
from app.vehicle_intelligence.eta import estimate_charging_eta_hours
from app.vehicle_intelligence.models import (
    ChargingRequirement,
    PlannedTrip,
    ReadinessState,
    RequirementSource,
    SOHSource,
    TripRequirementSource,
)

__all__ = [
    "ChargingAcceptanceConfig",
    "ChargingRequirement",
    "PlannedTrip",
    "ReadinessState",
    "RequirementSource",
    "SOHSource",
    "TripRequirementSource",
    "VehicleReadinessEngine",
    "acceptance_factor",
    "battery_acceptance_limit_kw",
    "estimate_charging_eta_hours",
    "estimate_soh_percent",
    "usable_capacity_kwh",
]


def __getattr__(name: str):
    if name == "VehicleReadinessEngine":
        from app.vehicle_intelligence.readiness import VehicleReadinessEngine

        return VehicleReadinessEngine
    raise AttributeError(name)
