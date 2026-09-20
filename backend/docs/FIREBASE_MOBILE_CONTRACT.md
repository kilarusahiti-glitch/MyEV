# Firebase Mobile Contract

This is the shared contract between the mobile owner app, the FastAPI backend,
and the admin dashboard. Examples use fake values only.

## Project and identity

- Mobile, website, and backend Admin SDK must use the same Firebase project.
- Firebase Authentication owns credentials and produces the canonical `uid`.
- The user profile document is `users/{uid}`.
- Every vehicle document is `vehicles/{vehicle_id}` and contains the same
  stable `owner_uid` value as the Auth UID.
- `vehicle_id` must not change between app launches or synchronization cycles.

## User documents

Mobile creates or merges `users/{uid}` after successful registration or
onboarding. Safe fields include:

```json
{
  "uid": "user_fake_001",
  "display_name": "Demo Owner",
  "email": "owner@example.test",
  "created_at": "server timestamp",
  "updated_at": "server timestamp"
}
```

Do not store passwords, access tokens, refresh tokens, private keys, or service
account data in Firestore.

## Vehicle documents

Mobile creates or merges `vehicles/{vehicle_id}` with these required fields:

```json
{
  "vehicle_id": "vehicle_fake_001",
  "owner_uid": "user_fake_001",
  "name": "Demo EV",
  "vehicle_type": "CAR",
  "battery_capacity_kwh": 60,
  "current_soc": 45,
  "estimated_range_km": 220,
  "max_ac_kw": 11,
  "max_dc_kw": 100,
  "connector_types": ["TYPE2", "CCS2"]
}
```

Optional mobile-owned preference fields are `target_soc`, `departure_time`,
`charging_mode`, and `urgent`. The backend accepts the existing camelCase
compatibility spellings where already implemented, including `batteryCapacity`,
`currentSoc`, `targetSoc`, `maxChargingPower`, and `connectorTypes`.

Registration does not connect a vehicle to a charger. New vehicles enter the
backend as `DISCONNECTED` with zero allocation until a backend session and
physical charger connection exist.

## Backend-owned state

FastAPI owns the authoritative physical and optimization state, including
charger connection, actual power, allocated power, status, feasibility,
priority, readiness, explanations, and validator safety. Mobile must not write
these decision fields into the vehicle document.

The backend writes the current validated result to
`charging_sessions/{session_id}`. The result may contain:

```json
{
  "session_id": "session_fake_001",
  "owner_uid": "user_fake_001",
  "vehicle_id": "vehicle_fake_001",
  "vehicle_name": "Demo EV",
  "charger_id": "charger_fake_001",
  "status": "CHARGING",
  "current_soc": 52.4,
  "target_soc": 80,
  "allocated_kw": 7.2,
  "actual_kw": 7.1,
  "priority": 0.72,
  "feasible": true,
  "estimated_range_km": 240,
  "estimated_time_remaining_min": 137,
  "readiness_status": "MINIMUM_READY",
  "reason_codes": ["NORMAL_CHARGING"],
  "explanation": "Charging is within the validated site budget.",
  "charging_mode": "CHEAPEST",
  "validator_safe": true,
  "updated_at": "server timestamp"
}
```

Allowed result statuses include `CHARGING`, `WAITING`, `PAUSED`,
`TARGET_REACHED`, `FAULTED`, and `DISCONNECTED`.

## Access rules

Mobile queries vehicles and charging sessions filtered by the signed-in
`currentUser.uid` through `owner_uid`. A user must not read another owner's
records. Admin access is organization-authorized separately. Firestore rules
must not be weakened to global unauthenticated read/write access.

## Synchronization

FastAPI performs a failure-safe Firebase vehicle synchronization approximately
every 7 seconds while running. It merges valid vehicles by stable ID, keeps the
six-vehicle demo fallback, rejects malformed records, and broadcasts an
existing `/ws/live` update when the vehicle set changes.
