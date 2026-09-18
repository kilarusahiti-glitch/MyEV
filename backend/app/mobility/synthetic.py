import random
from datetime import date, time, timedelta

from app.mobility.history import VehicleUsageHistoryStore
from app.mobility.models import UsageRecordSource, VehicleUsageRecord


def generate_synthetic_history(
    vehicle_id: str,
    start_date: date,
    days: int = 45,
    profile: str = "weekday_commute",
    seed: int = 42,
) -> list[VehicleUsageRecord]:
    rng = random.Random(seed)
    records: list[VehicleUsageRecord] = []
    for offset in range(days):
        current = start_date + timedelta(days=offset)
        weekday = current.weekday()
        if profile == "weekend_heavy" and weekday < 5:
            if rng.random() < 0.65:
                continue
            base_departure = 10 * 60 + 30
            energy = 6 + rng.random() * 4
        elif profile == "irregular":
            base_departure = rng.choice([7 * 60 + 45, 10 * 60 + 30, 14 * 60])
            energy = 4 + rng.random() * 14
        else:
            if weekday >= 5:
                continue
            base_departure = 7 * 60 + 40 if profile == "early_commute" else 9 * 60 + 15
            energy = (12 + rng.random() * 3) if profile == "early_commute" else (7 + rng.random() * 3)

        if offset == days // 3 and profile in {"early_commute", "weekday_commute"}:
            departure_minutes = 11 * 60 + 30
        else:
            departure_minutes = int(base_departure + rng.randint(-12, 12))
        return_minutes = min(23 * 60 + 59, departure_minutes + 9 * 60 + rng.randint(-30, 30))
        records.append(
            VehicleUsageRecord(
                vehicle_id=vehicle_id,
                date=current,
                departure_time=_time(departure_minutes),
                return_time=_time(return_minutes),
                departure_soc=80,
                return_soc=max(10, 80 - energy / 60 * 100),
                energy_used_kwh=energy,
                day_of_week=weekday,
                trip_distance_km=energy / 0.15,
                context=profile,
                source=UsageRecordSource.DEMO,
            )
        )
    return records


def populate_synthetic_demo_history(
    store: VehicleUsageHistoryStore,
    start_date: date,
    days: int = 45,
) -> None:
    profiles = {
        "EV-01": "early_commute",
        "EV-02": "weekday_commute",
        "EV-03": "irregular",
        "EV-04": "weekend_heavy",
    }
    for index, (vehicle_id, profile) in enumerate(profiles.items()):
        for record in generate_synthetic_history(
            vehicle_id=vehicle_id,
            start_date=start_date,
            days=days,
            profile=profile,
            seed=100 + index,
        ):
            store.add(record)


def _time(minutes: int) -> time:
    minutes = minutes % (24 * 60)
    return time(hour=minutes // 60, minute=minutes % 60)
