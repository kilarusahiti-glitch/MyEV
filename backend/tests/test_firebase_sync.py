from datetime import UTC, datetime

from app.models import VehicleType
from app.services.firebase_sync import map_vehicle_record
from app.services.persistence import InMemoryPersistenceRepository
from app.services.runtime import ApplicationRuntime


def test_firebase_vehicle_mapping_preserves_identity_and_preferences() -> None:
    item = map_vehicle_record(
        {
            "_document_id": "vehicle-doc",
            "vehicle_id": "owner-car-1",
            "vehicle_name": "Owner Car",
            "vehicle_type": "CAR",
            "battery_capacity_kwh": 60,
            "soc": 25,
            "target_soc": 80,
            "estimated_range_km": 220,
            "max_ac_kw": 11,
            "max_dc_kw": 100,
            "connector_type": "CCS2",
            "owner_uid": "user-1",
            "charger_id": "dc-001",
            "departure_time": "2026-01-01T18:30:00+00:00",
            "charging_mode": "FAST",
            "connected": True,
        },
        user_records={"user-1": {"display_name": "Owner One"}},
    )

    assert item is not None
    assert item.vehicle.id == "owner-car-1"
    assert item.vehicle.owner_uid == "user-1"
    assert item.vehicle.vehicle_type == VehicleType.CAR
    assert item.target_soc == 80
    assert item.departure_time == datetime(2026, 1, 1, 18, 30, tzinfo=UTC)
    assert item.display_name == "Owner One"


def test_incomplete_firebase_vehicle_is_skipped() -> None:
    assert map_vehicle_record({"id": "missing-physical-data", "name": "Incomplete"}) is None


def test_imported_vehicle_runs_through_existing_optimizer_and_persists_result() -> None:
    class TestPersistence(InMemoryPersistenceRepository):
        def load_vehicle_records(self) -> list[dict]:
            return [{
                "vehicle_id": "firebase-car-1",
                "vehicle_name": "Cloud Car",
                "vehicle_type": "CAR",
                "battery_capacity_kwh": 60,
                "soc": 25,
                "target_soc": 80,
                "estimated_range_km": 200,
                "max_ac_kw": 11,
                "max_dc_kw": 100,
                "connector_type": "CCS2",
                "owner_uid": "uid-1",
                "charger_id": "dc-001",
                "connected": True,
            }]

        def load_user_records(self) -> dict[str, dict]:
            return {"uid-1": {"display_name": "Cloud Owner"}}

    persistence = TestPersistence()
    runtime = ApplicationRuntime(persistence=persistence)

    assert [ev.vehicle.id for ev in runtime.simulation_engine.evs] == ["firebase-car-1"]
    assert runtime.current_result is not None
    assert runtime.current_result.optimization.valid
    assert persistence._results["session-firebase-car-1"]["owner_uid"] == "uid-1"
