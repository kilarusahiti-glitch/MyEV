from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder

from app.alerts.models import Alert
from app.api.schemas import PreferenceUpdate, SpeedRequest, StatusResponse, TripRequest
from app.models.enums import ChargingMode
from app.models.enums import ChargingSessionStatus
from app.optimizer.feasibility import FeasibilityEngine
from app.scenarios.models import ScenarioType
from app.services.runtime import ApplicationRuntime
from app.vehicle_intelligence.models import PlannedTrip, TripRequirementSource


router = APIRouter(prefix="/api")
ws_router = APIRouter()


def _runtime() -> ApplicationRuntime:
    from app.main import runtime
    return runtime


def _status(runtime: ApplicationRuntime) -> dict[str, Any]:
    state = runtime.get_current_state()
    result = runtime.current_result
    active = [alert for alert in runtime.alert_engine.active_alerts.values() if alert.active]
    severity_order = {"INFO": 1, "WARNING": 2, "CRITICAL": 3}
    highest = max((alert.severity.value for alert in active), key=lambda value: severity_order[value], default=None)
    optimization = result.optimization if result else None
    effective = optimization.effective_ev_budget_kw if optimization else 0.0
    grid_utilization = (state.energy.grid_import_kw / state.site.grid_import_limit_kw * 100) if state.site.grid_import_limit_kw else 0.0
    grid_stress_level = "CRITICAL" if grid_utilization >= 90 else "HIGH" if grid_utilization >= 75 else "WATCH" if grid_utilization >= 55 else "LOW"
    emergency_mode = not (optimization.valid if optimization else True) or grid_utilization >= 100
    charging_threshold_kw = 0.01
    connected_count = sum(vehicle.connected for vehicle in state.vehicles)
    charging_count = sum(charger.actual_delivered_power_kw > charging_threshold_kw for charger in state.chargers)
    paused_count = sum(session.status == "PAUSED" for session in state.sessions)
    waiting_count = sum(
        vehicle.connected
        and next((charger.actual_delivered_power_kw for charger in state.chargers if charger.connected_vehicle_id == vehicle.vehicle_id), 0.0) <= charging_threshold_kw
        and next((session.status for session in state.sessions if session.vehicle_id == vehicle.vehicle_id), "") not in {"PAUSED", "COMPLETED", "CANCELLED"}
        for vehicle in state.vehicles
    )
    return {
        "timestamp": state.timestamp,
        "site": {"grid_import_limit_kw": state.site.grid_import_limit_kw, "transformer_operational_limit_kw": state.site.transformer_operational_limit_kw, "safety_reserve_kw": state.site.safety_reserve_kw, "building_load_kw": state.energy.building_load_kw, "solar_generation_kw": state.energy.solar_generation_kw, "grid_import_kw": state.energy.grid_import_kw, "grid_export_kw": state.energy.solar_export_kw, "ev_load_kw": state.energy.ev_load_kw, "available_ev_power_kw": effective},
        "counts": {"registered_vehicles": len(state.vehicles), "connected_vehicles": connected_count, "charging_vehicles": charging_count, "waiting_vehicles": waiting_count, "paused_vehicles": paused_count, "faulted_chargers": sum(charger.status == "FAULTED" for charger in state.chargers)},
        "simulation": {"speed": runtime.simulation_engine.clock.speed, "scenario": runtime.current_scenario.value, "mode": runtime.mode, "simulated_time": state.timestamp},
        "optimization": {"last_optimization_timestamp": optimization.timestamp if optimization else None, "constrained": optimization.constrained if optimization else False, "total_allocated_power_kw": optimization.total_allocated_kw if optimization else 0.0, "unused_ev_budget_kw": optimization.unused_budget_kw if optimization else effective, "validator_valid": optimization.valid if optimization else True, "decisions": [decision.__dict__ for decision in optimization.decisions] if optimization else []},
        "forecast_summary": {"peak_risk": runtime.current_forecast.peak_risk if runtime.current_forecast else 0.0, "solar_opportunity": runtime.current_forecast.solar_opportunity if runtime.current_forecast else 0.0},
        "alert_summary": {"active_count": len(active), "highest_severity": highest},
        "grid_utilization_percent": grid_utilization,
        "grid_stress_level": grid_stress_level,
        "emergency_mode": emergency_mode,
        "tariff": state.tariff.model_dump(mode="json"),
        "vehicles": [_vehicle_view(runtime, vehicle.vehicle_id) for vehicle in state.vehicles],
        "chargers": [charger.model_dump(mode="json") for charger in state.chargers],
    }


