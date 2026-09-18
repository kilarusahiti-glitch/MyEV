from dataclasses import dataclass

from app.vehicle_intelligence.models import SOHSource


@dataclass(frozen=True)
class SOHEstimationConfig:
    degradation_percent_per_equivalent_cycle: float = 0.01
    minimum_estimated_soh_percent: float = 70.0


def estimate_soh_percent(
    nominal_capacity_kwh: float,
    cumulative_battery_energy_throughput_kwh: float,
    explicit_soh_percent: float | None = None,
    explicit_source: SOHSource | None = None,
    config: SOHEstimationConfig | None = None,
) -> tuple[float, SOHSource]:
    if nominal_capacity_kwh <= 0:
        raise ValueError("nominal_capacity_kwh must be positive")
    if explicit_soh_percent is not None and explicit_source in {
        SOHSource.BMS_REPORTED,
        SOHSource.DEMO,
    }:
        return _validate_soh(explicit_soh_percent), explicit_source

    config = config or SOHEstimationConfig()
    cycles = max(0.0, cumulative_battery_energy_throughput_kwh) / nominal_capacity_kwh
    estimated = 100 - cycles * config.degradation_percent_per_equivalent_cycle
    return (
        max(config.minimum_estimated_soh_percent, min(100.0, estimated)),
        SOHSource.ESTIMATED,
    )


def usable_capacity_kwh(
    nominal_capacity_kwh: float,
    estimated_soh_percent: float,
) -> float:
    return nominal_capacity_kwh * _validate_soh(estimated_soh_percent) / 100


def _validate_soh(value: float) -> float:
    if not 0 < value <= 100:
        raise ValueError("estimated_soh_percent must be greater than 0 and at most 100")
    return value
