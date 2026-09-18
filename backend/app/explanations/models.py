from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel

from app.optimizer.models import ReasonCode


class ExplanationSeverity(StrEnum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class DecisionExplanation(BaseModel):
    session_id: str
    vehicle_id: str
    charger_id: str
    allocated_power_kw: float
    previous_allocated_power_kw: float | None = None
    change_kw: float | None = None
    primary_reason_code: ReasonCode
    reason_codes: tuple[ReasonCode, ...]
    headline: str
    detail: str
    severity: ExplanationSeverity = ExplanationSeverity.INFO
    timestamp: datetime