def _vehicle_view(runtime: ApplicationRuntime, vehicle_id: str) -> dict[str, Any]:
    ev = runtime.vehicle(vehicle_id)
    if ev is None:
        raise HTTPException(404, "Vehicle not found")
    state = runtime.get_current_state()
    vehicle_state = next(item for item in state.vehicles if item.vehicle_id == vehicle_id)
    charger = next((item for item in state.chargers if item.connected_vehicle_id == vehicle_id), None)
    session = next((item for item in state.sessions if item.vehicle_id == vehicle_id), None)
    firebase_preferences = runtime.firebase_preferences.get(vehicle_id)
    decision = next((item for item in runtime.current_result.optimization.decisions if item.vehicle_id == vehicle_id), None) if runtime.current_result else None
    feasibility = FeasibilityEngine().analyze(state).get(session.session_id) if session else None
    explanation = next((item for item in reversed(runtime.explanation_service.explanation_history) if item.vehicle_id == vehicle_id), None)
    actual_power_kw = charger.actual_delivered_power_kw if charger else 0.0
    commanded_power_kw = charger.commanded_power_kw if charger else 0.0
    charger_type = charger.charger_type if charger else None
    vehicle_max_kw = (ev.vehicle.max_ac_kw if charger_type == "AC" else ev.vehicle.max_dc_kw) if charger_type else 0.0
    if not ev.vehicle.connected:
        charging_status = "DISCONNECTED"
    elif charger and charger.status in {"FAULTED", "OFFLINE"}:
        charging_status = "FAULTED"
    elif session and session.status in {"PAUSED", "COMPLETED", "CANCELLED"}:
        charging_status = "PAUSED" if session.status == "PAUSED" else "TARGET_REACHED" if session.status == "COMPLETED" else "DISCONNECTED"
    elif session and session.current_soc >= session.target_soc:
        charging_status = "TARGET_REACHED"
    elif actual_power_kw > 0.01:
        charging_status = "CHARGING"
    else:
        charging_status = "WAITING"
    return {"vehicle_id": vehicle_id, "owner_uid": ev.vehicle.owner_uid, "owner_display_name": runtime.owner_names.get(vehicle_id) or None, "owner_email": runtime.owner_emails.get(vehicle_id) or None, "name": ev.vehicle.name, "vehicle_type": ev.vehicle.vehicle_type.value, "battery_capacity_kwh": ev.vehicle.battery_capacity_kwh, "usable_capacity_kwh": vehicle_state.usable_capacity_kwh, "current_soc": ev.current_soc, "target_soc": session.target_soc if session else (firebase_preferences.target_soc if firebase_preferences else None), "minimum_readiness_soc": ev.vehicle.minimum_readiness_soc, "max_ac_power_kw": ev.vehicle.max_ac_kw, "max_dc_power_kw": ev.vehicle.max_dc_kw, "vehicle_max_power_kw": vehicle_max_kw, "charger_max_power_kw": charger.max_power_kw if charger else 0.0, "effective_max_power_kw": decision.effective_max_kw if decision else 0.0, "allocated_power_kw": decision.allocated_power_kw if decision else 0.0, "commanded_power_kw": commanded_power_kw, "actual_power_kw": actual_power_kw, "charging_status": charging_status, "plugged_in": ev.vehicle.connected, "charger_id": charger.charger_id if charger else None, "connector": charger.connector_type if charger else None, "soh_percent": ev.vehicle.estimated_soh_percent, "soh_source": ev.vehicle.soh_source.value, "estimated_consumption_kwh_per_km": ev.vehicle.estimated_consumption_kwh_per_km, "estimated_range_km": runtime.range_for(ev), "reference_range_km": ev.vehicle.estimated_range_km, "range_source": "BACKEND_USABLE_CAPACITY", "mode": session.mode if session else (firebase_preferences.charging_mode.value if firebase_preferences else None), "departure": session.explicit_departure_time if session else (firebase_preferences.departure_time if firebase_preferences else None), "urgent": session.urgent if session else (firebase_preferences.urgent if firebase_preferences else False), "priority_score": decision.priority_score if decision else None, "reason_codes": [code.value for code in decision.reason_codes] if decision else [], "feasibility": feasibility.__dict__ if feasibility else None, "trip_readiness": session.charging_requirement.model_dump(mode="json") if session and session.charging_requirement else None, "latest_explanation": explanation.model_dump(mode="json") if explanation else None}


