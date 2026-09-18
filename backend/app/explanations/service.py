import math

from app.explanations.models import DecisionExplanation, ExplanationSeverity
from app.optimizer.models import OptimizationResult, ReasonCode, SessionOptimizationDecision
from app.state.models import SystemState


PRIMARY_REASON_PRECEDENCE = [
    ReasonCode.OFFLINE_OR_FAULTED,
    ReasonCode.TARGET_REACHED,
    ReasonCode.TARGET_INFEASIBLE,
    ReasonCode.TRIP_INFEASIBLE,
    ReasonCode.TARGET_AT_RISK,
    ReasonCode.TRIP_TARGET_AT_RISK,
    ReasonCode.URGENT_REQUEST,
    ReasonCode.BELOW_MINIMUM_READINESS,
    ReasonCode.TRIP_CHARGING_REQUIRED,
    ReasonCode.DEPARTURE_PRIORITY,
    ReasonCode.PREDICTED_USAGE,
    ReasonCode.PREDICTED_READINESS_RISK,
    ReasonCode.DEFERRED_FOR_FORECAST_PEAK,
    ReasonCode.CHARGE_NOW_BEFORE_PEAK,
    ReasonCode.DEFERRED_FOR_EXPECTED_SOLAR,
    ReasonCode.DEFERRED_FOR_EXPECTED_LOW_TARIFF,
    ReasonCode.CAPACITY_LIMIT,
    ReasonCode.SOLAR_AVAILABLE,
    ReasonCode.LOW_TARIFF_WINDOW,
    ReasonCode.DEFERRED_FOR_HIGH_TARIFF,
    ReasonCode.FAIRNESS_ADJUSTMENT,
    ReasonCode.NORMAL_CHARGING,
]


class DecisionExplanationService:
    def __init__(self, max_history: int = 200) -> None:
        self.max_history = max_history
        self.previous_allocations_by_session_id: dict[str, float] = {}
        self.explanation_history: list[DecisionExplanation] = []

    def explain(
        self,
        result: OptimizationResult,
        state: SystemState,
    ) -> list[DecisionExplanation]:
        explanations = [
            self._explain_decision(decision, state, result)
            for decision in result.decisions
        ]
        self.previous_allocations_by_session_id = {
            decision.session_id: decision.allocated_power_kw
            for decision in result.decisions
        }
        self.explanation_history.extend(explanations)
        self.explanation_history = self.explanation_history[-self.max_history :]
        return explanations

    def _explain_decision(
        self,
        decision: SessionOptimizationDecision,
        state: SystemState,
        result: OptimizationResult,
    ) -> DecisionExplanation:
        previous = self.previous_allocations_by_session_id.get(decision.session_id)
        change = (
            decision.allocated_power_kw - previous if previous is not None else None
        )
        primary = select_primary_reason(decision.reason_codes)
        if (
            change is not None
            and change < -0.01
            and result.constrained
            and not {
                ReasonCode.DEFERRED_FOR_FORECAST_PEAK,
                ReasonCode.DEFERRED_FOR_EXPECTED_SOLAR,
                ReasonCode.DEFERRED_FOR_EXPECTED_LOW_TARIFF,
            }.intersection(decision.reason_codes)
        ):
            primary = ReasonCode.CAPACITY_LIMIT
        severity = _severity(primary)
        headline = _headline(primary, decision, previous, change)
        detail = _detail(primary, decision, state, result, previous, change)
        if not math.isfinite(decision.allocated_power_kw):
            raise ValueError("Invalid allocation in explanation")
        return DecisionExplanation(
            session_id=decision.session_id,
            vehicle_id=decision.vehicle_id,
            charger_id=decision.charger_id,
            allocated_power_kw=decision.allocated_power_kw,
            previous_allocated_power_kw=previous,
            change_kw=change,
            primary_reason_code=primary,
            reason_codes=decision.reason_codes,
            headline=headline,
            detail=detail,
            severity=severity,
            timestamp=result.timestamp,
        )


def select_primary_reason(reason_codes: tuple[ReasonCode, ...]) -> ReasonCode:
    codes = set(reason_codes)
    for reason in PRIMARY_REASON_PRECEDENCE:
        if reason in codes:
            return reason
    return reason_codes[0] if reason_codes else ReasonCode.NORMAL_CHARGING


