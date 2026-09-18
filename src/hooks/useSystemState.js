// Hook to consume the central simulation engine state reactively
import { useState, useEffect, useMemo, useCallback } from 'react';
import { simulationEngine } from '../services/simulationEngine';
import { runWhatIfSimulation, generateForecast } from '../services/optimizationEngine';
import { alertEngine } from '../services/alertEngine';

export function useSystemState() {
  const [state, setState] = useState(() => simulationEngine.getState());

  useEffect(() => {
    const unsubscribe = simulationEngine.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
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
    getForecast: () => generateForecast(simulationEngine.getState()),
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
  }), []);

  return {
    ...state,
    controls
  };
}

