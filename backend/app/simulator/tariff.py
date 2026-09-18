from dataclasses import dataclass
from datetime import datetime, time
from enum import StrEnum


class TariffLevel(StrEnum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    PEAK = "PEAK"


@dataclass(frozen=True)
class TariffPeriod:
    level: TariffLevel
    price_per_kwh: float
    start_time: time
    end_time: time


class VirtualTariff:
    def __init__(self, periods: list[TariffPeriod] | None = None) -> None:
        self.periods = periods or default_tariff_periods()
        self.current_period = self.periods[0]

    def update(self, simulated_time: datetime) -> TariffPeriod:
        current_time = simulated_time.time()
        for period in self.periods:
            if _contains_time(period, current_time):
                self.current_period = period
                return self.current_period
        raise ValueError("No tariff period matches the simulated time")


def default_tariff_periods() -> list[TariffPeriod]:
    return [
        TariffPeriod(TariffLevel.LOW, 0.10, time(hour=0), time(hour=6)),
        TariffPeriod(TariffLevel.NORMAL, 0.18, time(hour=6), time(hour=18)),
        TariffPeriod(TariffLevel.PEAK, 0.32, time(hour=18), time(hour=22)),
        TariffPeriod(TariffLevel.NORMAL, 0.18, time(hour=22), time(hour=0)),
    ]


def _contains_time(period: TariffPeriod, value: time) -> bool:
    start = _time_to_seconds(period.start_time)
    end = _time_to_seconds(period.end_time)
    current = _time_to_seconds(value)

    if start < end:
        return start <= current < end
    return current >= start or current < end


def _time_to_seconds(value: time) -> int:
    return value.hour * 3600 + value.minute * 60 + value.second
