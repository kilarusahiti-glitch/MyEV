const STATUS_LABELS = {
  CHARGING: 'Charging',
  CONNECTED: 'Waiting',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  TARGET_REACHED: 'Target reached',
  CANCELLED: 'Cancelled',
  FAULTED: 'Faulted',
  OFFLINE: 'Offline',
  AVAILABLE: 'Available',
  DISCONNECTED: 'Disconnected'
};

const REASON_LABELS = {
  DEPARTURE_PRIORITY: 'Departure requirement has priority',
  URGENT_REQUEST: 'Charge Faster request is active',
  BELOW_MINIMUM_READINESS: 'Below minimum readiness',
  READINESS_PRIORITY: 'Readiness requirement is active',
  TARGET_AT_RISK: 'Target is at risk before departure',
  TARGET_INFEASIBLE: 'Target is not feasible by the deadline',
  CAPACITY_LIMIT: 'Site capacity is limiting charging',
  OFFLINE_OR_FAULTED: 'Charger is faulted or offline',
  TARGET_REACHED: 'Target SOC has been reached',
  SOLAR_AVAILABLE: 'Solar generation is available',
  LOW_TARIFF_WINDOW: 'Low tariff window is active',
  DEFERRED_FOR_HIGH_TARIFF: 'Deferred for a high tariff window',
  DEFERRED_FOR_LOW_SOLAR: 'Deferred until a better solar opportunity',
  NORMAL_CHARGING: 'Normal charging allocation'
};

function readableStatus(value) {
  return STATUS_LABELS[value] || value || 'Unavailable';
}

function priorityLabel(score) {
  if (typeof score !== 'number') return null;
  return score >= 0.75 ? 'HIGH' : score >= 0.45 ? 'MEDIUM' : 'LOW';
}

function formatSimulationTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} (sim)`;
}

export function normalizeVehicle(vehicle) {
  const feasibility = vehicle.feasibility || {};
  const readiness = vehicle.trip_readiness || null;
  const reasons = vehicle.reason_codes || [];
  const status = readableStatus(vehicle.charging_status);
  const feasible = feasibility.feasible_by_deadline;

  return {
    ...vehicle,
    id: vehicle.vehicle_id,
    name: vehicle.name || vehicle.vehicle_id,
    vehicleType: vehicle.vehicle_type || null,
    currentSoc: vehicle.current_soc,
    targetSoc: vehicle.target_soc,
    batteryCapacity: vehicle.battery_capacity_kwh,
    chargingPower: vehicle.allocated_power_kw,
    actualChargingPower: vehicle.actual_power_kw,
    vehicleMaxPower: vehicle.vehicle_max_power_kw,
    chargerMaxPower: vehicle.charger_max_power_kw,
    commandedPower: vehicle.commanded_power_kw,
    allocatedPower: vehicle.allocated_power_kw,
    chargerId: vehicle.charger_id,
    effectiveMaxPower: vehicle.effective_max_power_kw,
    connected: vehicle.plugged_in,
    status,
    departureTime: formatSimulationTime(vehicle.departure),
    predictedDeparture: null,
    estimatedRange: vehicle.estimated_range_km,
    backendPriorityScore: vehicle.priority_score,
    priorityScore: typeof vehicle.priority_score === 'number' ? Math.min(100, vehicle.priority_score * 100) : null,
    priority: priorityLabel(vehicle.priority_score),
    feasibility,
    readiness,
    achievableSoc: feasibility.achievable_soc_by_departure ?? null,
    estimatedCompletion: readiness?.eta_to_user_target_hours ?? null,
    depRisk: {
      onTrack: feasible !== false,
      label: feasible === false ? 'Target infeasible' : feasible === true ? 'On track' : 'Unavailable',
      recommendedPower: null
    },
    reasonCodes: reasons,
    reasons: reasons.map((code) => REASON_LABELS[code] || code)
  };
}

export function normalizeCharger(charger) {
  return {
    ...charger,
    id: charger.charger_id,
    chargerId: charger.charger_id,
    status: readableStatus(charger.status),
    maxPower: charger.max_power_kw,
    maxPowerKw: charger.max_power_kw,
    currentPower: charger.actual_delivered_power_kw,
    chargingPower: charger.actual_delivered_power_kw,
    vehicleId: charger.connected_vehicle_id,
    sessionId: charger.connected_session_id,
    connectorType: charger.connector_type
  };
}

export function normalizeAlert(alert) {
  const severity = alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'WARNING' ? 'warning' : 'info';
  return {
    ...alert,
    id: alert.alert_id,
    category: String(alert.type || 'SYSTEM').split('_')[0].toLowerCase(),
    severity,
    backendSeverity: alert.severity,
    time: alert.timestamp,
    type: alert.type
  };
}

export function normalizeExplanation(explanation, vehicleById = {}) {
  const oldPower = explanation.previous_allocated_power_kw ?? explanation.allocated_power_kw;
  const newPower = explanation.allocated_power_kw;
  return {
    ...explanation,
    evId: explanation.vehicle_id,
    evName: vehicleById[explanation.vehicle_id]?.name || explanation.vehicle_id,
    oldPower,
    newPower,
    delta: explanation.change_kw ?? 0,
    direction: (explanation.change_kw || 0) < 0 ? 'reduced' : (explanation.change_kw || 0) > 0 ? 'increased' : 'steady',
    factors: (explanation.reason_codes || []).map((code) => REASON_LABELS[code] || code),
    peakImpact: explanation.detail,
    timestamp: explanation.timestamp
  };
}

export function normalizeDashboard(dashboard) {
  const rawVehicles = dashboard?.vehicles || [];
  const vehicles = rawVehicles.map(normalizeVehicle);
  const vehicleById = Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const status = dashboard?.system_status || {};
  const site = status.site || {};
  const optimization = status.optimization || {};
  const explanations = (dashboard?.recent_explanations || []).map((item) => normalizeExplanation(item, vehicleById));

  return {
    ...dashboard,
    system_status: {
      ...status,
      site: {
        ...site,
        available_ev_power_kw: site.available_ev_power_kw ?? null
      },
      optimization: {
        ...optimization,
        decisions: optimization.decisions || []
      }
    },
    vehicles,
    chargers: (dashboard?.chargers || []).map(normalizeCharger),
    active_alerts: (dashboard?.active_alerts || []).map(normalizeAlert),
    recent_explanations: explanations,
    optimizationResult: optimization.decisions || [],
    optimizationLog: explanations
  };
}

export const backendReasonLabels = REASON_LABELS;