@router.get("/system/status", response_model=StatusResponse, summary="Get the current smart charging status")
def system_status() -> dict[str, Any]:
    return _status(_runtime())


@router.get("/vehicles", summary="List connected and configured vehicles")
def vehicles() -> list[dict[str, Any]]:
    runtime = _runtime()
    return [_vehicle_view(runtime, ev.vehicle.id) for ev in runtime.simulation_engine.evs]


@router.get("/vehicles/{vehicle_id}", summary="Get a vehicle integration view")
def vehicle(vehicle_id: str) -> dict[str, Any]:
    return _vehicle_view(_runtime(), vehicle_id)


@router.get("/driver/{vehicle_id}", summary="Get the mobile driver aggregate view")
def driver_view(vehicle_id: str) -> dict[str, Any]:
    runtime = _runtime()
    view = _vehicle_view(runtime, vehicle_id)
    alerts = [alert.model_dump(mode="json") for alert in runtime.alert_engine.active_alerts.values() if alert.vehicle_id == vehicle_id or alert.vehicle_id is None]
    prediction = None
    state = runtime.get_current_state()
    vehicle_state = next(item for item in state.vehicles if item.vehicle_id == vehicle_id)
    predicted = runtime.mobility_predictor.predict(vehicle_id, state.timestamp, vehicle_state)
    return {"vehicle": view, "charging_session": next((item.model_dump(mode="json") for item in state.sessions if item.vehicle_id == vehicle_id), None), "prediction_summary": predicted.model_dump(mode="json") if predicted else None, "charger": next((item.model_dump(mode="json") for item in state.chargers if item.connected_vehicle_id == vehicle_id), None), "latest_explanation": view["latest_explanation"], "active_alerts": alerts}


@router.get("/dashboard", summary="Get the dashboard aggregate view")
def dashboard() -> dict[str, Any]:
    runtime = _runtime()
    state = runtime.get_current_state()
    return {"system_status": _status(runtime), "vehicles": vehicles(), "chargers": [item.model_dump(mode="json") for item in state.chargers], "active_sessions": [item.model_dump(mode="json") for item in state.sessions], "forecast": runtime.current_forecast.model_dump(mode="json") if runtime.current_forecast else None, "active_alerts": [item.model_dump(mode="json") for item in runtime.alert_engine.active_alerts.values()], "recent_explanations": [item.model_dump(mode="json") for item in runtime.explanation_service.explanation_history[-20:]], "current_scenario": runtime.current_scenario.value, "simulation_speed": runtime.simulation_engine.clock.speed}


@router.get("/forecast", summary="Get the 15, 30, and 60 minute energy forecast")
def forecast() -> dict[str, Any]:
    runtime = _runtime()
    return runtime.current_forecast.model_dump(mode="json") if runtime.current_forecast else {}


@router.get("/vehicles/{vehicle_id}/prediction", summary="Get a vehicle mobility prediction")
def prediction(vehicle_id: str) -> dict[str, Any] | None:
    runtime = _runtime()
    state = runtime.get_current_state()
    vehicle_state = next((item for item in state.vehicles if item.vehicle_id == vehicle_id), None)
    if vehicle_state is None:
        raise HTTPException(404, "Vehicle not found")
    value = runtime.mobility_predictor.predict(vehicle_id, state.timestamp, vehicle_state)
    return value.model_dump(mode="json") if value else None


@router.get("/alerts", summary="Get active alerts")
def alerts(include_history: bool = False) -> dict[str, Any]:
    runtime = _runtime()
    active = [item.model_dump(mode="json") for item in runtime.alert_engine.active_alerts.values()]
    return {"active": active, "history": [item.model_dump(mode="json") for item in runtime.alert_engine.alert_history] if include_history else []}


@router.get("/explanations", summary="Get recent optimizer explanations")
def explanations(vehicle_id: str | None = None) -> list[dict[str, Any]]:
    items = _runtime().explanation_service.explanation_history
    return [item.model_dump(mode="json") for item in items if vehicle_id is None or item.vehicle_id == vehicle_id]


@router.get("/scenarios", summary="List available scenarios")
def scenarios() -> dict[str, Any]:
    return {"current": _runtime().current_scenario.value, "available": [item.value for item in ScenarioType]}


