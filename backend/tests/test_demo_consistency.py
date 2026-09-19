from app.api.router import _status, _vehicle_view
from app.main import runtime
from app.models.enums import ChargingSessionStatus
from app.scenarios.models import ScenarioType


def reset_runtime() -> None:
    runtime.reset_scenario()
    runtime.set_speed(1)


def test_normal_bootstrap_has_authoritative_active_mixed_fleet() -> None:
    reset_runtime()
    state = runtime.get_current_state()
    status = _status(runtime)

    assert len(state.vehicles) == 6
    assert status["counts"]["registered_vehicles"] == 6
    assert status["counts"]["connected_vehicles"] == 5
    assert status["counts"]["charging_vehicles"] >= 2
    assert state.energy.ev_load_kw > 0
    assert sum(charger.actual_delivered_power_kw for charger in state.chargers) == state.energy.ev_load_kw


def test_power_and_status_semantics_are_consistent() -> None:
    reset_runtime()
    views = [_vehicle_view(runtime, vehicle.vehicle_id) for vehicle in runtime.get_current_state().vehicles]

    for view in views:
        if not view["plugged_in"]:
            assert view["charging_status"] == "DISCONNECTED"
            assert view["allocated_power_kw"] == 0
            assert view["actual_power_kw"] == 0
        if view["charging_status"] == "CHARGING":
            assert view["actual_power_kw"] > 0.01
            assert view["plugged_in"] is True
        assert view["allocated_power_kw"] <= view["effective_max_power_kw"] + 1e-6
        assert 0 <= view["current_soc"] <= 100


def test_pause_and_fault_stop_actual_delivery() -> None:
    reset_runtime()
    runtime.session("session-car-001").status = ChargingSessionStatus.PAUSED
    runtime.simulation_engine.chargers[0].set_commanded_power_kw(0)
    runtime.run_control_cycle(0)
    paused = _vehicle_view(runtime, "car-001")
    assert paused["charging_status"] == "PAUSED"
    assert paused["actual_power_kw"] == 0

    reset_runtime()
    runtime.activate_scenario(ScenarioType.CHARGER_FAULT)
    faulted = _vehicle_view(runtime, "car-001")
    assert faulted["charging_status"] == "FAULTED"
    assert faulted["actual_power_kw"] == 0
    assert faulted["allocated_power_kw"] == 0


def test_scenarios_change_backend_budget_and_restore_normal() -> None:
    reset_runtime()
    normal = _status(runtime)
    normal_budget = normal["site"]["available_ev_power_kw"]
    normal_solar = normal["site"]["solar_generation_kw"]
    normal_ev_load = normal["site"]["ev_load_kw"]

    runtime.activate_scenario(ScenarioType.BUILDING_PEAK)
    peak = _status(runtime)
    assert peak["site"]["building_load_kw"] > normal["site"]["building_load_kw"]
    assert peak["site"]["available_ev_power_kw"] < normal_budget
    assert peak["site"]["grid_import_kw"] <= peak["site"]["grid_import_limit_kw"]

    runtime.reset_scenario()
    runtime.activate_scenario(ScenarioType.SOLAR_SURGE)
    solar = _status(runtime)
    assert solar["site"]["solar_generation_kw"] > normal_solar
    assert solar["site"]["available_ev_power_kw"] > normal_budget

    runtime.reset_scenario()
    runtime.activate_scenario(ScenarioType.EV_RUSH)
    rush = _status(runtime)
    assert rush["counts"]["registered_vehicles"] > normal["counts"]["registered_vehicles"]
    assert rush["site"]["ev_load_kw"] > 0
    assert rush["optimization"]["validator_valid"] is True
    assert normal_ev_load > 0
