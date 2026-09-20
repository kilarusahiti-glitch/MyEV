from __future__ import annotations

import logging
import os
import time
from typing import Any, Protocol

LOGGER = logging.getLogger(__name__)


class PersistenceRepository(Protocol):
    def save_session(self, record: dict[str, Any]) -> None: ...
    def list_sessions(self) -> list[dict[str, Any]]: ...
    def save_snapshot(self, record: dict[str, Any]) -> None: ...
    def save_event(self, record: dict[str, Any]) -> None: ...
    def load_vehicle_records(self) -> list[dict[str, Any]]: ...
    def load_user_records(self) -> dict[str, dict[str, Any]]: ...
    def set_all_vehicle_connections(self, connected: bool) -> int: ...
    def save_optimization_result(self, record: dict[str, Any]) -> None: ...


class InMemoryPersistenceRepository:
    """Development fallback; high-frequency telemetry never belongs here."""

    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}
        self._snapshots: dict[str, dict[str, Any]] = {}
        self._events: list[dict[str, Any]] = []
        self._results: dict[str, dict[str, Any]] = {}

    def save_session(self, record: dict[str, Any]) -> None:
        self._sessions[str(record["session_id"])] = dict(record)

    def list_sessions(self) -> list[dict[str, Any]]:
        return list(self._sessions.values())

    def save_snapshot(self, record: dict[str, Any]) -> None:
        snapshot_id = str(record.get("snapshot_id") or record.get("updated_at") or len(self._snapshots))
        self._snapshots[snapshot_id] = dict(record)

    def save_event(self, record: dict[str, Any]) -> None:
        self._events.append(dict(record))

    def load_vehicle_records(self) -> list[dict[str, Any]]:
        return []

    def load_user_records(self) -> dict[str, dict[str, Any]]:
        return {}

    def set_all_vehicle_connections(self, connected: bool) -> int:
        return 0

    def save_optimization_result(self, record: dict[str, Any]) -> None:
        self._results[str(record["session_id"])] = dict(record)


