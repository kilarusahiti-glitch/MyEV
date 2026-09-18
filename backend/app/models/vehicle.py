from pydantic import BaseModel, Field

from app.models.enums import VehicleType
from app.vehicle_intelligence.models import SOHSource


class Vehicle(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    vehicle_type: VehicleType
    battery_capacity_kwh: float = Field(gt=0)
    max_ac_kw: float = Field(ge=0)
    max_dc_kw: float = Field(ge=0)
    connector_types: list[str] = Field(min_length=1)
    current_soc: float = Field(ge=0, le=100)
    estimated_range_km: float = Field(ge=0)
    connected: bool = False
    minimum_readiness_soc: float = Field(default=30.0, ge=0, le=100)
    estimated_consumption_kwh_per_km: float = Field(default=0.15, gt=0)
    estimated_soh_percent: float = Field(default=100.0, gt=0, le=100)
    soh_source: SOHSource = SOHSource.UNKNOWN
