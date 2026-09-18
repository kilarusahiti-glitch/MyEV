from pydantic import BaseModel, Field

from app.models.enums import ChargerStatus, ChargerType


class Charger(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    charger_type: ChargerType
    max_power_kw: float = Field(gt=0)
    connector_type: str = Field(min_length=1)
    status: ChargerStatus = ChargerStatus.AVAILABLE
