from dataclasses import dataclass
from uuid import uuid4

from app.alerts.models import Alert, AlertSeverity, AlertStatus, AlertType
from app.forecasting.models import EnergyForecast
from app.optimizer.constraints import calculate_ev_power_budget
from app.optimizer.feasibility import FeasibilityEngine
from app.optimizer.models import OptimizationResult
from app.state.models import SystemState


@dataclass(frozen=True)
class AlertConfig:
    building_load_ratio_threshold: float = 0.75
    predicted_risk_threshold: float = 0.35
    solar_surplus_threshold_kw: float = 5.0
    forecast_confidence_threshold: float = 0.60
    forecast_peak_risk_threshold: float = 0.55
    forecast_solar_opportunity_threshold: float = 0.60
    max_history: int = 300


class AlertEngine:
    def __init__(self, config: AlertConfig | None = None) -> None:
        self.config = config or AlertConfig()
        self.active_alerts: dict[str, Alert] = {}
        self.alert_history: list[Alert] = []
        self._previous_target_reached: dict[str, bool] = {}

    def evaluate(
        self,
        state: SystemState,
        result: OptimizationResult,
        forecast: EnergyForecast | None = None,
    ) -> list[Alert]:
        desired: dict[str, Alert] = {}
        self._collect_building_alert(state, desired)
        self._collect_capacity_alert(state, result, desired)
        self._collect_session_alerts(state, result, desired)
        self._collect_charger_alerts(state, desired)
        self._collect_solar_alert(state, desired)
        self._collect_forecast_alerts(state, forecast, desired)

        emitted: list[Alert] = []
        for key, alert in desired.items():
            if key not in self.active_alerts:
                self.active_alerts[key] = alert
                emitted.append(alert)

        for key in list(self.active_alerts):
            if key not in desired:
                resolved = self.active_alerts.pop(key).model_copy(
                    update={
                        "active": False,
                        "status": AlertStatus.RESOLVED,
                        "timestamp": state.timestamp,
                    }
                )
                emitted.append(resolved)

        self.alert_history.extend(emitted)
        self.alert_history = self.alert_history[-self.config.max_history :]
        return emitted

    def _collect_building_alert(self, state: SystemState, desired: dict[str, Alert]) -> None:
        ratio = state.energy.building_load_kw / state.site.grid_import_limit_kw
        if ratio >= self.config.building_load_ratio_threshold:
            self._add(
                desired,
                state,
                AlertType.BUILDING_LOAD_HIGH,
                AlertSeverity.WARNING,
                "Building load is high",
                f"Building load is {ratio:.0%} of the grid import limit.",
                "site",
            )

    def _collect_forecast_alerts(
        self,
        state: SystemState,
        forecast: EnergyForecast | None,
        desired: dict[str, Alert],
    ) -> None:
        if forecast is None or forecast.confidence < self.config.forecast_confidence_threshold:
            return
        if forecast.peak_risk >= self.config.forecast_peak_risk_threshold:
            self._add(
                desired,
                state,
                AlertType.FORECAST_BUILDING_PEAK,
                AlertSeverity.WARNING,
                "Building peak expected",
                "Short-term forecast indicates building demand may rise soon.",
                "site",
            )
        if forecast.solar_opportunity >= self.config.forecast_solar_opportunity_threshold:
            self._add(
                desired,
                state,
                AlertType.FORECAST_SOLAR_OPPORTUNITY,
                AlertSeverity.INFO,
                "Solar opportunity expected",
                "Short-term forecast indicates solar generation may increase soon.",
                "site",
            )

    def _collect_capacity_alert(
        self,
        state: SystemState,
        result: OptimizationResult,
        desired: dict[str, Alert],
    ) -> None:
        useful_demand = sum(max(0.0, decision.effective_max_kw) for decision in result.decisions)
        if result.constrained and result.effective_ev_budget_kw < useful_demand:
            self._add(
                desired,
                state,
                AlertType.SITE_CAPACITY_CONSTRAINED,
                AlertSeverity.WARNING,
                "EV charging capacity is constrained",
                "Available EV charging capacity is below connected useful demand.",
                "site",
            )

    def _collect_session_alerts(
        self,
        state: SystemState,
        result: OptimizationResult,
        desired: dict[str, Alert],
    ) -> None:
        feasibility = FeasibilityEngine().analyze(state)
        decisions = {decision.session_id: decision for decision in result.decisions}
        for session in state.sessions:
            requirement = session.charging_requirement
            info = feasibility[session.session_id]
            if requirement and requirement.readiness_state == "BELOW_MINIMUM":
                self._add(
                    desired,
                    state,
                    AlertType.VEHICLE_BELOW_READINESS,
                    AlertSeverity.WARNING,
                    "Vehicle is below minimum readiness",
                    "Vehicle SOC is below its configured readiness policy.",
                    f"vehicle:{session.vehicle_id}",
                    vehicle_id=session.vehicle_id,
                    session_id=session.session_id,
                )
            if info.feasible_by_deadline is False:
                self._add(
                    desired,
                    state,
                    AlertType.TARGET_INFEASIBLE,
                    AlertSeverity.CRITICAL,
                    "Target may be infeasible",
                    "The requested SOC may not be reachable by the deadline.",
                    f"session:{session.session_id}",
                    vehicle_id=session.vehicle_id,
                    charger_id=session.charger_id,
                    session_id=session.session_id,
                )
            elif info.slack_hours is not None and info.slack_hours <= 0.25:
                self._add(
                    desired,
                    state,
                    AlertType.TARGET_AT_RISK,
                    AlertSeverity.WARNING,
                    "Target is at risk",
                    "Charging must continue near maximum to meet the deadline.",
                    f"session:{session.session_id}",
                    vehicle_id=session.vehicle_id,
                    charger_id=session.charger_id,
                    session_id=session.session_id,
                )
            if (
                requirement
                and requirement.predicted_readiness_risk is not None
                and requirement.mobility_prediction_confidence is not None
                and requirement.mobility_prediction_confidence >= 0.70
                and requirement.predicted_readiness_risk >= self.config.predicted_risk_threshold
            ):
                self._add(
                    desired,
                    state,
                    AlertType.PREDICTED_DEPARTURE_RISK,
                    AlertSeverity.WARNING,
                    "Predicted departure readiness risk",
                    "A high-confidence predicted departure is approaching while readiness is low.",
                    f"predicted:{session.vehicle_id}",
                    vehicle_id=session.vehicle_id,
                    session_id=session.session_id,
                )
            reached = session.current_soc >= session.target_soc
            previous = self._previous_target_reached.get(session.session_id, False)
            if reached and not previous:
                key = f"{AlertType.TARGET_REACHED.value}:session:{session.session_id}"
                desired[key] = self._new_alert(
                    state,
                    AlertType.TARGET_REACHED,
                    AlertSeverity.INFO,
                    "Target SOC reached",
                    "The vehicle reached its requested target SOC.",
                    key,
                    vehicle_id=session.vehicle_id,
                    charger_id=session.charger_id,
                    session_id=session.session_id,
                )
            self._previous_target_reached[session.session_id] = reached

    def _collect_charger_alerts(self, state: SystemState, desired: dict[str, Alert]) -> None:
        for charger in state.chargers:
            if charger.status == "FAULTED":
                self._add(
                    desired,
                    state,
                    AlertType.CHARGER_FAULT,
                    AlertSeverity.CRITICAL,
                    "Charger fault detected",
                    "A connected charger is faulted and cannot deliver power.",
                    f"charger:{charger.charger_id}",
                    charger_id=charger.charger_id,
                    session_id=charger.connected_session_id,
                    vehicle_id=charger.connected_vehicle_id,
                )

    def _collect_solar_alert(self, state: SystemState, desired: dict[str, Alert]) -> None:
        budget = calculate_ev_power_budget(state)
        if state.energy.solar_export_kw >= self.config.solar_surplus_threshold_kw or (
            state.energy.solar_generation_kw >= self.config.solar_surplus_threshold_kw
            and budget.effective_ev_budget_kw > 0
        ):
            self._add(
                desired,
                state,
                AlertType.SOLAR_SURPLUS,
                AlertSeverity.INFO,
                "Solar charging opportunity",
                "Solar generation is meaningfully available for charging.",
                "site",
            )

    def _add(
        self,
        desired: dict[str, Alert],
        state: SystemState,
        alert_type: AlertType,
        severity: AlertSeverity,
        title: str,
        message: str,
        entity_key: str,
        vehicle_id: str | None = None,
        charger_id: str | None = None,
        session_id: str | None = None,
    ) -> None:
        key = f"{alert_type.value}:{entity_key}"
        desired[key] = self._new_alert(
            state,
            alert_type,
            severity,
            title,
            message,
            key,
            vehicle_id,
            charger_id,
            session_id,
        )

    def _new_alert(
        self,
        state: SystemState,
        alert_type: AlertType,
        severity: AlertSeverity,
        title: str,
        message: str,
        key: str,
        vehicle_id: str | None = None,
        charger_id: str | None = None,
        session_id: str | None = None,
    ) -> Alert:
        return Alert(
            alert_id=str(uuid4()),
            timestamp=state.timestamp,
            type=alert_type,
            severity=severity,
            title=title,
            message=message,
            vehicle_id=vehicle_id,
            charger_id=charger_id,
            session_id=session_id,
            active=True,
            status=AlertStatus.ACTIVE,
            deduplication_key=key,
        )
