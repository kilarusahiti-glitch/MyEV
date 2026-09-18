from datetime import datetime

from pydantic import BaseModel

from app.telemetry.models import TelemetryReading
from app.mobility.models import MobilityPrediction
from app.vehicle_intelligence.models import ChargingRequirement, PlannedTrip


class SiteState(BaseModel):
    site_id: str
    name: str
    grid_import_limit_kw: float
    safety_reserve_kw: float
    transformer_rated_kva: float
    transformer_operational_limit_kw: float
    solar_peak_kw: float


class EnergyState(BaseModel):
    building_load_kw: float
    solar_generation_kw: float
    ev_load_kw: float
    site_demand_kw: float
    grid_import_kw: float
    solar_export_kw: float


class TariffState(BaseModel):
    current_level: str
    current_price_per_kwh: float


class VehicleState(BaseModel):
    vehicle_id: str
    current_soc: float
    connected: bool
    battery_capacity_kwh: float
    nominal_battery_capacity_kwh: float | None = None
    max_ac_kw: float
    max_dc_kw: float
    connector_types: list[str] = []
    minimum_readiness_soc: float = 30.0
    estimated_consumption_kwh_per_km: float = 0.15
    estimated_soh_percent: float = 100.0
    soh_source: str = "UNKNOWN"
    usable_capacity_kwh: float = 0.0
    current_battery_acceptance_limit_kw: float | None = None


class ChargerState(BaseModel):
    charger_id: str
    charger_type: str = ""
    status: str
    connected_vehicle_id: str | None
    connected_session_id: str | None
    commanded_power_kw: float
    actual_delivered_power_kw: float
    max_power_kw: float
    connector_type: str = ""


class SessionState(BaseModel):
    session_id: str
    vehicle_id: str
    charger_id: str
    current_soc: float
    target_soc: float
    arrival_time: datetime
    explicit_departure_time: datetime | None
    mode: str
    urgent: bool
    effective_max_kw: float
    allocated_kw: float
    commanded_power_kw: float
    energy_delivered_kwh: float
    status: str
    planned_trip: PlannedTrip | None = None
    charging_requirement: ChargingRequirement | None = None
    mobility_prediction: MobilityPrediction | None = None


class SystemState(BaseModel):
    timestamp: datetime
    site: SiteState
    energy: EnergyState
    tariff: TariffState
    vehicles: list[VehicleState]
    chargers: list[ChargerState]
    sessions: list[SessionState]
    telemetry: list[TelemetryReading]
