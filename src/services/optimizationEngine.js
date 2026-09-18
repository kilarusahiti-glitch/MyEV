/**
 * SmartCharge Grid — Deterministic Optimization Engine
 *
 * Pure calculation module. No AI, no randomness in allocation logic.
 * All decisions are auditable and explainable.
 */

// ─── 1. PRIORITY SCORING ────────────────────────────────────────────────────

/**
 * Parse departure time string ("06:30 AM") → decimal hours from midnight
 */
function parseDepartureHours(departureTime, simHour, simMinute) {
  if (!departureTime || departureTime === 'Ready' || departureTime === 'Awaiting Charger') return 24;
  try {
    const [timePart, period] = departureTime.split(' ');
    let [h, m] = timePart.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h + m / 60;
  } catch {
    return 24;
  }
}

/**
 * calculatePriorityScore(ev, systemState) → 0–100
 *
 * Factors:
 *   40 pts — battery urgency  (lower SOC = higher score)
 *   30 pts — departure urgency (less time remaining = higher score)
 *   15 pts — energy volume    (more kWh needed = slightly higher)
 *   10 pts — user priority    (HIGH/MEDIUM/LOW label)
 *    5 pts — charger health   (reduced charger lowers score)
 */
export function calculatePriorityScore(ev, systemState) {
  const { simHour = 8, simMinute = 30, chargers = [] } = systemState;

  // 1. Battery urgency (0–40)
  const socDeficit = Math.max(0, ev.targetSoc - ev.currentSoc); // 0–100
  const batteryScore = (socDeficit / 100) * 40;

  // 2. Departure urgency (0–30)
  const simTimeDec = simHour + simMinute / 60;
  const depTimeDec = parseDepartureHours(ev.departureTime, simHour, simMinute);
  // Wrap overnight: if departure has passed today, treat as tomorrow
  let hoursRemaining = depTimeDec - simTimeDec;
  if (hoursRemaining < 0) hoursRemaining += 24;

  // Energy required at current power
  const energyNeeded = ev.energyRequired || (ev.batteryCapacity * socDeficit / 100);
  const effectivePower = Math.max(ev.chargingPower, 3.7); // assume at least 3.7 kW if will charge
  const hoursNeeded = energyNeeded / effectivePower;

  let departureScore = 0;
  if (hoursRemaining <= 0.5) {
    departureScore = 30; // Departing in <30 min → maximum urgency
  } else if (hoursRemaining <= hoursNeeded * 1.1) {
    // Barely enough time — high urgency
    departureScore = 25 + (1 - Math.min(1, (hoursRemaining - hoursNeeded * 1.1) / hoursNeeded)) * 5;
  } else if (hoursRemaining <= 4) {
    departureScore = (1 - (hoursRemaining - hoursNeeded * 1.1) / (4 - hoursNeeded * 1.1)) * 20;
  }
  departureScore = Math.max(0, Math.min(30, departureScore));

  // 3. Energy volume (0–15) — more kWh needed = slightly more important
  const energyScore = Math.min(15, (energyNeeded / ev.batteryCapacity) * 15);

  // 4. User priority label (0–10)
  const labelScore = ev.priority === 'HIGH' ? 10 : ev.priority === 'MEDIUM' ? 5 : 2;

  // 5. Charger health (0–5)
  const charger = chargers.find(c => c.id === ev.chargerId);
  const chargerScore = charger ? (charger.status === 'online' ? 5 : charger.status === 'reduced' ? 2 : 0) : 3;

  const total = batteryScore + departureScore + energyScore + labelScore + chargerScore;
  return Math.min(100, Math.max(0, Math.round(total)));
}

// ─── 2. SAFE CAPACITY ────────────────────────────────────────────────────────

/**
 * Calculate the maximum power safely available for EV charging.
 *
 * availableGridCapacity = gridLimit - buildingLoad  (grid contract protection)
 * transformerSafeCapacity = transformerLimit * 0.88 - netGridImport_from_building
 *   (88% keeps 12% thermal headroom)
 * safeEVCapacity = min(availableGridCapacity, transformerSafeCapacity)
 */
