from datetime import datetime
from typing import Protocol

from app.telemetry.models import TelemetryReading


class TelemetrySource(Protocol):
    sensor_id: str

    def read(self, timestamp: datetime) -> list[TelemetryReading]:
        ...


class TelemetryGateway:
    def __init__(self, sensors: list[TelemetrySource] | None = None) -> None:
        self._sensors: list[TelemetrySource] = list(sensors or [])

    @property
    def sensors(self) -> list[TelemetrySource]:
        return list(self._sensors)

    def register(self, sensor: TelemetrySource) -> None:
        self._sensors.append(sensor)

    def collect(self, timestamp: datetime) -> list[TelemetryReading]:
        readings: list[TelemetryReading] = []
        for sensor in self._sensors:
            readings.extend(sensor.read(timestamp))
        return readings
