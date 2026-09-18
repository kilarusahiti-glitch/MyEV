import React from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { 
  FlaskConical, 
  Radio, 
  Play, 
  Pause, 
  FastForward, 
  Sliders, 
  Sparkles, 
  Sun, 
  Building2, 
  Car, 
  Zap, 
  AlertTriangle, 
  BatteryLow, 
  CloudRain, 
  Cpu, 
  RotateCcw,
  CheckCircle2
} from 'lucide-react';

const SCENARIOS = [
  {
    id: 'Solar Peak',
    name: '☀️ Solar Peak',
    desc: 'Sets clock to 12:30 PM with high irradiance (39.5 kW). Maximum renewable generation.',
    color: '#eab308'
  },
  {
    id: 'Morning Demand',
    name: '🌅 Morning Demand',
    desc: 'Simulates 08:15 AM commercial building ramp, HVAC warmup and early EV commute departures.',
    color: '#06b6d4'
  },
  {
    id: 'Evening Peak',
    name: '🌆 Evening Peak',
    desc: 'Simulates 07:30 PM residential cooking & AC surge with zero solar output and peak tariff.',
    color: '#a855f7'
  },
  {
    id: 'EV Rush',
    name: '🚗 EV Rush',
    desc: 'Simultaneously plugs in 16 vehicles requiring charging, creating high localized cluster load.',
    color: '#10b981'
  },
  {
    id: 'Grid Overload',
    name: '⚠️ Grid Overload',
    desc: 'Intentionally surges combined EV + Building load beyond the 100 kW contract limit.',
    color: '#ef4444'
  },
  {
    id: 'Many Low-Battery EVs',
    name: '🔋 Many Low-Battery EVs',
    desc: 'Sets 10 EVs to critical 10-18% SOC with urgent morning departure requirements.',
    color: '#f59e0b'
  },
  {
    id: 'Low Solar',
    name: '🌧️ Low Solar',
    desc: 'Simulates heavy storm cloud cover, slashing solar array output down to 8%.',
    color: '#64748b'
  },
  {
    id: 'Charger Failure',
    name: '🔌 Charger Failure',
    desc: 'Simulates hardware ground faults taking 4 charging bays offline with alerts.',
    color: '#f43f5e'
  }
];

