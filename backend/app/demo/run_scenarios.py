from datetime import UTC, datetime

from app.alerts import AlertEngine
from app.explanations import DecisionExplanationService
from app.models import Charger, ChargerStatus, ChargerType, ChargingMode, ChargingSession, SiteConfig, Vehicle, VehicleType
from app.optimizer.engine import OptimizationEngine
from app.scenarios import ScenarioManager, ScenarioType
from app.simulator import SimulationClock, SimulationEngine, VirtualBuilding, VirtualCharger, VirtualEV, VirtualSolar, VirtualTariff


START = datetime(2026, 9, 18, 7, 0, tzinfo=UTC)


def main() -> None:
    engine = _engine()
    optimizer = OptimizationEngine()
    explanations = DecisionExplanationService()
    alerts = AlertEngine()
    scenarios = ScenarioManager(
        engine,
        building_peak_offset_kw=28,
        solar_surge_multiplier=2.4,
        fault_charger_id="CH-01",
    )

    _run_step("STEP 1 - NORMAL", engine, optimizer, explanations, alerts)

    event = scenarios.activate(ScenarioType.BUILDING_PEAK)
    print(f"\nSCENARIO: {event.summary}")
    _run_step("STEP 2 - BUILDING PEAK", engine, optimizer, explanations, alerts)

    event = scenarios.activate(ScenarioType.SOLAR_SURGE)
    print(f"\nSCENARIO: {event.summary}")
    _run_step("STEP 3 - SOLAR SURGE", engine, optimizer, explanations, alerts)

    event = scenarios.activate(ScenarioType.EV_RUSH)
    print(f"\nSCENARIO: {event.summary}")
    _run_step("STEP 4 - EV RUSH", engine, optimizer, explanations, alerts)

    event = scenarios.activate(ScenarioType.CHARGER_FAULT)
    print(f"\nSCENARIO: {event.summary}")
    _run_step("STEP 5 - CHARGER FAULT", engine, optimizer, explanations, alerts)

    event = scenarios.reset()
    print(f"\nSCENARIO: {event.summary}")
    _run_step("STEP 6 - RESET", engine, optimizer, explanations, alerts)


def _run_step(
    title: str,
    engine: SimulationEngine,
    optimizer: OptimizationEngine,
    explanations: DecisionExplanationService,
    alerts: AlertEngine,
) -> None:
    snapshot = engine.tick(60)
    assert snapshot.system_state is not None
    result = optimizer.optimize(snapshot.system_state)
    step_explanations = explanations.explain(result, snapshot.system_state)
    step_alerts = alerts.evaluate(snapshot.system_state, result)
    engine.apply_optimization(result)

    print(f"\n{title}")
    print(
        f"Building={snapshot.building_load_kw:.1f} kW "
        f"Solar={snapshot.solar_generation_kw:.1f} kW "
        f"Budget={result.effective_ev_budget_kw:.1f} kW "
        f"Allocated={result.total_allocated_kw:.1f} kW"
    )
    print("Allocations:")
    for decision in result.decisions:
        explanation = next(item for item in step_explanations if item.session_id == decision.session_id)
        previous = (
            "n/a"
            if explanation.previous_allocated_power_kw is None
            else f"{explanation.previous_allocated_power_kw:.1f}"
        )
        print(
            f"  {decision.vehicle_id}/{decision.charger_id}: "
            f"{previous} -> {decision.allocated_power_kw:.1f} kW | "
            f"{explanation.headline}"
        )
    active_alerts = [alert for alert in step_alerts if alert.active]
    resolved_alerts = [alert for alert in step_alerts if not alert.active]
    if active_alerts:
        print("Alerts:")
        for alert in active_alerts:
            print(f"  {alert.type.value} {alert.severity.value}: {alert.title}")
    if resolved_alerts:
        print("Resolved:")
        for alert in resolved_alerts:
            print(f"  {alert.type.value}")


def _engine() -> SimulationEngine:
    evs = [
        _ev("EV-01", 32, 11),
        _ev("EV-02", 55, 7.2),
        _ev("EV-03", 40, 11),
        _ev("EV-04", 62, 11),
    ]
    chargers = [
        _charger("CH-01", 11, "EV-01", "S-01", 80, evs[0], ChargingMode.FAST),
        _charger("CH-02", 7.2, "EV-02", "S-02", 85, evs[1], ChargingMode.CHEAPEST),
        _charger("CH-03", 11, "EV-03", "S-03", 80, evs[2], ChargingMode.GREENEST),
        _charger("CH-04", 11, "EV-04", "S-04", 90, evs[3], ChargingMode.FAST),
    ]
    return SimulationEngine(
        clock=SimulationClock(START, speed=60),
        building=VirtualBuilding(base_load_kw=45, variation_kw=0, seed=1),
        solar=VirtualSolar(solar_peak_kw=25, cloud_factor=0.65),
        tariff=VirtualTariff(),
        chargers=chargers,
        site_config=SiteConfig(
            id="scenario-demo",
            name="Scenario Demo",
            grid_import_limit_kw=85,
            safety_reserve_kw=5,
            transformer_rated_kva=130,
            transformer_operational_limit_kw=95,
            solar_peak_kw=25,
        ),
        evs=evs,
    )


def _ev(vehicle_id: str, soc: float, max_ac: float) -> VirtualEV:
    return VirtualEV(
        Vehicle(
            id=vehicle_id,
            name=vehicle_id,
            vehicle_type=VehicleType.CAR,
            battery_capacity_kwh=60,
            max_ac_kw=max_ac,
            max_dc_kw=50,
            connector_types=["TYPE2"],
            current_soc=soc,
            estimated_range_km=150,
            connected=True,
            minimum_readiness_soc=30,
            estimated_soh_percent=100,
            soh_source="DEMO",
        )
    )


def _charger(
    charger_id: str,
    max_kw: float,
    vehicle_id: str,
    session_id: str,
    target: float,
    ev: VirtualEV,
    mode: ChargingMode,
) -> VirtualCharger:
    charger = VirtualCharger(
        Charger(
            id=charger_id,
            name=charger_id,
            charger_type=ChargerType.AC,
            max_power_kw=max_kw,
            connector_type="TYPE2",
            status=ChargerStatus.AVAILABLE,
        )
    )
    charger.connect(
        ev,
        ChargingSession(
            id=session_id,
            vehicle_id=vehicle_id,
            charger_id=charger_id,
            target_soc=target,
            arrival_time=START,
            charging_mode=mode,
            urgent=False,
            effective_max_kw=0,
        ),
    )
    return charger


if __name__ == "__main__":
    main()
