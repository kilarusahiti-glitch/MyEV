import React from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { formatPower, formatPercent, formatTemperature } from '../utils/formatters';
import MetricCard from '../components/common/MetricCard';
import { 
  Zap, 
  Cpu, 
  Thermometer, 
  Activity, 
  AlertTriangle, 
  ShieldCheck, 
  Flame, 
  Compass, 
  Layers,
  ArrowDown
} from 'lucide-react';

export default function GridPage() {
  const {
    gridLimit,
    buildingLoad,
    evLoad,
    totalLoad,
    remainingCapacity,
    gridUtilization,
    transformerLoad,
    transformerTemp,
    voltage,
    current,
    transformerLimit,
    systemStatus,
    controls
  } = useSystemState();

  const isWarning = transformerLoad >= 85 || gridUtilization >= 85;
  const isCritical = transformerLoad >= 95 || gridUtilization >= 95;

  const getStatusColor = (val) => {
    if (val >= 95) return 'var(--danger)';
    if (val >= 85) return 'var(--warning)';
    return 'var(--success)';
  };

  return (
    <div className="grid-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Grid & Transformer Telemetry</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Main substation feed, contract threshold enforcement, and thermal transformer diagnostics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => controls.triggerScenario('Grid Overload')}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', background: isCritical ? '#ef4444' : undefined }}
          >
            <Flame size={15} />
            <span>Simulate Grid Overload</span>
          </button>
        </div>
      </div>

      {/* Grid Threshold Alert if High */}
      {(isWarning || isCritical) && (
        <div style={{
          background: isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          {isCritical ? <Flame size={24} className="text-danger" /> : <AlertTriangle size={24} className="text-warning" />}
          <div>
            <div style={{ fontWeight: '700', color: isCritical ? '#f87171' : '#fbbf24' }}>
              {isCritical ? 'CRITICAL: Substation Capacity & Thermal Limit Exceeded' : 'WARNING: Approaching Grid Contract Capacity (>85%)'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Current load is {formatPower(totalLoad)} kW against a {formatPower(gridLimit)} kW contract ceiling. Peak penalties and transformer thermal wear apply if sustained.
            </div>
          </div>
        </div>
      )}

      {/* Grid Core Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '1rem'
      }}>
        <MetricCard
          title="GRID LIMIT"
          value={gridLimit}
          unit="kW"
          icon={Zap}
          subtitle="Contract maximum"
          badgeText="FEED 100A"
          badgeVariant="info"
        />

        <MetricCard
          title="BUILDING DEMAND"
          value={buildingLoad}
          unit="kW"
          icon={Layers}
          statusColor="#38bdf8"
          subtitle="Non-EV facilities load"
        />

        <MetricCard
          title="EV LOAD"
          value={evLoad}
          unit="kW"
          icon={Compass}
          statusColor="#34d399"
          subtitle="Active vehicle charging"
        />

        <MetricCard
          title="TOTAL LOAD"
          value={totalLoad}
          unit="kW"
          icon={Activity}
          statusColor={getStatusColor(gridUtilization)}
          subtitle="Building + EV Demand"
        />

        <MetricCard
          title="REMAINING CAPACITY"
          value={remainingCapacity}
          unit="kW"
          icon={Zap}
          statusColor={remainingCapacity < 10 ? 'var(--danger)' : '#10b981'}
          subtitle="Safety headroom"
        />

        <MetricCard
          title="UTILIZATION"
          value={gridUtilization}
          unit="%"
          icon={Activity}
          progress={gridUtilization}
          progressColor={getStatusColor(gridUtilization)}
          subtitle="Target < 85%"
          badgeText={isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'NORMAL'}
          badgeVariant={isCritical ? 'danger' : isWarning ? 'warning' : 'success'}
        />
      </div>

      {/* Transformer Detailed Diagnostic Section */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Cpu size={20} style={{ color: '#a855f7' }} />
            <span className="card-title">Main 100 kVA Step-Down Transformer Diagnostic Station</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-purple">400V 3-Phase</span>
            <span className={`badge badge-${isCritical ? 'danger' : isWarning ? 'warning' : 'success'}`}>
              {transformerLoad >= 85 ? 'Threshold Exceeded' : 'Healthy Thermal State'}
            </span>
          </div>
        </div>

        {/* Transformer Gauges Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginTop: '1rem'
        }}>
          {/* Transformer Load */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Load %</div>
            <div className="mono" style={{ fontSize: '2rem', fontWeight: '800', color: getStatusColor(transformerLoad), margin: '0.35rem 0' }}>
              {formatPercent(transformerLoad)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Rated Capacity: {transformerLimit} kVA
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '0.75rem', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, transformerLoad)}%`, height: '100%', background: getStatusColor(transformerLoad) }} />
            </div>
          </div>

          {/* Operating Temperature */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <Thermometer size={14} style={{ color: transformerTemp > 75 ? 'var(--danger)' : '#38bdf8' }} />
              <span>Core Temperature</span>
            </div>
            <div className="mono" style={{ fontSize: '2rem', fontWeight: '800', color: transformerTemp > 75 ? 'var(--danger)' : '#f8fafc', margin: '0.35rem 0' }}>
              {formatTemperature(transformerTemp)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>°C</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Thermal alarm threshold: 85.0 °C
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '0.75rem', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (transformerTemp / 100) * 100)}%`, height: '100%', background: transformerTemp > 75 ? '#ef4444' : '#06b6d4' }} />
            </div>
          </div>

          {/* Voltage */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bus Voltage</div>
            <div className="mono" style={{ fontSize: '2rem', fontWeight: '800', color: '#38bdf8', margin: '0.35rem 0' }}>
              {formatPower(voltage)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>V</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Nominal: 400.0 V (±5% IEEE tolerance)
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '0.75rem', overflow: 'hidden' }}>
              <div style={{ width: '92%', height: '100%', background: '#38bdf8' }} />
            </div>
          </div>

          {/* Current */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phase Current</div>
            <div className="mono" style={{ fontSize: '2rem', fontWeight: '800', color: '#34d399', margin: '0.35rem 0' }}>
              {formatPower(current)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>A</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Peak Breaker: 160 A
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '0.75rem', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (current / 160) * 100)}%`, height: '100%', background: '#10b981' }} />
            </div>
          </div>
        </div>

        {/* Safety Margins & Threshold Explanations */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            SUBSTATION RELIABILITY RULES:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <div>
              <span style={{ color: '#fbbf24', fontWeight: '600' }}>• Warning Threshold (85%):</span> Automated smart charging power throttling begins to safeguard transformer life.
            </div>
            <div>
              <span style={{ color: '#f87171', fontWeight: '600' }}>• Critical Threshold (95%):</span> Circuit breakers risk tripping; non-urgent EV charging is immediately queued or paused.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
