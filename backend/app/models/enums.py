from enum import StrEnum


class VehicleType(StrEnum):
    CAR = "CAR"
    BIKE = "BIKE"
    SCOOTER = "SCOOTER"


class ChargerType(StrEnum):
    AC = "AC"
    DC = "DC"


class ChargerStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    CONNECTED = "CONNECTED"
    CHARGING = "CHARGING"
    PAUSED = "PAUSED"
    FAULTED = "FAULTED"
    OFFLINE = "OFFLINE"


class ChargingMode(StrEnum):
    FAST = "FAST"
    CHEAPEST = "CHEAPEST"
    GREENEST = "GREENEST"


class ChargingSessionStatus(StrEnum):
    CONNECTED = "CONNECTED"
    CHARGING = "CHARGING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    FAULTED = "FAULTED"
