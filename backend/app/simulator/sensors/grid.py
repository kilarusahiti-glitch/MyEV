from datetime import datetime
from typing import Callable

from app.telemetry.models import TelemetryQuality, TelemetryReading


class GridPowerMeter:
    def __init__(
        self,
        sensor_id: str,
        grid_import_kw: Callable[[], float],
        solar_export_kw: Callable[[], float],
    ) -> None:
        self.sensor_id = sensor_id
        self._grid_import_kw = grid_import_kw
        self._solar_export_kw = solar_export_kw

    def read(self, timestamp: datetime) -> list[TelemetryReading]:
        return [
            TelemetryReading(
                sensor_id=self.sensor_id,
                metric="GRID_IMPORT",
                value=self._grid_import_kw(),
                unit="kW",
                timestamp=timestamp,
                quality=TelemetryQuality.GOOD,
            ),
            TelemetryReading(
                sensor_id=self.sensor_id,
                metric="GRID_EXPORT",
                value=self._solar_export_kw(),
                unit="kW",
                timestamp=timestamp,
                quality=TelemetryQuality.GOOD,
            ),
        ]
