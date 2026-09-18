from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class TripRequirementSource(StrEnum):
    USER_EXPLICIT = "USER_EXPLICIT"
    DEMO = "DEMO"


class SOHSource(StrEnum):
    BMS_REPORTED = "BMS_REPORTED"
    ESTIMATED = "ESTIMATED"
    DEMO = "DEMO"
    UNKNOWN = "UNKNOWN"


class RequirementSource(StrEnum):
    URGENT = "URGENT"
    TRIP = "TRIP"
    EXPLICIT_DEPARTURE_TARGET = "EXPLICIT_DEPARTURE_TARGET"
    MINIMUM_READINESS = "MINIMUM_READINESS"
    FLEXIBLE_TARGET = "FLEXIBLE_TARGET"
    NONE = "NONE"
    PREDICTED_USAGE = "PREDICTED_USAGE"


class ReadinessState(StrEnum):
    BELOW_MINIMUM = "BELOW_MINIMUM"
    MINIMUM_READY = "MINIMUM_READY"
    TRIP_NOT_READY = "TRIP_NOT_READY"
    TRIP_READY = "TRIP_READY"
    TARGET_READY = "TARGET_READY"


class PlannedTrip(BaseModel):
    trip_id: str = Field(min_length=1)
    vehicle_id: str = Field(min_length=1)
    distance_km: float = Field(ge=0)
    departure_time: datetime
    return_trip: bool = False
    total_distance_km: float | None = Field(default=None, ge=0)
    reserve_soc_percent: float = Field(default=20, ge=0, le=100)
    source: TripRequirementSource = TripRequirementSource.USER_EXPLICIT


class ChargingRequirement(BaseModel):
    minimum_readiness_soc: float = Field(ge=0, le=100)
    trip_required_soc: float | None = None
    user_target_soc: float | None = Field(default=None, ge=0, le=100)
    effective_required_soc: float = Field(ge=0)
    mandatory_soc: float = Field(ge=0)
    flexible_target_soc: float | None = Field(default=None, ge=0, le=100)
    requirement_source: RequirementSource
    deadline: datetime | None = None
    energy_required_kwh: float = Field(ge=0)
    readiness_deficit_soc: float
    trip_ready: bool | None = None
    requirement_feasible: bool = True
    readiness_state: ReadinessState
    trip_feasible_on_full_charge: bool | None = None
    eta_to_minimum_readiness_hours: float | None = None
    eta_to_trip_ready_hours: float | None = None
    eta_to_user_target_hours: float | None = None
    mobility_prediction_confidence: float | None = None
    predicted_readiness_risk: float | None = None

    @model_validator(mode="after")
    def validate_soc_values(self) -> "ChargingRequirement":
        if self.trip_required_soc is not None and self.trip_required_soc < 0:
            raise ValueError("trip_required_soc must be non-negative")
        return self
