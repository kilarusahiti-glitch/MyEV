import React from 'react';
import { useSystemState } from '../hooks/useSystemState';
import MetricCard from '../components/common/MetricCard';
import { Building2, Activity, Zap, Flame, Calendar, BarChart2, ShieldAlert } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function BuildingEnergyPage() {
  const { buildingLoad, hourlyHistory, controls, buildingDemandMultiplier } = useSystemState();

  // Compute stats from hourly history + current
  const peakDemand = Math.max(...hourlyHistory.map(h => h.buildingLoad), buildingLoad);
  const avgDemand = Number(
    (hourlyHistory.reduce((acc, h) => acc + h.buildingLoad, 0) / hourlyHistory.length).toFixed(1)
  );
  // Estimate daily consumption in kWh = sum of hourly loads
  const dailyKwh = Math.round(hourlyHistory.reduce((acc, h) => acc + h.buildingLoad, 0));
  const totalMwh = (dailyKwh * 30 / 1000).toFixed(2); // estimated monthly MWh

  // Subsystem breakdown data
  const subsystemData = [
    { name: 'HVAC & Climate', load: Number((buildingLoad * 0.46).toFixed(1)), color: '#06b6d4' },
    { name: 'Lighting & Common', load: Number((buildingLoad * 0.22).toFixed(1)), color: '#3b82f6' },
    { name: 'Elevators & Pumps', load: Number((buildingLoad * 0.18).toFixed(1)), color: '#8b5cf6' },
    { name: 'Plug Loads & Other', load: Number((buildingLoad * 0.14).toFixed(1)), color: '#10b981' }
  ];

  return (
    <div className="building-energy-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Building Energy Monitoring</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Building A non-EV telemetry: HVAC, elevators, lighting, and residential base loads.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={() => controls.triggerScenario('Morning Demand')}
            className="btn btn-sm"
          >
            🌅 Morning Demand
          </button>
          <button 
            onClick={() => controls.triggerScenario('Evening Peak')}
            className="btn btn-sm btn-primary"
          >
            🌆 Evening Peak
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        <MetricCard
          title="CURRENT LOAD"
          value={buildingLoad}
          unit="kW"
          icon={Building2}
          statusColor="#38bdf8"
          subtitle="Real-time demand sensor"
          badgeText={`${buildingDemandMultiplier}x MULT`}
          badgeVariant="info"
        />

        <MetricCard
          title="PEAK DEMAND (24H)"
          value={peakDemand}
          unit="kW"
          icon={Flame}
          statusColor="#f59e0b"
          subtitle="Recorded during evening cook"
          trend="Max 78 kW contract"
        />

        <MetricCard
          title="AVERAGE DEMAND"
          value={avgDemand}
          unit="kW"
          icon={Activity}
          subtitle="Rolling 24h baseline"
          trend="Steady within ±6%"
        />

        <MetricCard
          title="DAILY CONSUMPTION"
          value={dailyKwh}
          unit="kWh"
          icon={Zap}
          statusColor="#10b981"
          subtitle="Building A day total"
          trend="~$248 / day est."
        />

        <MetricCard
          title="MONTHLY TOTAL"
          value={totalMwh}
          unit="MWh"
          icon={Calendar}
          subtitle="Projected 30-day billing"
          badgeText="ESTIMATE"
        />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.25rem' }}>
        {/* Demand Line Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">24-Hour Building Demand Curve (kW)</span>
            <span className="badge badge-info">Real-Time Telemetry</span>
          </div>
          <div style={{ width: '100%', height: '300px', marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit=" kW" domain={[0, 90]} />
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
                <Line
                  type="monotone"
                  dataKey="buildingLoad"
                  name="Building Demand (kW)"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ fill: '#06b6d4', r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Consumption Area Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Hourly Consumption Trend (kWh)</span>
            <span className="badge badge-success">Energy Footprint</span>
          </div>
          <div style={{ width: '100%', height: '300px', marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit=" kWh" domain={[0, 90]} />
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
                  dataKey="buildingLoad"
                  name="Energy Consumed (kWh)"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorCons)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Subsystems Breakdown Cards */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Building A Subsystem Load Distribution</span>
          <span className="mono" style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Total: {buildingLoad} kW</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginTop: '0.5rem'
        }}>
          {subsystemData.map((sub) => (
            <div key={sub.name} style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub.name}</div>
              <div className="mono" style={{ fontSize: '1.4rem', fontWeight: '700', color: sub.color, margin: '0.25rem 0' }}>
                {sub.load} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>kW</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${(sub.load / buildingLoad) * 100}%`, height: '100%', background: sub.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
