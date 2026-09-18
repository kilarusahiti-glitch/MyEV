from datetime import date, datetime, time
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator


class UsageRecordSource(StrEnum):
    DEMO = "DEMO"
    USER_RECORDED = "USER_RECORDED"
    SIMULATED = "SIMULATED"


class MobilityPredictionSource(StrEnum):
    PREDICTED_USAGE = "PREDICTED_USAGE"


class VehicleUsageRecord(BaseModel):
    vehicle_id: str = Field(min_length=1)
    date: date
    departure_time: time
    return_time: time | None = None
    departure_soc: float = Field(ge=0, le=100)
    return_soc: float | None = Field(default=None, ge=0, le=100)
    energy_used_kwh: float = Field(ge=0)
    day_of_week: int = Field(ge=0, le=6)
    trip_distance_km: float | None = Field(default=None, ge=0)
    context: str | None = None
    source: UsageRecordSource = UsageRecordSource.USER_RECORDED

    @model_validator(mode="after")
    def date_matches_day_of_week(self) -> "VehicleUsageRecord":
        if self.date.weekday() != self.day_of_week:
            raise ValueError("day_of_week must match date.weekday()")
        return self


class ProbabilityBucket(BaseModel):
    window_start: time
    window_end: time
    probability: float = Field(ge=0, le=1)


class DeparturePattern(BaseModel):
    window_start: time
    window_end: time
    center_time: time
    probability: float = Field(ge=0, le=1)
    sample_count: int = Field(ge=0)


class DeparturePrediction(BaseModel):
    most_likely_departure: time
    window_start: time
    window_end: time
    probability_within_window: float = Field(ge=0, le=1)
    probability_buckets: list[ProbabilityBucket]
    patterns: list[DeparturePattern]
    dominant_pattern_probability: float = Field(ge=0, le=1)
    sample_count: int = Field(ge=0)
    confidence: float = Field(ge=0, le=1)
    planning_deadline: datetime


class EnergyPrediction(BaseModel):
    expected_energy_kwh: float = Field(ge=0)
    safe_energy_requirement_kwh: float = Field(ge=0)
    sample_count: int = Field(ge=0)
    confidence: float = Field(ge=0, le=1)


class PredictedReadiness(BaseModel):
    recommended_soc: float = Field(ge=0)
    minimum_soc: float = Field(ge=0, le=100)
    predicted_required_soc: float = Field(ge=0)
    planning_deadline: datetime
    readiness_risk: float = Field(ge=0, le=1)
    requirement_feasible: bool


class MobilityPrediction(BaseModel):
    vehicle_id: str
    departure_prediction: DeparturePrediction
    energy_prediction: EnergyPrediction
    readiness: PredictedReadiness
    confidence: float = Field(ge=0, le=1)
    source: MobilityPredictionSource = MobilityPredictionSource.PREDICTED_USAGE
    sample_count: int = Field(ge=0)