@router.post("/scenarios/{scenario}/activate", summary="Activate a physical simulation scenario")
async def activate_scenario(scenario: ScenarioType) -> dict[str, Any]:
    runtime = _runtime()
    try:
        event = runtime.activate_scenario(scenario)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    await runtime.websocket_manager.broadcast("scenario_activated", {"timestamp": event.timestamp.isoformat(), "event": event.model_dump(mode="json"), "system_status": _status(runtime)})
    return event.model_dump(mode="json")


@router.post("/scenarios/reset", summary="Reset physical simulation state")
async def reset_scenario() -> dict[str, Any]:
    return await activate_scenario(ScenarioType.RESET)


@router.post("/simulator/step", summary="Advance physics and run one control cycle")
async def simulator_step(seconds: float = 1.0) -> dict[str, Any]:
    runtime = _runtime()
    result = runtime.run_control_cycle(seconds)
    payload = _status(runtime)
    await runtime.websocket_manager.broadcast("telemetry_update", payload)
    return payload


@router.post("/simulator/speed", summary="Set simulation speed")
def simulator_speed(request: SpeedRequest) -> dict[str, int]:
    try:
        _runtime().set_speed(request.speed)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"speed": request.speed}


@router.post("/simulator/reset", summary="Reset scenario state")
async def simulator_reset() -> dict[str, Any]:
    return await reset_scenario()


@router.patch("/sessions/{session_id}/preferences", summary="Update charging preferences")
async def preferences(session_id: str, request: PreferenceUpdate) -> dict[str, Any]:
    runtime = _runtime()
    try:
        session = runtime.update_preferences(session_id, **request.model_dump(exclude_none=True))
    except KeyError as exc:
        raise HTTPException(404, "Session not found") from exc
    await runtime.websocket_manager.broadcast("charging_state_change", _status(runtime))
    return session.model_dump(mode="json")


@router.post("/sessions/{session_id}/start", summary="Start a charging session")
async def start_session(session_id: str) -> dict[str, Any]:
    runtime = _runtime()
    session = runtime.session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    session.status = ChargingSessionStatus.CHARGING
    runtime.run_control_cycle(0.0)
    await runtime.websocket_manager.broadcast("session_started", _status(runtime))
    return session.model_dump(mode="json")


@router.post("/sessions/{session_id}/pause", summary="Pause a charging session")
async def pause_session(session_id: str) -> dict[str, Any]:
    runtime = _runtime()
    session = runtime.session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    session.status = ChargingSessionStatus.PAUSED
    for charger in runtime.simulation_engine.chargers:
        if charger.connected_session and charger.connected_session.id == session_id:
            charger.set_commanded_power_kw(0.0)
    runtime.run_control_cycle(0.0)
    await runtime.websocket_manager.broadcast("charging_state_change", _status(runtime))
    return session.model_dump(mode="json")


@router.post("/sessions/{session_id}/resume", summary="Resume a charging session")
async def resume_session(session_id: str) -> dict[str, Any]:
    runtime = _runtime()
    session = runtime.session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    session.status = ChargingSessionStatus.CHARGING
    runtime.run_control_cycle(0.0)
    await runtime.websocket_manager.broadcast("charging_state_change", _status(runtime))
    return session.model_dump(mode="json")


