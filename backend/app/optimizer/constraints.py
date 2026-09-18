from app.models.charger import Charger
from app.models.enums import ChargerType
from app.models.session import ChargingSession
from app.models.vehicle import Vehicle
from app.optimizer.models import EVPowerBudget
from app.state.models import ChargerState, SessionState, SystemState, VehicleState
from app.vehicle_intelligence.charging_curve import battery_acceptance_limit_kw


def is_connector_compatible(vehicle: Vehicle, charger: Charger) -> bool:
    return charger.connector_type in vehicle.connector_types


def vehicle_charging_limit_kw(vehicle: Vehicle, charger_type: ChargerType) -> float:
    if charger_type == ChargerType.AC:
        return vehicle.max_ac_kw
    if charger_type == ChargerType.DC:
        return vehicle.max_dc_kw
    raise ValueError(f"Unsupported charger type: {charger_type}")


def effective_charging_limit_kw(vehicle: Vehicle, charger: Charger) -> float:
    if not is_connector_compatible(vehicle, charger):
        raise ValueError(
            f"Vehicle {vehicle.id} is not compatible with charger {charger.id}"
        )

    vehicle_limit_kw = vehicle_charging_limit_kw(vehicle, charger.charger_type)
    return min(vehicle_limit_kw, charger.max_power_kw)


def effective_session_max_power_kw(
    session: ChargingSession,
    vehicle: Vehicle,
    charger: Charger,
) -> float:
    if session.vehicle_id != vehicle.id:
        raise ValueError("Session vehicle_id does not match vehicle.id")
    if session.charger_id != charger.id:
        raise ValueError("Session charger_id does not match charger.id")

    return effective_charging_limit_kw(vehicle, charger)


def calculate_ev_power_budget(state: SystemState) -> EVPowerBudget:
    grid_based = max(
        0.0,
        state.site.grid_import_limit_kw
        - state.energy.building_load_kw
        + state.energy.solar_generation_kw
        - state.site.safety_reserve_kw,
    )
    transformer_based = max(
        0.0,
        state.site.transformer_operational_limit_kw
        - state.energy.building_load_kw
        + state.energy.solar_generation_kw
        - state.site.safety_reserve_kw,
    )
    return EVPowerBudget(
        grid_based_ev_budget_kw=grid_based,
        transformer_based_ev_budget_kw=transformer_based,
        effective_ev_budget_kw=min(grid_based, transformer_based),
    )


def connector_compatible_from_state(
    vehicle: VehicleState,
    charger: ChargerState,
) -> bool:
    return charger.connector_type in vehicle.connector_types


def vehicle_charging_limit_from_state(
    vehicle: VehicleState,
    charger: ChargerState,
) -> float:
    if charger.charger_type == ChargerType.AC.value:
        return vehicle.max_ac_kw
    if charger.charger_type == ChargerType.DC.value:
        return vehicle.max_dc_kw
    return 0.0


def effective_session_limit_from_state(
    session: SessionState,
    vehicle: VehicleState | None,
    charger: ChargerState | None,
) -> float:
    if vehicle is None or charger is None:
        return 0.0
    if session.vehicle_id != vehicle.vehicle_id or session.charger_id != charger.charger_id:
        return 0.0
    if not vehicle.connected:
        return 0.0
    if charger.connected_vehicle_id != vehicle.vehicle_id:
        return 0.0
    if charger.connected_session_id != session.session_id:
        return 0.0
    if charger.status in {"FAULTED", "OFFLINE"}:
        return 0.0
    if session.current_soc >= session.target_soc:
        return 0.0
    if not connector_compatible_from_state(vehicle, charger):
        return 0.0

    vehicle_limit = vehicle_charging_limit_from_state(vehicle, charger)
    acceptance_limit = battery_acceptance_limit_kw(vehicle_limit, session.current_soc)
    return min(vehicle_limit, charger.max_power_kw, acceptance_limit)
