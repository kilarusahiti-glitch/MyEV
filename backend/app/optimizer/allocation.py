from dataclasses import dataclass

from app.forecasting.models import EnergyForecast
from app.optimizer.models import (
    EVPowerBudget,
    PriorityScore,
    ReasonCode,
    SessionFeasibility,
    SessionOptimizationDecision,
)
from app.state.models import SessionState


@dataclass(frozen=True)
class AllocationConfig:
    increment_kw: float = 0.5


class AllocationEngine:
    def __init__(self, config: AllocationConfig | None = None) -> None:
        self.config = config or AllocationConfig()

    def allocate(
        self,
        sessions: list[SessionState],
        feasibility: dict[str, SessionFeasibility],
        priorities: dict[str, PriorityScore],
        budget: EVPowerBudget,
        forecast: EnergyForecast | None = None,
    ) -> list[SessionOptimizationDecision]:
        allocations = {session.session_id: 0.0 for session in sessions}
        reasons = {
            session.session_id: list(priorities[session.session_id].reason_codes)
            for session in sessions
        }
        remaining = budget.effective_ev_budget_kw

        baseline_sessions = [
            session
            for session in sessions
            if feasibility[session.session_id].required_average_power_kw is not None
            and feasibility[session.session_id].useful_power_limit_kw > 0
        ]
        for session in sorted(
            baseline_sessions,
            key=lambda item: _allocation_sort_key(item, feasibility, priorities),
        ):
            info = feasibility[session.session_id]
            baseline = min(
                info.required_average_power_kw or 0.0,
                info.useful_power_limit_kw,
            )
            amount = min(baseline, remaining)
            allocations[session.session_id] += amount
            remaining -= amount
            if amount > 0:
                reasons[session.session_id].append(ReasonCode.DEPARTURE_PRIORITY)
            if remaining <= 1e-9:
                break

        while remaining > 1e-9:
            eligible = [
                session
                for session in sessions
                if allocations[session.session_id]
                < feasibility[session.session_id].useful_power_limit_kw - 1e-9
                and not _is_deferred_flexible(session, priorities)
                and not _is_deferred_by_forecast(session, forecast)
            ]
            if not eligible:
                break

            session = sorted(
                eligible,
                key=lambda item: _allocation_sort_key(item, feasibility, priorities),
            )[0]
            info = feasibility[session.session_id]
            headroom = info.useful_power_limit_kw - allocations[session.session_id]
            amount = min(self.config.increment_kw, headroom, remaining)
            if amount <= 1e-9:
                break
            allocations[session.session_id] += amount
            remaining -= amount

        decisions: list[SessionOptimizationDecision] = []
        for session in sessions:
            info = feasibility[session.session_id]
            if budget.effective_ev_budget_kw <= 0 and info.useful_power_limit_kw > 0:
                reasons[session.session_id].append(ReasonCode.CAPACITY_LIMIT)
            if info.energy_remaining_kwh <= 0:
                reasons[session.session_id].append(ReasonCode.TARGET_REACHED)
            if _is_deferred_flexible(session, priorities):
                reasons[session.session_id].append(ReasonCode.TARGET_DEFERRED)
            forecast_reasons = _forecast_reason_codes(session, forecast)
            reasons[session.session_id].extend(forecast_reasons)
            decisions.append(
                SessionOptimizationDecision(
                    session_id=session.session_id,
                    vehicle_id=session.vehicle_id,
                    charger_id=session.charger_id,
                    allocated_power_kw=round(allocations[session.session_id], 6),
                    effective_max_kw=info.effective_max_kw,
                    priority_score=priorities[session.session_id].score,
                    feasible_by_deadline=info.feasible_by_deadline,
                    slack_hours=info.slack_hours,
                    reason_codes=tuple(dict.fromkeys(reasons[session.session_id])),
                )
            )
        return decisions


def _allocation_sort_key(
    session: SessionState,
    feasibility: dict[str, SessionFeasibility],
    priorities: dict[str, PriorityScore],
) -> tuple[float, float, float, float, str]:
    info = feasibility[session.session_id]
    priority = priorities[session.session_id]
    slack = info.slack_hours if info.slack_hours is not None else 1_000_000.0
    return (
        -priority.score,
        slack,
        -priority.fairness_component,
        session.arrival_time.timestamp(),
        session.session_id,
    )


def _is_deferred_flexible(
    session: SessionState,
    priorities: dict[str, PriorityScore],
) -> bool:
    requirement = session.charging_requirement
    if not requirement or requirement.readiness_deficit_soc > 0 or requirement.deadline:
        return False
    reason_codes = set(priorities[session.session_id].reason_codes)
    return bool(
        requirement.flexible_target_soc is not None
        and (
            ReasonCode.DEFERRED_FOR_HIGH_TARIFF in reason_codes
            or ReasonCode.DEFERRED_FOR_LOW_SOLAR in reason_codes
        )
    )


def _is_deferred_by_forecast(
    session: SessionState,
    forecast: EnergyForecast | None,
) -> bool:
    return bool(_forecast_reason_codes(session, forecast))


def _forecast_reason_codes(
    session: SessionState,
    forecast: EnergyForecast | None,
) -> list[ReasonCode]:
    if forecast is None or forecast.confidence < 0.55:
        return []
    requirement = session.charging_requirement
    if session.urgent:
        return []
    if requirement and (
        requirement.readiness_deficit_soc > 0
        or requirement.deadline is not None
        or requirement.requirement_source
        in {"TRIP", "EXPLICIT_DEPARTURE_TARGET", "URGENT", "PREDICTED_USAGE"}
    ):
        return []

    reasons: list[ReasonCode] = []
    if forecast.peak_risk >= 0.45:
        reasons.extend([ReasonCode.FORECAST_BUILDING_PEAK, ReasonCode.DEFERRED_FOR_FORECAST_PEAK])
    if session.mode == "GREENEST" and forecast.solar_opportunity >= 0.45:
        reasons.extend([ReasonCode.FORECAST_SOLAR_INCREASE, ReasonCode.DEFERRED_FOR_EXPECTED_SOLAR])
    if session.mode == "CHEAPEST" and any(
        point.tariff_state == "LOW" for point in forecast.tariff
    ):
        reasons.extend([ReasonCode.FORECAST_LOWER_TARIFF, ReasonCode.DEFERRED_FOR_EXPECTED_LOW_TARIFF])
    return reasons