export function calculateSafeCapacity(state) {
  const {
    gridLimit = 100,
    transformerLimit = 100,
    buildingLoad = 60,
    solarGeneration = 0
  } = state;

  // Grid contract constraint
  const availableGridCapacity = Math.max(0, gridLimit - buildingLoad);

  // Transformer thermal constraint (88% of nameplate, minus building's portion of transformer)
  const transformerSafeKva = transformerLimit * 0.88;
  // Building already uses its share; solar reduces net import
  const buildingNetImport = Math.max(0, buildingLoad - solarGeneration);
  const transformerRemainingForEV = Math.max(0, transformerSafeKva - buildingNetImport);

  const safeEVCapacity = Math.min(availableGridCapacity, transformerRemainingForEV);
  return Number(safeEVCapacity.toFixed(2));
}

// ─── 3. GRID STRESS ──────────────────────────────────────────────────────────

/**
 * calculateGridStress(state) → { level, pct, label, color }
 * Levels: LOW / WATCH / HIGH / CRITICAL
 */
export function calculateGridStress(state) {
  const { totalLoad = 0, gridLimit = 100, transformerLoad = 0 } = state;
  const pct = Math.max((totalLoad / gridLimit) * 100, transformerLoad);

  if (pct >= 95) return { level: 'CRITICAL', pct, label: 'Critical — Emergency mode active', color: '#ef4444' };
  if (pct >= 85) return { level: 'HIGH',     pct, label: 'High — Throttling flexible EVs', color: '#f59e0b' };
  if (pct >= 75) return { level: 'WATCH',    pct, label: 'Watch — Approaching limit', color: '#eab308' };
  return           { level: 'LOW',      pct, label: 'Low — Operating normally', color: '#10b981' };
}

// ─── 4. DEPARTURE RISK ───────────────────────────────────────────────────────

/**
 * calculateDepartureRisk(ev, simHour, simMinute) → { onTrack, riskMinutes, label, recommendedPower }
 */
export function calculateDepartureRisk(ev, simHour = 8, simMinute = 30) {
  if (ev.status === 'Completed') return { onTrack: true, riskMinutes: 0, label: '✓ Charged', recommendedPower: 0 };

  const socDeficit = Math.max(0, ev.targetSoc - ev.currentSoc);
  if (socDeficit <= 0) return { onTrack: true, riskMinutes: 0, label: '✓ Target reached', recommendedPower: 0 };

  const energyNeeded = (socDeficit / 100) * ev.batteryCapacity;
  const currentPower = Math.max(ev.chargingPower, 0.1);
  const hoursNeeded = energyNeeded / currentPower;

  const simTimeDec = simHour + simMinute / 60;
  const depTimeDec = parseDepartureHours(ev.departureTime, simHour, simMinute);
  let hoursAvailable = depTimeDec - simTimeDec;
  if (hoursAvailable < 0) hoursAvailable += 24;

  const bufferHours = hoursAvailable - hoursNeeded;
  const riskMinutes = Math.round(-bufferHours * 60);

  if (bufferHours >= 0.25) {
    return { onTrack: true, riskMinutes: 0, label: '✓ On Track', recommendedPower: currentPower };
  }

  // Calculate minimum power needed to make departure
  const minPowerNeeded = hoursAvailable > 0 ? energyNeeded / hoursAvailable : ev.maxChargingPower;
  const recommendedPower = Math.min(ev.maxChargingPower, Math.ceil(minPowerNeeded * 10) / 10);

  return {
    onTrack: false,
    riskMinutes,
    label: `⚠ Departure Risk (+${Math.abs(riskMinutes)}m)`,
    recommendedPower
  };
}

// ─── 5. CHARGING ALLOCATION ──────────────────────────────────────────────────

/**
 * allocateChargingPower(evs, safeCapacity, state)
 *
 * Returns an array of { id, allocatedPower, priorityScore, reason }
 *
 * Algorithm:
 *  1. Score all active/waiting EVs
 *  2. Sort descending by priority score
 *  3. Greedily allocate up to min(ev.maxChargingPower, safeCapacity remaining)
 *  4. EVs at/above target get 0
 *  5. In emergency (safeCapacity < 0), even urgent EVs get minimum viable power
 */
