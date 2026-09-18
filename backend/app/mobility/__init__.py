from app.mobility.history import VehicleUsageHistoryStore
from app.mobility.models import (
    DeparturePrediction,
    EnergyPrediction,
    MobilityPrediction,
    VehicleUsageRecord,
)

__all__ = [
    "DeparturePrediction",
    "EnergyPrediction",
    "MobilityPrediction",
    "MobilityPredictor",
    "MobilityPredictorConfig",
    "VehicleUsageHistoryStore",
    "VehicleUsageRecord",
]


def __getattr__(name: str):
    if name in {"MobilityPredictor", "MobilityPredictorConfig"}:
        from app.mobility.predictor import MobilityPredictor, MobilityPredictorConfig

        return {
            "MobilityPredictor": MobilityPredictor,
            "MobilityPredictorConfig": MobilityPredictorConfig,
        }[name]
    raise AttributeError(name)
