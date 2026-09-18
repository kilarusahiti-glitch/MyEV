from __future__ import annotations

from typing import Any, Protocol


class PersistenceRepository(Protocol):
    def save_session(self, record: dict[str, Any]) -> None: ...
    def list_sessions(self) -> list[dict[str, Any]]: ...


class InMemoryPersistenceRepository:
    """Development fallback; high-frequency telemetry never belongs here."""

    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}

    def save_session(self, record: dict[str, Any]) -> None:
        self._sessions[str(record["session_id"])] = dict(record)

    def list_sessions(self) -> list[dict[str, Any]]:
        return list(self._sessions.values())
