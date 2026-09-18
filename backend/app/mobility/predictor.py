from dataclasses import dataclass
from datetime import datetime, time, timedelta

from app.mobility.history import VehicleUsageHistoryStore
from app.mobility.models import (
    DeparturePattern,
    DeparturePrediction,
    EnergyPrediction,
    MobilityPrediction,
    PredictedReadiness,
    ProbabilityBucket,
    VehicleUsageRecord,
)
from app.mobility.stats import (
    mad,
    minutes_from_midnight,
    outlier_weights,
    recency_weight,
    time_from_minutes,
    weighted_average,
    weighted_percentile,
)
from app.state.models import VehicleState


@dataclass(frozen=True)
class MobilityPredictorConfig:
    same_weekday_weight: float = 1.0
    other_weekday_weight: float = 0.4
    weekend_match_weight: float = 0.9
    weekend_mismatch_weight: float = 0.1
    recency_lambda: float = 0.035
    bucket_minutes: int = 30
    cluster_gap_minutes: int = 60
    safe_energy_percentile: float = 0.80
    predicted_reserve_soc_percent: float = 20.0
    medium_confidence_extra_reserve_soc: float = 5.0
    high_confidence_threshold: float = 0.70
    medium_confidence_threshold: float = 0.40
    upcoming_horizon_hours: float = 6.0


