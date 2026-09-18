/**
 * SmartCharge Grid — Alert Engine
 *
 * Generates, deduplicates, and stores typed alerts.
 * Singleton that the simulation engine feeds state into.
 */
import { firestoreService } from './firestoreService';

const ALERT_CATEGORIES = {
  grid: 'GRID',
  ev: 'EV',
  solar: 'SOLAR',
  charger: 'CHARGER',
  transformer: 'TRANSFORMER',
  system: 'SYSTEM'
};

const COOLDOWN_MS = 90_000; // 90 second minimum between same alert type

class AlertEngine {
  constructor() {
    this.alerts = [];
    this.subscribers = new Set();
    this.lastAlertTime = {}; // key → timestamp
    this.maxAlerts = 60;
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    cb([...this.alerts]);
    return () => this.subscribers.delete(cb);
  }

  _notify() {
    const snapshot = [...this.alerts];
    this.subscribers.forEach(cb => { try { cb(snapshot); } catch(e) {} });
  }

  _canFire(key) {
    const now = Date.now();
    if (!this.lastAlertTime[key] || now - this.lastAlertTime[key] > COOLDOWN_MS) {
      this.lastAlertTime[key] = now;
      return true;
    }
    return false;
  }

  _add(category, severity, title, message, time, data = {}) {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category,          // 'grid' | 'ev' | 'solar' | 'charger' | 'transformer' | 'system'
      severity,          // 'info' | 'warning' | 'danger'
      title,
      message,
      time,
      data,
      dismissed: false,
      createdAt: Date.now()
    };
    this.alerts.unshift(alert);
    if (this.alerts.length > this.maxAlerts) this.alerts.pop();
    this._notify();

    // Async Firestore persist (non-blocking)
    firestoreService.saveTelemetrySnapshot({ alert, type: 'alert' }).catch(() => {});

