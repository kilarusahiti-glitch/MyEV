# VoltFlow Frontend Integration Contract

The backend is the single authoritative source for physical state, telemetry, optimization, allocation, scenarios, alerts, and explanations. It uses an in-memory persistence fallback for development; Firebase can be connected behind the repository interface later.

## Startup and network

From `backend/`:

```powershell
python -m pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Use the backend machine's LAN address from mobile and dashboard devices:

```text
API_BASE_URL=http://<BACKEND_DEVICE_LAN_IP>:8000
WS_BASE_URL=ws://<BACKEND_DEVICE_LAN_IP>:8000/ws/live
```

Development CORS origins are configured with `CORS_ALLOW_ORIGINS`, a comma-separated list. React Native requests may omit an Origin header. Firebase ID tokens are accepted as a future auth boundary; this hackathon runtime is explicitly development/demo mode and does not silently verify arbitrary production tokens.

Swagger and machine-readable OpenAPI are available at `/docs` and `/openapi.json`.

## REST endpoints

All response timestamps are ISO-8601. Request validation errors are `422`; missing IDs are `404`; invalid simulator values are `400`.

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/health` | Availability check | No |
| GET | `/api/system/status` | Site, counts, simulation, optimization, forecast and alert summary | No in demo |
| GET | `/api/system/state` | Normalized authoritative `SystemState` | No in demo |
| GET | `/api/dashboard` | Dashboard aggregate | No in demo |
| GET | `/api/vehicles` | All configured/demo vehicles | No in demo |
| GET | `/api/vehicles/{vehicle_id}` | Vehicle intelligence and latest decision view | No in demo |
| GET | `/api/driver/{vehicle_id}` | Mobile aggregate view | No in demo |
| GET | `/api/vehicles/{vehicle_id}/prediction` | Mobility prediction, if history exists | No in demo |
| GET | `/api/forecast` | 15/30/60 minute forecast | No in demo |
| GET | `/api/alerts?include_history=false` | Active alerts; optional lifecycle history | No in demo |
| GET | `/api/explanations?vehicle_id=...` | Recent decision explanations | No in demo |
| GET | `/api/scenarios` | Available and active scenario | No in demo |
| POST | `/api/scenarios/{scenario}/activate` | Change physical scenario | Admin/demo |
| POST | `/api/scenarios/reset` | Restore deterministic baseline | Admin/demo |
| POST | `/api/simulator/step?seconds=1` | Advance physics and control cycle | Admin/demo |
| POST | `/api/simulator/speed` | JSON `{ "speed": 1 }`, `10`, or `60` | Admin/demo |
| POST | `/api/simulator/reset` | Reset physical scenario | Admin/demo |
| GET | `/api/trips` | Planned trips | No in demo |
| POST | `/api/trips` | Create a trip; backend calculates readiness | User |
| DELETE | `/api/trips/{trip_id}` | Clear a trip | User |
| PATCH | `/api/sessions/{session_id}/preferences` | Change target, departure, mode, urgent | User |
| POST | `/api/vehicles/{vehicle_id}/charge-faster` | Set urgent and rerun safe allocation | User |
| POST | `/api/sessions/{session_id}/start` | Start session | User |
| POST | `/api/sessions/{session_id}/pause` | Pause session | User |
| POST | `/api/sessions/{session_id}/resume` | Resume session | User |
| POST | `/api/sessions/{session_id}/stop` | Finalize and persist session history | User |
| GET | `/api/history/sessions` | Completed charging history | User |

Preference JSON:

```json
{"target_soc": 85, "departure_time": "2026-01-01T16:00:00Z", "mode": "CHEAPEST", "urgent": false}
```

## WebSocket

Connect to `/ws/live`. The stable envelope is:

```json
{"type":"SYSTEM_UPDATE","timestamp":"2026-01-01T12:00:00Z","data":{}}
```

