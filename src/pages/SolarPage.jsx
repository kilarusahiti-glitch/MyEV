import React from 'react';
import { useSystemState } from '../hooks/useSystemState';
import MetricCard from '../components/common/MetricCard';
import { Sun, Zap, CloudSun, Leaf, Compass, ArrowUpRight, Battery, Sparkles } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function SolarPage() {
  const {
    solarGeneration,
    totalLoad,
    hourlyHistory,
    simTime,
    simHour,
    solarMultiplier,
    controls
  } = useSystemState();

  const peakSolarRating = 40.0; // kWp
  const solarUtilization = totalLoad > 0 
    ? Math.min(100, Number(((Math.min(solarGeneration, totalLoad) / (solarGeneration || 1)) * 100).toFixed(0)))
    : 0;

  const excessSolar = Math.max(0, Number((solarGeneration - totalLoad).toFixed(1)));
  const renewableContribution = totalLoad > 0 
    ? Math.min(100, Number(((solarGeneration / totalLoad) * 100).toFixed(1)))
    : 0;

  // Environmental offsets (approx 0.85 kg CO2 saved per kWh solar generated)
  const co2OffsetKg = (solarGeneration * 0.85).toFixed(1);

  return (
    <div className="solar-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Solar & Renewables Telemetry</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Rooftop photovoltaic generation array (40 kWp), diurnal irradiance curve, and building self-consumption.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => controls.triggerScenario('Solar Peak')}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem' }}
          >
            <Sun size={15} />
            <span>Trigger Solar Peak</span>
          </button>
          <button 
            onClick={() => controls.triggerScenario('Low Solar')}
            className="btn btn-sm"
          >
            🌧️ Low Solar / Storm
          </button>
        </div>
      </div>

      {/* Solar KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        <MetricCard
          title="CURRENT SOLAR"
          value={solarGeneration}
          unit="kW"
          icon={Sun}
          statusColor="#facc15"
          progress={(solarGeneration / peakSolarRating) * 100}
          progressColor="#eab308"
          subtitle={`Capacity: ${peakSolarRating} kWp`}
          badgeText={solarGeneration > 0 ? 'GENERATING' : 'NIGHT STANDBY'}
          badgeVariant={solarGeneration > 0 ? 'warning' : 'info'}
        />

        <MetricCard
          title="RENEWABLE CONTRIBUTION"
          value={renewableContribution}
          unit="%"
          icon={Leaf}
          statusColor="#34d399"
          progress={renewableContribution}
          progressColor="#10b981"
          subtitle="Of total building + EV load"
          trend="Grid relief factor"
        />

        <MetricCard
          title="SOLAR UTILIZATION"
          value={solarUtilization}
          unit="%"
          icon={Zap}
          statusColor="#38bdf8"
          subtitle="Direct on-site consumption"
          badgeText="ZERO CURTAILMENT"
          badgeVariant="success"
        />

        <MetricCard
          title="EXCESS EXPORT"
          value={excessSolar}
          unit="kW"
          icon={ArrowUpRight}
          subtitle="Net feed-in to utility"
          trend={excessSolar > 0 ? 'Exporting' : 'No export'}
          trendDirection="neutral"
        />

        <MetricCard
          title="EST. CO₂ OFFSET"
          value={co2OffsetKg}
          unit="kg/hr"
          icon={Sparkles}
          statusColor="#10b981"
          subtitle="Avoided grid emissions"
          badgeText="GREEN"
          badgeVariant="success"
        />
      </div>

      {/* Solar Generation Curve (Recharts) */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CloudSun size={20} className="text-solar" />
            <span className="card-title">24-Hour Diurnal Solar PV Generation Profile</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="mono" style={{ fontSize: '0.8rem', color: '#facc15' }}>
              Current: {simTime} ({solarGeneration} kW)
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: '320px', marginTop: '1rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="solarAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
              <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit=" kW" domain={[0, 45]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: '#f8fafc'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '10px' }} />
              <Area
                type="monotone"
                dataKey="solarGeneration"
                name="Solar Output (kW)"
                stroke="#eab308"
                fillOpacity={1}
                fill="url(#solarAreaGradient)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Physics & Behavior Explanations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Photovoltaic System Specifications</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Array Rating</span>
              <span className="mono" style={{ fontWeight: '600' }}>40.0 kWp Monocrystalline</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Inverter Efficiency</span>
              <span className="mono" style={{ fontWeight: '600', color: '#10b981' }}>98.4% MPPT</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Weather Multiplier</span>
              <span className="mono" style={{ fontWeight: '600', color: '#facc15' }}>{solarMultiplier}x</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Azimuth & Tilt</span>
              <span className="mono" style={{ fontWeight: '600' }}>180° South • 25° Tilt</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Diurnal Physics Simulation Rules</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <div>
              <span style={{ color: '#38bdf8', fontWeight: '600' }}>• Night (19:00 - 06:00):</span> Solar output is strictly 0 kW.
            </div>
            <div>
              <span style={{ color: '#facc15', fontWeight: '600' }}>• Morning (06:00 - 10:00):</span> Irradiance ramps upwards as sun angle steepens.
            </div>
            <div>
              <span style={{ color: '#f59e0b', fontWeight: '600' }}>• Midday Peak (11:30 - 13:30):</span> Maximum ~40 kW output directly offsets EV charging.
            </div>
            <div>
              <span style={{ color: '#c084fc', fontWeight: '600' }}>• Evening Decline (16:00 - 19:00):</span> Output tapers to zero as building demand peaks.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
