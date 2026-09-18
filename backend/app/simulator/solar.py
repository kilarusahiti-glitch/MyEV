import math
from datetime import datetime, time


class VirtualSolar:
    def __init__(
        self,
        solar_peak_kw: float,
        sunrise: time = time(hour=6),
        sunset: time = time(hour=18),
        cloud_factor: float = 1.0,
    ) -> None:
        if solar_peak_kw < 0:
            raise ValueError("solar_peak_kw must be non-negative")
        if not 0 <= cloud_factor <= 1:
            raise ValueError("cloud_factor must be between 0 and 1")
        if _time_to_seconds(sunrise) >= _time_to_seconds(sunset):
            raise ValueError("sunrise must be before sunset")

        self.solar_peak_kw = solar_peak_kw
        self.sunrise = sunrise
        self.sunset = sunset
        self.cloud_factor = cloud_factor
        self.current_generation_kw = 0.0
        self.scenario_generation_multiplier = 1.0

    def update(self, simulated_time: datetime) -> float:
        now_seconds = _time_to_seconds(simulated_time.time())
        sunrise_seconds = _time_to_seconds(self.sunrise)
        sunset_seconds = _time_to_seconds(self.sunset)

        if now_seconds < sunrise_seconds or now_seconds >= sunset_seconds:
            self.current_generation_kw = 0.0
            return self.current_generation_kw

        daylight_progress = (now_seconds - sunrise_seconds) / (
            sunset_seconds - sunrise_seconds
        )
        clear_sky_kw = self.solar_peak_kw * math.sin(math.pi * daylight_progress)
        generation_kw = clear_sky_kw * self.cloud_factor * self.scenario_generation_multiplier
        peak_limit_kw = self.solar_peak_kw * max(1.0, self.scenario_generation_multiplier)
        self.current_generation_kw = min(peak_limit_kw, max(0.0, generation_kw))
        return self.current_generation_kw


def _time_to_seconds(value: time) -> int:
    return value.hour * 3600 + value.minute * 60 + value.second
