from fastapi.testclient import TestClient

from app.main import app, runtime


client = TestClient(app)


def reset_backend() -> None:
    runtime.reset_scenario()
    runtime.set_speed(1)


def test_health_and_openapi() -> None:
    assert client.get("/health").status_code == 200
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_status_dashboard_and_mixed_fleet() -> None:
    reset_backend()
    status = client.get("/api/system/status")
    dashboard = client.get("/api/dashboard")
    fleet = client.get("/api/vehicles").json()
    assert status.status_code == 200
    assert dashboard.status_code == 200
    assert {item["vehicle_type"] for item in fleet} >= {"CAR", "SCOOTER"}
    assert status.json()["optimization"]["validator_valid"] is True


def test_driver_range_is_vehicle_specific() -> None:
    reset_backend()
    car = client.get("/api/driver/car-001").json()["vehicle"]
    scooter = client.get("/api/driver/scooter-001").json()["vehicle"]
    assert car["estimated_range_km"] != scooter["estimated_range_km"]
    assert car["usable_capacity_kwh"] > scooter["usable_capacity_kwh"]


def test_charge_faster_is_urgent_and_safe() -> None:
    reset_backend()
    response = client.post("/api/vehicles/car-001/charge-faster")
    assert response.status_code == 200
    assert response.json()["urgent"] is True
    decision = next(item for item in runtime.current_result.optimization.decisions if item.vehicle_id == "car-001")
    assert decision.allocated_power_kw <= decision.effective_max_kw


def test_scenarios_change_physical_budget_and_reset() -> None:
    reset_backend()
    normal = client.get("/api/system/status").json()["site"]["available_ev_power_kw"]
    assert client.post("/api/scenarios/BUILDING_PEAK/activate").status_code == 200
    peak = client.get("/api/system/status").json()["site"]["available_ev_power_kw"]
    assert peak < normal
    assert client.post("/api/scenarios/reset").status_code == 200


def test_faulted_charger_gets_zero_allocation() -> None:
    reset_backend()
    assert client.post("/api/scenarios/CHARGER_FAULT/activate").status_code == 200
    state = client.get("/api/system/state").json()
    faulted = next(item for item in state["chargers"] if item["charger_id"] == "dc-001")
    assert faulted["status"] == "FAULTED"
    decision = next(item for item in runtime.current_result.optimization.decisions if item.charger_id == "dc-001")
    assert decision.allocated_power_kw == 0
    reset_backend()


def test_trip_and_preferences_feed_runtime() -> None:
    reset_backend()
    trip = client.post("/api/trips", json={"vehicle_id": "car-001", "distance_km": 80, "departure_time": "2026-01-01T14:00:00Z"})
    assert trip.status_code == 200
    assert runtime.get_current_state().sessions[0].planned_trip is not None
    preferences = client.patch("/api/sessions/session-car-001/preferences", json={"target_soc": 90, "urgent": True})
    assert preferences.status_code == 200
    assert preferences.json()["target_soc"] == 90


def test_stop_session_is_available_in_history() -> None:
    reset_backend()
    response = client.post("/api/sessions/session-car-001/stop")
    assert response.status_code == 200
    history = client.get("/api/history/sessions").json()
    assert any(item["session_id"] == "session-car-001" for item in history)


def test_websocket_initial_event() -> None:
    reset_backend()
    with client.websocket_connect("/ws/live") as websocket:
        message = websocket.receive_json()
        assert message["type"] == "SYSTEM_UPDATE"
        assert "data" in message
