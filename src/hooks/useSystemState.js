// Hook to consume the central simulation engine state reactively
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { simulationEngine } from '../services/simulationEngine';
import { runWhatIfSimulation, generateForecast } from '../services/optimizationEngine';
import { alertEngine } from '../services/alertEngine';
import { backendApi } from '../services/backendApi';
import { backendWebSocket } from '../services/backendWebSocket';
import { normalizeDashboard } from '../services/backendAdapters';
import { firestoreService } from '../services/firestoreService';

export function useSystemState() {
  const [state, setState] = useState(() => simulationEngine.getState());
  const [backendSnapshot, setBackendSnapshot] = useState(null);
  const [backendStatus, setBackendStatus] = useState('CONNECTING');
  const [backendError, setBackendError] = useState(null);
  const [commandStates, setCommandStates] = useState({});
  const [commandErrors, setCommandErrors] = useState({});
  const pendingCommands = useRef(new Set());
  const lastSnapshotPersistAt = useRef(0);

  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (backendStatus !== 'LIVE' || !backendSnapshot?.system_status) return;
    const now = Date.now();
    if (now - lastSnapshotPersistAt.current < 10000) return;
    lastSnapshotPersistAt.current = now;
    const status = backendSnapshot.system_status;
    firestoreService.saveAuthoritativeSnapshot({
      timestamp: status.timestamp,
      scenario: backendSnapshot.current_scenario || status.simulation?.scenario,
      ...status.site,
      ...status.counts,
      validator_safe: status.optimization?.validator_valid
    }).catch(() => {});
  }, [backendStatus, backendSnapshot]);

  useEffect(() => {
    let cancelled = false;
    let hasSnapshot = false;
    let needsResync = false;
    let unsubscribeSocket = null;

    const applyMessage = (message) => {
      const payload = message.data;
      const status = payload?.system_status || (
        payload?.site && payload?.counts ? payload : null
      );

      if (!status && !Array.isArray(payload?.vehicles) && !Array.isArray(payload?.chargers)) return;

      setBackendSnapshot((current) => {
        if (!current) return current;
        return normalizeDashboard({
          ...current,
          ...(status ? {
            system_status: status,
            ...(Array.isArray(status.vehicles) ? { vehicles: status.vehicles } : {}),
            ...(Array.isArray(status.chargers) ? { chargers: status.chargers } : {})
          } : {}),
          ...(Array.isArray(payload?.vehicles) ? { vehicles: payload.vehicles } : {}),
          ...(Array.isArray(payload?.chargers) ? { chargers: payload.chargers } : {}),
          ...(Array.isArray(payload?.active_alerts) ? { active_alerts: payload.active_alerts } : {})
        });
      });
    };

    const applySocketStatus = (status, error = null) => {
      if (cancelled) return;
      if (status === 'LIVE' && !hasSnapshot) {
        setBackendStatus('OFFLINE');
        backendApi.getDashboard()
          .then((dashboard) => {
            if (cancelled) return;
            hasSnapshot = true;
            setBackendSnapshot(normalizeDashboard(dashboard));
            setBackendStatus('LIVE');
            setBackendError(null);
          })
          .catch(() => {
            if (!cancelled) setBackendStatus('OFFLINE');
          });
        return;
      }

      setBackendStatus(status);
      if (error) setBackendError(error);

      if (status === 'RECONNECTING' || status === 'OFFLINE') {
        needsResync = true;
      }

      if (status === 'LIVE' && needsResync) {
        needsResync = false;
        backendApi.getDashboard()
          .then((dashboard) => {
            if (cancelled) return;
            setBackendSnapshot(normalizeDashboard(dashboard));
            setBackendError(null);
          })
          .catch((refreshError) => {
            if (!cancelled) setBackendError(refreshError.message || 'Backend unavailable');
          });
      }
    };

    const connectToLiveState = () => {
      if (!cancelled) {
        unsubscribeSocket = backendWebSocket.subscribe(applyMessage, applySocketStatus);
      }
    };

    backendApi.getDashboard()
      .then((dashboard) => {
        if (cancelled) return;
        setBackendSnapshot(normalizeDashboard(dashboard));
        hasSnapshot = true;
        setBackendError(null);
        connectToLiveState();
      })
      .catch((error) => {
        if (cancelled) return;
        setBackendStatus('OFFLINE');
        setBackendError(error.message || 'Backend unavailable');
        connectToLiveState();
      });

    return () => {
      cancelled = true;
      unsubscribeSocket?.();
    };
  }, []);

  const controls = useMemo(() => ({
    setSpeed: (speed) => simulationEngine.setSpeed(speed),
    setBuildingMultiplier: (val) => simulationEngine.setBuildingMultiplier(val),
    setSolarMultiplier: (val) => simulationEngine.setSolarMultiplier(val),
    setGridLimit: (val) => simulationEngine.setGridLimit(val),
    setTransformerLimit: (val) => simulationEngine.setTransformerLimit(val),
    triggerScenario: (name) => simulationEngine.triggerScenario(name),
    toggleVehicleCharging: (id) => simulationEngine.toggleVehicleCharging(id),
    updateVehiclePriority: (id, p) => simulationEngine.updateVehiclePriority(id, p),
    setOptimizerEnabled: (val) => simulationEngine.setOptimizerEnabled(val),
    // What-if runs as a pure calculation off live state
    runWhatIf: (inputs) => runWhatIfSimulation(inputs),
    // Forecast uses current engine state
    getForecast: () => backendSnapshot?.forecast || generateForecast(simulationEngine.getState()),
    // Alert management
    clearAlert: (id) => alertEngine.clearAlert(id),
    dismissAllAlerts: () => alertEngine.dismissAll(),
    consumeToasts: () => simulationEngine.consumeToasts(),
    // Stage 3 controls
    setOrganizationMode: (mode) => simulationEngine.setOrganizationMode(mode),
    setTariffSettings: (tariff) => simulationEngine.setTariffSettings(tariff),
    setChargerStatus: (id, status) => simulationEngine.setChargerStatus(id, status),
    triggerDemandResponse: (kw, dur) => simulationEngine.triggerDemandResponse(kw, dur),
    cancelDemandResponse: () => simulationEngine.cancelDemandResponse(),
    addEvent: (txt, type, icon) => simulationEngine.addEvent(txt, type, icon)
  }), [backendSnapshot]);

  const runBackendCommand = useCallback(async (commandKey, command) => {
    if (pendingCommands.current.has(commandKey)) return null;
    if (backendStatus !== 'LIVE') {
      const message = 'Backend is not live; command was not sent.';
      setCommandStates((current) => ({ ...current, [commandKey]: 'ERROR' }));
      setCommandErrors((current) => ({ ...current, [commandKey]: message }));
      return null;
    }

    pendingCommands.current.add(commandKey);
    setCommandStates((current) => ({ ...current, [commandKey]: 'SENDING' }));
    setCommandErrors((current) => ({ ...current, [commandKey]: null }));
    try {
      const result = await command();
      setCommandStates((current) => ({ ...current, [commandKey]: 'SUCCESS' }));
      return result;
    } catch (error) {
      setCommandStates((current) => ({ ...current, [commandKey]: 'ERROR' }));
      setCommandErrors((current) => ({
        ...current,
        [commandKey]: error.message || 'Backend command failed.'
      }));
      return null;
    } finally {
      pendingCommands.current.delete(commandKey);
    }
  }, [backendStatus]);

  const backendControls = useMemo(() => ({
    activateScenario: (scenario) => runBackendCommand(`scenario:${scenario}`, () => backendApi.activateScenario(scenario)),
    resetScenario: () => runBackendCommand('scenario:RESET', () => backendApi.resetScenario()),
    simulatorStep: (seconds = 1) => runBackendCommand('simulator:step', () => backendApi.simulatorStep(seconds)),
    setSpeed: (speed) => runBackendCommand(`simulator:speed:${speed}`, () => backendApi.setSimulatorSpeed(speed)),
    resetSimulator: () => runBackendCommand('simulator:reset', () => backendApi.resetSimulator()),
    chargeFaster: (vehicleId) => runBackendCommand(`charge-faster:${vehicleId}`, () => backendApi.chargeFaster(vehicleId)),
    startSession: (sessionId) => runBackendCommand(`session:start:${sessionId}`, () => backendApi.startSession(sessionId)),
    pauseSession: (sessionId) => runBackendCommand(`session:pause:${sessionId}`, () => backendApi.pauseSession(sessionId)),
    resumeSession: (sessionId) => runBackendCommand(`session:resume:${sessionId}`, () => backendApi.resumeSession(sessionId)),
    stopSession: (sessionId) => runBackendCommand(`session:stop:${sessionId}`, () => backendApi.stopSession(sessionId)),
    updateSessionPreferences: (sessionId, preferences) => runBackendCommand(`session:preferences:${sessionId}`, () => backendApi.updateSessionPreferences(sessionId, preferences)),
    createTrip: (trip) => runBackendCommand(`trip:${trip.vehicle_id}`, () => backendApi.createTrip(trip))
  }), [runBackendCommand]);

  const liveState = useMemo(() => {
    if (!backendSnapshot?.system_status?.site) return state;

    const site = backendSnapshot.system_status.site;
    const counts = backendSnapshot.system_status.counts || {};
    const backendVehicles = backendSnapshot.vehicles || [];
    const gridLimit = site.grid_import_limit_kw;
    const buildingLoad = site.building_load_kw;
    const evLoad = site.ev_load_kw;
    const gridImport = site.grid_import_kw;

    return {
      ...state,
      gridLimit,
      buildingLoad,
      evLoad,
      solarGeneration: site.solar_generation_kw,
      totalLoad: Number((buildingLoad + evLoad).toFixed(1)),
      remainingCapacity: site.available_ev_power_kw,
      safeEVCapacity: site.available_ev_power_kw,
      gridUtilization: gridLimit > 0 ? Number(((gridImport / gridLimit) * 100).toFixed(1)) : 0,
      gridImport,
      activeEvCount: counts.charging_vehicles ?? 0,
      totalEvCount: backendVehicles.length,
      registeredEvCount: counts.registered_vehicles ?? backendVehicles.length,
      connectedEvCount: counts.connected_vehicles ?? 0,
      waitingEvCount: counts.waiting_vehicles ?? 0,
      vehicles: backendVehicles,
      chargers: backendSnapshot.chargers || state.chargers,
      alerts: backendSnapshot.active_alerts || state.alerts,
      optimizationResult: backendSnapshot.optimizationResult || [],
      optimizationLog: backendSnapshot.optimizationLog || [],
      forecast: backendSnapshot.forecast || null,
      backendSystemStatus: backendSnapshot.system_status,
      activeScenario: backendSnapshot.current_scenario || backendSnapshot.system_status.simulation?.scenario || 'NORMAL',
      gridStress: {
        level: backendSnapshot.system_status.grid_stress_level,
        pct: backendSnapshot.system_status.grid_utilization_percent
      },
      isEmergencyMode: backendSnapshot.system_status.emergency_mode,
      electricityTariff: backendSnapshot.system_status.tariff?.current_price_per_kwh ?? null,
      tariffLevel: backendSnapshot.system_status.tariff?.current_level ?? null,
      simHour: backendSnapshot.system_status.simulation?.simulated_time
        ? new Date(backendSnapshot.system_status.simulation.simulated_time).getHours()
        : null,
      simMinute: backendSnapshot.system_status.simulation?.simulated_time
        ? new Date(backendSnapshot.system_status.simulation.simulated_time).getMinutes()
        : null,
      transformerLoad: null,
      backendDashboard: backendSnapshot
    };
  }, [state, backendSnapshot]);

  return {
    ...liveState,
    backendStatus,
    backendError,
    controls,
    backendControls,
    commandStates,
    commandErrors
  };
}

