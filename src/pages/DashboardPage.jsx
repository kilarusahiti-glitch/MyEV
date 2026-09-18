import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSystemState } from '../hooks/useSystemState';
import { getOrgConfig } from '../data/organizationConfig';
import { calculateBilling } from '../services/billingService';
import MetricCard from '../components/common/MetricCard';
import PowerFlow from '../components/dashboard/PowerFlow';
import DemoTourModal from '../components/common/DemoTourModal';
import { 
  Zap, 
  Building2, 
  Car, 
  Sun, 
  Cpu, 
  ShieldCheck, 
  AlertTriangle, 
  Activity,
  TrendingUp,
  TrendingDown,
  Flame,
  CheckCircle2,
  Sparkles,
  Receipt,
  Leaf,
  Clock,
  Radio,
  Sliders
} from 'lucide-react';
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

export default function DashboardPage() {
  const systemState = useSystemState();
  const {
    gridLimit,
    buildingLoad,
    evLoad,
    solarGeneration,
    totalLoad,
    remainingCapacity,
    gridUtilization,
    transformerLoad,
    transformerTemp,
    activeEvCount,
    totalEvCount,
    systemStatus,
    statusMessage,
    hourlyHistory,
    vehicles,
    gridStress,
    isEmergencyMode,
    eventFeed = [],
    organizationMode,
    controls
  } = systemState;

  const org = getOrgConfig(organizationMode);

  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  // Derive dynamic electricity bill estimate
  const bill = useMemo(() => {
    return calculateBilling(systemState);
  }, [systemState]);

  // Derived sustainability snapshot
  const sustainabilitySummary = useMemo(() => {
    const solarUsed = Math.round(Math.max(120, (solarGeneration || 14) * 28));
    const evRenewable = Math.round(Math.min(solarUsed * 0.7, (evLoad || 21) * 14));
    const co2Avoided = Math.round(solarUsed * 0.82);
    return { solarUsed, evRenewable, co2Avoided };
  }, [solarGeneration, evLoad]);

  const renderEventIcon = (iconName) => {
    switch (iconName) {
      case 'Sun': return <Sun size={14} color="#facc15" />;
      case 'Car': return <Car size={14} color="#38bdf8" />;
      case 'AlertTriangle': return <AlertTriangle size={14} color="#f59e0b" />;
      case 'CheckCircle2': return <CheckCircle2 size={14} color="#10b981" />;
      case 'Building2': return <Building2 size={14} color="#8b5cf6" />;
      case 'Receipt': return <Receipt size={14} color="#34d399" />;
      case 'RotateCcw': return <Activity size={14} color="#06b6d4" />;
      case 'Zap':
      default:
        return <Zap size={14} color="#10b981" />;
    }
  };

  return (
    <div className="dashboard-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Donezo Top Welcome Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Dashboard
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
              fontSize: '0.72rem',
              fontWeight: '700'
            }}>
              <span className="status-dot pulse" style={{ background: '#16a34a' }} />
              <span>OPTIMIZER ACTIVE</span>
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.3rem', fontWeight: '500' }}>
            Plan, prioritize, and accomplish your smart EV grid management with ease.
          </p>
        </div>

        {/* Donezo Action Buttons: Dark Green Pill + Outlined White Pill */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={() => controls.triggerScenario('EV Rush')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: '#14532d',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.65rem 1.25rem',
              fontSize: '0.84rem',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(20, 83, 45, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>+ Add EV Simulation</span>
          </button>

          <button 
            onClick={() => setIsDemoModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: '9999px',
              padding: '0.65rem 1.25rem',
              fontSize: '0.84rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <Sparkles size={14} color="#16a34a" />
            <span>Judge Demo Tour</span>
          </button>
        </div>
      </div>

      {/* Emergency Mode Alert Banner */}
      {isEmergencyMode && (
        <div style={{
          background: '#fef2f2',
          border: '1.5px solid #f87171',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Flame size={24} color="#dc2626" className="animate-pulse" />
            <div>
              <div style={{ fontWeight: '800', color: '#991b1b', fontSize: '0.95rem' }}>
                CRITICAL SUBSTATION OVERLOAD: Emergency Load Shedding Active
              </div>
              <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                Grid utilization at {gridUtilization}%. Flexible EV charging has been automatically suspended to prevent transformer trip.
              </div>
            </div>
          </div>
          <button 
            onClick={() => controls.triggerScenario('Reset Default')}
            className="btn btn-sm"
            style={{ background: '#ffffff', borderColor: '#fca5a5', color: '#991b1b', fontWeight: '700' }}
          >
            Reset to Normal
          </button>
        </div>
      )}

      {/* Donezo 4-Metric Cards Row: Hero Card (Deep Green) + 3 Crisp White Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* HERO CARD: Total EV Load */}
        <MetricCard
          isHero={true}
          title="Total EV Load"
          value={evLoad.toFixed(1)}
          unit="kW"
          icon={Car}
          trend="Increased from last month"
          progress={gridUtilization}
        />

        {/* CARD 2: Available Capacity */}
        <MetricCard
          title="Available Capacity"
          value={remainingCapacity.toFixed(1)}
          unit="kW"
          icon={Zap}
          statusColor="#16a34a"
          trend="Safe Headroom"
          badgeText="92 kW Cap"
        />

        {/* CARD 3: Active EV Fleet */}
        <MetricCard
          title="Active Fleet"
          value={`${activeEvCount}`}
          unit={`/ ${totalEvCount}`}
          icon={Car}
          statusColor="#2563eb"
          trend={`${totalEvCount - activeEvCount} waiting / idle`}
          badgeText="Smart Scheduled"
        />

        {/* CARD 4: Solar Generation */}
        <MetricCard
          title="Solar Generation"
          value={solarGeneration.toFixed(1)}
          unit="kW"
          icon={Sun}
          statusColor="#d97706"
          trend={solarGeneration > 0 ? `${gridLimit >= 200 ? 'High-Capacity' : '40 kWp'} Array` : 'Night Standby'}
          badgeText={solarGeneration > 0 ? 'Clean Offset' : 'Standby'}
        />
      </div>

      {/* 2. LIVE POWER FLOW (Requirement #16) */}
      <PowerFlow
        gridLimit={gridLimit}
        buildingLoad={buildingLoad}
        evLoad={evLoad}
        solarGeneration={solarGeneration}
        transformerLoad={transformerLoad}
        totalLoad={totalLoad}
        remainingCapacity={remainingCapacity}
        gridUtilization={gridUtilization}
      />

      {/* 3. SMART CHARGING SUMMARY & 4. GRID STRESS / PREDICTION (Requirement #16) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>
        {/* SMART CHARGING SUMMARY */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={18} className="text-cyan" />
                <span className="card-title">Smart Charging Optimization Status</span>
              </div>
              <span className="badge badge-success">Algorithm Active</span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Allocating available substation capacity according to arrival SOC, departure guarantee, and solar surplus.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SAFE HEADROOM</div>
                <div className="mono" style={{ fontSize: '1.3rem', fontWeight: '800', color: '#10b981' }}>
                  {remainingCapacity} kW
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Under 92 kW contract limit</div>
              </div>

              <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ACTIVE POLICY</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#38bdf8', marginTop: '0.2rem' }}>
                  SOC & Deadline Weighted
                </div>
                <div style={{ fontSize: '0.68rem', color: '#34d399' }}>Urgent departures prioritized</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activeEvCount} vehicles receiving optimized power</span>
            <Link to="/smart-charging" className="btn btn-sm btn-primary" style={{ fontSize: '0.72rem' }}>
              <span>Smart Charging Console</span>
            </Link>
          </div>
        </div>

        {/* GRID STRESS / PREDICTION SUMMARY */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} color="#f59e0b" />
                <span className="card-title">Grid Stress & Predictive Forecast</span>
              </div>
              <span className={`badge badge-${gridStress.level === 'CRITICAL' ? 'danger' : gridStress.level === 'HIGH' ? 'warning' : 'success'}`}>
                {gridStress.label} Stress ({gridStress.pct}%)
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              6-hour lookahead evaluating building demand ramp, scheduled EV arrivals, and solar decay.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Transformer Thermal Margin</span>
                  <span className="mono" style={{ fontWeight: '700', color: transformerLoad > 85 ? '#f87171' : '#34d399' }}>
                    {(100 - transformerLoad).toFixed(1)}% Safe
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, transformerLoad)}%`, height: '100%', background: transformerLoad > 85 ? '#ef4444' : '#10b981', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tomorrow's energy plan computed</span>
            <Link to="/predictions" className="btn btn-sm" style={{ fontSize: '0.72rem' }}>
              <span>Predictions & Plan</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 5. ELECTRICITY BILL & 6. SUSTAINABILITY (Requirement #16) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem' }}>
        {/* ELECTRICITY BILL SUMMARY */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'radial-gradient(ellipse at top right, rgba(16, 185, 129, 0.06), rgba(15, 23, 42, 0.95))' }}>
          <div>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={18} color="#34d399" />
                <span className="card-title">Electricity Bill — Simulation Mode</span>
              </div>
              <span className="badge badge-success">Save {bill.currency}{bill.comparison.estimatedSavings}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>ESTIMATED BILL</div>
                <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#10b981' }}>
                  {bill.currency}{bill.estimatedBill.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#34d399' }}>With smart charging</div>
              </div>

              <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>WITHOUT SMART</div>
                <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f87171' }}>
                  {bill.currency}{bill.comparison.withoutSmartCharging.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#f87171' }}>Uncoordinated peak</div>
              </div>

              <div style={{ padding: '0.65rem', background: 'rgba(6, 182, 212, 0.08)', borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                <div style={{ fontSize: '0.68rem', color: '#38bdf8' }}>NET SAVINGS</div>
                <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8' }}>
                  {bill.currency}{bill.comparison.estimatedSavings.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#38bdf8' }}>{bill.comparison.savingsPercent}% reduction</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Billing Period: {bill.billingPeriod}</span>
            <Link to="/electricity-bill" className="btn btn-sm btn-primary" style={{ fontSize: '0.72rem' }}>
              <span>Full Bill Breakdown</span>
            </Link>
          </div>
        </div>

        {/* SUSTAINABILITY SUMMARY */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'radial-gradient(ellipse at top right, rgba(250, 204, 21, 0.06), rgba(15, 23, 42, 0.95))' }}>
          <div>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Leaf size={18} color="#10b981" />
                <span className="card-title">Sustainability & Clean Energy Highlights</span>
              </div>
              <span className="badge badge-success">ESG Metrics</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>SOLAR USED</div>
                <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#facc15' }}>
                  {sustainabilitySummary.solarUsed} <span style={{ fontSize: '0.75rem' }}>kWh</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>100% on-site</div>
              </div>

              <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>EV RENEWABLE</div>
                <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#10b981' }}>
                  {sustainabilitySummary.evRenewable} <span style={{ fontSize: '0.75rem' }}>kWh</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#10b981' }}>Solar-to-EV match</div>
              </div>

              <div style={{ padding: '0.65rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: '0.68rem', color: '#34d399' }}>CO₂ AVOIDED</div>
                <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#34d399' }}>
                  {sustainabilitySummary.co2Avoided} <span style={{ fontSize: '0.75rem' }}>kg</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#34d399' }}>Scope 2 offset</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Peak reduction: 18% • Clean charging: 84%</span>
            <Link to="/sustainability" className="btn btn-sm" style={{ fontSize: '0.72rem' }}>
              <span>Sustainability Report</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 7. REAL-TIME EVENT FEED (Requirement #17) & 24-Hour Profile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.25rem' }}>
        {/* COMPACT REAL-TIME EVENT FEED */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Radio size={16} className="text-cyan" />
              <span className="card-title">Real-Time Event Feed</span>
            </div>
            <span className="badge badge-info">{eventFeed.length} Events</span>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Live application telemetry events emitted by the optimization engine and sensors.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', maxHeight: '250px', overflowY: 'auto' }}>
            {eventFeed.map((evItem) => (
              <div
                key={evItem.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  fontSize: '0.8rem'
                }}
              >
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '45px' }}>
                  {evItem.time}
                </span>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {renderEventIcon(evItem.icon)}
                </span>
                <span style={{ color: '#f8fafc', flex: 1 }}>
                  {evItem.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 24-Hour Profile Area Chart */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} className="text-cyan" />
              <span className="card-title">24-Hour Power Flow Profile</span>
            </div>
            <span className="badge badge-info">24 Data Points</span>
          </div>

          <div style={{ width: '100%', height: '230px', marginTop: '0.5rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashBld" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="dashEv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="dashSol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#facc15" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" kW" domain={[0, 110]} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', fontSize: '0.75rem' }} />
                <Legend wrapperStyle={{ fontSize: '0.72rem', paddingTop: '4px' }} />
                <Area type="monotone" dataKey="buildingLoad" name="Building" stroke="#06b6d4" fill="url(#dashBld)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="evLoad" name="EVs" stroke="#10b981" fill="url(#dashEv)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="solarGeneration" name="Solar" stroke="#facc15" fill="url(#dashSol)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Demo Tour Modal Dialog */}
      <DemoTourModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </div>
  );
}
