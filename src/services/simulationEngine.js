// Central Simulation Engine & Virtual Sensors for SmartCharge Grid
import { INITIAL_ORGANIZATION, INITIAL_VEHICLES, INITIAL_CHARGERS, INITIAL_HOURLY_HISTORY } from '../data/seedData';
import { getFacilityConfig, getFacilityTariff, getBuildingLoadAtHour, FACILITY_CONFIG } from '../data/facilityConfig';
import { firestoreService } from './firestoreService';
import {
  calculateSafeCapacity,
  allocateChargingPower,
  calculateGridStress,
  calculateSolarBonus,
  generateExplanation
} from './optimizationEngine';
import { alertEngine } from './alertEngine';
import { DEFAULT_TARIFF } from './billingService'; // kept for compatibility

class SimulationEngine {
  constructor() {
    this.subscribers = new Set();
    this.timer = null;
    this.tickIntervalMs = 1000;
    this.speed = 1; // 1x, 2x, 5x, 10x, 0 (paused)
    this.tickCount = 0;

    // Simulation clock starts at 08:30 AM
    this.simHour = 8;
    this.simMinute = 30;

    // Organization Mode: 'Apartment' | 'Office' | 'College Campus' | 'Commercial Facility'
    this.organizationMode = 'Apartment';
    this.facilityConfig = getFacilityConfig('Apartment');

    // Configurable Billing Tariff
    this.tariffSettings = { ...getFacilityTariff('Apartment') };

    // Base parameters and control overrides
    this.gridLimit = this.facilityConfig.gridCapacity;
    this.transformerLimit = this.facilityConfig.transformerCapacity;
    this.buildingDemandMultiplier = 1.0;
    this.solarMultiplier = 1.0;
    this.activeScenario = 'Normal Operation';

    // State collections
    this.vehicles = JSON.parse(JSON.stringify(INITIAL_VEHICLES));
    this.chargers = JSON.parse(JSON.stringify(INITIAL_CHARGERS));
    this.hourlyHistory = JSON.parse(JSON.stringify(INITIAL_HOURLY_HISTORY));

    // Dynamic metrics
    this.buildingLoad = 58.4;
    this.solarGeneration = 14.8;
    this.evLoad = 21.6;
    this.totalLoad = 80.0;
    this.remainingCapacity = 20.0;
    this.gridUtilization = 80.0;
    this.transformerLoad = 80.0;
    this.transformerTemp = 58.2; // °C
    this.voltage = 401.5; // V
    this.current = 115.4; // A
    this.electricityTariff = 0.18; // $/kWh
    this.systemStatus = 'NORMAL'; // 'NORMAL' | 'WARNING' | 'CRITICAL'
    this.statusMessage = 'System operating within safe margins.';

    // Alerts queue (legacy + alert engine)
    this.alerts = [
      { id: 'alt-1', type: 'info', message: 'Solar array production rising with morning irradiance.', time: '08:15 AM' },
      { id: 'alt-2', type: 'warning', message: 'Charger CH-05 reported offline (ground fault error).', time: '07:45 AM' }
    ];

    // Real-Time Event Feed (compact application log)
    this.eventFeed = [
      { id: 'ev-1', time: '14:24', icon: 'Sun', type: 'info', text: 'Solar surplus detected (+12.4 kW)' },
      { id: 'ev-2', time: '14:23', icon: 'Zap', type: 'success', text: 'EV charging dynamically optimized' },
      { id: 'ev-3', time: '14:21', icon: 'Car', type: 'warning', text: 'EV-03 priority upgraded to HIGH' },
      { id: 'ev-4', time: '14:20', icon: 'AlertTriangle', type: 'warning', text: 'Grid utilization reached 86%' },
      { id: 'ev-5', time: '14:18', icon: 'CheckCircle2', type: 'success', text: 'EV-07 charging completed' }
    ];

    // Demand Response State
    this.demandResponse = {
      active: false,
      requestedKw: 15,
      actualReducedKw: 17,
      durationMinutes: 30,
      remainingSeconds: 0,
      status: 'IDLE' // 'IDLE' | 'ACTIVE' | 'COMPLETED'
    };

    // Optimizer state
    this.isEmergencyMode = false;
    this.optimizerEnabled = true;
    this.optimizationResult = [];
    this.gridStress = { level: 'LOW', pct: 0, label: 'Low', color: '#10b981' };
    this.lastSolarGeneration = 0;
    this.optimizationLog = []; // recent explanations
    this.toastQueue = [];      // pending UI toasts

    // Compute initial state
    this.updateStateCalculations();
    this.start();
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    const currentState = this.getState();
    this.subscribers.forEach(cb => {
      try {
        cb(currentState);
      } catch (err) {
        console.error('Subscriber notification error:', err);
      }
    });
  }

