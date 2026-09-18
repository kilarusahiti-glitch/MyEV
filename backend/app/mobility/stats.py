from datetime import time
from math import exp


def minutes_from_midnight(value: time) -> int:
    return value.hour * 60 + value.minute


def time_from_minutes(minutes: float) -> time:
    rounded = int(round(minutes)) % (24 * 60)
    return time(hour=rounded // 60, minute=rounded % 60)


def median(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def mad(values: list[float]) -> float:
    med = median(values)
    return median([abs(value - med) for value in values])


def outlier_weights(values: list[float], threshold: float = 3.5) -> list[float]:
    if not values:
        return []
    med = median(values)
    deviation = mad(values)
    if deviation == 0:
        return [1.0 for _ in values]
    weights = []
    for value in values:
        modified_z = 0.6745 * abs(value - med) / deviation
        weights.append(0.15 if modified_z > threshold else 1.0)
    return weights


def weighted_average(values: list[float], weights: list[float]) -> float:
    total_weight = sum(weights)
    if total_weight <= 0:
        return 0.0
    return sum(value * weight for value, weight in zip(values, weights, strict=True)) / total_weight


def weighted_percentile(values: list[float], weights: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    pairs = sorted(zip(values, weights, strict=True), key=lambda item: item[0])
    total = sum(max(0.0, weight) for _, weight in pairs)
    if total <= 0:
        return pairs[-1][0]
    threshold = total * percentile
    running = 0.0
    for value, weight in pairs:
        running += max(0.0, weight)
        if running >= threshold:
            return value
    return pairs[-1][0]


def recency_weight(age_days: int, recency_lambda: float) -> float:
    return exp(-recency_lambda * max(0, age_days))
