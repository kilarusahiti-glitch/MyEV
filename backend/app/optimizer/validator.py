import math

from app.optimizer.constraints import calculate_ev_power_budget
from app.optimizer.feasibility import FeasibilityEngine
from app.optimizer.models import OptimizationResult
from app.state.models import SystemState


class DecisionValidationError(ValueError):
    pass


class DecisionValidator:
    def __init__(self, tolerance_kw: float = 1e-6) -> None:
        self.tolerance_kw = tolerance_kw

    def validate(self, state: SystemState, result: OptimizationResult) -> None:
        budget = calculate_ev_power_budget(state)
        feasibility = FeasibilityEngine().analyze(state)
        decisions = {decision.session_id: decision for decision in result.decisions}

        total = 0.0
        for session in state.sessions:
            decision = decisions.get(session.session_id)
            if decision is None:
                raise DecisionValidationError(
                    f"Missing decision for session {session.session_id}"
                )
            allocation = decision.allocated_power_kw
            if not math.isfinite(allocation):
                raise DecisionValidationError("Allocation must be finite")
            if allocation < -self.tolerance_kw:
                raise DecisionValidationError("Allocation must be non-negative")

            limit = feasibility[session.session_id].effective_max_kw
            if allocation - limit > self.tolerance_kw:
                raise DecisionValidationError(
                    f"Allocation exceeds effective max for {session.session_id}"
                )
            if (
                feasibility[session.session_id].energy_remaining_kwh <= 0
                and allocation > self.tolerance_kw
            ):
                raise DecisionValidationError(
                    f"Target reached session allocated power: {session.session_id}"
                )
            total += allocation

        if total - budget.effective_ev_budget_kw > self.tolerance_kw:
            raise DecisionValidationError("Total allocation exceeds EV budget")
        if abs(total - result.total_allocated_kw) > self.tolerance_kw:
            raise DecisionValidationError("Result total does not match decisions")
        if not math.isfinite(result.total_allocated_kw) or result.total_allocated_kw < 0:
            raise DecisionValidationError("Result total must be finite and non-negative")
