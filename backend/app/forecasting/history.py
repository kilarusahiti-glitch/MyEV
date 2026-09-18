from datetime import datetime

from app.forecasting.models import EnergyHistorySample
from app.state.models import SystemState


class EnergyHistoryStore:
    def __init__(self, max_samples: int = 300) -> None:
        self.max_samples = max_samples
        self._samples: list[EnergyHistorySample] = []

    def add(self, sample: EnergyHistorySample) -> None:
        self._samples.append(sample)
        self._samples.sort(key=lambda item: item.timestamp)
        if len(self._samples) > self.max_samples:
            del self._samples[: len(self._samples) - self.max_samples]

    def add_state(self, state: SystemState) -> EnergyHistorySample:
        sample = EnergyHistorySample(
            timestamp=state.timestamp,
            building_load_kw=state.energy.building_load_kw,
            solar_generation_kw=state.energy.solar_generation_kw,
            grid_import_kw=state.energy.grid_import_kw,
            ev_load_kw=state.energy.ev_load_kw,
            tariff_state=state.tariff.current_level,
        )
        self.add(sample)
        return sample

    def get_all(self) -> list[EnergyHistorySample]:
        return list(self._samples)

    def get_recent(
        self,
        limit: int | None = None,
        since: datetime | None = None,
    ) -> list[EnergyHistorySample]:
        samples = self.get_all()
        if since:
            samples = [sample for sample in samples if sample.timestamp >= since]
        if limit:
            samples = samples[-limit:]
        return samples
