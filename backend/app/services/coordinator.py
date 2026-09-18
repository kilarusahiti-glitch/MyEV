from dataclasses import dataclass

from app.alerts import Alert, AlertEngine
from app.explanations import DecisionExplanation, DecisionExplanationService
from app.forecasting import EnergyForecast, EnergyHistoryStore, ForecastEngine
from app.optimizer.engine import OptimizationEngine
from app.optimizer.models import OptimizationResult
from app.simulator.engine import SimulationEngine, SimulationSnapshot


@dataclass(frozen=True)
class SmartChargingCycleResult:
    snapshot: SimulationSnapshot
    optimization: OptimizationResult
    explanations: list[DecisionExplanation]
    alerts: list[Alert]
    forecast: EnergyForecast | None


class SmartChargingCoordinator:
    def __init__(
        self,
        simulation: SimulationEngine,
        optimizer: OptimizationEngine | None = None,
        explanations: DecisionExplanationService | None = None,
        alerts: AlertEngine | None = None,
        energy_history: EnergyHistoryStore | None = None,
        forecast_engine: ForecastEngine | None = None,
    ) -> None:
        self.simulation = simulation
        self.optimizer = optimizer or OptimizationEngine()
        self.explanations = explanations or DecisionExplanationService()
        self.alerts = alerts or AlertEngine()
        self.energy_history = energy_history or EnergyHistoryStore()
        self.forecast_engine = forecast_engine or ForecastEngine(
            self.energy_history,
            tariff=simulation.tariff,
        )
        self.decision_history: list[OptimizationResult] = []
        self.max_history = 200

    def cycle(self, delta_real_seconds: float) -> SmartChargingCycleResult:
        snapshot = self.simulation.tick(delta_real_seconds)
        if snapshot.system_state is None:
            raise ValueError("SimulationEngine must be configured with SiteConfig")
        self.energy_history.add_state(snapshot.system_state)
        forecast = self.forecast_engine.forecast(snapshot.system_state)
        optimization = self.optimizer.optimize(snapshot.system_state, forecast=forecast)
        explanations = self.explanations.explain(optimization, snapshot.system_state)
        alerts = self.alerts.evaluate(snapshot.system_state, optimization, forecast=forecast)
        self.simulation.apply_optimization(optimization)
        self.decision_history.append(optimization)
        self.decision_history = self.decision_history[-self.max_history :]
        return SmartChargingCycleResult(
            snapshot=snapshot,
            optimization=optimization,
            explanations=explanations,
            alerts=alerts,
            forecast=forecast,
        )
