from __future__ import annotations


def estimated_range_km(
    usable_capacity_kwh: float,
    current_soc: float,
    consumption_kwh_per_km: float,
) -> float:
    if consumption_kwh_per_km <= 0:
        return 0.0
    available = usable_capacity_kwh * max(0.0, min(100.0, current_soc)) / 100.0
    return available / consumption_kwh_per_km
