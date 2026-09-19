"""Small, defensive adapters between the existing Firestore schema and domain models.

This module only translates persisted requirements. Charging decisions continue to
be produced by the normal SystemState and optimizer pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.models import ChargingMode, Vehicle, VehicleType


@dataclass(frozen=True)
class ImportedVehicle:
    vehicle: Vehicle
    owner_uid: str | None
    target_soc: float | None
    departure_time: datetime | None
    charging_mode: ChargingMode
    urgent: bool
    charger_id: str | None
    display_name: str | None


def map_vehicle_record(
    record: dict[str, Any],
    *,
    user_records: dict[str, dict[str, Any]] | None = None,
) -> ImportedVehicle | None:
    """Map known existing field spellings into a validated backend vehicle.

    Records missing physical requirements are skipped so an incomplete cloud
    document cannot replace the deterministic demo state.
    """

    vehicle_id = _text(record, "vehicle_id", "id") or _text(record, "_document_id")
    name = _text(record, "vehicle_name", "name")
    capacity = _number(record, "battery_capacity_kwh", "batteryCapacity")
    soc = _number(record, "current_soc", "soc", "currentSoc")
    estimated_range = _number(record, "estimated_range_km", "estimatedRangeKm")
    max_ac = _number(record, "max_ac_kw", "vehicle_max_ac_kw", "maxChargingPower", "max_power_kw")
    max_dc = _number(record, "max_dc_kw", "vehicle_max_dc_kw", "dc_max_kw") or 0.0
    if not vehicle_id or not name or capacity is None or soc is None or estimated_range is None or max_ac is None:
        return None

    try:
        vehicle_type = VehicleType(str(record.get("vehicle_type", record.get("vehicleType", "CAR"))).upper())
        connectors = _connectors(record.get("connector_types") or record.get("connectorTypes") or record.get("connector_type"))
        if not connectors:
            return None
        vehicle = Vehicle(
            id=vehicle_id,
            owner_uid=_text(record, "owner_uid", "ownerUid", "user_id", "userId"),
            name=name,
            vehicle_type=vehicle_type,
            battery_capacity_kwh=capacity,
            max_ac_kw=max_ac,
            max_dc_kw=max_dc,
            connector_types=connectors,
            current_soc=soc,
            estimated_range_km=estimated_range,
            connected=bool(record.get("connected", record.get("pluggedIn", record.get("charger_id", record.get("chargerId"))))),
            minimum_readiness_soc=_number(record, "minimum_readiness_soc", "minimumReadinessSoc") or 30.0,
            estimated_consumption_kwh_per_km=_number(record, "estimated_consumption_kwh_per_km") or 0.15,
        )
    except (TypeError, ValueError):
        return None

    owner_uid = vehicle.owner_uid
    display_name = None
    if owner_uid and user_records:
        owner = user_records.get(owner_uid, {})
        display_name = _text(owner, "display_name", "displayName", "name")
    return ImportedVehicle(
        vehicle=vehicle,
        owner_uid=owner_uid,
        target_soc=_number(record, "target_soc", "targetSoc"),
        departure_time=_datetime(record.get("departure_time") or record.get("departureTime")),
        charging_mode=_mode(record.get("charging_mode") or record.get("chargingMode")),
        urgent=bool(record.get("urgent", record.get("charge_faster", record.get("chargeFaster", False)))),
        charger_id=_text(record, "charger_id", "chargerId"),
        display_name=display_name,
    )


def _text(record: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = record.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def _number(record: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = record.get(key)
        if value is not None and value != "":
            try:
                return float(value)
            except (TypeError, ValueError):
                return None
    return None


def _connectors(value: Any) -> list[str]:
    values = value if isinstance(value, list) else [value] if value else []
    result: list[str] = []
    for item in values:
        normalized = str(item).strip().upper().replace(" ", "-")
        if normalized == "AC-TYPE-2":
            normalized = "TYPE2"
        result.append(normalized)
    return list(dict.fromkeys(result))


def _mode(value: Any) -> ChargingMode:
    try:
        return ChargingMode(str(value or ChargingMode.CHEAPEST).upper())
    except ValueError:
        return ChargingMode.CHEAPEST


def _datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
