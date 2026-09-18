from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import ChargingMode


class HealthResponse(BaseModel):
    status: str


class PreferenceUpdate(BaseModel):
    target_soc: float | None = Field(default=None, ge=0, le=100)
    departure_time: datetime | None = None
    mode: ChargingMode | None = None
    urgent: bool | None = None


class TripRequest(BaseModel):
    vehicle_id: str
    distance_km: float = Field(ge=0)
    departure_time: datetime
    return_trip: bool = False
    total_distance_km: float | None = Field(default=None, ge=0)
    reserve_soc_percent: float = Field(default=20, ge=0, le=100)


class SpeedRequest(BaseModel):
    speed: int = Field(description="Simulation speed multiplier: 1, 10, or 60")


class CommandRequest(BaseModel):
    vehicle_id: str


class StatusResponse(BaseModel):
    timestamp: datetime
    site: dict[str, Any]
    counts: dict[str, int]
    simulation: dict[str, Any]
    optimization: dict[str, Any]
    forecast_summary: dict[str, float]
    alert_summary: dict[str, Any]


class ApiEnvelope(BaseModel):
    data: Any