class MobilityPredictor:
    def __init__(
        self,
        history_store: VehicleUsageHistoryStore,
        config: MobilityPredictorConfig | None = None,
    ) -> None:
        self.history_store = history_store
        self.config = config or MobilityPredictorConfig()

    def predict(
        self,
        vehicle_id: str,
        current_datetime: datetime,
        vehicle_state: VehicleState,
    ) -> MobilityPrediction | None:
        records = self.history_store.get_records(vehicle_id)
        if not records:
            return None

        weighted = self._weighted_records(records, current_datetime)
        positive = [(record, weight) for record, weight in weighted if weight > 0]
        if not positive:
            return None

        departure = self._departure_prediction(positive, current_datetime)
        energy = self._energy_prediction(positive)
        sample_maturity = min(1.0, len(records) / 5)
        confidence = max(
            0.0,
            min(1.0, ((departure.confidence + energy.confidence) / 2) * sample_maturity),
        )
        reserve = self.config.predicted_reserve_soc_percent
        if self.config.medium_confidence_threshold <= confidence < self.config.high_confidence_threshold:
            reserve += self.config.medium_confidence_extra_reserve_soc

        predicted_required_soc = (
            energy.safe_energy_requirement_kwh / vehicle_state.usable_capacity_kwh * 100
            + reserve
            if vehicle_state.usable_capacity_kwh > 0
            else 1000.0
        )
        recommended_soc = max(vehicle_state.minimum_readiness_soc, predicted_required_soc)
        deficit = max(0.0, recommended_soc - vehicle_state.current_soc)
        readiness_risk = self._readiness_risk(
            departure=departure,
            confidence=confidence,
            deficit_soc=deficit,
            current_datetime=current_datetime,
        )

        return MobilityPrediction(
            vehicle_id=vehicle_id,
            departure_prediction=departure,
            energy_prediction=energy,
            readiness=PredictedReadiness(
                recommended_soc=recommended_soc,
                minimum_soc=vehicle_state.minimum_readiness_soc,
                predicted_required_soc=predicted_required_soc,
                planning_deadline=departure.planning_deadline,
                readiness_risk=readiness_risk,
                requirement_feasible=recommended_soc <= 100,
            ),
            confidence=confidence,
            sample_count=len(records),
        )

    def _weighted_records(
        self,
        records: list[VehicleUsageRecord],
        current_datetime: datetime,
    ) -> list[tuple[VehicleUsageRecord, float]]:
        departure_minutes = [minutes_from_midnight(record.departure_time) for record in records]
        energy_values = [record.energy_used_kwh for record in records]
        departure_outliers = outlier_weights(departure_minutes)
        energy_outliers = outlier_weights(energy_values)
        weighted: list[tuple[VehicleUsageRecord, float]] = []
        for record, departure_weight, energy_weight in zip(
            records,
            departure_outliers,
            energy_outliers,
            strict=True,
        ):
            age_days = (current_datetime.date() - record.date).days
            context_weight = self._context_weight(record.day_of_week, current_datetime.weekday())
            weight = (
                context_weight
                * recency_weight(age_days, self.config.recency_lambda)
                * min(departure_weight, energy_weight)
            )
            weighted.append((record, weight))
        return weighted

    def _context_weight(self, record_day: int, target_day: int) -> float:
        record_weekend = record_day >= 5
        target_weekend = target_day >= 5
        if record_day == target_day:
            return self.config.same_weekday_weight
        if record_weekend and target_weekend:
            return self.config.weekend_match_weight
        if record_weekend != target_weekend:
            return self.config.weekend_mismatch_weight
        return self.config.other_weekday_weight

    def _departure_prediction(
        self,
        weighted_records: list[tuple[VehicleUsageRecord, float]],
        current_datetime: datetime,
    ) -> DeparturePrediction:
        minutes = [minutes_from_midnight(record.departure_time) for record, _ in weighted_records]
        weights = [weight for _, weight in weighted_records]
        patterns = self._patterns(minutes, weights)
        dominant = patterns[0]
        buckets = self._buckets(minutes, weights)
        window_start_dt = current_datetime.replace(
            hour=dominant.window_start.hour,
            minute=dominant.window_start.minute,
            second=0,
            microsecond=0,
        )
        if window_start_dt <= current_datetime:
            window_start_dt += timedelta(days=1)
        confidence = self._departure_confidence(minutes, weights, dominant.probability)
        return DeparturePrediction(
            most_likely_departure=dominant.center_time,
            window_start=dominant.window_start,
            window_end=dominant.window_end,
            probability_within_window=dominant.probability,
            probability_buckets=buckets,
            patterns=patterns,
            dominant_pattern_probability=dominant.probability,
            sample_count=len(weighted_records),
            confidence=confidence,
            planning_deadline=window_start_dt,
        )

    def _patterns(self, minutes: list[int], weights: list[float]) -> list[DeparturePattern]:
        pairs = sorted(zip(minutes, weights, strict=True), key=lambda item: item[0])
        clusters: list[list[tuple[int, float]]] = []
        for minute, weight in pairs:
            if not clusters or minute - clusters[-1][-1][0] > self.config.cluster_gap_minutes:
                clusters.append([(minute, weight)])
            else:
                clusters[-1].append((minute, weight))
        total_weight = sum(weights) or 1.0
        patterns = []
        for cluster in clusters:
            cluster_minutes = [minute for minute, _ in cluster]
            cluster_weights = [weight for _, weight in cluster]
            center = weighted_average(cluster_minutes, cluster_weights)
            start = min(cluster_minutes)
            end = max(cluster_minutes) + 1
            patterns.append(
                DeparturePattern(
                    window_start=time_from_minutes(start),
                    window_end=time_from_minutes(end),
                    center_time=time_from_minutes(center),
                    probability=sum(cluster_weights) / total_weight,
                    sample_count=len(cluster),
                )
            )
        return sorted(patterns, key=lambda item: (-item.probability, item.window_start))

    def _buckets(self, minutes: list[int], weights: list[float]) -> list[ProbabilityBucket]:
        bucket_weights: dict[int, float] = {}
        for minute, weight in zip(minutes, weights, strict=True):
            bucket = minute // self.config.bucket_minutes
            bucket_weights[bucket] = bucket_weights.get(bucket, 0.0) + weight
        total = sum(bucket_weights.values()) or 1.0
        return [
            ProbabilityBucket(
                window_start=time_from_minutes(bucket * self.config.bucket_minutes),
                window_end=time_from_minutes((bucket + 1) * self.config.bucket_minutes),
                probability=weight / total,
            )
            for bucket, weight in sorted(bucket_weights.items())
        ]

    def _energy_prediction(
        self,
        weighted_records: list[tuple[VehicleUsageRecord, float]],
    ) -> EnergyPrediction:
        energies = [record.energy_used_kwh for record, _ in weighted_records]
        weights = [weight for _, weight in weighted_records]
        expected = weighted_average(energies, weights)
        safe = weighted_percentile(energies, weights, self.config.safe_energy_percentile)
        confidence = self._energy_confidence(energies)
        return EnergyPrediction(
            expected_energy_kwh=expected,
            safe_energy_requirement_kwh=max(expected, safe),
            sample_count=len(weighted_records),
            confidence=confidence,
        )

    def _departure_confidence(
        self,
        minutes: list[int],
        weights: list[float],
        dominance: float,
    ) -> float:
        sample_component = min(1.0, len(minutes) / 20)
        spread_component = max(0.0, 1 - mad([float(value) for value in minutes]) / 120)
        recency_component = min(1.0, sum(weights) / max(1, len(weights)))
        outlier_fraction = 1 - (sum(1 for weight in weights if weight < 0.2) / len(weights))
        return max(
            0.0,
            min(
                1.0,
                0.25 * sample_component
                + 0.25 * spread_component
                + 0.25 * dominance
                + 0.15 * recency_component
                + 0.10 * outlier_fraction,
            ),
        )

    def _energy_confidence(self, energies: list[float]) -> float:
        if not energies:
            return 0.0
        sample_component = min(1.0, len(energies) / 20)
        med = sorted(energies)[len(energies) // 2]
        spread_component = max(0.0, 1 - mad(energies) / max(1.0, med))
        return max(0.0, min(1.0, 0.55 * sample_component + 0.45 * spread_component))

    def _readiness_risk(
        self,
        departure: DeparturePrediction,
        confidence: float,
        deficit_soc: float,
        current_datetime: datetime,
    ) -> float:
        hours = (
            departure.planning_deadline - current_datetime
        ).total_seconds() / 3600
        if hours <= 0:
            departure_risk = 1.0
        elif hours <= self.config.upcoming_horizon_hours:
            departure_risk = 1 - hours / self.config.upcoming_horizon_hours
        else:
            departure_risk = 0.1 * departure.dominant_pattern_probability
        deficit_component = min(1.0, max(0.0, deficit_soc) / 40)
        return max(0.0, min(1.0, departure_risk * deficit_component * confidence))