class FirebasePersistenceRepository:
    """Optional Firestore persistence with an in-memory safety net.

    The repository is deliberately outside the optimizer and is only enabled
    when FIREBASE_PERSISTENCE_ENABLED=true and Google credentials are present.
    A Firestore outage never propagates into the charging control loop.
    """

    def __init__(self, fallback: InMemoryPersistenceRepository | None = None) -> None:
        self._fallback = fallback or InMemoryPersistenceRepository()
        self._client = None
        self._last_result_write = 0.0
        self._result_cache: dict[str, tuple[str, float]] = {}
        self._user_records_cache: dict[str, dict[str, Any]] = {}
        self._user_records_loaded_at = 0.0
        try:
            import firebase_admin
            from firebase_admin import auth
            from firebase_admin import credentials, firestore

            try:
                firebase_app = firebase_admin.get_app()
            except ValueError:
                credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                credential = (
                    credentials.Certificate(credential_path)
                    if credential_path
                    else credentials.ApplicationDefault()
                )
                options = {
                    "projectId": os.getenv("GOOGLE_CLOUD_PROJECT") or None,
                }
                firebase_app = firebase_admin.initialize_app(
                    credential,
                    {key: value for key, value in options.items() if value},
                )
            self._client = firestore.client(firebase_app)
            self._firebase_app = firebase_app
            self._auth = auth
            LOGGER.info("Persistence: Firebase")
        except Exception as exc:  # pragma: no cover - depends on optional deployment SDK
            LOGGER.warning("Firebase persistence unavailable; using memory fallback: %s", exc)
            LOGGER.info("Persistence: InMemory")

    @property
    def available(self) -> bool:
        return self._client is not None

    def _write(self, collection: str, document_id: str, record: dict[str, Any]) -> None:
        if self._client is None:
            return
        try:
            self._client.collection(collection).document(document_id).set(record, merge=True, timeout=5)
        except Exception as exc:  # pragma: no cover - network dependent
            LOGGER.warning("Firebase write failed for %s/%s: %s", collection, document_id, exc)

    def save_session(self, record: dict[str, Any]) -> None:
        self._fallback.save_session(record)
        self._write("charging_sessions", str(record["session_id"]), record)

    def list_sessions(self) -> list[dict[str, Any]]:
        if self._client is None:
            return self._fallback.list_sessions()
        try:  # pragma: no cover - network dependent
            return [item.to_dict() for item in self._client.collection("charging_sessions").stream()]
        except Exception as exc:
            LOGGER.warning("Firebase session read failed: %s", exc)
            return self._fallback.list_sessions()

    def save_snapshot(self, record: dict[str, Any]) -> None:
        self._fallback.save_snapshot(record)
        self._write("system_snapshots", "current", record)

    def save_event(self, record: dict[str, Any]) -> None:
        self._fallback.save_event(record)
        event_id = str(record.get("event_id") or record.get("timestamp") or len(self._fallback._events))
        self._write("events", event_id, record)

    def load_vehicle_records(self) -> list[dict[str, Any]]:
        if self._client is None:
            return self._fallback.load_vehicle_records()
        try:  # pragma: no cover - network dependent
            return [
                {"_document_id": item.id, **(item.to_dict() or {})}
                for item in self._client.collection("vehicles").stream()
            ]
        except Exception as exc:
            LOGGER.warning("Firebase vehicle read failed: %s", exc)
            return self._fallback.load_vehicle_records()

    def load_user_records(self) -> dict[str, dict[str, Any]]:
        if self._client is None:
            return self._fallback.load_user_records()
        if time.monotonic() - self._user_records_loaded_at < 60:
            return self._user_records_cache
        try:  # pragma: no cover - network dependent
            records = {
                item.id: (item.to_dict() or {})
                for item in self._client.collection("users").stream()
            }
            page = self._auth.list_users(app=self._firebase_app)
            while page:
                for user in page.users:
                    auth_record = {"display_name": user.display_name, "email": user.email}
                    records[user.uid] = {**auth_record, **records.get(user.uid, {})}
                page = page.get_next_page()
            self._user_records_cache = records
            self._user_records_loaded_at = time.monotonic()
            return records
        except Exception as exc:
            LOGGER.warning("Firebase user read failed: %s", exc)
            return self._fallback.load_user_records()

    def set_all_vehicle_connections(self, connected: bool) -> int:
        if self._client is None:
            raise RuntimeError("Firebase is unavailable; vehicle connection state was not written")
        documents = list(self._client.collection("vehicles").stream())
        batch = self._client.batch()
        for document in documents:
            batch.update(document.reference, {
                "connected": connected,
                "plugged_in": connected,
                "charging_status": "CONNECTED" if connected else "DISCONNECTED",
            })
        if documents:
            batch.commit(timeout=15)
        return len(documents)

    def save_optimization_result(self, record: dict[str, Any]) -> None:
        self._fallback.save_optimization_result(record)
        if self._client is None:
            return
        session_id = str(record["session_id"])
        now = time.monotonic()
        meaningful_keys = (
            "status",
            "allocated_kw",
            "priority",
            "feasible",
            "target_soc",
            "reason_codes",
            "validator_safe",
        )
        serialized = repr(tuple((key, record.get(key)) for key in meaningful_keys))
        previous = self._result_cache.get(session_id)
        meaningful_change = previous is None or previous[0] != serialized
        periodic_due = now - self._last_result_write >= 5.0
        if not meaningful_change and not periodic_due:
            return
        self._result_cache[session_id] = (serialized, now)
        self._last_result_write = now
        self._write("charging_sessions", session_id, record)


def build_persistence_repository() -> PersistenceRepository:
    fallback = InMemoryPersistenceRepository()
    if os.getenv("FIREBASE_PERSISTENCE_ENABLED", "false").lower() == "true":
        firebase_repository = FirebasePersistenceRepository(fallback)
        if firebase_repository.available:
            return firebase_repository
        LOGGER.info("Persistence: InMemory")
        return fallback
    LOGGER.info("Persistence: InMemory")
    return fallback
