from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class ReasonCode(StrEnum):
    NORMAL_CHARGING = "NORMAL_CHARGING"
    DEPARTURE_PRIORITY = "DEPARTURE_PRIORITY"
    URGENT_REQUEST = "URGENT_REQUEST"
    BELOW_MINIMUM_READINESS = "BELOW_MINIMUM_READINESS"
    READINESS_PRIORITY = "READINESS_PRIORITY"
    TRIP_CHARGING_REQUIRED = "TRIP_CHARGING_REQUIRED"
    TRIP_READY = "TRIP_READY"
    TRIP_TARGET_AT_RISK = "TRIP_TARGET_AT_RISK"
    TRIP_INFEASIBLE = "TRIP_INFEASIBLE"
    FLEXIBLE_TARGET = "FLEXIBLE_TARGET"
    TARGET_DEFERRED = "TARGET_DEFERRED"
    BATTERY_ACCEPTANCE_LIMIT = "BATTERY_ACCEPTANCE_LIMIT"
    HIGH_SOC_TAPER = "HIGH_SOC_TAPER"
    PREDICTED_USAGE = "PREDICTED_USAGE"
    PREDICTED_READINESS_RISK = "PREDICTED_READINESS_RISK"
    FORECAST_BUILDING_PEAK = "FORECAST_BUILDING_PEAK"
    CHARGE_NOW_BEFORE_PEAK = "CHARGE_NOW_BEFORE_PEAK"
    DEFERRED_FOR_FORECAST_PEAK = "DEFERRED_FOR_FORECAST_PEAK"
    FORECAST_SOLAR_INCREASE = "FORECAST_SOLAR_INCREASE"
    DEFERRED_FOR_EXPECTED_SOLAR = "DEFERRED_FOR_EXPECTED_SOLAR"
    FORECAST_LOWER_TARIFF = "FORECAST_LOWER_TARIFF"
    DEFERRED_FOR_EXPECTED_LOW_TARIFF = "DEFERRED_FOR_EXPECTED_LOW_TARIFF"
    LOW_TARIFF_WINDOW = "LOW_TARIFF_WINDOW"
    SOLAR_AVAILABLE = "SOLAR_AVAILABLE"
    CAPACITY_LIMIT = "CAPACITY_LIMIT"
    FAIRNESS_ADJUSTMENT = "FAIRNESS_ADJUSTMENT"
    TARGET_REACHED = "TARGET_REACHED"
    CHARGER_LIMIT = "CHARGER_LIMIT"
    VEHICLE_LIMIT = "VEHICLE_LIMIT"
    TARGET_AT_RISK = "TARGET_AT_RISK"
    TARGET_INFEASIBLE = "TARGET_INFEASIBLE"
    DEFERRED_FOR_HIGH_TARIFF = "DEFERRED_FOR_HIGH_TARIFF"
    DEFERRED_FOR_LOW_SOLAR = "DEFERRED_FOR_LOW_SOLAR"
    OFFLINE_OR_FAULTED = "OFFLINE_OR_FAULTED"
    INCOMPATIBLE_CONNECTOR = "INCOMPATIBLE_CONNECTOR"
    DISCONNECTED = "DISCONNECTED"


@dataclass(frozen=True)
class EVPowerBudget:
    grid_based_ev_budget_kw: float
    transformer_based_ev_budget_kw: float
    effective_ev_budget_kw: float


@dataclass(frozen=True)
class SessionFeasibility:
    session_id: str
    vehicle_id: str
    charger_id: str
    energy_remaining_kwh: float
    required_wall_energy_kwh: float
    effective_max_kw: float
    time_remaining_hours: float | None
    minimum_charge_time_hours: float | None
    required_average_power_kw: float | None
    slack_hours: float | None
    feasible_by_deadline: bool | None
    achievable_soc_by_departure: float | None
    useful_power_limit_kw: float


@dataclass(frozen=True)
class PriorityScore:
    session_id: str
    score: float
    readiness_component: float
    deadline_component: float
    energy_component: float
    fairness_component: float
    mode_component: float
    opportunity_component: float
    urgent_boost: float
    reason_codes: tuple[ReasonCode, ...]


@dataclass(frozen=True)
class SessionOptimizationDecision:
    session_id: str
    vehicle_id: str
    charger_id: str
    allocated_power_kw: float
    effective_max_kw: float
    priority_score: float
    feasible_by_deadline: bool | None
    slack_hours: float | None
    reason_codes: tuple[ReasonCode, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class OptimizationResult:
    timestamp: datetime
    grid_based_ev_budget_kw: float
    transformer_based_ev_budget_kw: float
    effective_ev_budget_kw: float
    total_allocated_kw: float
    unused_budget_kw: float
    constrained: bool
    decisions: list[SessionOptimizationDecision]
    valid: bool = True
