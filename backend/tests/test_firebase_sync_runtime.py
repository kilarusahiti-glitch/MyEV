from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from app.services.persistence import InMemoryPersistenceRepository
from app.services.runtime import ApplicationRuntime


class FakeFirebasePersistence(InMemoryPersistenceRepository):
    def __init__(self, records: list[dict[str, Any]]) -> None:
        super().__init__()
        self.records = records

    def load_vehicle_records(self) -> list[dict[str, Any]]:
        return list(self.records)

    def load_user_records(self) -> dict[str, dict[str, Any]]:
        return {"owner-a": {"display_name": "Owner A"}}


def record(vehicle_id: str = "firebase-ev-001", **overrides: Any) -> dict[str, Any]:
    value: dict[str, Any] = {
        "vehicle_id": vehicle_id,
        "owner_uid": "owner-a",
        "name": "Cloud EV",
        "vehicle_type": "CAR",
        "battery_capacity_kwh": 60,
        "current_soc": 45,
        "estimated_range_km": 220,
        "max_ac_kw": 11,
        "max_dc_kw": 100,
        "connector_types": ["TYPE2", "CCS2"],
        "target_soc": 80,
    }
    value.update(overrides)
    return value


def test_startup_import_merges_with_demo_and_preserves_identity() -> None:
    persistence = FakeFirebasePersistence([record()])
    runtime = ApplicationRuntime(persistence=persistence)

    ids = [ev.vehicle.id for ev in runtime.simulation_engine.evs]
    assert len(ids) == 7
    assert ids.count("firebase-ev-001") == 1
    assert runtime.vehicle("firebase-ev-001").vehicle.owner_uid == "owner-a"
    assert runtime.owner_names["firebase-ev-001"] == "Owner A"
    assert runtime.vehicle("firebase-ev-001").vehicle.connected is False


def test_periodic_refresh_discovers_vehicle_without_restart_or_duplicates() -> None:
    persistence = FakeFirebasePersistence([record()])
    runtime = ApplicationRuntime(persistence=persistence)
    persistence.records.append(record("firebase-ev-002", name="Second Cloud EV"))

    assert runtime.sync_firebase_vehicles() is True
    assert runtime.vehicle("firebase-ev-002") is not None
    assert runtime.sync_firebase_vehicles() is False
    assert [ev.vehicle.id for ev in runtime.simulation_engine.evs].count("firebase-ev-002") == 1


def test_refresh_updates_profile_without_overwriting_live_soc() -> None:
    persistence = FakeFirebasePersistence([record()])
    runtime = ApplicationRuntime(persistence=persistence)
    ev = runtime.vehicle("firebase-ev-001")
    ev.vehicle.current_soc = 51
    persistence.records[0]["name"] = "Renamed Cloud EV"
    persistence.records[0]["target_soc"] = 88

    assert runtime.sync_firebase_vehicles() is True
    assert ev.vehicle.name == "Renamed Cloud EV"
    assert ev.current_soc == 51
    assert runtime.firebase_preferences["firebase-ev-001"].target_soc == 88


def test_cloud_connection_flag_is_reflected_without_inventing_charger_assignment() -> None:
    persistence = FakeFirebasePersistence([record(connected=True)])
    runtime = ApplicationRuntime(persistence=persistence)
    ev = runtime.vehicle("firebase-ev-001")

    assert ev.vehicle.connected is True
    assert not any(charger.connected_ev is ev for charger in runtime.simulation_engine.chargers)
    assert not any(session.vehicle_id == "firebase-ev-001" for session in runtime.sessions.values())


def test_firebase_vehicle_and_virtual_sensor_readings_share_system_state() -> None:
    runtime = ApplicationRuntime(persistence=FakeFirebasePersistence([record()]))
    telemetry = runtime.get_current_state().telemetry
    sensor_ids = {reading.sensor_id for reading in telemetry}

    assert "BUILDING_METER_01" in sensor_ids
    assert "SOLAR_METER_01" in sensor_ids
    assert "GRID_METER_01" in sensor_ids
    assert "SOC_FIREBASE-EV-001" in sensor_ids
    assert runtime.vehicle("firebase-ev-001") is not None


def test_charger_sensor_history_is_seeded_and_sampled_hourly() -> None:
    runtime = ApplicationRuntime(persistence=FakeFirebasePersistence([]))
    initial = runtime.charger_health_samples[-1]
    initial_time = datetime.fromisoformat(initial["sampled_at"])

    assert initial["source"] == "VIRTUAL_SENSORS"
    assert len(initial["chargers"]) == len(runtime.simulation_engine.chargers)
    assert all(item["power_sensor_id"] and item["status_sensor_id"] for item in initial["chargers"])
    assert runtime.record_charger_health_sample(initial_time + timedelta(minutes=59)) is False
    assert runtime.record_charger_health_sample(initial_time + timedelta(hours=1)) is True
    assert len(runtime.charger_health_samples) == 2


def test_refresh_updates_mobile_preferences_on_existing_session() -> None:
    persistence = FakeFirebasePersistence([record()])
    runtime = ApplicationRuntime(persistence=persistence)
    session = next(iter(runtime.sessions.values()))
    session.vehicle_id = "firebase-ev-001"
    persistence.records[0]["target_soc"] = 88
    persistence.records[0]["urgent"] = True

    assert runtime.sync_firebase_vehicles() is True
    assert session.target_soc == 88
    assert session.urgent is True


def test_malformed_and_failed_refreshes_do_not_poison_runtime() -> None:
    persistence = FakeFirebasePersistence([record("valid-ev")])
    runtime = ApplicationRuntime(persistence=persistence)
    persistence.records.extend([{"vehicle_id": "bad", "owner_uid": "owner-a"}, record("valid-ev")])
    assert runtime.sync_firebase_vehicles() is False
    assert runtime.vehicle("valid-ev") is not None
    assert runtime.vehicle("bad") is None

    class FailingPersistence(FakeFirebasePersistence):
        def load_vehicle_records(self) -> list[dict[str, Any]]:
            raise RuntimeError("temporary unavailable")

    failing = FailingPersistence([])
    failing_runtime = ApplicationRuntime(persistence=failing)
    assert failing_runtime.sync_firebase_vehicles() is False
    assert len(failing_runtime.simulation_engine.evs) == 6
    assert failing_runtime.current_result is not None
    assert failing_runtime.current_result.optimization.valid
