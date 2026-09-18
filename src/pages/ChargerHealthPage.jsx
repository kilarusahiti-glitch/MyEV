import React, { useState } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { getOrgConfig } from '../data/organizationConfig';
import { 
  BatteryCharging, 
  Activity, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Wrench, 
  Power, 
  Thermometer, 
  Zap, 
  Car, 
  X, 
  SlidersHorizontal,
  Flame
} from 'lucide-react';

export default function ChargerHealthPage() {
  const { chargers, vehicles, controls, organizationMode } = useSystemState();
  const org = getOrgConfig(organizationMode);

  const [selectedChargerId, setSelectedChargerId] = useState('CH-04'); // default inspect CH-04 (offline)
  const [filter, setFilter] = useState('all'); // 'all' | 'online' | 'reduced' | 'offline'

  const selectedCharger = chargers.find(c => c.id === selectedChargerId) || chargers[0];
  const connectedEv = vehicles.find(v => v.chargerId === selectedCharger?.id);

  const filteredChargers = chargers.filter(c => {
    if (filter === 'online') return c.status === 'online';
    if (filter === 'reduced') return c.status === 'reduced';
    if (filter === 'offline') return c.status === 'offline';
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'offline':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="status-dot" style={{ background: '#ef4444' }} />
            <span>🔴 Offline</span>
          </span>
        );
      case 'reduced':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="status-dot" style={{ background: '#f59e0b' }} />
            <span>🟠 Reduced Power</span>
          </span>
        );
      case 'online':
      default:
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="status-dot pulse" style={{ background: '#10b981' }} />
            <span>🟢 Online</span>
          </span>
        );
    }
  };

  const getDiagnosticInfo = (charger) => {
    if (charger.status === 'offline') {
      return {
        issue: 'Ground fault loop detection (GFCI tripped) & OCPP communication timeout.',
        recommendation: 'Dispatch technician to inspect physical breaker and verify connector grounding pin.',
        commStatus: 'Disconnected (No Heartbeat > 15m)',
        healthScore: '42%'
      };
    }
    if (charger.status === 'reduced') {
      return {
        issue: 'Connector thermal sensor reached 62°C. Output throttled to 50% for safety.',
        recommendation: 'Check cooling fan airflow and inspect contact pins for oxidation or dust build-up.',
        commStatus: 'Connected (Thermal Derated)',
        healthScore: '78%'
      };
    }
    return {
      issue: 'None. Hardware diagnostics passing all nominal test thresholds.',
      recommendation: 'Standard scheduled bi-annual preventative maintenance.',
      commStatus: 'OCPP 2.0.1 Connected (24ms latency)',
      healthScore: '98%'
    };
  };

  const diag = selectedCharger ? getDiagnosticInfo(selectedCharger) : null;

  return (
    <div className="charger-health-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Charger Fleet Health & Diagnostics</h1>
            <span className="badge badge-info">{chargers.length} Bays Active</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Real-time OCPP 2.0.1 telemetry, connector thermal health, and technician diagnostic actions for <strong>{org.name}</strong>.
          </p>
        </div>

        {/* Quick Filter Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({chargers.length})
          </button>
          <button 
            className={`btn btn-sm ${filter === 'online' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('online')}
          >
            🟢 Online ({chargers.filter(c => c.status === 'online').length})
          </button>
          <button 
            className={`btn btn-sm ${filter === 'reduced' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('reduced')}
          >
            🟠 Reduced ({chargers.filter(c => c.status === 'reduced').length})
          </button>
          <button 
            className={`btn btn-sm ${filter === 'offline' ? 'btn-primary' : ''}`}
            onClick={() => setFilter('offline')}
          >
            🔴 Offline ({chargers.filter(c => c.status === 'offline').length})
          </button>
        </div>
      </div>

      {/* Main Content Layout: Grid of Chargers + Inspection Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedCharger ? '1fr 380px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Charger Fleet Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Prominent High-Value Focus Section (CH-01 to CH-05) */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="card-title" style={{ fontSize: '1rem' }}>Primary Charger Substation Line (CH-01 to CH-05)</span>
              <span className="badge badge-info">Priority Line</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {chargers.slice(0, 5).map((charger) => {
                const isSelected = selectedChargerId === charger.id;
                const ev = vehicles.find(v => v.chargerId === charger.id);
                return (
                  <div
                    key={charger.id}
                    onClick={() => setSelectedChargerId(charger.id)}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected ? '2px solid #06b6d4' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span className="mono" style={{ fontWeight: '800', fontSize: '1.1rem', color: '#f8fafc' }}>
                        {charger.id}
                      </span>
                      <BatteryCharging size={18} color={charger.status === 'offline' ? '#ef4444' : charger.status === 'reduced' ? '#f59e0b' : '#10b981'} />
                    </div>

                    <div style={{ marginBottom: '0.5rem' }}>
                      {getStatusBadge(charger.status)}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      EV: <strong>{ev ? ev.name : 'Empty'}</strong>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Power: <strong className="mono" style={{ color: charger.status === 'offline' ? '#64748b' : '#38bdf8' }}>{ev && ev.status === 'Charging' ? `${ev.chargingPower} kW` : '0.0 kW'}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Remaining Fleet Grid (CH-06 to CH-20) */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span className="card-title" style={{ fontSize: '1rem' }}>Sub-distribution Bays (CH-06 to CH-20)</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click any charger to inspect telemetry</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {filteredChargers.slice(5).map((charger) => {
                const isSelected = selectedChargerId === charger.id;
                const ev = vehicles.find(v => v.chargerId === charger.id);
                return (
                  <div
                    key={charger.id}
                    onClick={() => setSelectedChargerId(charger.id)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected ? '2px solid #06b6d4' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span className="mono" style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                        {charger.id}
                      </span>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: charger.status === 'offline' ? '#ef4444' : charger.status === 'reduced' ? '#f59e0b' : '#10b981'
                      }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {charger.status === 'offline' ? 'Offline' : charger.status === 'reduced' ? 'Reduced' : 'Nominal'}
                    </div>
                    <div className="mono" style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '0.2rem' }}>
                      {ev && ev.status === 'Charging' ? `${ev.chargingPower} kW` : 'Idle'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Inspection Drawer (Requirement #5) */}
        {selectedCharger && diag && (
          <div className="card" style={{
            position: 'sticky',
            top: '1rem',
            border: selectedCharger.status === 'offline' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(6, 182, 212, 0.4)',
            background: 'rgba(15, 23, 42, 0.98)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="mono" style={{ fontSize: '1.4rem', fontWeight: '900', color: '#f8fafc' }}>
                    {selectedCharger.id}
                  </span>
                  {getStatusBadge(selectedCharger.status)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Hardware ID: <code>OCPP-HW-{selectedCharger.id.replace('-', '')}-v2</code>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CURRENT POWER</div>
                <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: selectedCharger.status === 'offline' ? '#64748b' : '#38bdf8' }}>
                  {connectedEv && connectedEv.status === 'Charging' ? `${connectedEv.chargingPower} kW` : '0.0 kW'}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Max: {selectedCharger.maxPower} kW</div>
              </div>

              <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>HEALTH SCORE</div>
                <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: selectedCharger.status === 'offline' ? '#f87171' : '#34d399' }}>
                  {diag.healthScore}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>MTBF: 99.4%</div>
              </div>
            </div>

            {/* Connected EV Telemetry */}
            <div style={{ padding: '0.85rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                Connected Vehicle
              </div>
              {connectedEv ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{connectedEv.name}</div>
                    <span className="badge badge-info">{connectedEv.priority} Priority</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    ID: {connectedEv.id} • Battery: {connectedEv.batteryCapacity} kWh
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem' }}>
                    <span>Current SOC:</span>
                    <strong className="mono" style={{ color: '#38bdf8' }}>{Math.round(connectedEv.currentSoc)}% / {connectedEv.targetSoc}%</strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No vehicle currently plugged into this bay.
                </div>
              )}
            </div>

            {/* Communication Status */}
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Communication Status
              </div>
              <div style={{ fontSize: '0.82rem', color: selectedCharger.status === 'offline' ? '#f87171' : '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {selectedCharger.status === 'offline' ? <WifiOff size={15} /> : <Wifi size={15} />}
                <span>{diag.commStatus}</span>
              </div>
            </div>

            {/* Diagnostic Issue */}
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Detected Diagnostic Issue
              </div>
              <div style={{ fontSize: '0.8rem', color: selectedCharger.status === 'offline' ? '#f87171' : selectedCharger.status === 'reduced' ? '#fbbf24' : 'var(--text-secondary)', lineHeight: '1.4' }}>
                {diag.issue}
              </div>
            </div>

            {/* Recommended Action */}
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Recommended Action
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                {diag.recommendation}
              </div>
            </div>

            {/* Interactive Control Actions for Hackathon Testing */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                Technician Action Console:
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {selectedCharger.status !== 'online' && (
                  <button 
                    onClick={() => controls.setChargerStatus(selectedCharger.id, 'online')}
                    className="btn btn-sm btn-primary"
                    style={{ justifyContent: 'center' }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Restore Online</span>
                  </button>
                )}

                {selectedCharger.status !== 'reduced' && (
                  <button 
                    onClick={() => controls.setChargerStatus(selectedCharger.id, 'reduced')}
                    className="btn btn-sm"
                    style={{ justifyContent: 'center' }}
                  >
                    <Thermometer size={14} />
                    <span>Derate (50%)</span>
                  </button>
                )}

                {selectedCharger.status !== 'offline' && (
                  <button 
                    onClick={() => controls.setChargerStatus(selectedCharger.id, 'offline')}
                    className="btn btn-sm"
                    style={{ justifyContent: 'center', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                  >
                    <Power size={14} />
                    <span>Take Offline</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
