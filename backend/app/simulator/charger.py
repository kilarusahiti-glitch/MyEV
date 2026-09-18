from app.models.charger import Charger
from app.models.enums import ChargerStatus
from app.models.session import ChargingSession
from app.optimizer.constraints import (
    effective_charging_limit_kw,
    vehicle_charging_limit_kw,
)
from app.simulator.ev import VirtualEV
from app.vehicle_intelligence.charging_curve import battery_acceptance_limit_kw


class VirtualCharger:
    def __init__(self, charger: Charger) -> None:
        self.charger = charger
        self.connected_ev: VirtualEV | None = None
        self.connected_session: ChargingSession | None = None
        self.commanded_power_kw = 0.0
        self.actual_delivered_power_kw = 0.0

    @property
    def status(self) -> ChargerStatus:
        return self.charger.status

    def connect(self, ev: VirtualEV, session: ChargingSession) -> bool:
        if session.vehicle_id != ev.vehicle.id or session.charger_id != self.charger.id:
            raise ValueError("Session does not match connected EV and charger")

        try:
            effective_charging_limit_kw(ev.vehicle, self.charger)
        except ValueError:
            self.connected_ev = None
            self.connected_session = None
            self.actual_delivered_power_kw = 0.0
            return False

        self.connected_ev = ev
        self.connected_session = session
        ev.vehicle.connected = True
        if self.charger.status not in {ChargerStatus.FAULTED, ChargerStatus.OFFLINE}:
            self.charger.status = ChargerStatus.CONNECTED
        return True

    def disconnect(self) -> None:
        if self.connected_ev:
            self.connected_ev.vehicle.connected = False
        self.connected_ev = None
        self.connected_session = None
        self.commanded_power_kw = 0.0
        self.actual_delivered_power_kw = 0.0
        if self.charger.status not in {ChargerStatus.FAULTED, ChargerStatus.OFFLINE}:
            self.charger.status = ChargerStatus.AVAILABLE

    def set_commanded_power_kw(self, power_kw: float) -> None:
        if power_kw < 0:
            raise ValueError("power_kw must be non-negative")
        self.commanded_power_kw = power_kw

    def step(self, delta_time_hours: float) -> float:
        if not self._can_deliver_power():
            self.actual_delivered_power_kw = 0.0
            return self.actual_delivered_power_kw

        assert self.connected_ev is not None
        assert self.connected_session is not None

        if self.connected_ev.current_soc >= self.connected_session.target_soc:
            self.actual_delivered_power_kw = 0.0
            if self.charger.status == ChargerStatus.CHARGING:
                self.charger.status = ChargerStatus.CONNECTED
            return self.actual_delivered_power_kw

        try:
            capability_kw = effective_charging_limit_kw(
                self.connected_ev.vehicle,
                self.charger,
            )
        except ValueError:
            self.actual_delivered_power_kw = 0.0
            return self.actual_delivered_power_kw

        acceptance_kw = battery_acceptance_limit_kw(
            vehicle_charging_limit_kw(
                self.connected_ev.vehicle,
                self.charger.charger_type,
            ),
            self.connected_ev.current_soc,
        )
        requested_kw = min(self.commanded_power_kw, capability_kw, acceptance_kw)
        accepted_energy_kwh = self.connected_ev.apply_charging(
            actual_power_kw=requested_kw,
            delta_time_hours=delta_time_hours,
            session=self.connected_session,
        )
        self.actual_delivered_power_kw = (
            accepted_energy_kwh / (delta_time_hours * self.connected_ev.efficiency)
            if delta_time_hours > 0
            else 0.0
        )
        if self.actual_delivered_power_kw > 0:
            self.charger.status = ChargerStatus.CHARGING
        elif self.charger.status == ChargerStatus.CHARGING:
            self.charger.status = ChargerStatus.CONNECTED
        return self.actual_delivered_power_kw

    def _can_deliver_power(self) -> bool:
        if self.charger.status in {ChargerStatus.FAULTED, ChargerStatus.OFFLINE}:
            return False
        if not self.connected_ev or not self.connected_session:
            return False
        if self.commanded_power_kw <= 0:
            return False
        return True
