from app.models.session import ChargingSession
from app.models.vehicle import Vehicle


class VirtualEV:
    def __init__(self, vehicle: Vehicle, efficiency: float = 0.92) -> None:
        if not 0 < efficiency <= 1:
            raise ValueError("efficiency must be greater than 0 and at most 1")

        self.vehicle = vehicle
        self.efficiency = efficiency
        self.cumulative_energy_received_kwh = 0.0

    @property
    def current_soc(self) -> float:
        return self.vehicle.current_soc

    def apply_charging(
        self,
        actual_power_kw: float,
        delta_time_hours: float,
        session: ChargingSession | None = None,
    ) -> float:
        if actual_power_kw <= 0 or delta_time_hours <= 0:
            return 0.0

        target_soc = min(100.0, session.target_soc if session else 100.0)
        if self.vehicle.current_soc >= target_soc:
            self.vehicle.current_soc = target_soc
            return 0.0

        requested_energy_kwh = actual_power_kw * delta_time_hours * self.efficiency
        target_delta_soc = target_soc - self.vehicle.current_soc
        max_accepted_energy_kwh = (
            target_delta_soc / 100 * self.vehicle.battery_capacity_kwh
        )
        accepted_energy_kwh = min(requested_energy_kwh, max_accepted_energy_kwh)
        soc_delta = accepted_energy_kwh / self.vehicle.battery_capacity_kwh * 100

        self.vehicle.current_soc = min(target_soc, self.vehicle.current_soc + soc_delta)
        self.cumulative_energy_received_kwh += accepted_energy_kwh
        if session:
            session.energy_delivered_kwh += accepted_energy_kwh

        return accepted_energy_kwh
