from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class AlertSeverity(StrEnum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AlertStatus(StrEnum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"


class AlertType(StrEnum):
    BUILDING_LOAD_HIGH = "BUILDING_LOAD_HIGH"
    SITE_CAPACITY_CONSTRAINED = "SITE_CAPACITY_CONSTRAINED"
    TARGET_AT_RISK = "TARGET_AT_RISK"
    TARGET_INFEASIBLE = "TARGET_INFEASIBLE"
    TRIP_TARGET_AT_RISK = "TRIP_TARGET_AT_RISK"
    CHARGER_FAULT = "CHARGER_FAULT"
    VEHICLE_BELOW_READINESS = "VEHICLE_BELOW_READINESS"
    PREDICTED_DEPARTURE_RISK = "PREDICTED_DEPARTURE_RISK"
    TARGET_REACHED = "TARGET_REACHED"
    SOLAR_SURPLUS = "SOLAR_SURPLUS"
    FORECAST_BUILDING_PEAK = "FORECAST_BUILDING_PEAK"
    FORECAST_SOLAR_OPPORTUNITY = "FORECAST_SOLAR_OPPORTUNITY"


class Alert(BaseModel):
    alert_id: str
    timestamp: datetime
    type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    vehicle_id: str | None = None
    charger_id: str | None = None
    session_id: str | None = None
    active: bool
    status: AlertStatus
    deduplication_key: str
