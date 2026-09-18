from dataclasses import dataclass
from datetime import timedelta
from statistics import mean, pstdev

from app.forecasting.history import EnergyHistoryStore
from app.forecasting.models import EnergyForecast, ForecastPoint, TariffForecastPoint
from app.simulator.tariff import VirtualTariff
from app.state.models import SystemState


@dataclass(frozen=True)
class ForecastConfig:
    horizons_minutes: tuple[int, ...] = (15, 30, 60)
    recent_sample_count: int = 8
    trend_alpha: float = 0.85
    peak_risk_ratio_start: float = 0.70
    solar_opportunity_delta_kw: float = 5.0
    minimum_influence_confidence: float = 0.55


class ForecastEngine:
    def __init__(
        self,
        history: EnergyHistoryStore,
        tariff: VirtualTariff | None = None,
        config: ForecastConfig | None = None,
    ) -> None:
        self.history = history
        self.tariff = tariff
        self.config = config or ForecastConfig()

    def forecast(self, state: SystemState) -> EnergyForecast | None:
        samples = self.history.get_recent(limit=self.config.recent_sample_count)
        if not samples:
            return None
        building = self._series_forecast(
            values=[sample.building_load_kw for sample in samples],
            horizons=self.config.horizons_minutes,
            floor=0.0,
        )
        solar = self._series_forecast(
            values=[sample.solar_generation_kw for sample in samples],
            horizons=self.config.horizons_minutes,
            floor=0.0,
            nighttime_zero=state.energy.solar_generation_kw == 0,
        )
        tariff = [
            TariffForecastPoint(
                horizon_minutes=horizon,
                tariff_state=self._tariff_at(state, horizon),
                confidence=1.0,
            )
            for horizon in self.config.horizons_minutes
        ]
        confidence = mean([point.confidence for point in building + solar] or [0.0])
        max_building = max(point.predicted_value for point in building)
        site_limit = min(
            state.site.grid_import_limit_kw,
            state.site.transformer_operational_limit_kw,
        )
        peak_ratio = max_building / site_limit if site_limit > 0 else 1.0
        peak_risk = max(
            0.0,
            min(
                1.0,
                (peak_ratio - self.config.peak_risk_ratio_start)
                / (1 - self.config.peak_risk_ratio_start),
            ),
        ) * confidence
        current_solar = state.energy.solar_generation_kw
        max_solar = max(point.predicted_value for point in solar)
        solar_opportunity = max(
            0.0,
            min(1.0, (max_solar - current_solar) / self.config.solar_opportunity_delta_kw),
        ) * confidence
        return EnergyForecast(
            timestamp=state.timestamp,
            building_load=building,
            solar_generation=solar,
            tariff=tariff,
            peak_risk=peak_risk,
            solar_opportunity=solar_opportunity,
            confidence=confidence,
        )

    def _series_forecast(
        self,
        values: list[float],
        horizons: tuple[int, ...],
        floor: float,
        nighttime_zero: bool = False,
    ) -> list[ForecastPoint]:
        recent_average = mean(values)
        if len(values) >= 2:
            slope_per_sample = (values[-1] - values[0]) / (len(values) - 1)
        else:
            slope_per_sample = 0.0
        noise = pstdev(values) if len(values) > 1 else recent_average
        sample_component = min(1.0, len(values) / self.config.recent_sample_count)
        monotonic = all(
            later >= earlier for earlier, later in zip(values, values[1:], strict=False)
        ) or all(
            later <= earlier for earlier, later in zip(values, values[1:], strict=False)
        )
        consistency = 1.0 if recent_average == 0 else max(0.0, 1 - noise / max(1.0, recent_average))
        if monotonic and len(values) >= 4:
            consistency = max(consistency, 0.85)
        points: list[ForecastPoint] = []
        for horizon in horizons:
            steps = horizon / 15
            trend_forecast = values[-1] + slope_per_sample * steps
            if nighttime_zero and recent_average == 0:
                predicted = 0.0
            else:
                predicted = trend_forecast
            horizon_factor = max(0.25, 1 - horizon / 120)
            confidence = max(0.0, min(1.0, sample_component * consistency * horizon_factor))
            points.append(
                ForecastPoint(
                    horizon_minutes=horizon,
                    predicted_value=max(floor, predicted),
                    confidence=confidence,
                )
            )
        return points

    def _tariff_at(self, state: SystemState, horizon_minutes: int) -> str:
        if not self.tariff:
            return state.tariff.current_level
        future_time = state.timestamp + timedelta(minutes=horizon_minutes)
        return self.tariff.update(future_time).level.value
