from dataclasses import dataclass

from app.state.models import ChargerState, SessionState, VehicleState
from app.vehicle_intelligence.eta import estimate_charging_eta_hours
from app.vehicle_intelligence.models import (
    ChargingRequirement,
    PlannedTrip,
    ReadinessState,
    RequirementSource,
)
from app.vehicle_intelligence.trip import (
    DEFAULT_TRIP_ENERGY_BUFFER_PERCENT,
    buffered_trip_energy_kwh,
    required_departure_soc_percent,
)


@dataclass(frozen=True)
class ReadinessConfig:
    trip_energy_buffer_percent: float = DEFAULT_TRIP_ENERGY_BUFFER_PERCENT
    default_minimum_readiness_soc: float = 30.0
    high_confidence_threshold: float = 0.70
    medium_confidence_threshold: float = 0.40


class VehicleReadinessEngine:
    def __init__(self, config: ReadinessConfig | None = None) -> None:
        self.config = config or ReadinessConfig()

    def build_requirement(
        self,
        vehicle: VehicleState,
        session: SessionState,
        charger: ChargerState | None = None,
    ) -> ChargingRequirement:
        minimum_soc = vehicle.minimum_readiness_soc
        user_target = session.target_soc
        trip = session.planned_trip
        trip_required_soc: float | None = None
        trip_energy = 0.0
        trip_feasible: bool | None = None
        trip_ready: bool | None = None

        if trip:
            trip_required_soc, trip_feasible = required_departure_soc_percent(
                trip=trip,
                usable_capacity_kwh=vehicle.usable_capacity_kwh,
                estimated_consumption_kwh_per_km=vehicle.estimated_consumption_kwh_per_km,
                buffer_percent=self.config.trip_energy_buffer_percent,
            )
            trip_energy = buffered_trip_energy_kwh(
                trip,
                vehicle.estimated_consumption_kwh_per_km,
                self.config.trip_energy_buffer_percent,
            )
            trip_ready = vehicle.current_soc >= trip_required_soc

        mandatory_soc = minimum_soc
        source = RequirementSource.MINIMUM_READINESS
        deadline = None
        if vehicle.current_soc >= minimum_soc:
            source = RequirementSource.NONE

        if trip and trip_required_soc is not None and not trip_ready:
            mandatory_soc = max(mandatory_soc, min(100.0, trip_required_soc))
            deadline = trip.departure_time
            source = RequirementSource.TRIP

        if session.explicit_departure_time is not None:
            mandatory_soc = max(mandatory_soc, user_target)
            deadline = (
                min(deadline, session.explicit_departure_time)
                if deadline
                else session.explicit_departure_time
            )
            source = RequirementSource.EXPLICIT_DEPARTURE_TARGET

        prediction = session.mobility_prediction
        if (
            prediction
            and source in {RequirementSource.NONE, RequirementSource.MINIMUM_READINESS}
            and session.explicit_departure_time is None
            and not trip
            and prediction.confidence >= self.config.high_confidence_threshold
        ):
            mandatory_soc = max(
                mandatory_soc,
                min(100.0, prediction.readiness.recommended_soc),
            )
            deadline = prediction.readiness.planning_deadline
            source = RequirementSource.PREDICTED_USAGE

        if session.urgent:
            mandatory_soc = max(mandatory_soc, user_target)
            source = RequirementSource.URGENT

        flexible_target = None
        if user_target > mandatory_soc and not session.urgent and session.explicit_departure_time is None:
            flexible_target = user_target

        effective_required_soc = mandatory_soc
        if source == RequirementSource.NONE and flexible_target is not None:
            effective_required_soc = vehicle.current_soc
        readiness_deficit = max(0.0, effective_required_soc - vehicle.current_soc)
        state = _readiness_state(vehicle.current_soc, minimum_soc, trip_ready, user_target)
        eta_min = _eta(vehicle, charger, minimum_soc)
        eta_trip = _eta(vehicle, charger, trip_required_soc) if trip_required_soc else None
        eta_target = _eta(vehicle, charger, user_target)

        return ChargingRequirement(
            minimum_readiness_soc=minimum_soc,
            trip_required_soc=trip_required_soc,
            user_target_soc=user_target,
            effective_required_soc=effective_required_soc,
            mandatory_soc=mandatory_soc,
            flexible_target_soc=flexible_target,
            requirement_source=source,
            deadline=deadline,
            energy_required_kwh=max(
                0.0,
                (effective_required_soc - vehicle.current_soc)
                / 100
                * vehicle.usable_capacity_kwh,
            ),
            readiness_deficit_soc=readiness_deficit,
            trip_ready=trip_ready,
            requirement_feasible=trip_feasible is not False,
            readiness_state=state,
            trip_feasible_on_full_charge=trip_feasible,
            eta_to_minimum_readiness_hours=eta_min,
            eta_to_trip_ready_hours=eta_trip,
            eta_to_user_target_hours=eta_target,
            mobility_prediction_confidence=(
                prediction.confidence if prediction else None
            ),
            predicted_readiness_risk=(
                prediction.readiness.readiness_risk if prediction else None
            ),
        )


def _eta(
    vehicle: VehicleState,
    charger: ChargerState | None,
    target_soc: float | None,
) -> float | None:
    if target_soc is None:
        return None
    charger_max = charger.max_power_kw if charger else max(vehicle.max_ac_kw, vehicle.max_dc_kw)
    vehicle_max = (
        vehicle.max_ac_kw if charger and charger.charger_type == "AC" else max(vehicle.max_ac_kw, vehicle.max_dc_kw)
    )
    return estimate_charging_eta_hours(
        current_soc=vehicle.current_soc,
        target_soc=target_soc,
        usable_capacity_kwh=vehicle.usable_capacity_kwh,
        vehicle_electrical_max_kw=vehicle_max,
        charger_max_kw=charger_max,
    )


def _readiness_state(
    current_soc: float,
    minimum_soc: float,
    trip_ready: bool | None,
    user_target_soc: float,
) -> ReadinessState:
    if trip_ready is False:
        return ReadinessState.TRIP_NOT_READY
    if trip_ready is True:
        return ReadinessState.TRIP_READY
    if current_soc < minimum_soc:
        return ReadinessState.BELOW_MINIMUM
    if current_soc >= user_target_soc:
        return ReadinessState.TARGET_READY
    return ReadinessState.MINIMUM_READY