  getState() {
    return {
      simTime: this.getFormattedTime(),
      simHour: this.simHour,
      simMinute: this.simMinute,
      speed: this.speed,
      isRunning: this.speed > 0,
      activeScenario: this.activeScenario,

      gridLimit: this.gridLimit,
      transformerLimit: this.transformerLimit,
      buildingDemandMultiplier: this.buildingDemandMultiplier,
      solarMultiplier: this.solarMultiplier,

      buildingLoad: Number(this.buildingLoad.toFixed(1)),
      solarGeneration: Number(this.solarGeneration.toFixed(1)),
      evLoad: Number(this.evLoad.toFixed(1)),
      totalLoad: Number(this.totalLoad.toFixed(1)),
      remainingCapacity: Number(this.remainingCapacity.toFixed(1)),
      gridUtilization: Number(this.gridUtilization.toFixed(1)),

      transformerLoad: Number(this.transformerLoad.toFixed(1)),
      transformerTemp: Number(this.transformerTemp.toFixed(1)),
      voltage: Number(this.voltage.toFixed(1)),
      current: Number(this.current.toFixed(1)),
      electricityTariff: Number(this.electricityTariff.toFixed(2)),

      systemStatus: this.systemStatus,
      statusMessage: this.statusMessage,

      organizationMode: this.organizationMode,
      tariffSettings: { ...this.tariffSettings },
      demandResponse: { ...this.demandResponse },
      eventFeed: [...this.eventFeed],

      activeEvCount: this.vehicles.filter(v => v.status === 'Charging').length,
      totalEvCount: this.vehicles.length,
      vehicles: [...this.vehicles],
      chargers: [...this.chargers],
      hourlyHistory: [...this.hourlyHistory],
      alerts: [...this.alerts],

      // Stage 2 optimizer fields
      isEmergencyMode: this.isEmergencyMode,
      optimizerEnabled: this.optimizerEnabled,
      optimizationResult: [...this.optimizationResult],
      gridStress: { ...this.gridStress },
      optimizationLog: this.optimizationLog.slice(0, 10),
      toastQueue: [...this.toastQueue],
      safeEVCapacity: Number(calculateSafeCapacity(this).toFixed(1))
    };
  }

