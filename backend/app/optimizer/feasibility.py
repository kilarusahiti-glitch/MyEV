from datetime import datetime
from math import inf

from app.optimizer.constraints import effective_session_limit_from_state
from app.optimizer.models import SessionFeasibility
from app.state.models import ChargerState, SessionState, SystemState, VehicleState
from app.vehicle_intelligence.models import RequirementSource
from app.vehicle_intelligence.readiness import VehicleReadinessEngine

DEFAULT_CHARGING_EFFICIENCY = 0.92


class FeasibilityEngine:
    def __init__(
        self,
        charging_efficiency: float = DEFAULT_CHARGING_EFFICIENCY,
        control_interval_hours: float = 1.0,
    ) -> None:
        if not 0 < charging_efficiency <= 1:
            raise ValueError("charging_efficiency must be greater than 0 and at most 1")
        if control_interval_hours <= 0:
            raise ValueError("control_interval_hours must be positive")
        self.charging_efficiency = charging_efficiency
        self.control_interval_hours = control_interval_hours

    def analyze(self, state: SystemState) -> dict[str, SessionFeasibility]:
        vehicles = {vehicle.vehicle_id: vehicle for vehicle in state.vehicles}
        chargers = {charger.charger_id: charger for charger in state.chargers}
        return {
            session.session_id: self.analyze_session(
                state.timestamp,
                session,
                vehicles.get(session.vehicle_id),
                chargers.get(session.charger_id),
            )
            for session in state.sessions
        }

    def analyze_session(
        self,
        timestamp: datetime,
        session: SessionState,
        vehicle: VehicleState | None,
        charger: ChargerState | None,
    ) -> SessionFeasibility:
        if vehicle is None or charger is None:
            return _empty_feasibility(session)

        requirement = session.charging_requirement or VehicleReadinessEngine().build_requirement(
            vehicle,
            session,
            charger,
        )
        charging_target_soc = requirement.effective_required_soc
        if (
            requirement.flexible_target_soc is not None
            and requirement.requirement_source == RequirementSource.NONE
        ):
            charging_target_soc = requirement.flexible_target_soc

        energy_remaining = energy_remaining_kwh(
            battery_capacity_kwh=vehicle.usable_capacity_kwh or vehicle.battery_capacity_kwh,
            current_soc=session.current_soc,
            target_soc=charging_target_soc,
        )
        required_wall_energy = energy_remaining / self.charging_efficiency
        effective_max = effective_session_limit_from_state(session, vehicle, charger)
        useful_power_limit = min(
            effective_max,
            required_wall_energy / self.control_interval_hours
            if required_wall_energy > 0
            else 0.0,
        )

        deadline = requirement.deadline
        if deadline is None:
            return SessionFeasibility(
                session_id=session.session_id,
                vehicle_id=session.vehicle_id,
                charger_id=session.charger_id,
                energy_remaining_kwh=energy_remaining,
                required_wall_energy_kwh=required_wall_energy,
                effective_max_kw=effective_max,
                time_remaining_hours=None,
                minimum_charge_time_hours=(
                    required_wall_energy / effective_max if effective_max > 0 else None
                ),
                required_average_power_kw=None,
                slack_hours=None,
                feasible_by_deadline=None,
                achievable_soc_by_departure=None,
                useful_power_limit_kw=useful_power_limit,
            )

        time_remaining = (
            deadline - timestamp
        ).total_seconds() / 3600
        minimum_charge_time = (
            required_wall_energy / effective_max if effective_max > 0 else inf
        )
        required_average = (
            required_wall_energy / time_remaining if time_remaining > 0 else inf
        )
        slack = time_remaining - minimum_charge_time
        feasible = (
            energy_remaining == 0
            or (time_remaining > 0 and effective_max > 0 and slack >= 0)
        )
        achievable_soc = _achievable_soc(
            session=session,
            vehicle=vehicle,
            effective_max_kw=effective_max,
            time_remaining_hours=time_remaining,
            efficiency=self.charging_efficiency,
            target_soc=charging_target_soc,
        )

        return SessionFeasibility(
            session_id=session.session_id,
            vehicle_id=session.vehicle_id,
            charger_id=session.charger_id,
            energy_remaining_kwh=energy_remaining,
            required_wall_energy_kwh=required_wall_energy,
            effective_max_kw=effective_max,
            time_remaining_hours=time_remaining,
            minimum_charge_time_hours=minimum_charge_time if minimum_charge_time != inf else None,
            required_average_power_kw=required_average if required_average != inf else None,
            slack_hours=slack,
            feasible_by_deadline=feasible,
            achievable_soc_by_departure=achievable_soc,
            useful_power_limit_kw=useful_power_limit,
        )


def energy_remaining_kwh(
    battery_capacity_kwh: float,
    current_soc: float,
    target_soc: float,
) -> float:
    return max(0.0, battery_capacity_kwh * (target_soc - current_soc) / 100)


def _achievable_soc(
    session: SessionState,
    vehicle: VehicleState,
    effective_max_kw: float,
    time_remaining_hours: float,
    efficiency: float,
    target_soc: float,
) -> float:
    if time_remaining_hours <= 0 or effective_max_kw <= 0:
        return session.current_soc
    battery_energy = effective_max_kw * time_remaining_hours * efficiency
    soc_gain = battery_energy / vehicle.battery_capacity_kwh * 100
    return min(target_soc, session.current_soc + soc_gain)


def _empty_feasibility(session: SessionState) -> SessionFeasibility:
    return SessionFeasibility(
        session_id=session.session_id,
        vehicle_id=session.vehicle_id,
        charger_id=session.charger_id,
        energy_remaining_kwh=0.0,
        required_wall_energy_kwh=0.0,
        effective_max_kw=0.0,
        time_remaining_hours=None,
        minimum_charge_time_hours=None,
        required_average_power_kw=None,
        slack_hours=None,
        feasible_by_deadline=False,
        achievable_soc_by_departure=None,
        useful_power_limit_kw=0.0,
    )