export function allocateChargingPower(evs, safeCapacity, state) {
  const { chargers = [] } = state;
  const result = [];
  let budgetRemaining = safeCapacity;

  // Only consider EVs that need charging
  const activeEvs = evs.filter(ev => {
    if (ev.status === 'Completed') return false;
    const charger = chargers.find(c => c.id === ev.chargerId);
    if (charger && charger.status === 'offline') return false;
    return ev.currentSoc < ev.targetSoc;
  });

  // Score and sort
  const scored = activeEvs.map(ev => ({
    ev,
    score: calculatePriorityScore(ev, state),
    depRisk: calculateDepartureRisk(ev, state.simHour, state.simMinute)
  })).sort((a, b) => b.score - a.score);

  const isEmergency = safeCapacity < 5;

  for (const { ev, score, depRisk } of scored) {
    const charger = chargers.find(c => c.id === ev.chargerId);
    const maxChargerPower = charger?.status === 'reduced'
      ? ev.maxChargingPower * 0.5
      : ev.maxChargingPower;

    let allocated = 0;
    let reason = '';

    if (budgetRemaining <= 0 && isEmergency) {
      // Emergency: protect only CRITICAL departure risk EVs at min power
      if (!depRisk.onTrack && score > 70) {
        allocated = Math.min(3.7, maxChargerPower);
        reason = 'Emergency protected — critical departure risk';
      } else {
        allocated = 0;
        reason = 'Paused — grid emergency, flexible charging queued';
      }
    } else {
      // Normal allocation: give up to max, capped by budget
      const wanted = Math.min(maxChargerPower, 7.4); // default target ~7.4 kW
      allocated = Math.min(wanted, Math.max(0, budgetRemaining));
      reason = allocated >= wanted
        ? 'Full allocation — sufficient grid capacity'
        : allocated > 0
          ? `Throttled ${allocated.toFixed(1)} kW — grid capacity shared`
          : 'Queued — grid capacity exhausted';
    }

    budgetRemaining -= allocated;
    result.push({
      id: ev.id,
      allocatedPower: Number(allocated.toFixed(2)),
      priorityScore: score,
      onTrack: depRisk.onTrack,
      riskLabel: depRisk.label,
      recommendedPower: depRisk.recommendedPower,
      reason
    });
  }

  // EVs that are completed
  evs.filter(ev => ev.status === 'Completed' || ev.currentSoc >= ev.targetSoc).forEach(ev => {
    if (!result.find(r => r.id === ev.id)) {
      result.push({
        id: ev.id,
        allocatedPower: 0,
        priorityScore: 0,
        onTrack: true,
        riskLabel: '✓ Charged',
        recommendedPower: 0,
        reason: 'Target SOC reached'
      });
    }
  });

  return result;
}

// ─── 6. EXPLANATION GENERATOR ────────────────────────────────────────────────

export function generateExplanation(ev, oldPower, newPower, state, reason) {
  const diff = newPower - oldPower;
  const delta = Math.abs(diff).toFixed(1);
  const direction = diff < 0 ? 'reduced' : diff > 0 ? 'increased' : 'unchanged';

  const factors = [];

  if (state.buildingLoad > 65) factors.push('🏢 Building demand elevated (' + state.buildingLoad.toFixed(0) + ' kW)');
  if (state.solarGeneration < 5 && state.simHour >= 6 && state.simHour <= 19) factors.push('⛅ Low solar generation');
  if (state.solarGeneration > 20) factors.push('☀️ Solar surplus available (' + state.solarGeneration.toFixed(0) + ' kW)');
  if (state.gridUtilization > 85) factors.push('⚡ Grid at ' + state.gridUtilization.toFixed(0) + '% utilization');
  if (state.transformerLoad > 85) factors.push('🔌 Transformer thermal load high');
  if (reason) factors.push('📋 ' + reason);

  const peakImpact = diff < 0 ? `${delta} kW peak demand avoided` : `+${delta} kW clean energy utilised`;

  return {
    evId: ev.id,
    evName: ev.name,
    oldPower: Number(oldPower.toFixed(2)),
    newPower: Number(newPower.toFixed(2)),
    direction,
    delta: Number(delta),
    factors,
    peakImpact,
    timestamp: new Date().toISOString()
  };
}

