from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ScenarioType(StrEnum):
    NORMAL = "NORMAL"
    BUILDING_PEAK = "BUILDING_PEAK"
    SOLAR_SURGE = "SOLAR_SURGE"
    EV_RUSH = "EV_RUSH"
    CHARGER_FAULT = "CHARGER_FAULT"
    RESET = "RESET"


class ScenarioEvent(BaseModel):
    scenario: ScenarioType
    timestamp: datetime
    affected_entities: list[str] = Field(default_factory=list)
    summary: str
    parameters: dict[str, Any] = Field(default_factory=dict)
