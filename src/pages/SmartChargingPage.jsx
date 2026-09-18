import React, { useState } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import MetricCard from '../components/common/MetricCard';
import DecisionExplanation from '../components/common/DecisionExplanation';
import {
  Zap, Car, TrendingUp, TrendingDown, ShieldCheck,
  AlertTriangle, Cpu, Sun, CheckCircle2, Clock, Battery
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { calculatePriorityScore, calculateDepartureRisk } from '../services/optimizationEngine';

function GridStressIndicator({ stress }) {
  const bars = ['LOW', 'WATCH', 'HIGH', 'CRITICAL'];
  const colors = { LOW: '#10b981', WATCH: '#eab308', HIGH: '#f59e0b', CRITICAL: '#ef4444' };
  const activeIdx = bars.indexOf(stress?.level || 'LOW');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        {bars.map((b, i) => (
          <div key={b} style={{
            flex: 1, height: '8px', borderRadius: '4px',
            background: i <= activeIdx ? colors[b] : 'rgba(255,255,255,0.08)',
            transition: 'background 0.4s ease'
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        {bars.map(b => <span key={b}>{b}</span>)}
      </div>
      <div style={{ fontSize: '0.8rem', fontWeight: '600', color: colors[stress?.level || 'LOW'] }}>
        {stress?.label || 'Operating normally'}
      </div>
    </div>
  );
}

function PriorityBadge({ score }) {
  const level = score >= 75 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW';
  const color = score >= 75 ? '#f87171' : score >= 45 ? '#fbbf24' : '#34d399';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      <div style={{
        width: '48px', height: '6px', borderRadius: '3px',
        background: 'rgba(255,255,255,0.08)', overflow: 'hidden'
      }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
      </div>
      <span className="mono" style={{ fontSize: '0.78rem', fontWeight: '700', color, minWidth: '26px' }}>{score}</span>
      <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', background: `${color}22`, color, border: `1px solid ${color}44` }}>{level}</span>
    </div>
  );
}

export default function SmartChargingPage() {
  const {
    vehicles, chargers, buildingLoad, solarGeneration, evLoad,
    gridLimit, gridUtilization, safeEVCapacity, isEmergencyMode,
    gridStress, optimizationResult, optimizationLog,
    transformerLoad, electricityTariff, simHour, simMinute,
    controls
  } = useSystemState();

  const [filter, setFilter] = useState('ALL');

  // Enrich vehicles with optimizer data
  const enrichedVehicles = vehicles.map(ev => {
    const optResult = optimizationResult.find(r => r.id === ev.id);
    const priorityScore = optResult?.priorityScore ?? calculatePriorityScore(ev, { simHour, simMinute, chargers });
    const depRisk = calculateDepartureRisk(ev, simHour, simMinute);
    const charger = chargers.find(c => c.id === ev.chargerId);
    return {
      ...ev,
      priorityScore,
      depRisk,
      allocatedPower: optResult?.allocatedPower ?? ev.chargingPower,
      reason: optResult?.reason || '',
      chargerStatus: charger?.status || 'online'
    };
  });

  const chargingVehicles = enrichedVehicles.filter(v =>
    filter === 'ALL' ? (v.status === 'Charging' || v.status === 'Waiting') :
    filter === 'CHARGING' ? v.status === 'Charging' :
    filter === 'WAITING' ? v.status === 'Waiting' :
    filter === 'RISK' ? !v.depRisk.onTrack :
    true
  ).sort((a, b) => b.priorityScore - a.priorityScore);

  // Chart data
  const allocationChartData = enrichedVehicles
    .filter(v => v.allocatedPower > 0)
    .sort((a, b) => b.allocatedPower - a.allocatedPower)
    .slice(0, 12)
    .map(v => ({
      name: v.id,
      power: Number(v.allocatedPower.toFixed(2)),
      priority: v.priorityScore
    }));

  const totalAllocated = enrichedVehicles.reduce((s, v) => s + v.allocatedPower, 0);
  const utilizationPct = safeEVCapacity > 0 ? (totalAllocated / safeEVCapacity) * 100 : 0;
  const atRiskCount = enrichedVehicles.filter(v => !v.depRisk.onTrack && v.status !== 'Completed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Emergency Mode Banner */}
      {isEmergencyMode && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.5)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', gap: '1rem'
        }}>
          <AlertTriangle size={22} color="#f87171" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', color: '#f87171', fontSize: '0.95rem' }}>🔴 EMERGENCY MODE ACTIVE</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Grid at {gridUtilization.toFixed(0)}% capacity. Flexible EV charging suspended. Only critical-departure EVs protected.
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => controls.triggerScenario('Reset Default')}
            style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#f87171' }}>
            Reset Baseline
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <MetricCard
          title="AVAILABLE EV CAPACITY"
          value={safeEVCapacity}
          unit="kW"
          icon={Zap}
          statusColor="#3b82f6"
          subtitle={`${gridLimit - buildingLoad > 0 ? (gridLimit - buildingLoad).toFixed(0) : 0} kW after building load`}
          badgeText={isEmergencyMode ? 'EMERGENCY' : 'SAFE'}
          badgeVariant={isEmergencyMode ? 'danger' : 'info'}
        />
        <MetricCard
          title="ALLOCATED EV POWER"
          value={totalAllocated.toFixed(1)}
          unit="kW"
          icon={Car}
          progress={utilizationPct}
          progressColor={utilizationPct > 90 ? 'var(--danger)' : '#10b981'}
          statusColor="#10b981"
          subtitle={`${utilizationPct.toFixed(0)}% of safe budget used`}
        />
        <MetricCard
          title="GRID UTILIZATION"
          value={gridUtilization.toFixed(0)}
          unit="%"
          icon={TrendingUp}
          progress={gridUtilization}
          progressColor={gridUtilization > 85 ? 'var(--danger)' : gridUtilization > 75 ? 'var(--warning)' : '#3b82f6'}
          statusColor={gridUtilization > 85 ? '#f87171' : '#38bdf8'}
          subtitle={`${totalAllocated.toFixed(1)} kW EV + ${buildingLoad.toFixed(1)} kW building`}
        />
        <MetricCard
          title="SOLAR OFFSET"
          value={solarGeneration.toFixed(1)}
          unit="kW"
          icon={Sun}
          statusColor="#facc15"
          subtitle={solarGeneration > 0 ? `Reducing net grid import` : 'No generation'}
          badgeText={solarGeneration > 15 ? 'SURPLUS' : 'NOMINAL'}
          badgeVariant={solarGeneration > 15 ? 'success' : 'info'}
        />
        <MetricCard
          title="DEPARTURE RISKS"
          value={atRiskCount}
          icon={Clock}
          statusColor={atRiskCount > 0 ? '#f87171' : '#10b981'}
          subtitle={atRiskCount > 0 ? `${atRiskCount} EV(s) may miss target` : 'All on track'}
          badgeText={atRiskCount > 0 ? 'ACTION' : 'OK'}
          badgeVariant={atRiskCount > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          title="TRANSFORMER"
          value={transformerLoad.toFixed(0)}
          unit="%"
          icon={Cpu}
          progress={transformerLoad}
          progressColor={transformerLoad > 85 ? 'var(--danger)' : '#8b5cf6'}
          statusColor="#8b5cf6"
          subtitle={`${(100 - transformerLoad).toFixed(1)}% thermal headroom`}
        />
      </div>

      {/* Grid Stress Panel + Allocation Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem' }}>
        {/* Grid Stress */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Grid Stress Level</span>
            <span className={`badge badge-${gridStress?.level === 'CRITICAL' ? 'danger' : gridStress?.level === 'HIGH' ? 'warning' : 'success'}`}>
              {gridStress?.pct?.toFixed(0)}%
            </span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <GridStressIndicator stress={gridStress} />
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              { label: 'Building Load', val: buildingLoad.toFixed(1), unit: 'kW', color: '#38bdf8' },
              { label: 'EV Load', val: totalAllocated.toFixed(1), unit: 'kW', color: '#34d399' },
              { label: 'Solar Offset', val: `-${solarGeneration.toFixed(1)}`, unit: 'kW', color: '#facc15' },
              { label: 'Net Grid Import', val: Math.max(0, buildingLoad + totalAllocated - solarGeneration).toFixed(1), unit: 'kW', color: '#a855f7' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span className="mono" style={{ fontWeight: '700', color: item.color }}>
                  {item.val} {item.unit}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1rem', padding: '0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            💡 Safe EV Budget = min(Grid − Building, 88% Transformer − Building)
          </div>
        </div>

        {/* Allocation Bar Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Live Charging Power Allocation</span>
            <span className="badge badge-info">Optimizer Active</span>
          </div>
          <div style={{ width: '100%', height: '220px', marginTop: '0.75rem' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allocationChartData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 10 }} stroke="#64748b" unit=" kW" domain={[0, 8]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', fontSize: '0.78rem', color: '#f8fafc' }}
                  formatter={(val, name) => [`${val} kW`, 'Allocated']}
                />
                <ReferenceLine y={7.4} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 4" label={{ value: 'Max 7.4kW', fill: '#f87171', fontSize: 10 }} />
                <Bar dataKey="power" radius={[4, 4, 0, 0]}>
                  {allocationChartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.priority >= 75 ? '#f87171' : entry.priority >= 45 ? '#fbbf24' : '#34d399'}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)', justifyContent: 'center', marginTop: '0.25rem' }}>
            <span style={{ color: '#f87171' }}>■ HIGH Priority</span>
            <span style={{ color: '#fbbf24' }}>■ MEDIUM Priority</span>
            <span style={{ color: '#34d399' }}>■ LOW Priority</span>
          </div>
        </div>
      </div>

      {/* EV Allocation Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">EV Charging Allocation — {chargingVehicles.length} Vehicles</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['ALL', 'CHARGING', 'WAITING', 'RISK'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="btn btn-sm"
                style={{
                  background: filter === f ? 'rgba(59,130,246,0.2)' : 'transparent',
                  borderColor: filter === f ? 'rgba(59,130,246,0.5)' : 'var(--border)',
                  color: filter === f ? '#60a5fa' : 'var(--text-muted)',
                  fontSize: '0.72rem'
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginTop: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['EV', 'Status', 'Priority Score', 'Current SOC', 'Allocated Power', 'Recommended', 'Departure', 'ETA', 'Departure Risk'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chargingVehicles.map((ev, i) => (
                <tr key={ev.id} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                  transition: 'background 0.2s'
                }}>
                  <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: '600' }}>{ev.name}</div>
                    <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ev.id} · {ev.chargerId}</div>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span className={`badge badge-${ev.status === 'Charging' ? 'success' : ev.status === 'Waiting' ? 'warning' : 'info'}`} style={{ fontSize: '0.68rem' }}>
                      {ev.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <PriorityBadge score={ev.priorityScore} />
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <div className="mono" style={{ fontWeight: '700', color: ev.currentSoc < 30 ? '#f87171' : ev.currentSoc < 60 ? '#fbbf24' : '#34d399' }}>
                      {Math.round(ev.currentSoc)}%
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>→ {ev.targetSoc}%</div>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span className="mono" style={{ fontWeight: '700', color: '#38bdf8', fontSize: '0.9rem' }}>
                      {ev.allocatedPower.toFixed(1)} kW
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {ev.depRisk.recommendedPower > 0 ? `${ev.depRisk.recommendedPower.toFixed(1)} kW` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{ev.departureTime}</span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span className="mono" style={{ fontSize: '0.78rem', color: ev.estimatedCompletion === 'Ready' ? '#34d399' : 'var(--text-secondary)' }}>
                      {ev.estimatedCompletion || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: '600',
                      color: ev.depRisk.onTrack ? '#34d399' : '#f87171'
                    }}>
                      {ev.depRisk.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optimization Log */}
      {optimizationLog && optimizationLog.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Optimization Decisions</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last {optimizationLog.length} changes</span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            {optimizationLog.map((exp, i) => (
              <DecisionExplanation key={i} explanation={exp} compact />
            ))}
          </div>
        </div>
      )}

      {/* Tariff Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>Current Electricity Tariff</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Time-of-Use pricing active</div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {[
              { label: 'Off-Peak (10pm–8am)', rate: '$0.12/kWh', active: simHour < 8 || simHour >= 22 },
              { label: 'Mid-Peak (8am–5pm)', rate: '$0.22/kWh', active: simHour >= 8 && simHour < 17 },
              { label: 'Peak (5pm–9pm)', rate: '$0.34/kWh', active: simHour >= 17 && simHour < 21 }
            ].map(t => (
              <div key={t.label} style={{ textAlign: 'center', opacity: t.active ? 1 : 0.4 }}>
                <div className="mono" style={{ fontSize: '1rem', fontWeight: '700', color: t.active ? '#facc15' : 'var(--text-secondary)' }}>{t.rate}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t.label}</div>
                {t.active && <div style={{ width: '100%', height: '2px', background: '#facc15', borderRadius: '2px', marginTop: '0.2rem' }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
