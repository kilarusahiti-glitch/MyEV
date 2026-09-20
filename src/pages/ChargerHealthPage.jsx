import React, { useEffect, useMemo, useState } from 'react';
import { BatteryCharging, CheckCircle2, RotateCcw, Zap } from 'lucide-react';
import { useSystemState } from '../hooks/useSystemState';
import { backendApi } from '../services/backendApi';
import { formatPower, formatPercent } from '../utils/formatters';

const statusClass = { AVAILABLE: 'badge-success', CONNECTED: 'badge-info', CHARGING: 'badge-success', PAUSED: 'badge-warning', FAULTED: 'badge-danger', OFFLINE: 'badge-danger' };

export default function ChargerHealthPage() {
  const { chargers, vehicles, backendStatus, backendControls, commandStates } = useSystemState();
  const [selectedId, setSelectedId] = useState(null);
  const [sensorHistory, setSensorHistory] = useState({ samples: [], sample_interval_seconds: 3600 });
  const live = backendStatus === 'LIVE';
  const selected = chargers.find((charger) => charger.id === selectedId) || chargers[0];
  const assigned = useMemo(() => vehicles.find((vehicle) => vehicle.chargerId === selected?.id), [vehicles, selected]);
  useEffect(() => {
    if (!live) return undefined;
    let cancelled = false;
    const refresh = () => backendApi.getChargerHealthHistory()
      .then((data) => { if (!cancelled) setSensorHistory(data); })
      .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [live]);
  const selectedSamples = sensorHistory.samples
    .flatMap((sample) => (sample.chargers || [])
      .filter((item) => item.charger_id === selected?.id)
      .map((item) => ({ ...item, sampled_at: sample.sampled_at, source: sample.source })))
    .slice(-12)
    .reverse();
  const fault = () => { if (live) backendControls.activateScenario('CHARGER_FAULT'); };
  const reset = () => { if (live) backendControls.resetScenario(); };
  return <div className="charger-health-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1200px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}><div><h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Charger Health</h1><p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Backend-authoritative charger status, power delivery, connector, and assignment state.</p></div><div style={{ display: 'flex', gap: '0.5rem' }}><button className="btn btn-sm" onClick={fault} disabled={!live || commandStates['scenario:CHARGER_FAULT'] === 'SENDING'}><Zap size={14} /> Test Charger Fault</button><button className="btn btn-sm btn-primary" onClick={reset} disabled={!live || commandStates['scenario:RESET'] === 'SENDING'}><RotateCcw size={14} /> Reset</button></div></div>
    {!live && <div className="badge badge-warning" style={{ alignSelf: 'flex-start', padding: '0.6rem 0.8rem' }}>BACKEND OFFLINE: charger telemetry unavailable.</div>}
    {live && <div className="badge badge-info" style={{ alignSelf: 'flex-start', padding: '0.55rem 0.75rem' }}>Virtual sensor history · {Math.round(sensorHistory.sample_interval_seconds / 60)} min cadence · {sensorHistory.samples.length} samples</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>{chargers.map((charger) => <button key={charger.id} className="card" onClick={() => setSelectedId(charger.id)} style={{ textAlign: 'left', cursor: 'pointer', border: selected?.id === charger.id ? '2px solid #0891b2' : undefined }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong><BatteryCharging size={16} /> {charger.id}</strong><span className={`badge ${statusClass[charger.status] || 'badge-info'}`}>{charger.status}</span></div><div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.65rem' }}>{charger.connectorType || 'Connector unavailable'}</div><div className="mono" style={{ marginTop: '0.4rem' }}>{formatPower(charger.currentPower)} kW actual / {formatPower(charger.maxPower)} kW max</div></button>)}</div>
    {selected && <section className="card"><div className="card-header"><span className="card-title">{selected.id} details</span><span className={`badge ${statusClass[selected.status] || 'badge-info'}`}>{selected.status}</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginTop: '1rem' }}>{[['Charger ID', selected.id], ['Connector', selected.connectorType || '—'], ['Maximum power', `${formatPower(selected.maxPower)} kW`], ['Actual power', `${formatPower(selected.currentPower)} kW`], ['Assigned vehicle', assigned?.name || 'None'], ['Vehicle SOC', assigned ? `${formatPercent(assigned.currentSoc)}%` : '—'], ['Fault state', selected.status === 'FAULTED' ? 'FAULTED' : 'None']].map(([label, value]) => <div key={label}><div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{label}</div><strong className="mono">{value}</strong></div>)}</div><p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem' }}><CheckCircle2 size={13} /> Temperature, uptime, maintenance prediction, and technician overrides are unsupported by the backend and are omitted.</p></section>}
    {selected && <section className="card"><div className="card-header"><span className="card-title">Hourly Virtual Sensor Samples</span><span className="badge badge-info">{selectedSamples.length} recent</span></div>{selectedSamples.length ? <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}><thead><tr>{['Sample time', 'Source', 'Status', 'Power', 'Vehicle', 'Quality'].map((label) => <th key={label} style={{ textAlign: 'left', padding: '0.55rem', color: 'var(--text-muted)' }}>{label}</th>)}</tr></thead><tbody>{selectedSamples.map((sample) => <tr key={`${sample.sampled_at}-${sample.charger_id}`} style={{ borderTop: '1px solid var(--border)' }}><td className="mono" style={{ padding: '0.55rem', whiteSpace: 'nowrap' }}>{new Date(sample.sampled_at).toLocaleString()}</td><td style={{ padding: '0.55rem' }}>{sample.source}</td><td style={{ padding: '0.55rem' }}>{sample.status}</td><td className="mono" style={{ padding: '0.55rem' }}>{formatPower(sample.actual_power_kw)} / {formatPower(sample.max_power_kw)} kW</td><td style={{ padding: '0.55rem' }}>{sample.connected_vehicle_id || 'None'}</td><td style={{ padding: '0.55rem' }}>{sample.quality}</td></tr>)}</tbody></table></div> : <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem' }}>No virtual sensor sample is available for this charger yet.</p>}</section>}
  </div>;
}
