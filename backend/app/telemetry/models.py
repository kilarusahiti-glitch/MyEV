from datetime import datetime
from enum import StrEnum
from typing import TypeAlias

from pydantic import BaseModel, Field


class TelemetryQuality(StrEnum):
    GOOD = "GOOD"
    STALE = "STALE"
    OFFLINE = "OFFLINE"
    INVALID = "INVALID"


TelemetryValue: TypeAlias = float | int | str | bool


class TelemetryReading(BaseModel):
    sensor_id: str = Field(min_length=1)
    metric: str = Field(min_length=1)
    value: TelemetryValue
    unit: str
    timestamp: datetime
    quality: TelemetryQuality = TelemetryQuality.GOOD
