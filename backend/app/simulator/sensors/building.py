from datetime import datetime

from app.simulator.building import VirtualBuilding
from app.telemetry.models import TelemetryQuality, TelemetryReading


class BuildingPowerMeter:
    def __init__(self, sensor_id: str, building: VirtualBuilding) -> None:
        self.sensor_id = sensor_id
        self.building = building

    def read(self, timestamp: datetime) -> list[TelemetryReading]:
        return [
            TelemetryReading(
                sensor_id=self.sensor_id,
                metric="ACTIVE_POWER",
                value=self.building.current_load_kw,
                unit="kW",
                timestamp=timestamp,
                quality=TelemetryQuality.GOOD,
            )
        ]
