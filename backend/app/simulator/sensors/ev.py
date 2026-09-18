from datetime import datetime

from app.simulator.ev import VirtualEV
from app.telemetry.models import TelemetryQuality, TelemetryReading


class EVSOCSensor:
    def __init__(self, sensor_id: str, ev: VirtualEV) -> None:
        self.sensor_id = sensor_id
        self.ev = ev

    def read(self, timestamp: datetime) -> list[TelemetryReading]:
        return [
            TelemetryReading(
                sensor_id=self.sensor_id,
                metric="STATE_OF_CHARGE",
                value=self.ev.current_soc,
                unit="%",
                timestamp=timestamp,
                quality=TelemetryQuality.GOOD,
            )
        ]
