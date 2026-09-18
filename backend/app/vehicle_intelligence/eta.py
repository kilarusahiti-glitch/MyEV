from app.vehicle_intelligence.charging_curve import (
    ChargingAcceptanceConfig,
    acceptance_factor,
)


DEFAULT_CHARGING_EFFICIENCY = 0.92


def estimate_charging_eta_hours(
    current_soc: float,
    target_soc: float,
    usable_capacity_kwh: float,
    vehicle_electrical_max_kw: float,
    charger_max_kw: float,
    efficiency: float = DEFAULT_CHARGING_EFFICIENCY,
    config: ChargingAcceptanceConfig | None = None,
) -> float:
    if target_soc <= current_soc:
        return 0.0
    if usable_capacity_kwh <= 0 or vehicle_electrical_max_kw <= 0 or charger_max_kw <= 0:
        return float("inf")
    if not 0 < efficiency <= 1:
        raise ValueError("efficiency must be greater than 0 and at most 1")

    config = config or ChargingAcceptanceConfig()
    hours = 0.0
    cursor = current_soc
    for band_end in [config.low_soc_threshold, config.high_soc_threshold, target_soc]:
        upper = min(target_soc, band_end)
        if upper <= cursor:
            continue
        factor = acceptance_factor(cursor, config)
        wall_power_kw = min(charger_max_kw, vehicle_electrical_max_kw * factor)
        if wall_power_kw <= 0:
            return float("inf")
        battery_energy_kwh = (upper - cursor) / 100 * usable_capacity_kwh
        hours += battery_energy_kwh / (wall_power_kw * efficiency)
        cursor = upper
        if cursor >= target_soc:
            break
    return max(0.0, hours)
