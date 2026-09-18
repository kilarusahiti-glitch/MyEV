from datetime import datetime, timedelta


class SimulationClock:
    def __init__(self, start_time: datetime, speed: int = 1) -> None:
        if speed not in {1, 10, 60}:
            raise ValueError("Simulation speed must be one of: 1, 10, 60")
        self.current_time = start_time
        self.speed = speed

    def advance(self, real_seconds: float) -> datetime:
        if real_seconds < 0:
            raise ValueError("real_seconds must be non-negative")
        self.current_time += timedelta(seconds=real_seconds * self.speed)
        return self.current_time