def _headline(
    primary: ReasonCode,
    decision: SessionOptimizationDecision,
    previous: float | None,
    change: float | None,
) -> str:
    if primary == ReasonCode.OFFLINE_OR_FAULTED:
        return "Charging stopped because the connected charger is faulted or offline."
    if primary == ReasonCode.TARGET_REACHED:
        return "Charging stopped because the target SOC was reached."
    if primary in {ReasonCode.TARGET_INFEASIBLE, ReasonCode.TRIP_INFEASIBLE}:
        return "The requested target may not be achievable before departure."
    if primary == ReasonCode.BELOW_MINIMUM_READINESS:
        return "Charging prioritized because the vehicle is below minimum readiness."
    if primary == ReasonCode.PREDICTED_USAGE:
        return "Charging prioritized because the predicted departure window is approaching."
    if primary == ReasonCode.DEFERRED_FOR_HIGH_TARIFF:
        return "Charging deferred because the current tariff is high and the target is flexible."
    if primary == ReasonCode.SOLAR_AVAILABLE:
        return "Charging increased because solar generation is currently available."
    if primary == ReasonCode.DEFERRED_FOR_FORECAST_PEAK:
        return "Charging reduced because building demand is expected to rise soon and the target is flexible."
    if primary == ReasonCode.CHARGE_NOW_BEFORE_PEAK:
        return "Charging continues now because the required energy should be delivered before an expected building peak."
    if primary == ReasonCode.DEFERRED_FOR_EXPECTED_SOLAR:
        return "Charging deferred because more solar generation is expected soon."
    if primary == ReasonCode.DEFERRED_FOR_EXPECTED_LOW_TARIFF:
        return "Charging deferred because a lower tariff window is expected soon."
    if change is not None and change < -0.01 and primary == ReasonCode.CAPACITY_LIMIT:
        return "Charging reduced because site capacity is limited."
    if change is not None and change > 0.01:
        return "Charging allocation increased."
    return "Charging allocation is valid for current site conditions."


def _detail(
    primary: ReasonCode,
    decision: SessionOptimizationDecision,
    state: SystemState,
    result: OptimizationResult,
    previous: float | None,
    change: float | None,
) -> str:
    if previous is not None and change is not None:
        direction = "increased" if change > 0 else "reduced" if change < 0 else "remained"
        prefix = (
            f"Allocation {direction} from {previous:.1f} kW to "
            f"{decision.allocated_power_kw:.1f} kW. "
        )
    else:
        prefix = f"Allocation is {decision.allocated_power_kw:.1f} kW. "

    if change is not None and change < -0.01 and result.constrained:
        return (
            prefix
            + "Available EV capacity is constrained by current building load, solar generation, and site limits."
        )
    if primary == ReasonCode.SOLAR_AVAILABLE and change is not None and change > 0.01:
        return prefix + "Solar generation improved the opportunity to charge."
    if primary == ReasonCode.OFFLINE_OR_FAULTED:
        return prefix + "The charger status in SystemState prevents power allocation."
    if primary == ReasonCode.PREDICTED_USAGE:
        return prefix + "A high-confidence mobility prediction is active for this session."
    if primary in {
        ReasonCode.DEFERRED_FOR_FORECAST_PEAK,
        ReasonCode.DEFERRED_FOR_EXPECTED_SOLAR,
        ReasonCode.DEFERRED_FOR_EXPECTED_LOW_TARIFF,
    }:
        return prefix + "A short-term forecast affected this flexible charging decision."
    return (
        prefix
        + f"EV budget is {result.effective_ev_budget_kw:.1f} kW; "
        + f"building load is {state.energy.building_load_kw:.1f} kW."
    )


def _severity(primary: ReasonCode) -> ExplanationSeverity:
    if primary in {ReasonCode.TARGET_INFEASIBLE, ReasonCode.TRIP_INFEASIBLE, ReasonCode.OFFLINE_OR_FAULTED}:
        return ExplanationSeverity.CRITICAL
    if primary in {ReasonCode.TARGET_AT_RISK, ReasonCode.TRIP_TARGET_AT_RISK, ReasonCode.CAPACITY_LIMIT}:
        return ExplanationSeverity.WARNING
    return ExplanationSeverity.INFO