@router.post("/sessions/{session_id}/stop", summary="Stop and finalize a charging session")
async def stop_session(session_id: str) -> dict[str, Any]:
    runtime = _runtime()
    session = runtime.session(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    session.status = ChargingSessionStatus.COMPLETED
    for charger in runtime.simulation_engine.chargers:
        if charger.connected_session and charger.connected_session.id == session_id:
            charger.disconnect()
    record = runtime.finalize_session(session)
    runtime.run_control_cycle(0.0)
    await runtime.websocket_manager.broadcast("session_stopped", {"record": record, "system_status": _status(runtime)})
    return record


@router.post("/vehicles/{vehicle_id}/charge-faster", summary="Mark a vehicle urgent and rerun safe allocation")
async def charge_faster(vehicle_id: str) -> dict[str, Any]:
    try:
        session = _runtime().charge_faster(vehicle_id)
    except KeyError as exc:
        raise HTTPException(404, "Vehicle or session not found") from exc
    runtime = _runtime()
    await runtime.websocket_manager.broadcast("charge_faster_activated", {"vehicle_id": vehicle_id, "session_id": session.id, "system_status": _status(runtime)})
    return {"vehicle_id": vehicle_id, "urgent": True, "session": session.model_dump(mode="json"), "explanation": next((item.model_dump(mode="json") for item in reversed(runtime.explanation_service.explanation_history) if item.vehicle_id == vehicle_id), None)}


@router.get("/trips", summary="List planned trips")
def trips() -> list[dict[str, Any]]:
    return [trip.model_dump(mode="json") for trip in _runtime().trips.values()]


@router.get("/calendar", summary="Get backend-owned calendar history and projections")
def calendar() -> dict[str, Any]:
    """Return deterministic demo history plus short-horizon backend projections.

    These records are explicitly labelled so the UI never presents synthetic
    history or forecast values as measured IoT telemetry.
    """
    runtime = _runtime()
    state = runtime.get_current_state()
    today = state.timestamp.date()
    site = state.energy
    history: list[dict[str, Any]] = []
    for offset in range(14, 0, -1):
        day = today - timedelta(days=offset)
        factor = 0.88 + ((offset * 7) % 9) / 100
        history.append({
            "date": day.isoformat(),
            "kind": "HISTORY",
            "label": "SIMULATED HISTORY",
            "building_energy_kwh": round(site.building_load_kw * 24 * factor, 2),
            "solar_energy_kwh": round(site.solar_generation_kw * 8 * factor, 2),
            "peak_grid_import_kw": round((site.building_load_kw + site.ev_load_kw) * factor, 2),
            "completed_sessions": 3 + (offset % 4),
        })
    forecast: list[dict[str, Any]] = []
    for offset in range(1, 8):
        day = today + timedelta(days=offset)
        forecast.append({
            "date": day.isoformat(),
            "kind": "FORECAST",
            "label": "FORECAST",
            "peak_building_kw": round(site.building_load_kw * (1 + (offset % 3) * 0.04), 2),
            "expected_solar_kw": round(site.solar_generation_kw * max(0.65, 1 - (offset % 4) * 0.05), 2),
            "available_ev_capacity_kw": round(runtime.current_result.optimization.effective_ev_budget_kw if runtime.current_result else 0.0, 2),
            "peak_risk": round(runtime.current_forecast.peak_risk if runtime.current_forecast else 0.0, 2),
            "solar_opportunity": round(runtime.current_forecast.solar_opportunity if runtime.current_forecast else 0.0, 2),
        })
    return {"today": today.isoformat(), "history": history, "forecast": forecast}


@router.get("/chargers/health-history", summary="Get hourly virtual charger sensor samples")
def charger_health_history() -> dict[str, Any]:
    return {
        "sample_interval_seconds": 3600,
        "source": "VIRTUAL_SENSORS",
        "samples": list(_runtime().charger_health_samples),
    }


@router.post("/trips", summary="Create or replace a planned trip")
async def create_trip(request: TripRequest) -> dict[str, Any]:
    runtime = _runtime()
    trip = PlannedTrip(trip_id=f"trip-{uuid4().hex[:10]}", source=TripRequirementSource.USER_EXPLICIT, **request.model_dump())
    try:
        runtime.set_trip(trip)
    except KeyError as exc:
        raise HTTPException(404, "Vehicle not found") from exc
    await runtime.websocket_manager.broadcast("charging_state_change", _status(runtime))
    return trip.model_dump(mode="json")


@router.delete("/trips/{trip_id}", status_code=204, summary="Clear a planned trip")
def delete_trip(trip_id: str) -> None:
    if trip_id not in _runtime().trips:
        raise HTTPException(404, "Trip not found")
    _runtime().clear_trip(trip_id)


@router.get("/history/sessions", summary="Get finalized charging history")
def session_history() -> list[dict[str, Any]]:
    return _runtime().persistence.list_sessions()


@router.get("/system/state", summary="Get the authoritative normalized SystemState")
def system_state() -> dict[str, Any]:
    return _runtime().get_current_state().model_dump(mode="json")


@ws_router.websocket("/ws/live")
async def live_websocket(websocket: WebSocket) -> None:
    runtime = _runtime()
    await runtime.websocket_manager.connect(websocket)
    try:
        await websocket.send_json(jsonable_encoder({"type": "SYSTEM_UPDATE", "timestamp": runtime.get_current_state().timestamp.isoformat(), "data": _status(runtime)}))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        runtime.websocket_manager.disconnect(websocket)
