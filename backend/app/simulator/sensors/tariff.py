from datetime import datetime

from app.simulator.tariff import VirtualTariff
from app.telemetry.models import TelemetryQuality, TelemetryReading


class TariffSensor:
    def __init__(self, sensor_id: str, tariff: VirtualTariff) -> None:
        self.sensor_id = sensor_id
        self.tariff = tariff

    def read(self, timestamp: datetime) -> list[TelemetryReading]:
        period = self.tariff.current_period
        return [
            TelemetryReading(
                sensor_id=self.sensor_id,
                metric="CURRENT_TARIFF_PRICE",
                value=period.price_per_kwh,
                unit="currency/kWh",
                timestamp=timestamp,
                quality=TelemetryQuality.GOOD,
            ),
            TelemetryReading(
                sensor_id=self.sensor_id,
                metric="CURRENT_TARIFF_LEVEL",
                value=period.level.value,
                unit="level",
                timestamp=timestamp,
                quality=TelemetryQuality.GOOD,
            ),
        ]
