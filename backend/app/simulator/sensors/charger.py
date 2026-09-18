from datetime import datetime

from app.simulator.charger import VirtualCharger
from app.telemetry.models import TelemetryQuality, TelemetryReading


class ChargerPowerMeter:
    def __init__(self, sensor_id: str, charger: VirtualCharger) -> None:
        self.sensor_id = sensor_id
        self.charger = charger

    def read(self, timestamp: datetime) -> list[TelemetryReading]:
        return [
            TelemetryReading(
                sensor_id=self.sensor_id,
                metric="ACTUAL_CHARGING_POWER",
                value=self.charger.actual_delivered_power_kw,
                unit="kW",
                timestamp=timestamp,
                quality=TelemetryQuality.GOOD,
            )
        ]


class ChargerStatusSensor:
    def __init__(self, sensor_id: str, charger: VirtualCharger) -> None:
        self.sensor_id = sensor_id
        self.charger = charger

    def read(self, timestamp: datetime) -> list[TelemetryReading]:
        return [
            TelemetryReading(
                sensor_id=self.sensor_id,
                metric="CHARGER_STATUS",
                value=self.charger.charger.status.value,
                unit="status",
                timestamp=timestamp,
                quality=TelemetryQuality.GOOD,
            )
        ]
