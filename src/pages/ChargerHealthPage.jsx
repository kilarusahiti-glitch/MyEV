import React, { useMemo, useState } from 'react';
import { BatteryCharging, CheckCircle2, RotateCcw, Zap } from 'lucide-react';
import { useSystemState } from '../hooks/useSystemState';
import { formatPower, formatPercent } from '../utils/formatters';

const statusClass = { AVAILABLE: 'badge-success', CONNECTED: 'badge-info', CHARGING: 'badge-success', PAUSED: 'badge-warning', FAULTED: 'badge-danger', OFFLINE: 'badge-danger' };

export default function ChargerHealthPage() {
  const { chargers, vehicles, backendStatus, backendControls, commandStates } = useSystemState();
  const [selectedId, setSelectedId] = useState(null);
  const live = backendStatus === 'LIVE';
  const selected = chargers.find((charger) => charger.id === selectedId) || chargers[0];
  const assigned = useMemo(() => vehicles.find((vehicle) => vehicle.chargerId === selected?.id), [vehicles, selected]);
  const fault = () => { if (live) backendControls.activateScenario('CHARGER_FAULT'); };
  const reset = () => { if (live) backendControls.resetScenario(); };
  return <div className="charger-health-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1200px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}><div><h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Charger Health</h1><p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Backend-authoritative charger status, power delivery, connector, and assignment state.</p></div><div style={{ display: 'flex', gap: '0.5rem' }}><button className="btn btn-sm" onClick={fault} disabled={!live || commandStates['scenario:CHARGER_FAULT'] === 'SENDING'}><Zap size={14} /> Test Charger Fault</button><button className="btn btn-sm btn-primary" onClick={reset} disabled={!live || commandStates['scenario:RESET'] === 'SENDING'}><RotateCcw size={14} /> Reset</button></div></div>
    {!live && <div className="badge badge-warning" style={{ alignSelf: 'flex-start', padding: '0.6rem 0.8rem' }}>BACKEND OFFLINE: charger telemetry unavailable.</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>{chargers.map((charger) => <button key={charger.id} className="card" onClick={() => setSelectedId(charger.id)} style={{ textAlign: 'left', cursor: 'pointer', border: selected?.id === charger.id ? '2px solid #0891b2' : undefined }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong><BatteryCharging size={16} /> {charger.id}</strong><span className={`badge ${statusClass[charger.status] || 'badge-info'}`}>{charger.status}</span></div><div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.65rem' }}>{charger.connectorType || 'Connector unavailable'}</div><div className="mono" style={{ marginTop: '0.4rem' }}>{formatPower(charger.currentPower)} kW actual / {formatPower(charger.maxPower)} kW max</div></button>)}</div>
    {selected && <section className="card"><div className="card-header"><span className="card-title">{selected.id} details</span><span className={`badge ${statusClass[selected.status] || 'badge-info'}`}>{selected.status}</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginTop: '1rem' }}>{[['Charger ID', selected.id], ['Connector', selected.connectorType || '—'], ['Maximum power', `${formatPower(selected.maxPower)} kW`], ['Actual power', `${formatPower(selected.currentPower)} kW`], ['Assigned vehicle', assigned?.name || 'None'], ['Vehicle SOC', assigned ? `${formatPercent(assigned.currentSoc)}%` : '—'], ['Fault state', selected.status === 'FAULTED' ? 'FAULTED' : 'None']].map(([label, value]) => <div key={label}><div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{label}</div><strong className="mono">{value}</strong></div>)}</div><p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem' }}><CheckCircle2 size={13} /> Temperature, uptime, maintenance prediction, and technician overrides are unsupported by the backend and are omitted.</p></section>}
  </div>;
}