Events currently emitted are `SYSTEM_UPDATE`, `telemetry_update`, `scenario_activated`, `charging_state_change`, `session_started`, `session_stopped`, and `charge_faster_activated`. Events are emitted after meaningful mutations. `data` contains the same frontend-friendly status or mutation payload available from REST. The optimizer is not run once per client connection.

## Enums and units

Vehicle types: `CAR`, `BIKE`, `SCOOTER`. Charging modes: `FAST`, `CHEAPEST`, `GREENEST`. Charger statuses: `AVAILABLE`, `CONNECTED`, `CHARGING`, `PAUSED`, `FAULTED`, `OFFLINE`. Session statuses: `CONNECTED`, `CHARGING`, `PAUSED`, `COMPLETED`, `CANCELLED`, `FAULTED`. Alert severity: `INFO`, `WARNING`, `CRITICAL`. Telemetry quality: `GOOD`, `STALE`, `OFFLINE`, `INVALID`. Scenarios: `NORMAL`, `BUILDING_PEAK`, `SOLAR_SURGE`, `EV_RUSH`, `CHARGER_FAULT`, `RESET`.

Power is `kW`, energy is `kWh`, state of charge is percent, distance is `km`, and timestamps include timezone information. `SIMULATED_SENSOR`, `VIRTUAL_CHARGER`, `PROFILE_ESTIMATE`, `DEMO`, and `PREDICTED` identify source rather than claiming physical hardware truth.

Reason codes returned by `/api/explanations` are `NORMAL_CHARGING`, `DEPARTURE_PRIORITY`, `URGENT_REQUEST`, `BELOW_MINIMUM_READINESS`, `READINESS_PRIORITY`, `TRIP_CHARGING_REQUIRED`, `TRIP_READY`, `TRIP_TARGET_AT_RISK`, `TRIP_INFEASIBLE`, `FLEXIBLE_TARGET`, `TARGET_DEFERRED`, `BATTERY_ACCEPTANCE_LIMIT`, `HIGH_SOC_TAPER`, `PREDICTED_USAGE`, `PREDICTED_READINESS_RISK`, `FORECAST_BUILDING_PEAK`, `CHARGE_NOW_BEFORE_PEAK`, `DEFERRED_FOR_FORECAST_PEAK`, `FORECAST_SOLAR_INCREASE`, `DEFERRED_FOR_EXPECTED_SOLAR`, `FORECAST_LOWER_TARIFF`, `DEFERRED_FOR_EXPECTED_LOW_TARIFF`, `LOW_TARIFF_WINDOW`, `SOLAR_AVAILABLE`, `CAPACITY_LIMIT`, `FAIRNESS_ADJUSTMENT`, `TARGET_REACHED`, `CHARGER_LIMIT`, `VEHICLE_LIMIT`, `TARGET_AT_RISK`, `TARGET_INFEASIBLE`, `DEFERRED_FOR_HIGH_TARIFF`, `DEFERRED_FOR_LOW_SOLAR`, `OFFLINE_OR_FAULTED`, `INCOMPATIBLE_CONNECTOR`, and `DISCONNECTED`.

## Recommended client calls

Mobile should usually call `/api/driver/{vehicle_id}`, `/api/vehicles/{vehicle_id}/charge-faster`, session preferences, trips, history, and `/ws/live`.

Dashboard should usually call `/api/dashboard`, `/api/system/status`, `/api/scenarios`, `/api/alerts`, `/api/explanations`, and `/ws/live`.

## Safety behavior

`Charge Faster` only sets `urgent=true` and reruns the optimizer. It never writes vehicle-max power directly. Allocation remains bounded by vehicle capability, charger capability, connector compatibility, battery acceptance/taper, site grid/transformer budgets, and independent decision validation. Bikes and scooters use the same capability-driven optimizer as cars.

Estimated range is authoritative in the backend:

```text
usable_capacity_kwh = nominal_capacity_kwh * soh_percent / 100
available_energy_kwh = usable_capacity_kwh * current_soc / 100
estimated_range_km = available_energy_kwh / vehicle_consumption_kwh_per_km
```

Reference/manufacturer range remains separate from this profile estimate.
