import React, { useState, useEffect } from 'react';
import { useSystemState } from '../../hooks/useSystemState';
import { useAuth } from '../../context/AuthContext';
import { getOrgConfig, ORGANIZATION_CONFIGS } from '../../data/organizationConfig';
import DemoTourModal from '../common/DemoTourModal';
import { 
  Building2, 
  FlaskConical, 
  Clock, 
  Bell, 
  Mail,
  User, 
  LogOut, 
  Menu,
  Radio,
  ChevronDown,
  Search,
  X
} from 'lucide-react';

// Real clock hook — uses actual browser/system time, updates every second
function useRealClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function TopBar({ onMenuClick }) {
  const { 
    systemStatus, 
    alerts, 
    organizationMode,
    controls 
  } = useSystemState();
  const { currentUser, isDemoUser, logout } = useAuth();

  const org = getOrgConfig(organizationMode);
  const now = useRealClock();

  const [showAlerts, setShowAlerts] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showIotModal, setShowIotModal] = useState(false);
  const [showDemoTour, setShowDemoTour] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Format real current time
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  return (
    <>
      <header className="topbar">
        {/* Left Side: Mobile Menu + Search Bar */}
        <div className="topbar-left">
          <button className="mobile-menu-btn" onClick={onMenuClick}>
            <Menu size={20} />
          </button>

          {/* Search Bar */}
          <div className="topbar-search-container">
            <Search size={16} className="search-icon" />
            <input 
              type="text"
              className="topbar-search-input"
              placeholder="Search EV, charger, grid..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="search-shortcut">⌘ F</span>
          </div>

          {/* Org facility selector dropdown */}
          <div className="topbar-dropdown-wrapper" style={{ position: 'relative' }}>
            <div 
              className="topbar-org-pill" 
              onClick={() => setShowOrgMenu(!showOrgMenu)}
              title="Click to switch facility type"
            >
              <Building2 size={15} color="#166534" />
              <span className="org-pill-name">{org.name}</span>
              <ChevronDown size={13} color="#6b7280" />
            </div>

            {showOrgMenu && (
              <div className="dropdown-panel card" style={{ position: 'absolute', top: '100%', left: 0, width: '260px', zIndex: 100, padding: '0.65rem', marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                  Select Facility Type
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {Object.values(ORGANIZATION_CONFIGS).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        controls.setOrganizationMode(o.id);
                        setShowOrgMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '8px',
                        background: organizationMode === o.id ? '#f0fdf4' : 'transparent',
                        border: organizationMode === o.id ? '1px solid #bbf7d0' : '1px solid transparent',
                        color: organizationMode === o.id ? '#166534' : '#374151',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.78rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700' }}>{o.id}</div>
                        <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>{o.facilityType}</div>
                      </div>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: o.badgeColor }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Simulation mode indicator */}
          <div 
            className="topbar-mode-badge" 
            onClick={() => setShowIotModal(true)}
            title="Click to inspect IoT telemetry hardware state"
          >
            <FlaskConical size={13} />
            <span>SIMULATION</span>
          </div>
        </div>

        {/* Right Side: Real Time + Mail + Bell + Profile */}
        <div className="topbar-right">
          {/* Real Current Time — uses actual system clock */}
          <div className="time-controls-pill" title="Current system time (real-time)">
            <Clock size={14} color="#166534" />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span className="sim-time mono" style={{ fontSize: '0.82rem', fontWeight: '700' }}>
                {formatTime(now)}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: '500' }}>
                {formatDate(now)}
              </span>
            </div>
          </div>

          {/* Mail icon button */}
          <button 
            className="topbar-circle-btn"
            title="Direct Messages & Support"
            onClick={() => alert("VoltFlow Grid Dispatch Communications: All channels clear.")}
          >
            <Mail size={17} />
          </button>

          {/* Bell / Notification icon button */}
          <div className="topbar-dropdown-wrapper">
            <button 
              className="topbar-circle-btn" 
              onClick={() => setShowAlerts(!showAlerts)}
              title="System Telemetry Notifications"
            >
              <Bell size={17} />
              {alerts.length > 0 && <span className="topbar-badge-dot">{alerts.length}</span>}
            </button>

            {showAlerts && (
              <div className="dropdown-panel alerts-panel card">
                <div className="panel-header">
                  <span className="panel-title">System Telemetry Alerts</span>
                  <span className="badge badge-info">{alerts.length} active</span>
                </div>
                <div className="alerts-list">
                  {alerts.map((a) => (
                    <div key={a.id} className={`alert-item alert-${a.type}`}>
                      <div className="alert-meta">
                        <span className="alert-time mono">{a.time}</span>
                        <span className={`badge badge-${a.type === 'danger' ? 'danger' : a.type === 'warning' ? 'warning' : 'info'}`}>
                          {a.type}
                        </span>
                      </div>
                      <div className="alert-text">{a.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile Badge Pill */}
          <div className="topbar-dropdown-wrapper">
            <button 
              className="topbar-user-pill" 
              onClick={() => setShowProfile(!showProfile)}
            >
              <div className="donezo-avatar">
                <span>{isDemoUser ? 'DU' : (currentUser?.email?.[0] || 'A').toUpperCase()}</span>
              </div>
              <div className="donezo-user-details">
                <div className="donezo-username">
                  {isDemoUser ? 'Demo User' : (currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin')}
                </div>
                <div className="donezo-useremail">
                  {currentUser?.email || 'admin@voltflow.ai'}
                </div>
              </div>
            </button>

            {showProfile && (
              <div className="dropdown-panel profile-panel card">
                <div className="profile-info-header">
                  <div className="profile-name">
                    {isDemoUser ? 'Demo User' : (currentUser?.displayName || 'Admin')}
                  </div>
                  <div className="profile-email mono">
                    {currentUser?.email || 'admin@voltflow.ai'}
                  </div>
                  <div className="profile-role badge badge-info" style={{ marginTop: '0.35rem' }}>
                    {isDemoUser ? '🧪 Demo Mode (Local)' : '⚡ Chief Grid Operator'}
                  </div>
                </div>
                <div className="profile-divider" />
                <button className="profile-logout-btn" onClick={logout}>
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Live IoT Info Modal Dialog */}
      {showIotModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem', border: '1px solid #bbf7d0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Radio size={22} color="#16a34a" />
                <span style={{ fontWeight: '800', fontSize: '1.15rem', color: '#0f1117' }}>Live IoT Hardware Status</span>
              </div>
              <button onClick={() => setShowIotModal(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.75rem' }}>
              🟢 REALTIME SIMULATION ACTIVE
            </div>

            <p style={{ fontSize: '0.82rem', color: '#374151', lineHeight: '1.5', marginBottom: '1rem' }}>
              Receiving high-frequency telemetry from the virtual substation simulation engine. Supports direct binding to:
            </p>

            <ul style={{ fontSize: '0.8rem', color: '#1f2937', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.25rem', paddingLeft: '1.25rem' }}>
              <li>Smart Meters (Modbus RTU / TCP)</li>
              <li>Solar Inverters (SunSpec / MQTT)</li>
              <li>EV Chargers (OCPP 2.0.1 WebSocket)</li>
              <li>Transformer Sensors (4-20mA RTD & CT loops)</li>
            </ul>

            <button onClick={() => setShowIotModal(false)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Demo Tour Modal */}
      <DemoTourModal isOpen={showDemoTour} onClose={() => setShowDemoTour(false)} />
    </>
  );
}
