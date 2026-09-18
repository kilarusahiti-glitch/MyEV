from datetime import datetime
from typing import Protocol

from app.telemetry.models import TelemetryReading


class BaseSensor(Protocol):
    sensor_id: str

    def read(self, timestamp: datetime) -> list[TelemetryReading]:
        ...
