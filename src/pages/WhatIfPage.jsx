import React, { useState, useMemo } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { Settings, Play, Zap, Car, Building2, Sun, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend
} from 'recharts';

function InputRow({ label, icon: Icon, min, max, step, value, onChange, unit, color }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <Icon size={14} style={{ color }} />
          {label}
        </div>
        <span className="mono" style={{ fontWeight: '700', color, fontSize: '0.9rem' }}>{value} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
        <span>{min} {unit}</span><span>{max} {unit}</span>
      </div>
    </div>
  );
}

export default function WhatIfPage() {
  const { controls, gridLimit: liveGridLimit, buildingLoad: liveBuildingLoad, solarGeneration: liveSolar } = useSystemState();

  const [numEvs, setNumEvs] = useState(20);
  const [gridLimitVal, setGridLimitVal] = useState(liveGridLimit);
  const [buildingMult, setBuildingMult] = useState(1.0);
  const [solarMult, setSolarMult] = useState(1.0);
  const [avgPower, setAvgPower] = useState(7.2);
  const [simHour, setSimHour] = useState(18);
  const [hasRun, setHasRun] = useState(false);

  const result = useMemo(() => {
    if (!hasRun) return null;
    return controls.runWhatIf({
      numEvs, gridLimit: gridLimitVal, buildingLoadMult: buildingMult,
      solarMult, avgEvPower: avgPower, simHour
    });
  }, [hasRun, numEvs, gridLimitVal, buildingMult, solarMult, avgPower, simHour]);

  const runSimulation = () => setHasRun(true);

  // Re-run whenever inputs change (after first run)
  const handleChange = (setter) => (val) => {
    setter(val);
    if (hasRun) setHasRun(false);
  };

  const chartData = result ? [
    { label: 'Without Optimizer', ev: result.withoutOpt.evLoad, building: result.withoutOpt.buildingLoad, solar: result.withoutOpt.solar },
    { label: 'With Optimizer',    ev: result.withOpt.evLoad,    building: result.withOpt.buildingLoad,    solar: result.withOpt.solar }
  ] : [];

  const timeLabel = `${simHour > 12 ? simHour - 12 : simHour}:00 ${simHour >= 12 ? 'PM' : 'AM'}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Info Banner */}
      <div className="card" style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Settings size={18} color="#60a5fa" style={{ marginTop: '1px', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: '600', color: '#60a5fa', marginBottom: '0.25rem' }}>What-If Simulator</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Run a separate stateless simulation to see how different conditions affect grid load — with and without the smart charging optimizer. <strong>Live system is not affected.</strong>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Inputs */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Simulation Inputs</span>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <InputRow label="Number of EVs" icon={Car} min={1} max={20} step={1} value={numEvs}
              onChange={handleChange(setNumEvs)} unit="EVs" color="#34d399" />
            <InputRow label="Grid Contract Limit" icon={Zap} min={60} max={200} step={5} value={gridLimitVal}
              onChange={handleChange(setGridLimitVal)} unit="kW" color="#38bdf8" />
            <InputRow label="Building Load Factor" icon={Building2} min={0.5} max={2.0} step={0.05} value={buildingMult}
              onChange={handleChange(setBuildingMult)} unit="×" color="#06b6d4" />
            <InputRow label="Solar Multiplier" icon={Sun} min={0} max={1.5} step={0.05} value={solarMult}
              onChange={handleChange(setSolarMult)} unit="×" color="#facc15" />
            <InputRow label="Avg EV Charging Power" icon={Car} min={3.7} max={11} step={0.1} value={avgPower}
              onChange={handleChange(setAvgPower)} unit="kW" color="#a855f7" />

            {/* Hour selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>🕐 Simulation Hour</span>
                <span className="mono" style={{ fontWeight: '700', color: '#f8fafc' }}>{timeLabel}</span>
              </div>
              <input type="range" min={0} max={23} step={1} value={simHour}
                onChange={e => { setSimHour(Number(e.target.value)); if (hasRun) setHasRun(false); }}
                style={{ width: '100%', accentColor: '#f8fafc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>12 AM</span><span>12 PM</span><span>11 PM</span>
              </div>
            </div>

            <button
              onClick={runSimulation}
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem', padding: '0.75rem' }}
            >
              <Play size={16} /> Run Simulation
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!result ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <Play size={40} style={{ color: '#3b82f6', display: 'block', margin: '0 auto 1rem' }} />
              <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Configure inputs and click "Run Simulation"</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>Results will appear here</div>
            </div>
          ) : (
            <>
              {/* Side-by-side comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Without optimizer */}
                <div className="card" style={{
                  borderColor: result.withoutOpt.isOverload ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)',
                  background: result.withoutOpt.isOverload ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
                    WITHOUT OPTIMIZATION
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {result.withoutOpt.isOverload ? <AlertTriangle size={20} color="#f87171" /> : <CheckCircle2 size={20} color="#fbbf24" />}
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: result.withoutOpt.isOverload ? '#f87171' : '#fbbf24' }}>
                      {result.withoutOpt.label}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: '2rem', fontWeight: '800', color: result.withoutOpt.isOverload ? '#f87171' : '#fbbf24' }}>
                    {result.withoutOpt.peakLoad} kW
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Peak Grid Load</div>
                  {[
                    { l: 'Building', v: `${result.withoutOpt.buildingLoad} kW` },
                    { l: 'EV Total', v: `${result.withoutOpt.evLoad} kW` },
                    { l: 'Solar', v: `${result.withoutOpt.solar} kW` },
                    { l: 'Grid Util', v: `${result.withoutOpt.utilization}%` }
                  ].map(r => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', borderTop: '1px solid var(--border)', padding: '0.3rem 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.l}</span>
                      <span className="mono" style={{ fontWeight: '600' }}>{r.v}</span>
                    </div>
                  ))}
                </div>

                {/* With optimizer */}
                <div className="card" style={{
                  borderColor: result.withOpt.isOverload ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)',
                  background: result.withOpt.isOverload ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.08)'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
                    WITH OPTIMIZATION
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {result.withOpt.isOverload ? <AlertTriangle size={20} color="#fbbf24" /> : <CheckCircle2 size={20} color="#34d399" />}
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: result.withOpt.isOverload ? '#fbbf24' : '#34d399' }}>
                      {result.withOpt.label}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: '2rem', fontWeight: '800', color: result.withOpt.isOverload ? '#fbbf24' : '#34d399' }}>
                    {result.withOpt.peakLoad} kW
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Peak Grid Load</div>
                  {[
                    { l: 'Building', v: `${result.withOpt.buildingLoad} kW` },
                    { l: 'EV Total', v: `${result.withOpt.evLoad} kW` },
                    { l: 'Solar', v: `${result.withOpt.solar} kW` },
                    { l: 'Grid Util', v: `${result.withOpt.utilization}%` }
                  ].map(r => (
                    <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', borderTop: '1px solid var(--border)', padding: '0.3rem 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{r.l}</span>
                      <span className="mono" style={{ fontWeight: '600' }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delta metrics */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Optimizer Impact Summary</span>
                  <span className="badge badge-success">Savings Calculated</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
                  {[
                    { label: 'Peak Reduction', value: `${result.deltas.peakReduction} kW`, icon: TrendingDown, color: '#34d399' },
                    { label: 'Energy Shifted', value: `${result.deltas.energyShifted} kWh`, icon: Zap, color: '#38bdf8' },
                    { label: 'Full Power EVs', value: result.deltas.evsFullPower, icon: Car, color: '#a855f7' },
                    { label: 'Throttled EVs', value: result.deltas.evsThrottled, icon: TrendingDown, color: '#fbbf24' },
                    { label: 'Delayed EVs', value: result.deltas.evsDelayed, icon: TrendingUp, color: '#f87171' },
                    { label: 'Critical Protected', value: result.deltas.criticalProtected, icon: CheckCircle2, color: '#10b981' }
                  ].map(d => (
                    <div key={d.label} style={{ textAlign: 'center', padding: '0.75rem', background: `${d.color}11`, borderRadius: 'var(--radius-sm)', border: `1px solid ${d.color}22` }}>
                      <d.icon size={18} style={{ color: d.color, display: 'block', margin: '0 auto 0.4rem' }} />
                      <div className="mono" style={{ fontSize: '1.3rem', fontWeight: '800', color: d.color }}>{d.value}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar Chart comparison */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Load Breakdown Comparison</span>
                </div>
                <div style={{ height: '220px', marginTop: '0.75rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#64748b" unit=" kW" />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', fontSize: '0.78rem', color: '#f8fafc' }} />
                      <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                      <ReferenceLine y={gridLimitVal} stroke="rgba(239,68,68,0.5)" strokeDasharray="5 3" label={{ value: `Limit ${gridLimitVal}kW`, fill: '#f87171', fontSize: 10 }} />
                      <Bar dataKey="building" name="Building Load" fill="#06b6d4" stackId="a" radius={[0,0,0,0]} />
                      <Bar dataKey="ev" name="EV Load" fill="#10b981" stackId="a" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