// ─── 7. SOLAR-AWARE CHARGING BONUS ───────────────────────────────────────────

/**
 * When solar generation is high and grid stress is LOW,
 * we can safely increase flexible EV charging beyond the normal allocation.
 * Returns an extra kW budget from solar.
 */
export function calculateSolarBonus(state) {
  const { solarGeneration = 0, buildingLoad = 0, gridLimit = 100 } = state;
  const solarOffset = Math.max(0, solarGeneration - buildingLoad * 0.1); // Solar directly offsetting grid
  const stressLevel = calculateGridStress(state);
  if (stressLevel.level !== 'LOW' && stressLevel.level !== 'WATCH') return 0;
  // Can increase EV charging by up to 80% of solar surplus
  return Math.min(solarOffset * 0.8, 15); // Cap at 15 kW bonus
}

// ─── 8. FORECAST ENGINE ──────────────────────────────────────────────────────

/**
 * Deterministic 6-hour-ahead forecast using the same diurnal models
 * as the simulation engine.
 *
 * Returns array of 12 half-hour forecast points.
 */
export function generateForecast(state) {
  const { simHour = 8, simMinute = 0, gridLimit = 100, buildingDemandMultiplier = 1.0, solarMultiplier = 1.0 } = state;
  const points = [];

  for (let i = 1; i <= 12; i++) {
    // Advance time by 30 min increments
    let totalMinutes = simHour * 60 + simMinute + i * 30;
    const fHour = Math.floor(totalMinutes / 60) % 24;
    const fMin = totalMinutes % 60;
    const timeDec = fHour + fMin / 60;

    // Building load model (same as simulationEngine)
    let base = 30;
    if (timeDec >= 6 && timeDec < 10) base = 45 + ((timeDec - 6) / 4) * 22;
    else if (timeDec >= 10 && timeDec < 17) base = 60 + Math.sin((timeDec - 10) * 0.5) * 4;
    else if (timeDec >= 17 && timeDec < 22) base = 65 + Math.sin(((timeDec - 17) / 5) * Math.PI) * 16;
    else if (timeDec >= 22) base = 50 - ((timeDec - 22) / 2) * 18;
    else base = 25 + Math.sin(timeDec) * 3;
    const forecastBuilding = Number((base * buildingDemandMultiplier).toFixed(1));

    // Solar model
    let forecastSolar = 0;
    if (timeDec >= 6 && timeDec <= 19) {
      const progress = (timeDec - 6) / 13;
      forecastSolar = Number((Math.sin(progress * Math.PI) * 40 * solarMultiplier).toFixed(1));
    }

    // EV demand estimate: taper as departures happen through day
    const evEstimate = timeDec < 9 ? 18 : timeDec < 12 ? 12 : timeDec < 18 ? 8 : timeDec < 21 ? 24 : 14;

    const totalLoad = forecastBuilding + evEstimate;
    const gridUtil = (totalLoad / gridLimit) * 100;
    const netGridImport = Math.max(0, totalLoad - forecastSolar);
    const transformerUtil = (netGridImport / gridLimit) * 100;

    const period = fHour >= 12 ? 'PM' : 'AM';
    const dHour = fHour % 12 === 0 ? 12 : fHour % 12;
    const dMin = fMin.toString().padStart(2, '0');

    let stressLevel = 'LOW';
    if (gridUtil >= 95) stressLevel = 'CRITICAL';
    else if (gridUtil >= 85) stressLevel = 'HIGH';
    else if (gridUtil >= 75) stressLevel = 'WATCH';

    points.push({
      time: `${dHour}:${dMin} ${period}`,
      timeDec,
      forecastBuilding,
      forecastSolar,
      forecastEV: evEstimate,
      totalLoad,
      gridUtil: Number(gridUtil.toFixed(1)),
      transformerUtil: Number(transformerUtil.toFixed(1)),
      stressLevel,
      tariff: fHour >= 17 && fHour < 21 ? 0.34 : fHour >= 8 && fHour < 17 ? 0.22 : 0.12
    });
  }

  return points;
}

