import React, { useState, useMemo } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { Bell, X, Filter, Zap, Car, Sun, Cpu, Activity, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';

const CATEGORIES = ['ALL', 'GRID', 'EV', 'SOLAR', 'CHARGER', 'TRANSFORMER', 'SYSTEM'];

const categoryIcons = {
  grid: <Zap size={14} />,
  ev: <Car size={14} />,
  solar: <Sun size={14} />,
  charger: <Activity size={14} />,
  transformer: <Cpu size={14} />,
  system: <CheckCircle2 size={14} />
};

const severityConfig = {
  danger: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', icon: <XCircle size={16} /> },
  warning: { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: <AlertTriangle size={16} /> },
  info: { color: '#38bdf8', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)', icon: <Info size={16} /> }
};

function AlertCard({ alert, onDismiss }) {
  const sev = severityConfig[alert.severity] || severityConfig.info;
  return (
    <div style={{
      background: sev.bg,
      border: `1px solid ${sev.border}`,
      borderRadius: 'var(--radius-md)',
      padding: '0.85rem 1rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      transition: 'opacity 0.2s'
    }}>
      <div style={{ color: sev.color, flexShrink: 0, marginTop: '1px' }}>{sev.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '700', fontSize: '0.85rem', color: sev.color }}>{alert.title}</span>
          <span style={{
            fontSize: '0.65rem', padding: '0.1rem 0.4rem',
            background: `${sev.color}22`, color: sev.color,
            border: `1px solid ${sev.border}`, borderRadius: '999px',
            display: 'flex', alignItems: 'center', gap: '0.25rem'
          }}>
            {categoryIcons[alert.category] || <Activity size={10} />}
            {(alert.category || 'SYSTEM').toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          {alert.message}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          {alert.time}
        </div>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, padding: '0.1rem', display: 'flex' }}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function AlertsPage() {
  const { alerts, isEmergencyMode, gridUtilization, gridStress, controls } = useSystemState();
  const [activeCategory, setActiveCategory] = useState('ALL');

  const filteredAlerts = useMemo(() => {
    if (activeCategory === 'ALL') return alerts;
    return alerts.filter(a => (a.category || 'system').toUpperCase() === activeCategory);
  }, [alerts, activeCategory]);

  const stats = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'danger').length,
    warnings: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length
  }), [alerts]);

  const handleDismiss = (id) => controls.clearAlert(id);
  const handleDismissAll = () => controls.dismissAllAlerts();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Total Alerts', value: stats.total, color: '#38bdf8', bg: 'rgba(6,182,212,0.1)' },
          { label: 'Critical', value: stats.critical, color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Warnings', value: stats.warnings, color: '#fbbf24', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Info', value: stats.info, color: '#a3e635', bg: 'rgba(163,230,53,0.1)' }
        ].map(s => (
          <div key={s.label} className="card" style={{ background: s.bg, borderColor: `${s.color}33` }}>
            <div className="mono" style={{ fontSize: '1.8rem', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Emergency Banner */}
      {isEmergencyMode && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 'var(--radius-lg)', padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', gap: '1rem'
        }}>
          <AlertTriangle size={20} color="#f87171" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', color: '#f87171' }}>🔴 EMERGENCY MODE ACTIVE</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Grid at {gridUtilization.toFixed(0)}%. All flexible EV charging suspended. Optimizer protecting critical vehicles only.
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="btn btn-sm"
                style={{
                  background: activeCategory === cat ? 'rgba(59,130,246,0.2)' : 'transparent',
                  borderColor: activeCategory === cat ? 'rgba(59,130,246,0.5)' : 'var(--border)',
                  color: activeCategory === cat ? '#60a5fa' : 'var(--text-muted)',
                  fontSize: '0.72rem'
                }}
              >
                {cat}
                {cat !== 'ALL' && (
                  <span style={{ marginLeft: '0.3rem', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', padding: '0 0.25rem', fontSize: '0.65rem' }}>
                    {alerts.filter(a => (a.category || 'system').toUpperCase() === cat).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={handleDismissAll} style={{ color: 'var(--text-muted)' }}>
            Clear All
          </button>
        </div>
      </div>

      {/* Alert Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {filteredAlerts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={40} style={{ marginBottom: '1rem', color: '#34d399', display: 'block', margin: '0 auto 1rem' }} />
            <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>No alerts in this category</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>System operating normally</div>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
          ))
        )}
      </div>
    </div>
  );
}
