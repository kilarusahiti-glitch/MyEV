import React, { useState } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { getOrgConfig } from '../data/organizationConfig';
import { 
  Zap, 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  TrendingDown, 
  Play, 
  Car, 
  Building2,
  FileCheck2,
  Sliders
} from 'lucide-react';

export default function DemandResponsePage() {
  const { demandResponse, controls, evLoad, vehicles, organizationMode } = useSystemState();
  const org = getOrgConfig(organizationMode);

  const [requestedKw, setRequestedKw] = useState(15);
  const [durationMins, setDurationMins] = useState(30);

  const isDrActive = demandResponse?.active;

  const handleTriggerDR = (e) => {
    e.preventDefault();
    controls.triggerDemandResponse(requestedKw, durationMins);
  };

  const handleCancelDR = () => {
    controls.cancelDemandResponse();
  };

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Identify affected flexible vehicles vs protected high-priority vehicles
  const flexibleEvs = vehicles.filter(v => v.priority === 'LOW' || v.priority === 'MEDIUM');
  const protectedEvs = vehicles.filter(v => v.priority === 'HIGH');

  return (
    <div className="demand-response-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Automated Demand Response (ADR)</h1>
          <span className={`badge badge-${isDrActive ? 'warning' : 'info'}`}>
            {isDrActive ? 'EVENT IN PROGRESS' : 'READY FOR DISPATCH'}
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Automated demand curtailment coordinating OpenADR 2.0b signals with localized EV charging flexibility for <strong>{org.name}</strong>.
        </p>
      </div>

      {/* Primary Highlight Card: Example Specification (#13) */}
      <div className="card" style={{
        padding: '1.75rem',
        background: isDrActive 
          ? 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.15), rgba(15, 23, 42, 0.95))' 
          : 'radial-gradient(ellipse at top left, rgba(6, 182, 212, 0.1), rgba(15, 23, 42, 0.95))',
        border: isDrActive ? '2px solid #f59e0b' : '1px solid var(--border)'
      }}>
        <div className="card-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Zap size={20} color={isDrActive ? '#f59e0b' : '#38bdf8'} />
            <span className="card-title" style={{ fontSize: '1.1rem' }}>Active Grid Demand Response Event</span>
          </div>
          <span className={`badge badge-${isDrActive ? 'warning' : 'success'}`}>
            {isDrActive ? 'OPENADR 2.0B CURTAILMENT' : 'NOMINAL GRID CONTRACT'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {/* GRID REQUEST */}
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
              GRID REQUEST
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.35rem' }}>
              <span className="mono" style={{ fontSize: '1.8rem', fontWeight: '900', color: '#f8fafc' }}>
                Reduce {demandResponse?.requestedKw || 15} kW
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Duration: <strong>{demandResponse?.durationMinutes || 30} minutes</strong>
            </div>
          </div>

          {/* OPTIMIZER RESPONSE */}
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ fontSize: '0.72rem', color: '#34d399', textTransform: 'uppercase', fontWeight: '700' }}>
              OPTIMIZER RESPONSE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
              <CheckCircle2 size={22} color="#10b981" />
              <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>
                ✓ Accepted
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Fast response dispatched in 850 ms
            </div>
          </div>

          {/* FLEXIBLE EV CURTAILMENT */}
          <div style={{ padding: '1rem', background: 'rgba(6, 182, 212, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
            <div style={{ fontSize: '0.72rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: '700' }}>
              FLEXIBLE EV CHARGING REDUCED
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.35rem' }}>
              <span className="mono" style={{ fontSize: '1.8rem', fontWeight: '900', color: '#38bdf8' }}>
                {isDrActive ? demandResponse.actualReducedKw : 17.0} kW
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Exceeds request by +2.0 kW headroom
            </div>
          </div>

          {/* TIMER / COUNTDOWN */}
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
              {isDrActive ? 'REMAINING TIME' : 'EVENT STATUS'}
            </div>
            <div className="mono" style={{ fontSize: '1.8rem', fontWeight: '900', color: isDrActive ? '#fbbf24' : '#64748b', marginTop: '0.35rem' }}>
              {isDrActive ? formatSeconds(demandResponse.remainingSeconds) : 'IDLE'}
            </div>
            <div style={{ marginTop: '0.35rem' }}>
              {isDrActive ? (
                <button onClick={handleCancelDR} className="btn btn-sm" style={{ fontSize: '0.7rem', color: '#f87171', borderColor: 'rgba(239,68,68,0.4)' }}>
                  Cancel DR Early
                </button>
              ) : (
                <span style={{ fontSize: '0.72rem', color: '#10b981' }}>Grid Operating Nominally</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Simulator & Dispatch Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Simulator Form */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={18} className="text-cyan" />
              <span className="card-title">Simulate Utility DR Request</span>
            </div>
            <span className="badge badge-info">Interactive Trigger</span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Broadcast a simulated demand-response event from the regional transmission operator.
          </p>

          <form onSubmit={handleTriggerDR} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Requested Load Reduction (kW)
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={requestedKw}
                onChange={(e) => setRequestedKw(Number(e.target.value))}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Event Duration (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
                className="input"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
              <Play size={16} />
              <span>Broadcast Demand Response Signal</span>
            </button>
          </form>
        </div>

        {/* Fleet Allocation Protection Details */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Algorithm Allocation Safeguards</span>
            <span className="badge badge-success">Deterministic Priority</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#34d399' }}>Protected Urgent Vehicles ({protectedEvs.length})</span>
                <span className="badge badge-success">Protected</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Vehicles departing within 2 hours or with critical battery state maintain full charging power despite DR signals.
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#fbbf24' }}>Flexible Curtailable Vehicles ({flexibleEvs.length})</span>
                <span className="badge badge-warning">Curtailable</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Long-dwell overnight vehicles absorb the full -15 kW curtailment without missing their target morning SOC.
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(6, 182, 212, 0.06)', border: '1px solid rgba(6, 182, 212, 0.2)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <strong>Demand Response Incentive:</strong> Grid operator pays ₹18.50 per curtailed kWh under the Dynamic Capacity Ancillary Services program.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
