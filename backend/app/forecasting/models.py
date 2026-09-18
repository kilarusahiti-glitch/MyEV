from datetime import datetime

from pydantic import BaseModel, Field


class EnergyHistorySample(BaseModel):
    timestamp: datetime
    building_load_kw: float = Field(ge=0)
    solar_generation_kw: float = Field(ge=0)
    grid_import_kw: float = Field(ge=0)
    ev_load_kw: float = Field(ge=0)
    tariff_state: str


class ForecastPoint(BaseModel):
    horizon_minutes: int
    predicted_value: float = Field(ge=0)
    confidence: float = Field(ge=0, le=1)


class TariffForecastPoint(BaseModel):
    horizon_minutes: int
    tariff_state: str
    confidence: float = Field(ge=0, le=1)


class EnergyForecast(BaseModel):
    timestamp: datetime
    building_load: list[ForecastPoint]
    solar_generation: list[ForecastPoint]
    tariff: list[TariffForecastPoint]
    peak_risk: float = Field(ge=0, le=1)
    solar_opportunity: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
