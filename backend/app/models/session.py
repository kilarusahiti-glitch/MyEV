from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import ChargingMode, ChargingSessionStatus


class ChargingSession(BaseModel):
    id: str = Field(min_length=1)
    vehicle_id: str = Field(min_length=1)
    charger_id: str = Field(min_length=1)
    target_soc: float = Field(gt=0, le=100)
    arrival_time: datetime
    explicit_departure_time: datetime | None = None
    charging_mode: ChargingMode
    urgent: bool = False
    effective_max_kw: float = Field(ge=0)
    allocated_kw: float = Field(ge=0, default=0)
    energy_delivered_kwh: float = Field(ge=0, default=0)
    status: ChargingSessionStatus = ChargingSessionStatus.CONNECTED
