from pydantic import BaseModel, Field


class SiteConfig(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    grid_import_limit_kw: float = Field(gt=0)
    safety_reserve_kw: float = Field(ge=0)
    transformer_rated_kva: float = Field(gt=0)
    transformer_operational_limit_kw: float = Field(gt=0)
    solar_peak_kw: float = Field(ge=0)