    return alert;
  }

  processState(state) {
    const {
      gridUtilization = 0,
      transformerLoad = 0,
      transformerTemp = 0,
      solarGeneration = 0,
      buildingLoad = 0,
      vehicles = [],
      chargers = [],
      simTime = '',
      isEmergencyMode = false,
      systemStatus = 'NORMAL'
    } = state;

    // ── GRID ALERTS ──────────────────────────────────────────────────────────
    if (gridUtilization >= 95 && this._canFire('grid_critical')) {
      this._add('grid', 'danger', '⚡ Grid Critical Overload',
        `Total demand at ${gridUtilization.toFixed(0)}% of ${state.gridLimit} kW contract limit. Emergency load shedding activated.`,
        simTime, { utilization: gridUtilization });
    } else if (gridUtilization >= 85 && gridUtilization < 95 && this._canFire('grid_warning')) {
      this._add('grid', 'warning', '⚡ Grid High Demand',
        `Grid utilization at ${gridUtilization.toFixed(0)}%. Flexible EV charging being throttled to protect contract limit.`,
        simTime, { utilization: gridUtilization });
    }

    // ── TRANSFORMER ALERTS ───────────────────────────────────────────────────
    if (transformerLoad >= 90 && this._canFire('transformer_critical')) {
      this._add('transformer', 'danger', '🔌 Transformer Near Thermal Limit',
        `Transformer at ${transformerLoad.toFixed(0)}% load, ${transformerTemp.toFixed(1)}°C core temperature. Sustained overload risks insulation damage.`,
        simTime, { load: transformerLoad, temp: transformerTemp });
    } else if (transformerLoad >= 80 && transformerLoad < 90 && this._canFire('transformer_warning')) {
      this._add('transformer', 'warning', '🔌 Transformer Load Elevated',
        `Transformer at ${transformerLoad.toFixed(0)}% — thermal margin below 20%. Monitoring closely.`,
        simTime, { load: transformerLoad });
    }

    // ── SOLAR ALERTS ─────────────────────────────────────────────────────────
    const hour = state.simHour || 12;
    if (solarGeneration > 30 && this._canFire('solar_surplus')) {
      this._add('solar', 'info', '☀️ Solar Surplus Detected',
        `Rooftop array generating ${solarGeneration.toFixed(1)} kW. Optimizer increasing flexible EV charging to absorb clean energy.`,
        simTime, { solar: solarGeneration });
    }
    if (solarGeneration < 3 && hour >= 9 && hour <= 16 && this._canFire('solar_low')) {
      this._add('solar', 'warning', '🌧️ Low Solar Generation',
        `Solar array at only ${solarGeneration.toFixed(1)} kW during daylight. Likely heavy cloud cover. Grid dependency increased.`,
        simTime, { solar: solarGeneration });
    }

    // ── EV DEPARTURE RISK ALERTS ─────────────────────────────────────────────
    vehicles.forEach(ev => {
      if (ev.status !== 'Charging' && ev.status !== 'Waiting') return;
      const socDeficit = Math.max(0, ev.targetSoc - ev.currentSoc);
      if (socDeficit <= 0) return;
      const energyNeeded = (socDeficit / 100) * ev.batteryCapacity;
      const power = Math.max(ev.chargingPower, 0.1);
      const hoursNeeded = energyNeeded / power;

      // Parse departure
      const depKey = `ev_departure_${ev.id}`;
      const simTimeDec = (state.simHour || 8) + (state.simMinute || 30) / 60;
      let hoursAvail = 24;
      try {
        const [tp, per] = (ev.departureTime || '').split(' ');
        let [h, m] = tp.split(':').map(Number);
        if (per === 'PM' && h !== 12) h += 12;
        if (per === 'AM' && h === 12) h = 0;
        hoursAvail = h + m / 60 - simTimeDec;
        if (hoursAvail < 0) hoursAvail += 24;
      } catch {}

      if (hoursAvail < hoursNeeded * 1.05 && hoursAvail < 2 && this._canFire(depKey)) {
        this._add('ev', 'warning', `⏰ Departure Risk — ${ev.name}`,
          `${ev.id} (${ev.currentSoc.toFixed(0)}% → ${ev.targetSoc}%) needs ${hoursNeeded.toFixed(1)}h but only ${hoursAvail.toFixed(1)}h remains before departure at ${ev.departureTime}.`,
          simTime, { evId: ev.id, hoursNeeded, hoursAvail });
      }
    });

    // ── CHARGER ALERTS ───────────────────────────────────────────────────────
    chargers.forEach(charger => {
      const key = `charger_offline_${charger.id}`;
      if (charger.status === 'offline' && this._canFire(key)) {
        const connectedEv = vehicles.find(v => v.chargerId === charger.id);
        const evInfo = connectedEv ? ` ${connectedEv.name} (${connectedEv.id}) is affected.` : '';
        this._add('charger', 'danger', `🔌 Charger ${charger.id} Offline`,
          `${charger.name} has gone offline (ground fault or communication error).${evInfo} Manual intervention required.`,
          simTime, { chargerId: charger.id });
      }
    });

    // ── EMERGENCY MODE ───────────────────────────────────────────────────────
    if (isEmergencyMode && this._canFire('emergency_mode')) {
      this._add('system', 'danger', '🔴 Emergency Mode Activated',
        `Grid utilization exceeded 95%. Smart charging has suspended all flexible EV loads. Only critical-departure EVs are protected.`,
        simTime);
    } else if (!isEmergencyMode && this.lastAlertTime['emergency_recovery_block'] &&
               this._canFire('emergency_recovery')) {
      this._add('system', 'info', '🟢 Emergency Mode Resolved',
        `Grid utilization has returned below 90%. Normal smart charging resumed.`,
        simTime);
    }
  }

  clearAlert(id) {
    this.alerts = this.alerts.filter(a => a.id !== id);
    this._notify();
  }

  dismissAll() {
    this.alerts = [];
    this._notify();
  }

  getAlerts() {
    return [...this.alerts];
  }

  getByCategory(category) {
    if (category === 'ALL') return [...this.alerts];
    return this.alerts.filter(a => a.category === category.toLowerCase());
  }
}

export const alertEngine = new AlertEngine();
