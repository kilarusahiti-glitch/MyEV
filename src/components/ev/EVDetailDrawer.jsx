import React from 'react';
import StatusBadge from '../common/StatusBadge';
import { formatPower, formatPercent } from '../../utils/formatters';
import EV3DViewer from './EV3DViewer';
import { 
  X, 
  BatteryCharging, 
  Zap, 
  Clock, 
  Gauge, 
  Calendar, 
  User, 
  CheckCircle, 
  AlertCircle,
  Play,
  Pause,
  ArrowUpCircle
} from 'lucide-react';

export default function EVDetailDrawer({
  vehicle,
  onClose,
  onToggleCharging,
  onUpdatePriority
}) {
  if (!vehicle) return null;

  const socColor = vehicle.currentSoc < 25 
    ? 'var(--danger)' 
    : vehicle.currentSoc < 60 
      ? 'var(--warning)' 
      : 'var(--success)';

  return (
    <div className="drawer-backdrop" onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 100,
      display: 'flex',
      justifyContent: 'flex-end'
    }}>
      <div 
        className="drawer-panel card" 
        onClick={(e) => e.stopPropagation()} 
        style={{
          width: '450px',
          maxWidth: '100%',
          height: '100%',
          borderRadius: '0',
          borderLeft: '1px solid var(--border-light)',
          background: 'var(--surface)',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
      >
        {/* Drawer Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge badge-info">{vehicle.id}</span>
              <StatusBadge status={vehicle.status} type="vehicle" />
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '700', marginTop: '0.4rem' }}>{vehicle.name}</h2>
            <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {vehicle.licensePlate} • Bay: {vehicle.chargerId}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn-sm btn"
            style={{ padding: '0.4rem', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 3D Realistic Vehicle Interactive Viewer */}
        <div style={{
          height: '190px',
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #090d16 0%, #111827 100%)',
          border: '1px solid var(--border)',
          marginBottom: '1.25rem',
          position: 'relative'
        }}>
          <EV3DViewer vehicle={vehicle} />
        </div>

        {/* Circular / Radial Battery Meter */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* SVG circle progress */}
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle
                cx="65"
                cy="65"
                r="54"
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="10"
              />
              <circle
                cx="65"
                cy="65"
                r="54"
                fill="none"
                stroke={socColor}
                strokeWidth="10"
                strokeDasharray="339.29"
                strokeDashoffset={339.29 - (339.29 * Math.min(100, Math.max(0, vehicle.currentSoc))) / 100}
                strokeLinecap="round"
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <span className="mono" style={{ fontSize: '1.6rem', fontWeight: '800', color: socColor }}>
                {formatPercent(vehicle.currentSoc)}%
              </span>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current SOC</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Target SOC</div>
              <div className="mono" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{vehicle.targetSoc}%</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Capacity</div>
              <div className="mono" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{vehicle.batteryCapacity} kWh</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Needed</div>
              <div className="mono" style={{ fontWeight: '700', color: '#38bdf8' }}>{vehicle.energyRequired} kWh</div>
            </div>
          </div>
        </div>

        {/* Telemetry Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.35rem' }}>
              <Zap size={14} style={{ color: '#38bdf8' }} />
              <span>Charging Power</span>
            </div>
            <div className="mono" style={{ fontSize: '1.15rem', fontWeight: '700', color: vehicle.chargingPower > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
              {formatPower(vehicle.chargingPower)} kW
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Max: {vehicle.maxChargingPower} kW
            </div>
          </div>

          <div className="card" style={{ padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.35rem' }}>
              <Clock size={14} style={{ color: 'var(--accent)' }} />
              <span>Est. Completion</span>
            </div>
            <div className="mono" style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {vehicle.estimatedCompletion}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Departs: {vehicle.departureTime}
            </div>
          </div>

          <div className="card" style={{ padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.35rem' }}>
              <ArrowUpCircle size={14} style={{ color: 'var(--warning)' }} />
              <span>Dispatch Priority</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StatusBadge status={vehicle.priority} type="priority" />
            </div>
          </div>

          <div className="card" style={{ padding: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.35rem' }}>
              <User size={14} style={{ color: 'var(--text-secondary)' }} />
              <span>Resident</span>
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {vehicle.ownerName || 'Building Resident'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Plugged: {vehicle.pluggedInAt || 'Evening'}
            </div>
          </div>
        </div>

        {/* Priority Selector & Quick Actions */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', display: 'block' }}>
              Update Dispatch Priority:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
                <button
                  key={p}
                  onClick={() => onUpdatePriority(vehicle.id, p)}
                  className={`btn-sm ${vehicle.priority === p ? 'btn-primary' : 'btn'}`}
                  style={{ width: '100%', fontSize: '0.75rem' }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onToggleCharging(vehicle.id)}
            className={`btn ${vehicle.status === 'Charging' ? 'btn' : 'btn-primary'}`}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {vehicle.status === 'Charging' ? (
              <>
                <Pause size={16} />
                <span>Pause Charging</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Resume / Start Charging</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
