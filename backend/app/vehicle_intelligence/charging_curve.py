from dataclasses import dataclass


@dataclass(frozen=True)
class ChargingAcceptanceConfig:
    low_soc_threshold: float = 80.0
    high_soc_threshold: float = 90.0
    low_soc_factor: float = 1.0
    mid_soc_factor: float = 0.75
    high_soc_factor: float = 0.5


def acceptance_factor(
    current_soc: float,
    config: ChargingAcceptanceConfig | None = None,
) -> float:
    config = config or ChargingAcceptanceConfig()
    if current_soc < config.low_soc_threshold:
        return config.low_soc_factor
    if current_soc < config.high_soc_threshold:
        return config.mid_soc_factor
    return config.high_soc_factor


def battery_acceptance_limit_kw(
    vehicle_electrical_max_kw: float,
    current_soc: float,
    config: ChargingAcceptanceConfig | None = None,
) -> float:
    return max(0.0, vehicle_electrical_max_kw * acceptance_factor(current_soc, config))
