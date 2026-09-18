import math
import random
from datetime import datetime


class VirtualBuilding:
    def __init__(
        self,
        base_load_kw: float,
        variation_kw: float = 1.5,
        seed: int = 42,
    ) -> None:
        if base_load_kw < 0:
            raise ValueError("base_load_kw must be non-negative")
        if variation_kw < 0:
            raise ValueError("variation_kw must be non-negative")

        rng = random.Random(seed)
        self.base_load_kw = base_load_kw
        self.variation_kw = variation_kw
        self._phase = rng.uniform(0, 2 * math.pi)
        self.current_load_kw = base_load_kw
        self.scenario_load_offset_kw = 0.0
        self.scenario_load_multiplier = 1.0

    def update(self, simulated_time: datetime) -> float:
        seconds = _seconds_since_midnight(simulated_time)
        hours = seconds / 3600

        morning_peak = _smooth_peak(hours, center_hour=8.0, width_hours=2.0)
        day_load = _smooth_peak(hours, center_hour=14.0, width_hours=5.5)
        evening_peak = _smooth_peak(hours, center_hour=19.5, width_hours=2.5)
        daily_wave = math.sin((2 * math.pi * seconds / 86_400) + self._phase)

        load_kw = (
            self.base_load_kw
            + self.base_load_kw * 0.25 * morning_peak
            + self.base_load_kw * 0.18 * day_load
            + self.base_load_kw * 0.35 * evening_peak
            + self.variation_kw * daily_wave
        )
        load_kw = load_kw * self.scenario_load_multiplier + self.scenario_load_offset_kw
        self.current_load_kw = max(0.0, load_kw)
        return self.current_load_kw


def _seconds_since_midnight(value: datetime) -> int:
    return value.hour * 3600 + value.minute * 60 + value.second


def _smooth_peak(hours: float, center_hour: float, width_hours: float) -> float:
    distance = (hours - center_hour) / width_hours
    return math.exp(-(distance * distance))
