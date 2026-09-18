from datetime import datetime

from app.simulator.solar import VirtualSolar
from app.telemetry.models import TelemetryQuality, TelemetryReading


class SolarPowerMeter:
    def __init__(self, sensor_id: str, solar: VirtualSolar) -> None:
        self.sensor_id = sensor_id
        self.solar = solar

    def read(self, timestamp: datetime) -> list[TelemetryReading]:
        return [
            TelemetryReading(
                sensor_id=self.sensor_id,
                metric="SOLAR_GENERATION",
                value=self.solar.current_generation_kw,
                unit="kW",
                timestamp=timestamp,
                quality=TelemetryQuality.GOOD,
            )
        ]
