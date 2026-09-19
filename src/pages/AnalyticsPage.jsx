import React, { useState, useMemo } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { formatPower } from '../utils/formatters';
import { getOrgConfig } from '../data/organizationConfig';
import { 
  BarChart3, 
  Zap, 
  Car, 
  Cpu, 
  Sun, 
  Calendar, 
  TrendingUp, 
  Activity, 
  Layers, 
  Filter 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export default function AnalyticsPage() {
  const { hourlyHistory, chargers, vehicles, gridLimit, organizationMode } = useSystemState();
  const org = getOrgConfig(organizationMode);

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'energy' | 'charging' | 'grid' | 'solar'

  // 1. Energy Data: Weekly Consumption Simulation (kWh)
  const weeklyConsumptionData = useMemo(() => [
    { day: 'Mon', building: 1420, ev: 410, solar: 260, net: 1570 },
    { day: 'Tue', building: 1460, ev: 430, solar: 280, net: 1610 },
    { day: 'Wed', building: 1510, ev: 480, solar: 310, net: 1680 },
    { day: 'Thu', building: 1490, ev: 460, solar: 290, net: 1660 },
    { day: 'Fri', building: 1580, ev: 520, solar: 300, net: 1800 },
    { day: 'Sat', building: 1320, ev: 390, solar: 340, net: 1370 },
    { day: 'Sun', building: 1250, ev: 350, solar: 360, net: 1240 }
  ], []);

  // 2. Charging Data: Charger Utilization (% time occupied over last 7 days)
  const chargerUtilizationData = useMemo(() => {
    return chargers.slice(0, 12).map((c, i) => ({
      id: c.id,
      utilization: Math.min(96, Math.max(35, Math.round(72 + Math.sin(i * 1.5) * 22))),
      sessions: Math.round(18 + Math.cos(i) * 6),
      kwhDelivered: Math.round(160 + Math.sin(i) * 50)
    }));
  }, [chargers]);

  // 3. Grid Data: Peak Demand Profile vs Contract Capacity
  const gridPeakData = useMemo(() => {
    return hourlyHistory.map((h, i) => {
      const unoptimizedPeak = (h.buildingLoad || 55) + (h.evLoad || 20) * 1.85;
      const optimizedPeak = (h.buildingLoad || 55) + (h.evLoad || 20);
      return {
        hour: h.hour,
        contractLimit: gridLimit || 100,
        unmanagedPeak: Number(unoptimizedPeak.toFixed(1)),
        smartGridPeak: Number(optimizedPeak.toFixed(1)),
        gridUtilization: Number(((optimizedPeak / (gridLimit || 100)) * 100).toFixed(1))
      };
    });
  }, [hourlyHistory, gridLimit]);

  // 4. Solar Data: Generation vs Building Load Offset
  const solarPerformanceData = useMemo(() => {
    return hourlyHistory.map(h => ({
      hour: h.hour,
      solarGeneration: h.solarGeneration || 0,
      buildingLoad: h.buildingLoad || 0,
      solarDirectToEv: Number(Math.min(h.solarGeneration || 0, h.evLoad || 0).toFixed(1)),
      solarDirectToBuilding: Number(Math.max(0, (h.solarGeneration || 0) - Math.min(h.solarGeneration || 0, h.evLoad || 0)).toFixed(1))
    }));
  }, [hourlyHistory]);

  return (
    <div className="analytics-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Telemetry & Performance Analytics</h1>
            <span className="badge badge-info">Historical & Real-Time</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Multi-vector telemetry analysis across Energy, EV Charging, Substation Grid, and Solar Renewables for <strong>{org.name}</strong>.
          </p>
        </div>

        {/* Section Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Sections
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'energy' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('energy')}
          >
            <Zap size={14} />
            <span>Energy</span>
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'charging' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('charging')}
          >
            <Car size={14} />
            <span>Charging</span>
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'grid' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('grid')}
          >
            <Cpu size={14} />
            <span>Grid</span>
          </button>
          <button 
            className={`btn btn-sm ${activeTab === 'solar' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('solar')}
          >
            <Sun size={14} />
            <span>Solar</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: ENERGY ANALYTICS */}
      {(activeTab === 'all' || activeTab === 'energy') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Zap size={18} className="text-cyan" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>1. Energy Analytics</h2>
            <span className="badge badge-info">Daily & Weekly</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.25rem' }}>
            {/* Daily Consumption Curve */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Daily Hourly Load Profile</span>
                <span className="badge badge-info">24 Hours</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Total site load vs building base and EV dispatch.
              </p>
              <div style={{ width: '100%', height: '260px', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyHistory} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="anBuilding" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="anEv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" kW" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '0.8rem' }} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '6px' }} />
                    <Area type="monotone" dataKey="buildingLoad" name="Building Base" stroke="#06b6d4" fill="url(#anBuilding)" strokeWidth={2} />
                    <Area type="monotone" dataKey="evLoad" name="EV Charging" stroke="#10b981" fill="url(#anEv)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Weekly Consumption Breakdown */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Weekly Energy Consumption by Category</span>
                <span className="badge badge-info">7-Day Totals</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Building consumption, EV energy delivery, and solar offsets.
              </p>
              <div style={{ width: '100%', height: '260px', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyConsumptionData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" kWh" />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '0.8rem' }} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '6px' }} />
                    <Bar dataKey="building" name="Building Load" fill="#06b6d4" stackId="a" />
                    <Bar dataKey="ev" name="EV Charging" fill="#10b981" stackId="a" />
                    <Bar dataKey="solar" name="Solar Offset" fill="#facc15" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: CHARGING ANALYTICS */}
      {(activeTab === 'all' || activeTab === 'charging') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Car size={18} color="#10b981" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>2. EV Charging Analytics</h2>
            <span className="badge badge-success">Fleet Utilization</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.25rem' }}>
            {/* Charger Utilization Chart */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Charger Utilization Rates (Bays CH-01 to CH-12)</span>
                <span className="badge badge-success">Average 76%</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Percentage of operational time delivering active charge to vehicles.
              </p>
              <div style={{ width: '100%', height: '260px', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chargerUtilizationData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="id" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '0.8rem' }} />
                    <Bar dataKey="utilization" name="Utilization Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* EV Energy Delivery Profile */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Delivered EV Energy (kWh per Bay)</span>
                <span className="badge badge-info">7-Day Total</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Cumulative energy dispensed by each individual charging terminal.
              </p>
              <div style={{ width: '100%', height: '260px', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chargerUtilizationData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="id" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" kWh" />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '0.8rem' }} />
                    <Line type="monotone" dataKey="kwhDelivered" name="kWh Delivered" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#38bdf8' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: GRID ANALYTICS */}
      {(activeTab === 'all' || activeTab === 'grid') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Cpu size={18} color="#a855f7" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>3. Substation Grid Analytics</h2>
            <span className="badge badge-purple">100 kW Contract</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.25rem' }}>
            {/* Peak Demand Comparison Chart */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Peak Demand Shaving: Unmanaged vs Optimized</span>
                <span className="badge badge-success">-18% Shaved</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Shows how smart charging keeps total load within the 100 kW substation contract.
              </p>
              <div style={{ width: '100%', height: '260px', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={gridPeakData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" kW" domain={[0, 130]} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '0.8rem' }} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '6px' }} />
                    <Line type="monotone" dataKey="unmanagedPeak" name="Unmanaged Peak Load" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="smartGridPeak" name="Smart Optimized Load" stroke="#10b981" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="contractLimit" name="Grid Safe Capacity" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Grid Utilization Trend */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Substation Grid Utilization %</span>
                <span className="badge badge-info">Capacity Margin</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Load percentage relative to contractual ceiling over 24 hours.
              </p>
              <div style={{ width: '100%', height: '260px', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gridPeakData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gridUtilGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '0.8rem' }} />
                    <Area type="monotone" dataKey="gridUtilization" name="Grid Utilization (%)" stroke="#a855f7" fill="url(#gridUtilGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: SOLAR ANALYTICS */}
      {(activeTab === 'all' || activeTab === 'solar') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Sun size={18} color="#facc15" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>4. Solar Renewables Analytics</h2>
            <span className="badge badge-warning">40 kWp Rooftop</span>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Solar Self-Consumption: Direct EV vs Building Offset</span>
              <span className="badge badge-success">100% On-Site</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Shows real-time partition of solar PV generation absorbed by charging vehicles vs building base.
            </p>
            <div style={{ width: '100%', height: '280px', marginTop: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={solarPerformanceData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="solEv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="solBld" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#facc15" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" kW" domain={[0, 45]} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '0.8rem' }} />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '6px' }} />
                  <Area type="monotone" dataKey="solarDirectToEv" name="Solar Absorbed by EVs" stroke="#10b981" fill="url(#solEv)" strokeWidth={2} />
                  <Area type="monotone" dataKey="solarDirectToBuilding" name="Solar Offset to Building" stroke="#facc15" fill="url(#solBld)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