  getFormattedTime() {
    const period = this.simHour >= 12 ? 'PM' : 'AM';
    const displayHour = this.simHour % 12 === 0 ? 12 : this.simHour % 12;
    const displayMinute = this.simMinute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setSpeed(multiplier) {
    this.speed = multiplier;
    this.notifySubscribers();
  }

  setBuildingMultiplier(val) {
    this.buildingDemandMultiplier = Number(val);
    this.updateStateCalculations();
    this.notifySubscribers();
  }

  setSolarMultiplier(val) {
    this.solarMultiplier = Number(val);
    this.updateStateCalculations();
    this.notifySubscribers();
  }

  setGridLimit(val) {
    this.gridLimit = Number(val);
    this.updateStateCalculations();
    this.notifySubscribers();
  }

  setTransformerLimit(val) {
    this.transformerLimit = Number(val);
    this.updateStateCalculations();
    this.notifySubscribers();
  }

  // Core Simulation Loop Tick
  tick() {
    if (this.speed === 0) return; // Paused

    this.tickCount++;

    // Advance clock: advance 1 minute * speed every second
    this.simMinute += 1 * this.speed;
    while (this.simMinute >= 60) {
      this.simMinute -= 60;
      this.simHour = (this.simHour + 1) % 24;
      this.onHourRollover();
    }

    // Demand Response countdown timer
    if (this.demandResponse && this.demandResponse.active) {
      this.demandResponse.remainingSeconds -= 1 * this.speed;
      if (this.demandResponse.remainingSeconds <= 0) {
        this.demandResponse.active = false;
        this.demandResponse.status = 'COMPLETED';
        this.addAlert('info', '✅ Demand Response event concluded. Normal charging capacity restored.');
        this.addEvent('Demand response completed — grid restored', 'success', 'CheckCircle2');
        this.toastQueue.push({ id: Date.now(), type: 'success', message: '✅ Demand Response completed' });
      }
    }

    // 1. Virtual Sensor: Building Demand Curve
    this.updateBuildingLoad();

    // 2. Virtual Sensor: Solar PV Generation Curve
    this.updateSolarGeneration();

    // 3. Virtual Sensor: EV Battery Charging Dynamics (unconstrained first pass)
    this.updateEvCharging();

    // 4. Optimization Engine — constrain EV charging to safe capacity
    if (this.optimizerEnabled) {
      this.applyOptimization();
    }

    // 5. Grid, Transformer & System Diagnostics (after optimizer adjustments)
    this.updateStateCalculations();

    // 6. Alert engine processes state
    if (this.tickCount % 5 === 0) {
      alertEngine.processState(this.getState());
      // Merge alert engine alerts
      const engineAlerts = alertEngine.getAlerts();
      if (engineAlerts.length > 0) {
        this.alerts = [...engineAlerts, ...this.alerts.filter(a => !engineAlerts.find(ea => ea.id === a.id))];
        if (this.alerts.length > 60) this.alerts = this.alerts.slice(0, 60);
      }
    }

    // Periodic throttled sync to Firestore (every 30 ticks)
    if (this.tickCount % 30 === 0) {
      firestoreService.saveTelemetrySnapshot({
        simTime: this.getFormattedTime(),
        buildingLoad: this.buildingLoad,
        evLoad: this.evLoad,
        solarGeneration: this.solarGeneration,
        totalLoad: this.totalLoad,
        transformerLoad: this.transformerLoad,
        systemStatus: this.systemStatus,
        isEmergencyMode: this.isEmergencyMode
      });
    }

    this.notifySubscribers();
  }

  updateBuildingLoad() {
    // Use facility-specific load profile from facilityConfig
    this.buildingLoad = Math.max(
      this.facilityConfig.buildingBaseLoad * 0.4,
      getBuildingLoadAtHour(this.simHour, this.simMinute, this.facilityConfig, this.buildingDemandMultiplier)
    );
  }

  updateSolarGeneration() {
    // Solar generation based on facility solar capacity, active 06:00–19:00
    const timeDec = this.simHour + this.simMinute / 60;
    if (timeDec < 6 || timeDec > 19) {
      this.solarGeneration = 0;
      return;
    }
    const peakKw = this.facilityConfig.solarCapacity;
    // Sine curve over daylight 13 hours, peak at noon
    const daylightProgress = (timeDec - 6) / 13;
    const rawSolar = Math.sin(daylightProgress * Math.PI) * peakKw;
    const cloudNoise = (Math.random() - 0.5) * (peakKw * 0.04);
    this.solarGeneration = Math.max(0, Math.min(peakKw * 1.02, (rawSolar + cloudNoise) * this.solarMultiplier));
  }

  updateEvCharging() {
    let totalCharging = 0;

    this.vehicles.forEach(ev => {
      // Look up assigned charger
      const charger = this.chargers.find(c => c.id === ev.chargerId);
      const isChargerAvailable = charger && charger.status !== 'offline';

      if (ev.status === 'Charging' && isChargerAvailable) {
        // Reduced charger throttles output
        if (charger.status === 'reduced') {
          ev.chargingPower = Math.min(ev.chargingPower, charger.maxPower * 0.5);
        }

        // Energy delivered in this tick (simulated minute)
        // Energy (kWh) = Power (kW) * (minutes / 60)
        const simHoursElapsed = (1 * this.speed) / 60;
        const kWhDelivered = ev.chargingPower * simHoursElapsed;
        
        // Update SOC
        const socGain = (kWhDelivered / ev.batteryCapacity) * 100;
        ev.currentSoc = Math.min(100, Number((ev.currentSoc + socGain).toFixed(2)));

        // Update energy required
        const socNeeded = Math.max(0, ev.targetSoc - ev.currentSoc);
        ev.energyRequired = Number(((socNeeded / 100) * ev.batteryCapacity).toFixed(1));

        // Check completion
        if (ev.currentSoc >= ev.targetSoc) {
          ev.status = 'Completed';
          ev.chargingPower = 0.0;
          ev.estimatedCompletion = 'Ready';
        } else {
          totalCharging += ev.chargingPower;
          const hoursRemaining = ev.chargingPower > 0 ? (ev.energyRequired / ev.chargingPower) : 0;
          const h = Math.floor(hoursRemaining);
          const m = Math.floor((hoursRemaining - h) * 60);
          ev.estimatedCompletion = `${h}h ${m}m`;
        }
      } else if (ev.status === 'Waiting' && isChargerAvailable) {
        // Waiter can start charging if power is available
        ev.chargingPower = 7.2;
        ev.status = 'Charging';
        totalCharging += ev.chargingPower;
      } else if (ev.status === 'Completed') {
        ev.chargingPower = 0.0;
      }
    });

    this.evLoad = totalCharging;
  }

  // ── OPTIMIZER APPLICATION ──────────────────────────────────────────────────
  applyOptimization() {
    const stateSnap = {
      simHour: this.simHour,
      simMinute: this.simMinute,
      gridLimit: this.gridLimit,
      transformerLimit: this.transformerLimit,
      buildingLoad: this.buildingLoad,
      solarGeneration: this.solarGeneration,
      evLoad: this.evLoad,
      totalLoad: this.buildingLoad + this.evLoad,
      gridUtilization: ((this.buildingLoad + this.evLoad) / this.gridLimit) * 100,
      chargers: this.chargers
    };

    const safeCapacity = calculateSafeCapacity(stateSnap);
    const solarBonus = calculateSolarBonus(stateSnap);
    let effectiveCapacity = Math.min(safeCapacity + solarBonus, this.gridLimit * 0.92 - this.buildingLoad);
    if (this.demandResponse && this.demandResponse.active) {
      effectiveCapacity = Math.max(0, effectiveCapacity - this.demandResponse.requestedKw);
    }

    // Emergency mode detection
    const prevEmergency = this.isEmergencyMode;
    this.isEmergencyMode = stateSnap.gridUtilization >= 95;

    if (this.isEmergencyMode && !prevEmergency) {
      this.addAlert('danger', '🔴 EMERGENCY MODE: Grid at critical capacity. Flexible EV charging suspended.');
      this.toastQueue.push({ id: Date.now(), type: 'danger', message: '🔴 Emergency Mode Activated — flexible charging suspended' });
    } else if (!this.isEmergencyMode && prevEmergency) {
      this.addAlert('info', '🟢 Emergency Mode Resolved: Grid returned to safe operating range.');
      this.toastQueue.push({ id: Date.now(), type: 'success', message: '🟢 Grid recovered — normal charging resumed' });
    }

    // Grid stress metric
    this.gridStress = calculateGridStress({ ...stateSnap, totalLoad: this.buildingLoad + this.evLoad });

    // Solar surplus toast (when solar ramps up significantly)
    const solarDelta = this.solarGeneration - this.lastSolarGeneration;
    if (solarDelta > 5 && this.solarGeneration > 15 && this.tickCount % 20 === 0) {
      this.toastQueue.push({ id: Date.now(), type: 'info', message: `☀️ Solar surplus +${solarDelta.toFixed(1)} kW — EV charging increased` });
    }
    this.lastSolarGeneration = this.solarGeneration;

    // Allocate power
    const allocation = allocateChargingPower(this.vehicles, effectiveCapacity, stateSnap);
    this.optimizationResult = allocation;

    // Apply allocations back to vehicles
    let newEvLoad = 0;
    allocation.forEach(({ id, allocatedPower }) => {
      const ev = this.vehicles.find(v => v.id === id);
      if (ev && ev.status === 'Charging') {
        const oldPower = ev.chargingPower;
        ev.chargingPower = allocatedPower;
        if (allocatedPower === 0 && oldPower > 0) {
          ev.status = 'Waiting';
        } else if (allocatedPower > 0 && ev.status === 'Waiting') {
          ev.status = 'Charging';
        }
        // Log significant changes
        if (Math.abs(oldPower - allocatedPower) > 1.0 && this.tickCount % 10 === 0) {
          const explanation = generateExplanation(ev, oldPower, allocatedPower, stateSnap, '');
          this.optimizationLog.unshift(explanation);
          if (this.optimizationLog.length > 20) this.optimizationLog.pop();
        }
        newEvLoad += allocatedPower;
      } else if (ev && ev.status === 'Waiting' && allocatedPower > 0) {
        ev.status = 'Charging';
        ev.chargingPower = allocatedPower;
        newEvLoad += allocatedPower;
      }
    });

    this.evLoad = newEvLoad;
    // Safety guard: hard clamp
    if (this.buildingLoad + this.evLoad > this.gridLimit * 0.98) {
      const excess = (this.buildingLoad + this.evLoad) - (this.gridLimit * 0.98);
      this.evLoad = Math.max(0, this.evLoad - excess);
    }
  }

  setOptimizerEnabled(val) {
    this.optimizerEnabled = Boolean(val);
    this.notifySubscribers();
  }

  consumeToasts() {
    const toasts = [...this.toastQueue];
    this.toastQueue = [];
    return toasts;
  }

  updateStateCalculations() {
    this.totalLoad = this.buildingLoad + this.evLoad;
    this.remainingCapacity = Math.max(0, this.gridLimit - this.totalLoad);
    this.gridUtilization = (this.totalLoad / this.gridLimit) * 100;

    // Transformer Load (accounting for solar backfeed or building relief)
    // Transformer kVA ~ totalLoad with power factor ~0.95
    const netGridImport = Math.max(0, this.totalLoad - this.solarGeneration);
    this.transformerLoad = (netGridImport / this.transformerLimit) * 100;

    // Thermal inertia model for transformer
    // Ambient 28°C, steady-state temp rises with load squared
    const targetTemp = 35 + Math.pow(this.transformerLoad / 100, 1.8) * 55;
    this.transformerTemp += (targetTemp - this.transformerTemp) * 0.05;

    // Voltage droop under load
    this.voltage = 405 - (this.transformerLoad / 100) * 14 + (Math.random() - 0.5) * 1.0;
    this.current = (netGridImport * 1000) / (Math.sqrt(3) * this.voltage);

    // Diagnostics & Alerts
    if (this.gridUtilization >= 95 || this.transformerLoad >= 95) {
      this.systemStatus = 'CRITICAL';
      this.statusMessage = '⚠️ CRITICAL: Substation transformer near thermal overload!';
    } else if (this.gridUtilization >= 85 || this.transformerLoad >= 85) {
      this.systemStatus = 'WARNING';
      this.statusMessage = '🟡 High demand warning: Approaching grid contract limit.';
    } else {
      this.systemStatus = 'NORMAL';
      this.statusMessage = '🟢 All grid, solar and transformer metrics operating nominally.';
    }

    // Electricity tariff (Time of Use pricing)
    // Peak hours: 17:00 - 21:00 ($0.34/kWh), Mid-peak: 08:00 - 17:00 ($0.22/kWh), Off-peak: ($0.12/kWh)
    if (this.simHour >= 17 && this.simHour < 21) {
      this.electricityTariff = 0.34;
    } else if (this.simHour >= 8 && this.simHour < 17) {
      this.electricityTariff = 0.22;
    } else {
      this.electricityTariff = 0.12;
    }
  }

  onHourRollover() {
    const formattedHour = `${this.simHour.toString().padStart(2, '0')}:00`;
    // Update or add hourly record in history
    const existingIdx = this.hourlyHistory.findIndex(h => h.hour === formattedHour);
    const dataPoint = {
      hour: formattedHour,
      buildingLoad: Number(this.buildingLoad.toFixed(1)),
      evLoad: Number(this.evLoad.toFixed(1)),
      solarGeneration: Number(this.solarGeneration.toFixed(1)),
      totalLoad: Number(this.totalLoad.toFixed(1)),
      gridLimit: this.gridLimit
    };

    if (existingIdx >= 0) {
      this.hourlyHistory[existingIdx] = dataPoint;
    } else {
      this.hourlyHistory.push(dataPoint);
      if (this.hourlyHistory.length > 24) this.hourlyHistory.shift();
    }
  }

  // Pre-configured Scenarios
  triggerScenario(scenarioName) {
    this.activeScenario = scenarioName;

    switch (scenarioName) {
      case 'Solar Peak':
        this.simHour = 12;
        this.simMinute = 30;
        this.solarMultiplier = 1.25;
        this.buildingDemandMultiplier = 0.95;
        this.addAlert('info', '☀️ Solar Peak: Maximum solar generation. Optimizer increasing flexible EV charging.');
        this.toastQueue.push({ id: Date.now(), type: 'info', message: '☀️ Solar surplus — EV charging increased with clean energy' });
        break;

      case 'Morning Demand':
        this.simHour = 8;
        this.simMinute = 15;
        this.buildingDemandMultiplier = 1.2;
        this.solarMultiplier = 0.7;
        this.addAlert('info', '🌅 Scenario triggered: Morning commercial/residential building ramp.');
        break;

      case 'Evening Peak':
        this.simHour = 19;
        this.simMinute = 30;
        this.buildingDemandMultiplier = 1.35;
        this.solarMultiplier = 0.0;
        this.addAlert('warning', '🌆 Scenario triggered: Peak evening tariff and residential cooking surge.');
        break;

      case 'EV Rush':
        this.simHour = 18;
        this.simMinute = 0;
        this.buildingDemandMultiplier = 1.15;
        // Connect all vehicles; optimizer will throttle to safe capacity
        this.vehicles.forEach((v, i) => {
          if (i < 18) {
            v.status = 'Charging';
            v.chargingPower = 7.4;
          }
        });
        this.addAlert('warning', '🚗 EV Rush: 18 EVs plugged in. Optimizer is allocating within safe grid capacity.');
        this.toastQueue.push({ id: Date.now(), type: 'warning', message: '🚗 EV Rush — optimizer throttling flexible loads' });
        break;

      case 'Grid Overload':
        this.buildingDemandMultiplier = 1.6;
        this.vehicles.forEach(v => {
          v.status = 'Charging';
          v.chargingPower = 7.4;
        });
        this.addAlert('danger', '⚠️ Grid Overload scenario: Emergency mode activated. Flexible EV loads suspended.');
        this.toastQueue.push({ id: Date.now(), type: 'danger', message: '⚠️ Grid Overload — emergency mode active' });
        break;

      case 'Many Low-Battery EVs':
        this.vehicles.forEach((v, i) => {
          if (i % 2 === 0) {
            v.currentSoc = Math.floor(10 + Math.random() * 8);
            v.status = 'Charging';
            v.priority = 'HIGH';
            v.chargingPower = 7.2;
          }
        });
        this.addAlert('warning', '🔋 Scenario triggered: 10 critical low-SOC vehicles needing urgent charge.');
        break;

      case 'Low Solar':
        this.simHour = 13;
        this.simMinute = 0;
        this.solarMultiplier = 0.08;
        this.addAlert('warning', '🌧️ Scenario triggered: Heavy cloud cover/storm, solar cut to 8%.');
        break;

      case 'Charger Failure':
        ['CH-02', 'CH-04', 'CH-07', 'CH-15'].forEach(id => {
          const charger = this.chargers.find(c => c.id === id);
          if (charger) charger.status = 'offline';
        });
        this.vehicles.forEach(v => {
          if (['CH-02', 'CH-04', 'CH-07', 'CH-15'].includes(v.chargerId)) {
            v.status = 'Waiting';
            v.chargingPower = 0.0;
          }
        });
        this.addAlert('danger', '🔌 Scenario triggered: Multiple charger hardware faults detected.');
        break;

      case 'Clean Charging':
        this.simHour = 13;
        this.simMinute = 0;
        this.solarMultiplier = 1.35;
        this.buildingDemandMultiplier = 0.85;
        this.vehicles.forEach((v, i) => {
          if (i < 10) {
            v.status = 'Charging';
            v.chargingPower = 7.2;
          }
        });
        this.addAlert('info', '☀️ Clean Charging: 100% of EV charging demand currently matched by rooftop solar.');
        this.addEvent('Clean charging active: 100% solar matched', 'success', 'Sun');
        this.toastQueue.push({ id: Date.now(), type: 'success', message: '☀️ Clean Charging Active (100% Solar)' });
        break;

      case 'Normal Operation':
      case 'Reset Default':
      default:
        this.activeScenario = 'Normal Operation';
        this.simHour = 11;
        this.simMinute = 0;
        this.buildingDemandMultiplier = 1.02;
        this.solarMultiplier = 1.1;
        this.gridLimit = 100;
        this.transformerLimit = 100;
        this.vehicles = JSON.parse(JSON.stringify(INITIAL_VEHICLES));
        this.chargers = JSON.parse(JSON.stringify(INITIAL_CHARGERS));
        this.addAlert('info', '🔄 Simulation reset to standard operating baseline (Normal).');
        this.addEvent('System reset to Normal baseline', 'info', 'RotateCcw');
        break;
    }

    this.updateBuildingLoad();
    this.updateSolarGeneration();
    this.updateEvCharging();
    this.updateStateCalculations();
    this.notifySubscribers();
  }

  addAlert(type, message) {
    this.alerts.unshift({
      id: `alt-${Date.now()}`,
      type,
      message,
      time: this.getFormattedTime()
    });
    if (this.alerts.length > 20) this.alerts.pop();
  }

  // Action methods for UI interaction
  updateVehiclePriority(vehicleId, priority) {
    const ev = this.vehicles.find(v => v.id === vehicleId);
    if (ev) {
      ev.priority = priority;
      this.addEvent(`${ev.name || ev.id} priority set to ${priority}`, priority === 'HIGH' ? 'warning' : 'info', 'Car');
      this.notifySubscribers();
    }
  }

  toggleVehicleCharging(vehicleId) {
    const ev = this.vehicles.find(v => v.id === vehicleId);
    if (ev) {
      if (ev.status === 'Charging') {
        ev.status = 'Waiting';
        ev.chargingPower = 0.0;
        this.addEvent(`${ev.name || ev.id} paused charging`, 'info', 'Pause');
      } else {
        ev.status = 'Charging';
        ev.chargingPower = 7.2;
        this.addEvent(`${ev.name || ev.id} resumed charging`, 'success', 'Zap');
      }
      this.updateEvCharging();
      this.updateStateCalculations();
      this.notifySubscribers();
    }
  }

  setOrganizationMode(mode) {
    this.organizationMode = mode;
    // Apply facility-specific configuration
    const fc = getFacilityConfig(mode);
    this.facilityConfig = fc;
    this.gridLimit = fc.gridCapacity;
    this.transformerLimit = fc.transformerCapacity;
    // Update tariff to facility-specific rates
    this.tariffSettings = { ...getFacilityTariff(mode) };
    // Rebuild vehicles for new facility EV count profile
    this._initFacilityVehicles(mode, fc);
    // Recompute
    this.updateBuildingLoad();
    this.updateSolarGeneration();
    this.updateEvCharging();
    this.updateStateCalculations();
    this.addEvent(`Facility switched to ${mode} (Grid: ${fc.gridCapacity} kW, Solar: ${fc.solarCapacity} kWp, EVs: ${fc.evCount})`, 'info', 'Building2');
    this.toastQueue.push({ id: Date.now(), type: 'info', message: `🏢 Switched to ${fc.label}` });
    this.notifySubscribers();
  }

  _initFacilityVehicles(mode, fc) {
    // Build an EV fleet appropriate for the facility count and charging profile
    const carModels = [
      { name: 'Tata Nexon EV', battery: 40.5, maxPower: 7.2 },
      { name: 'MG ZS EV', battery: 50.3, maxPower: 7.4 },
      { name: 'Hyundai Kona EV', battery: 39.2, maxPower: 7.2 },
      { name: 'Mahindra XUV400', battery: 39.4, maxPower: 7.2 },
      { name: 'Tesla Model 3', battery: 60, maxPower: 11.0 },
      { name: 'Hyundai Ioniq 5', battery: 72.6, maxPower: 11.0 },
      { name: 'BYD Atto 3', battery: 60.5, maxPower: 7.4 },
      { name: 'Kia EV6', battery: 77.4, maxPower: 11.0 },
      { name: 'Volvo XC40 Electric', battery: 69, maxPower: 11.0 },
      { name: 'BMW iX', battery: 111.5, maxPower: 11.0 },
    ];
    const statuses = ['Charging', 'Charging', 'Charging', 'Waiting', 'Completed'];
    const priorities = ['HIGH', 'HIGH', 'NORMAL', 'NORMAL', 'LOW'];

    // Departure times based on profile
    const departureTimes = {
      residential: ['06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM'],
      office: ['05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM'],
      campus: ['04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'],
      commercial: ['02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM'],
    };
    const depTimes = departureTimes[fc.chargingProfile] || departureTimes.residential;

    const count = Math.min(fc.evCount, 50);
    const chargerCount = Math.min(count, 20); // max 20 chargers defined in seed

    const newVehicles = [];
    for (let i = 0; i < count; i++) {
      const model = carModels[i % carModels.length];
      const soc = 10 + Math.floor(Math.random() * 70);
      const targetSoc = 85 + Math.floor(Math.random() * 15);
      const statusIdx = Math.floor(Math.random() * statuses.length);
      const status = i < count * 0.55 ? 'Charging' : i < count * 0.75 ? 'Waiting' : 'Completed';
      const chargerId = i < chargerCount ? `CH-${String(i + 1).padStart(2, '0')}` : null;
      const energyReq = Number((((targetSoc - soc) / 100) * model.battery).toFixed(1));
      newVehicles.push({
        id: `EV-${String(i + 1).padStart(2, '0')}`,
        name: model.name,
        licensePlate: `KA-04-EV-${1000 + i}`,
        batteryCapacity: model.battery,
        currentSoc: soc,
        targetSoc,
        departureTime: depTimes[i % depTimes.length],
        chargingPower: status === 'Charging' ? model.maxPower * (0.5 + Math.random() * 0.5) : 0,
        maxChargingPower: model.maxPower,
        status,
        chargerId,
        priority: priorities[i % priorities.length],
        estimatedCompletion: status === 'Charging' ? '2h 30m' : status === 'Completed' ? 'Ready' : 'Waiting',
        energyRequired: energyReq,
        ownerName: `User ${i + 1}`,
        pluggedInAt: '08:00 AM',
      });
    }
    this.vehicles = newVehicles;
    // Reset chargers list - keep original seed chargers for up to 20
    this.chargers = JSON.parse(JSON.stringify(INITIAL_CHARGERS)).slice(0, chargerCount);
    // Ensure offline/reduced for variety
    if (chargerCount > 3) {
      this.chargers[Math.floor(chargerCount * 0.2)].status = 'offline';
      this.chargers[Math.floor(chargerCount * 0.4)].status = 'reduced';
    }
    this.hourlyHistory = JSON.parse(JSON.stringify(INITIAL_HOURLY_HISTORY));
  }

  setTariffSettings(tariff) {
    this.tariffSettings = { ...this.tariffSettings, ...tariff };
    this.addEvent('Electricity tariff configuration updated', 'info', 'Receipt');
    this.toastQueue.push({ id: Date.now(), type: 'info', message: '⚙️ Billing tariff updated' });
    this.notifySubscribers();
  }

  setChargerStatus(chargerId, status) {
    const charger = this.chargers.find(c => c.id === chargerId);
    if (charger) {
      charger.status = status;
      const ev = this.vehicles.find(v => v.chargerId === chargerId);
      if (status === 'offline') {
        if (ev && ev.status === 'Charging') {
          ev.status = 'Waiting';
          ev.chargingPower = 0.0;
        }
        this.addAlert('danger', `🔴 Charger ${chargerId} hardware fault: Communication dropped (OCPP offline).`);
        this.addEvent(`Charger ${chargerId} went OFFLINE`, 'danger', 'AlertTriangle');
        this.toastQueue.push({ id: Date.now(), type: 'danger', message: `⚠️ Charger ${chargerId} offline` });
      } else if (status === 'reduced') {
        if (ev && ev.status === 'Charging') {
          ev.chargingPower = Math.min(ev.chargingPower, 3.7);
        }
        this.addAlert('warning', `🟠 Charger ${chargerId} thermal derating: Output capped at 50%.`);
        this.addEvent(`Charger ${chargerId} power derated (50%)`, 'warning', 'Zap');
        this.toastQueue.push({ id: Date.now(), type: 'warning', message: `🟠 Charger ${chargerId} derated` });
      } else if (status === 'online') {
        this.addAlert('info', `🟢 Charger ${chargerId} back online and operational.`);
        this.addEvent(`Charger ${chargerId} restored online`, 'success', 'CheckCircle2');
        this.toastQueue.push({ id: Date.now(), type: 'success', message: `🟢 Charger ${chargerId} online` });
      }
      this.updateEvCharging();
      this.updateStateCalculations();
      this.notifySubscribers();
    }
  }

  triggerDemandResponse(requestedKw = 15, durationMinutes = 30) {
    const actualReduced = Math.min(requestedKw + 2, Math.max(8, this.evLoad * 0.75));
    this.demandResponse = {
      active: true,
      requestedKw: Number(requestedKw),
      actualReducedKw: Number(actualReduced.toFixed(1)),
      durationMinutes: Number(durationMinutes),
      remainingSeconds: durationMinutes * 60,
      status: 'ACTIVE'
    };
    this.addAlert('warning', `⚡ Demand Response: Grid requested -${requestedKw} kW. Optimizer curtailed flexible EV load by -${actualReduced.toFixed(1)} kW.`);
    this.addEvent(`DR accepted: curtailed -${actualReduced.toFixed(1)} kW load`, 'warning', 'Zap');
    this.toastQueue.push({ id: Date.now(), type: 'warning', message: `⚡ Demand Response Active (-${requestedKw} kW)` });
    this.applyOptimization();
    this.updateStateCalculations();
    this.notifySubscribers();
  }

  cancelDemandResponse() {
    this.demandResponse = {
      active: false,
      requestedKw: 15,
      actualReducedKw: 0,
      durationMinutes: 30,
      remainingSeconds: 0,
      status: 'CANCELLED'
    };
    this.addAlert('info', 'Demand response terminated by operator.');
    this.addEvent('Demand response cancelled by operator', 'info', 'CheckCircle2');
    this.toastQueue.push({ id: Date.now(), type: 'info', message: 'Demand Response cancelled' });
    this.applyOptimization();
    this.updateStateCalculations();
    this.notifySubscribers();
  }

  addEvent(text, type = 'info', icon = 'Zap') {
    this.eventFeed.unshift({
      id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      time: this.getFormattedTime().split(' ')[0],
      icon,
      type,
      text
    });
    if (this.eventFeed.length > 25) this.eventFeed.pop();
  }
}

// Singleton instance
export const simulationEngine = new SimulationEngine();
