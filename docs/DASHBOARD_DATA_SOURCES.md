# Dashboard Data Sources

Operational smart-charging values come from the Python backend. React may format, sort, filter, and style them, but does not calculate charging decisions.

| Field | Authoritative source | API/WS field | Frontend consumer |
| --- | --- | --- | --- |
| Grid limit | Python backend | `system_status.site.grid_import_limit_kw` | `useSystemState`, dashboard/smart charging |
| Building load | Python backend | `system_status.site.building_load_kw` | `useSystemState`, dashboard |
| Solar generation | Python backend | `system_status.site.solar_generation_kw` | `useSystemState`, dashboard |
| Grid import | Python backend | `system_status.site.grid_import_kw` | `useSystemState`, dashboard |
| EV load | Python backend | `system_status.site.ev_load_kw` | `useSystemState`, dashboard |
| Available EV capacity | Python backend | `system_status.site.available_ev_power_kw` | `useSystemState`, smart charging |
| Registered/connected/charging/waiting counts | Python backend | `system_status.counts.*` | `useSystemState`, dashboard |
| SOC and vehicle state | Python backend | `/api/dashboard` vehicle fields | `backendAdapters.js` |
| Charger state | Python backend | `/api/dashboard` charger fields | `backendAdapters.js` |
| Vehicle maximum | Python backend | vehicle `vehicle_max_power_kw` and AC/DC fields | `backendAdapters.js`, smart charging |
| Charger maximum | Python backend | vehicle `charger_max_power_kw`, charger `max_power_kw` | `backendAdapters.js`, smart charging |
| Effective session maximum | Python backend | vehicle `effective_max_power_kw` | `backendAdapters.js`, smart charging |
| Allocated power | Python backend | vehicle `allocated_power_kw` | `backendAdapters.js`, smart charging |
| Commanded power | Python backend | vehicle `commanded_power_kw` | `backendAdapters.js` |
| Actual delivered power | Python backend | vehicle `actual_power_kw`, site `ev_load_kw` | `backendAdapters.js`, dashboard/smart charging |
| Allocation and priority | Python backend | `system_status.optimization.decisions`, vehicle view | smart charging |
| Charging status | Python backend | vehicle `charging_status` | `backendAdapters.js`, smart charging |
| Feasibility and achievable SOC | Python backend | vehicle `feasibility` | smart charging |
| Range | Python backend | vehicle `estimated_range_km` | vehicle views |
| Departure/readiness | Python backend | vehicle `departure`, `trip_readiness` | vehicle views |
| Validator status | Python backend | `system_status.optimization.validator_valid` | smart charging safety panel |
| Energy forecast | Python backend | `/api/dashboard.forecast` / `/api/forecast` | Predictions page |
| Vehicle mobility prediction | Python backend | `/api/vehicles/{vehicle_id}/prediction` | Predictions page |
| Session history | Python backend | `/api/history/sessions` | Calendar past dates |
| Planned trips | Python backend | `/api/trips` | Calendar future dates |
| 3D vehicle identity/state | Python backend | normalized dashboard vehicle fields | Parking Lot 3D |
| 3D charger assignment/state | Python backend | normalized dashboard charger fields | Parking Lot 3D |
| Forecast | Python backend | `/api/dashboard.forecast` | backend integration layer |
| Alerts | Python backend | `/api/dashboard.active_alerts` | Alerts page |
| Explanations | Python backend | `/api/dashboard.recent_explanations` | Smart Charging page |

Legacy `simulationEngine.js`, `optimizationEngine.js`, and `seedData` remain only for explicitly local/demo pages until those pages are migrated. They must not overwrite normalized backend state.
