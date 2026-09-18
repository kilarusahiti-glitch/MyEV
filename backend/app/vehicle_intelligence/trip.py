from app.vehicle_intelligence.models import PlannedTrip


DEFAULT_TRIP_ENERGY_BUFFER_PERCENT = 15.0


def total_trip_distance_km(trip: PlannedTrip) -> float:
    if trip.total_distance_km is not None:
        return trip.total_distance_km
    return trip.distance_km * 2 if trip.return_trip else trip.distance_km


def trip_energy_kwh(
    trip: PlannedTrip,
    estimated_consumption_kwh_per_km: float,
) -> float:
    if estimated_consumption_kwh_per_km <= 0:
        raise ValueError("estimated_consumption_kwh_per_km must be positive")
    return total_trip_distance_km(trip) * estimated_consumption_kwh_per_km


def buffered_trip_energy_kwh(
    trip: PlannedTrip,
    estimated_consumption_kwh_per_km: float,
    buffer_percent: float = DEFAULT_TRIP_ENERGY_BUFFER_PERCENT,
) -> float:
    if buffer_percent < 0:
        raise ValueError("buffer_percent must be non-negative")
    return trip_energy_kwh(trip, estimated_consumption_kwh_per_km) * (
        1 + buffer_percent / 100
    )


def required_departure_soc_percent(
    trip: PlannedTrip,
    usable_capacity_kwh: float,
    estimated_consumption_kwh_per_km: float,
    buffer_percent: float = DEFAULT_TRIP_ENERGY_BUFFER_PERCENT,
) -> tuple[float, bool]:
    if usable_capacity_kwh <= 0:
        raise ValueError("usable_capacity_kwh must be positive")
    trip_soc = (
        buffered_trip_energy_kwh(trip, estimated_consumption_kwh_per_km, buffer_percent)
        / usable_capacity_kwh
        * 100
    )
    required_soc = trip_soc + trip.reserve_soc_percent
    return required_soc, required_soc <= 100
