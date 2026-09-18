from collections import defaultdict
from datetime import date

from app.mobility.models import VehicleUsageRecord


class VehicleUsageHistoryStore:
    def __init__(self, max_records_per_vehicle: int = 500) -> None:
        self.max_records_per_vehicle = max_records_per_vehicle
        self._records: dict[str, list[VehicleUsageRecord]] = defaultdict(list)

    def add(self, record: VehicleUsageRecord) -> None:
        records = self._records[record.vehicle_id]
        records.append(record)
        records.sort(key=lambda item: (item.date, item.departure_time))
        if len(records) > self.max_records_per_vehicle:
            del records[: len(records) - self.max_records_per_vehicle]

    def get_records(self, vehicle_id: str) -> list[VehicleUsageRecord]:
        return list(self._records.get(vehicle_id, []))

    def get_recent_records(
        self,
        vehicle_id: str,
        since: date | None = None,
        limit: int | None = None,
    ) -> list[VehicleUsageRecord]:
        records = self.get_records(vehicle_id)
        if since is not None:
            records = [record for record in records if record.date >= since]
        if limit is not None:
            records = records[-limit:]
        return records
