from app.optimizer.allocation import AllocationEngine
from app.forecasting.models import EnergyForecast
from app.optimizer.constraints import calculate_ev_power_budget
from app.optimizer.feasibility import FeasibilityEngine
from app.optimizer.models import OptimizationResult, ReasonCode, SessionOptimizationDecision
from app.optimizer.priority import PriorityEngine
from app.optimizer.validator import DecisionValidator
from app.state.models import SystemState


class OptimizationEngine:
    def __init__(
        self,
        feasibility_engine: FeasibilityEngine | None = None,
        priority_engine: PriorityEngine | None = None,
        allocation_engine: AllocationEngine | None = None,
        validator: DecisionValidator | None = None,
    ) -> None:
        self.feasibility_engine = feasibility_engine or FeasibilityEngine()
        self.priority_engine = priority_engine or PriorityEngine()
        self.allocation_engine = allocation_engine or AllocationEngine()
        self.validator = validator or DecisionValidator()
        self.fairness_credit_by_session_id: dict[str, float] = {}

    def optimize(
        self,
        state: SystemState,
        forecast: EnergyForecast | None = None,
    ) -> OptimizationResult:
        if state.site.grid_import_limit_kw <= 0:
            raise ValueError("SystemState must include a positive grid import limit")
        if state.site.transformer_operational_limit_kw <= 0:
            raise ValueError(
                "SystemState must include a positive transformer operational limit"
            )

        budget = calculate_ev_power_budget(state)
        feasibility = self.feasibility_engine.analyze(state)
        priorities = {
            session.session_id: self.priority_engine.score(
                state=state,
                session=session,
                feasibility=feasibility[session.session_id],
                fairness_credit=self.fairness_credit_by_session_id.get(
                    session.session_id, 0.0
                ),
            )
            for session in state.sessions
        }
        decisions = self.allocation_engine.allocate(
            sessions=state.sessions,
            feasibility=feasibility,
            priorities=priorities,
            budget=budget,
            forecast=forecast,
        )
        decisions = self._enrich_reason_codes(state, decisions, budget.effective_ev_budget_kw)
        total_allocated = sum(decision.allocated_power_kw for decision in decisions)
        result = OptimizationResult(
            timestamp=state.timestamp,
            grid_based_ev_budget_kw=budget.grid_based_ev_budget_kw,
            transformer_based_ev_budget_kw=budget.transformer_based_ev_budget_kw,
            effective_ev_budget_kw=budget.effective_ev_budget_kw,
            total_allocated_kw=total_allocated,
            unused_budget_kw=max(0.0, budget.effective_ev_budget_kw - total_allocated),
            constrained=total_allocated + 1e-6 < sum(
                feasibility[session.session_id].useful_power_limit_kw
                for session in state.sessions
            ),
            decisions=decisions,
            valid=True,
        )
        self.validator.validate(state, result)
        self._update_fairness(state, feasibility, result)
        return result

    def _enrich_reason_codes(
        self,
        state: SystemState,
        decisions: list[SessionOptimizationDecision],
        effective_budget_kw: float,
    ) -> list[SessionOptimizationDecision]:
        chargers = {charger.charger_id: charger for charger in state.chargers}
        sessions = {session.session_id: session for session in state.sessions}
        enriched: list[SessionOptimizationDecision] = []
        for decision in decisions:
            session = sessions[decision.session_id]
            charger = chargers.get(decision.charger_id)
            codes = list(decision.reason_codes)
            if charger and charger.status in {"FAULTED", "OFFLINE"}:
                codes.append(ReasonCode.OFFLINE_OR_FAULTED)
            if decision.allocated_power_kw == 0 and effective_budget_kw <= 0:
                codes.append(ReasonCode.CAPACITY_LIMIT)
            if session.charging_requirement:
                if session.charging_requirement.predicted_readiness_risk:
                    codes.append(ReasonCode.PREDICTED_READINESS_RISK)
                if session.charging_requirement.requirement_source == "PREDICTED_USAGE":
                    codes.append(ReasonCode.PREDICTED_USAGE)
            if session.current_soc >= 80:
                codes.append(ReasonCode.BATTERY_ACCEPTANCE_LIMIT)
            if session.current_soc >= 90:
                codes.append(ReasonCode.HIGH_SOC_TAPER)
            enriched.append(
                SessionOptimizationDecision(
                    session_id=decision.session_id,
                    vehicle_id=decision.vehicle_id,
                    charger_id=decision.charger_id,
                    allocated_power_kw=decision.allocated_power_kw,
                    effective_max_kw=decision.effective_max_kw,
                    priority_score=decision.priority_score,
                    feasible_by_deadline=decision.feasible_by_deadline,
                    slack_hours=decision.slack_hours,
                    reason_codes=tuple(dict.fromkeys(codes)),
                )
            )
        return enriched

    def _update_fairness(
        self,
        state: SystemState,
        feasibility,
        result: OptimizationResult,
    ) -> None:
        decisions = {decision.session_id: decision for decision in result.decisions}
        for session in state.sessions:
            info = feasibility[session.session_id]
            needed_now = info.required_average_power_kw or min(
                info.effective_max_kw,
                info.useful_power_limit_kw,
            )
            if needed_now <= 0:
                self.fairness_credit_by_session_id[session.session_id] = 0.0
                continue
            allocation = decisions[session.session_id].allocated_power_kw
            current = self.fairness_credit_by_session_id.get(session.session_id, 0.0)
            if allocation + 1e-6 < min(needed_now, info.effective_max_kw) * 0.8:
                current += 0.1
            else:
                current -= 0.15
            self.fairness_credit_by_session_id[session.session_id] = max(
                0.0,
                min(1.0, current),
            )
