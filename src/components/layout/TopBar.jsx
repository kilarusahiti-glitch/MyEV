import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Clock, LogOut, Mail, Menu, Search } from 'lucide-react';
import { useSystemState } from '../../hooks/useSystemState';
import { useAuth } from '../../context/AuthContext';
import { getOrgConfig } from '../../data/organizationConfig';
import { firestoreService } from '../../services/firestoreService';

function useRealClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return now;
}

export default function TopBar({ onMenuClick }) {
  const { alerts, organizationMode } = useSystemState();
  const { currentUser, isDemoUser, logout } = useAuth();
  const navigate = useNavigate();
  const now = useRealClock();
  const [showAlerts, setShowAlerts] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedProfile, setSavedProfile] = useState(null);
  const profileRef = useRef(null);
  const org = getOrgConfig(organizationMode);
  const displayName = isDemoUser ? 'Demo User' : (savedProfile?.fullName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin');
  const email = savedProfile?.email || currentUser?.email || 'admin@voltflow.ai';

  useEffect(() => {
    if (!currentUser?.uid) return;
    firestoreService.getProfile(currentUser.uid).then((profile) => {
      if (profile) setSavedProfile(profile);
    }).catch(() => {});
  }, [currentUser?.uid]);

  useEffect(() => {
    const closeProfile = (event) => { if (profileRef.current && !profileRef.current.contains(event.target)) setShowProfile(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setShowProfile(false); };
    document.addEventListener('mousedown', closeProfile);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeProfile); document.removeEventListener('keydown', closeOnEscape); };
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-btn" onClick={onMenuClick} title="Open navigation"><Menu size={20} /></button>
        <div className="topbar-search-container"><Search size={16} className="search-icon" /><input type="text" className="topbar-search-input" placeholder="Search EV, charger, grid..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /><span className="search-shortcut">⌘ F</span></div>
        <div className="topbar-org-pill" title="Current organization"><span className="org-pill-mark" aria-hidden="true" /><span className="org-pill-name">{org.name}</span></div>
      </div>
      <div className="topbar-right">
        <div className="time-controls-pill" title="Current system time"><Clock size={14} color="#166534" /><div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}><span className="sim-time" style={{ fontSize: '0.82rem', fontWeight: 700 }}>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 500 }}>{now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div></div>
        <button className="topbar-circle-btn" title="Direct Messages and Support" onClick={() => window.alert('VoltFlow Grid Dispatch Communications: All channels clear.')}><Mail size={17} /></button>
        <div className="topbar-dropdown-wrapper"><button className="topbar-circle-btn" onClick={() => setShowAlerts(!showAlerts)} title="System Telemetry Notifications"><Bell size={17} />{alerts.length > 0 && <span className="topbar-badge-dot">{alerts.length}</span>}</button>{showAlerts && <div className="dropdown-panel alerts-panel card"><div className="panel-header"><span className="panel-title">System Telemetry Alerts</span><span className="badge badge-info">{alerts.length} active</span></div><div className="alerts-list">{alerts.map((alert) => <div key={alert.id} className={`alert-item alert-${alert.type}`}><div className="alert-text">{alert.message}</div></div>)}</div></div>}</div>
        <div className="topbar-dropdown-wrapper" ref={profileRef}><button className="topbar-user-pill" onClick={() => setShowProfile(!showProfile)} aria-expanded={showProfile}><div className="donezo-avatar"><span>{displayName.slice(0, 2).toUpperCase()}</span></div><div className="donezo-user-details"><div className="donezo-username">{displayName}</div><div className="donezo-useremail">{email}</div></div><ChevronDown size={14} /></button>{showProfile && <div className="dropdown-panel profile-panel card"><div className="profile-info-header"><div className="profile-name">{displayName}</div><div className="profile-email">{email}</div><div className="profile-role badge badge-info">{isDemoUser ? 'Demo Mode (Local)' : 'Grid Operator'}</div></div><div className="profile-divider" /><button className="profile-menu-btn" onClick={() => { setShowProfile(false); navigate('/settings'); }}>Settings <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} /></button><button className="profile-logout-btn" onClick={logout}><LogOut size={15} /><span>Sign Out</span></button></div>}</div>
      </div>
    </header>
  );
}