// ─── 9. WHAT-IF SIMULATION ───────────────────────────────────────────────────

/**
 * runWhatIfSimulation(inputs) → { withoutOpt, withOpt, deltas }
 *
 * Runs a completely separate stateless calculation.
 * Does NOT touch live simulationEngine state.
 */
export function runWhatIfSimulation({
  numEvs = 20,
  gridLimit = 100,
  buildingLoadMult = 1.0,
  solarMult = 1.0,
  avgEvPower = 7.2,
  simHour = 18
}) {
  // Base building load at given simulated hour
  const timeDec = simHour;
  let base = 30;
  if (timeDec >= 6 && timeDec < 10) base = 45 + ((timeDec - 6) / 4) * 22;
  else if (timeDec >= 10 && timeDec < 17) base = 60 + Math.sin((timeDec - 10) * 0.5) * 4;
  else if (timeDec >= 17 && timeDec < 22) base = 65 + Math.sin(((timeDec - 17) / 5) * Math.PI) * 16;
  const buildingLoad = Number((base * buildingLoadMult).toFixed(1));

  // Solar
  let solar = 0;
  if (timeDec >= 6 && timeDec <= 19) {
    const p = (timeDec - 6) / 13;
    solar = Number((Math.sin(p * Math.PI) * 40 * solarMult).toFixed(1));
  }

  // WITHOUT optimization: every EV charges at full power
  const rawEvLoad = numEvs * avgEvPower;
  const rawTotal = buildingLoad + rawEvLoad;
  const rawUtil = (rawTotal / gridLimit) * 100;
  const rawOverload = rawTotal > gridLimit;
  const rawPeak = rawTotal;

  // WITH optimization: cap EV load at safeCapacity
  const safeCapacity = Math.max(0, gridLimit * 0.88 - buildingLoad + solar * 0.6);
  const optEvLoad = Math.min(rawEvLoad, safeCapacity);
  const optTotal = buildingLoad + optEvLoad;
  const optUtil = (optTotal / gridLimit) * 100;

  // How many EVs get full power vs throttled vs delayed
  const evsFullPower = Math.floor(safeCapacity / avgEvPower);
  const evsThrottled = Math.min(numEvs - evsFullPower, Math.floor((safeCapacity % avgEvPower > 0.5 ? 1 : 0) + (optEvLoad - evsFullPower * avgEvPower) / avgEvPower));
  const evsDelayed = Math.max(0, numEvs - evsFullPower - evsThrottled);

  // Energy shifted = kWh that moved from peak to off-peak window
  const energyShifted = Number(((rawEvLoad - optEvLoad) * 1.5).toFixed(1)); // 1.5h typical shift window

  return {
    inputs: { numEvs, gridLimit, buildingLoad, solar, avgEvPower, buildingLoadMult, solarMult, simHour },
    withoutOpt: {
      peakLoad: Number(rawPeak.toFixed(1)),
      evLoad: Number(rawEvLoad.toFixed(1)),
      buildingLoad,
      solar,
      utilization: Number(rawUtil.toFixed(1)),
      isOverload: rawOverload,
      label: rawOverload ? '⚠️ GRID OVERLOAD' : '✓ Within Limits'
    },
    withOpt: {
      peakLoad: Number(optTotal.toFixed(1)),
      evLoad: Number(optEvLoad.toFixed(1)),
      buildingLoad,
      solar,
      utilization: Number(optUtil.toFixed(1)),
      isOverload: optTotal > gridLimit,
      label: optTotal <= gridLimit ? '✓ GRID SAFE' : '⚠️ STILL HIGH — Adjust inputs'
    },
    deltas: {
      peakReduction: Number((rawTotal - optTotal).toFixed(1)),
      evsFullPower: Math.max(0, evsFullPower),
      evsThrottled: Math.max(0, evsThrottled),
      evsDelayed: Math.max(0, evsDelayed),
      energyShifted,
      criticalProtected: Math.min(numEvs, evsFullPower)
    }
  };
}