export default function SimulationPage() {
  const {
    speed,
    simTime,
    activeScenario,
    gridLimit,
    transformerLimit,
    buildingDemandMultiplier,
    solarMultiplier,
    buildingLoad,
    evLoad,
    solarGeneration,
    totalLoad,
    gridUtilization,
    transformerLoad,
    systemStatus,
    activeEvCount,
    controls,
    backendStatus,
    backendControls,
    commandStates,
    commandErrors
  } = useSystemState();

  const backendScenarioMap = {
    'Solar Peak': 'SOLAR_SURGE',
    'EV Rush': 'EV_RUSH',
    'Charger Failure': 'CHARGER_FAULT'
  };
  const isBackendLive = backendStatus === 'LIVE';
  const triggerScenario = (scenarioId) => {
    const backendScenario = backendScenarioMap[scenarioId];
    if (isBackendLive && backendScenario) {
      backendControls.activateScenario(backendScenario);
      return;
    }
    controls.triggerScenario(scenarioId);
  };
  const resetSimulation = () => {
    if (isBackendLive) {
      backendControls.resetScenario();
      return;
    }
    controls.triggerScenario('Reset Default');
  };

  return (
    <div className="simulation-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Virtual Sensor & Simulation Engine</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Control simulation parameters, speed, and trigger dynamic stress scenarios across the microgrid.
          </p>
        </div>
        <button
          onClick={resetSimulation}
          disabled={isBackendLive && commandStates['scenario:RESET'] === 'SENDING'}
          className="btn"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RotateCcw size={15} />
          <span>Reset to Normal Baseline</span>
        </button>
      </div>

      {/* Mode Selector & Status Card */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            DATA ACQUISITION MODE
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: '#38bdf8',
              fontWeight: '700',
              fontSize: '0.85rem'
            }}>
              <FlaskConical size={16} />
              <span>🧪 SIMULATION (Active Virtual Sensors)</span>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              cursor: 'not-allowed'
            }} title="Physical IoT hardware bridge connects in Stage 2">
              <Radio size={16} />
              <span>🔵 LIVE IoT (Hardware Bridge Stage 2)</span>
            </div>
          </div>
        </div>

        {/* Current Active Scenario State */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CURRENT SCENARIO</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#38bdf8', marginTop: '0.2rem' }}>
            {activeScenario}
          </div>
          <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Sim Time: {simTime} • {gridUtilization}% Grid • {transformerLoad}% Transformer
          </div>
        </div>
      </div>

      {/* Main Controls Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {/* Sliders & Parameters */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={18} className="text-cyan" />
              <span className="card-title">Virtual Sensor Multipliers & Limits</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
            {/* Grid Contract Limit */}
            <div className="slider-container">
              <div className="slider-label">
                <span>Contract Grid Limit (kW)</span>
                <span>{gridLimit} kW</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                step="5"
                value={gridLimit}
                onChange={(e) => controls.setGridLimit(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>50 kW</span>
                <span>100 kW (Standard)</span>
                <span>150 kW</span>
              </div>
            </div>

            {/* Transformer Capacity */}
            <div className="slider-container">
              <div className="slider-label">
                <span>Substation Transformer Limit (kVA)</span>
                <span>{transformerLimit} kVA</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                step="5"
                value={transformerLimit}
                onChange={(e) => controls.setTransformerLimit(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>50 kVA</span>
                <span>100 kVA</span>
                <span>150 kVA</span>
              </div>
            </div>

            {/* Building Demand Multiplier */}
            <div className="slider-container">
              <div className="slider-label">
                <span>Building Base Demand Multiplier</span>
                <span>{buildingDemandMultiplier}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={buildingDemandMultiplier}
                onChange={(e) => controls.setBuildingMultiplier(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>0.5x Low</span>
                <span>1.0x Nominal</span>
                <span>2.0x Extreme Peak</span>
              </div>
            </div>

            {/* Solar Generation Multiplier */}
            <div className="slider-container">
              <div className="slider-label">
                <span>Solar Irradiance Multiplier</span>
                <span>{solarMultiplier}x</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={solarMultiplier}
                onChange={(e) => controls.setSolarMultiplier(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>0.0x Heavy Overcast</span>
                <span>1.0x Clear Sky</span>
                <span>1.5x High Noon Peak</span>
              </div>
            </div>
          </div>
        </div>

        {/* Speed Controls & Live Diagnostics */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <span className="card-title">Simulation Time Engine</span>
              <span className="mono text-cyan">{simTime}</span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Select clock acceleration. At 1x, each real second advances 1 simulated minute.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
              <button
                onClick={() => controls.setSpeed(0)}
                className={`btn ${speed === 0 ? 'btn-primary' : 'btn'}`}
                disabled={isBackendLive}
                title={isBackendLive ? 'Pause is not exposed by the backend yet' : 'Local demo control'}
                style={{ flexDirection: 'column', gap: '0.2rem', padding: '0.75rem' }}
              >
                <Pause size={18} />
                <span style={{ fontSize: '0.75rem' }}>Pause</span>
              </button>

              <button
                onClick={() => (isBackendLive ? backendControls.setSpeed(1) : controls.setSpeed(1))}
                className={`btn ${speed === 1 ? 'btn-primary' : 'btn'}`}
                disabled={isBackendLive && commandStates['simulator:speed:1'] === 'SENDING'}
                style={{ flexDirection: 'column', gap: '0.2rem', padding: '0.75rem' }}
              >
                <Play size={18} />
                <span style={{ fontSize: '0.75rem' }}>{commandStates['simulator:speed:1'] === 'SENDING' ? 'Sending...' : '1x Real'}</span>
              </button>

              <button
                onClick={() => controls.setSpeed(2)}
                className={`btn ${speed === 2 ? 'btn-primary' : 'btn'}`}
                disabled={isBackendLive}
                title={isBackendLive ? '2x speed is not exposed by the backend' : 'Local demo control'}
                style={{ flexDirection: 'column', gap: '0.2rem', padding: '0.75rem' }}
              >
                <FastForward size={18} />
                <span style={{ fontSize: '0.75rem' }}>2x Fast</span>
              </button>

              <button
                onClick={() => controls.setSpeed(5)}
                className={`btn ${speed === 5 ? 'btn-primary' : 'btn'}`}
                disabled={isBackendLive}
                title={isBackendLive ? '5x speed is not exposed by the backend' : 'Local demo control'}
                style={{ flexDirection: 'column', gap: '0.2rem', padding: '0.75rem' }}
              >
                <Sparkles size={18} />
                <span style={{ fontSize: '0.75rem' }}>5x Ultra</span>
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              {isBackendLive
                ? 'Backend control: 1x speed. Pause, 2x, and 5x are not exposed by the current API.'
                : 'Local demo controls are active until the backend is live.'}
            </div>
            {commandErrors['simulator:speed:1'] && (
              <div style={{ color: '#b91c1c', fontSize: '0.78rem', marginTop: '0.5rem' }}>
                {commandErrors['simulator:speed:1']}
              </div>
            )}
          </div>

          {/* Quick Snapshot Metrics */}
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.7)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              DERIVED SYSTEM OUTPUT:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Building: </span>
                <span className="mono" style={{ fontWeight: '700', color: '#38bdf8' }}>{buildingLoad} kW</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>EV Fleet: </span>
                <span className="mono" style={{ fontWeight: '700', color: '#34d399' }}>{evLoad} kW</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Solar Output: </span>
                <span className="mono" style={{ fontWeight: '700', color: '#facc15' }}>{solarGeneration} kW</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Total Demand: </span>
                <span className="mono" style={{ fontWeight: '700', color: totalLoad > gridLimit ? '#f87171' : 'var(--text-primary)' }}>
                  {totalLoad} kW
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Scenario Action Buttons */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} className="text-cyan" />
            <span className="card-title">Interactive Stress & Operational Scenarios</span>
          </div>
          <span className="badge badge-info">1-Click Trigger</span>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          {isBackendLive
            ? 'Backend-connected scenarios: Solar Peak, EV Rush, and Charger Failure. Other presets remain local demo controls.'
            : 'Backend controls are unavailable. Scenario actions below are local demo controls and do not change backend state.'}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginTop: '0.5rem'
        }}>
          {SCENARIOS.map((sc) => {
            const isActive = activeScenario === sc.id;
            return (
              <div
                key={sc.id}
                onClick={() => triggerScenario(sc.id)}
                role="button"
                tabIndex={0}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isActive ? 'rgba(6, 182, 212, 0.45)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem', color: sc.color }}>
                    {sc.name}
                  </span>
                  {isActive && <CheckCircle2 size={16} className="text-cyan" />}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {sc.desc}
                </p>
              </div>
            );
          })}
        </div>
        {(commandErrors['scenario:SOLAR_SURGE'] || commandErrors['scenario:EV_RUSH'] || commandErrors['scenario:CHARGER_FAULT']) && (
          <div style={{ color: '#b91c1c', fontSize: '0.78rem', marginTop: '0.75rem' }}>
            Backend command failed. {commandErrors['scenario:SOLAR_SURGE'] || commandErrors['scenario:EV_RUSH'] || commandErrors['scenario:CHARGER_FAULT']}
          </div>
        )}
      </div>
    </div>
  );
}
