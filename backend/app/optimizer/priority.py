from dataclasses import dataclass

from app.models.enums import ChargingMode
from app.optimizer.models import PriorityScore, ReasonCode, SessionFeasibility
from app.state.models import SessionState, SystemState


@dataclass(frozen=True)
class PriorityWeights:
    readiness: float = 0.22
    deadline: float = 0.35
    predicted_readiness: float = 0.12
    energy: float = 0.12
    fairness: float = 0.10
    mode: float = 0.10
    opportunity: float = 0.09
    urgent_boost: float = 0.75


class PriorityEngine:
    def __init__(self, weights: PriorityWeights | None = None) -> None:
        self.weights = weights or PriorityWeights()

    def score(
        self,
        state: SystemState,
        session: SessionState,
        feasibility: SessionFeasibility,
        fairness_credit: float = 0.0,
    ) -> PriorityScore:
        reason_codes: list[ReasonCode] = []
        requirement = session.charging_requirement
        readiness_component = 0.0
        if requirement:
            readiness_component = min(1.0, max(0.0, requirement.readiness_deficit_soc) / 30)
            if requirement.readiness_state == "BELOW_MINIMUM":
                readiness_component = max(readiness_component, 0.8)
                reason_codes.append(ReasonCode.BELOW_MINIMUM_READINESS)
                reason_codes.append(ReasonCode.READINESS_PRIORITY)
            if requirement.requirement_source == "TRIP" and not requirement.trip_ready:
                readiness_component = max(readiness_component, 0.9)
                reason_codes.append(ReasonCode.TRIP_CHARGING_REQUIRED)
            if requirement.trip_ready:
                reason_codes.append(ReasonCode.TRIP_READY)
            if requirement.requirement_feasible is False:
                reason_codes.append(ReasonCode.TRIP_INFEASIBLE)
            if requirement.flexible_target_soc is not None:
                reason_codes.append(ReasonCode.FLEXIBLE_TARGET)
            if requirement.requirement_source == "PREDICTED_USAGE":
                reason_codes.append(ReasonCode.PREDICTED_USAGE)
        predicted_component = (
            requirement.predicted_readiness_risk
            if requirement and requirement.predicted_readiness_risk is not None
            else 0.0
        )
        if predicted_component > 0:
            reason_codes.append(ReasonCode.PREDICTED_READINESS_RISK)
        if session.current_soc >= 80:
            reason_codes.append(ReasonCode.BATTERY_ACCEPTANCE_LIMIT)
        if session.current_soc >= 90:
            reason_codes.append(ReasonCode.HIGH_SOC_TAPER)

        deadline_component = _deadline_component(feasibility)
        if deadline_component >= 0.65:
            reason_codes.append(ReasonCode.DEPARTURE_PRIORITY)
        if feasibility.feasible_by_deadline is False:
            reason_codes.append(ReasonCode.TARGET_INFEASIBLE)
        elif feasibility.slack_hours is not None and feasibility.slack_hours <= 0.25:
            reason_codes.append(ReasonCode.TARGET_AT_RISK)

        energy_component = min(1.0, feasibility.energy_remaining_kwh / 50)
        fairness_component = max(0.0, min(1.0, fairness_credit))
        if fairness_component >= 0.2:
            reason_codes.append(ReasonCode.FAIRNESS_ADJUSTMENT)

        mode_component, mode_reasons = _mode_component(state, session, feasibility)
        reason_codes.extend(mode_reasons)
        opportunity_component = _opportunity_component(state, session, feasibility)
        if (
            session.mode == ChargingMode.GREENEST.value
            and opportunity_component > 0
            and state.energy.solar_generation_kw > 1
        ):
            reason_codes.append(ReasonCode.SOLAR_AVAILABLE)
        if (
            session.mode == ChargingMode.CHEAPEST.value
            and state.tariff.current_level == "LOW"
        ):
            reason_codes.append(ReasonCode.LOW_TARIFF_WINDOW)

        urgent_boost = self.weights.urgent_boost if session.urgent else 0.0
        if session.urgent:
            reason_codes.append(ReasonCode.URGENT_REQUEST)

        score = (
            readiness_component * self.weights.readiness
            + deadline_component * self.weights.deadline
            + predicted_component * self.weights.predicted_readiness
            + energy_component * self.weights.energy
            + fairness_component * self.weights.fairness
            + mode_component * self.weights.mode
            + opportunity_component * self.weights.opportunity
            + urgent_boost
        )
        if not reason_codes:
            reason_codes.append(ReasonCode.NORMAL_CHARGING)

        return PriorityScore(
            session_id=session.session_id,
            score=max(0.0, score),
            readiness_component=readiness_component,
            deadline_component=deadline_component,
            energy_component=energy_component,
            fairness_component=fairness_component,
            mode_component=mode_component,
            opportunity_component=opportunity_component,
            urgent_boost=urgent_boost,
            reason_codes=tuple(dict.fromkeys(reason_codes)),
        )


def _deadline_component(feasibility: SessionFeasibility) -> float:
    if feasibility.energy_remaining_kwh <= 0:
        return 0.0
    if feasibility.slack_hours is None:
        return 0.0
    if feasibility.slack_hours <= 0:
        return 1.0
    if feasibility.slack_hours >= 4:
        return 0.0
    return (4 - feasibility.slack_hours) / 4


def _mode_component(
    state: SystemState,
    session: SessionState,
    feasibility: SessionFeasibility,
) -> tuple[float, list[ReasonCode]]:
    if session.mode == ChargingMode.FAST.value:
        return 1.0, []
    if session.mode == ChargingMode.CHEAPEST.value:
        must_charge = (
            feasibility.required_average_power_kw is not None
            and feasibility.required_average_power_kw >= feasibility.effective_max_kw * 0.5
        )
        if (
            session.charging_requirement
            and session.charging_requirement.readiness_deficit_soc > 0
        ):
            must_charge = True
        if state.tariff.current_level == "PEAK" and _has_substantial_slack(feasibility) and not must_charge:
            return 0.0, [ReasonCode.DEFERRED_FOR_HIGH_TARIFF]
        if state.tariff.current_level == "LOW":
            return 0.9, [ReasonCode.LOW_TARIFF_WINDOW]
        return 0.45, []
    if session.mode == ChargingMode.GREENEST.value:
        if state.energy.solar_generation_kw > 1:
            return 0.9, [ReasonCode.SOLAR_AVAILABLE]
        if _has_substantial_slack(feasibility):
            return 0.1, [ReasonCode.DEFERRED_FOR_LOW_SOLAR]
        return 0.45, []
    return 0.5, []


def _opportunity_component(
    state: SystemState,
    session: SessionState,
    feasibility: SessionFeasibility,
) -> float:
    if state.tariff.current_level == "LOW":
        return 0.8
    if state.energy.solar_generation_kw > 1:
        return min(1.0, state.energy.solar_generation_kw / 50)
    if session.mode == ChargingMode.CHEAPEST.value and state.tariff.current_level == "PEAK":
        return 0.0
    if feasibility.slack_hours is not None and feasibility.slack_hours <= 0.5:
        return 0.5
    return 0.25


def _has_substantial_slack(feasibility: SessionFeasibility) -> bool:
    return feasibility.slack_hours is None or feasibility.slack_hours > 1.0
