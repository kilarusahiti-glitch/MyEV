import React, { useEffect, useState } from 'react';
import { Building2, Save, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSystemState } from '../hooks/useSystemState';
import { ORGANIZATION_CONFIGS } from '../data/organizationConfig';
import { firestoreService } from '../services/firestoreService';

const PROFILE_KEY = 'voltflow_profile_settings';
const ORGANIZATION_TYPES = ['Residential Community', 'Apartment Complex', 'Office / Commercial', 'Campus / University', 'Fleet / Depot', 'Public Charging Site', 'Other'];

function loadProfile(user) {
  try { return { fullName: user?.displayName || '', email: user?.email || '', phone: '', organizationName: '', organizationType: 'Residential Community', ...JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') }; } catch { return { fullName: user?.displayName || '', email: user?.email || '', phone: '', organizationName: '', organizationType: 'Residential Community' }; }
}

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const { organizationMode } = useSystemState();
  const [profile, setProfile] = useState(() => loadProfile(currentUser));
  const [saved, setSaved] = useState(false);
  const update = (key) => (event) => setProfile((value) => ({ ...value, [key]: event.target.value }));
  const save = (event) => {
    event.preventDefault();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    firestoreService.updateProfile(currentUser?.uid, profile).then(() => setSaved(true)).catch(() => setSaved(true));
    window.setTimeout(() => setSaved(false), 2500);
  };
  const organization = ORGANIZATION_CONFIGS[organizationMode];

  useEffect(() => {
    if (!currentUser?.uid) return;
    firestoreService.getProfile(currentUser.uid).then((stored) => {
      if (stored) setProfile((value) => ({ ...value, ...stored }));
    }).catch(() => {});
  }, [currentUser?.uid]);

  return <form className="settings-page" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '900px' }}>
    <div><h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Settings</h1><p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Manage the operator profile and organization context used by this browser.</p></div>
    {saved && <div role="status" className="badge badge-success" style={{ alignSelf: 'flex-start', padding: '0.6rem 0.8rem' }}>Profile saved</div>}
    <section className="card"><div className="card-header"><span className="card-title"><UserRound size={17} /> Profile</span><span className="badge badge-info">Local browser profile</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
      <label>Full Name<input className="input" value={profile.fullName} onChange={update('fullName')} /></label>
      <label>Email<input className="input" type="email" value={profile.email} onChange={update('email')} /></label>
      <label>Phone (optional)<input className="input" value={profile.phone} onChange={update('phone')} placeholder="Not provided" /></label>
    </div></section>
    <section className="card"><div className="card-header"><span className="card-title"><Building2 size={17} /> Organization</span><span className="badge badge-info">{organization?.name || organizationMode}</span></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
      <label>Organization Name<input className="input" value={profile.organizationName} onChange={update('organizationName')} placeholder={organization?.name || 'Organization name'} /></label>
      <label>Organization Type<select className="input" value={profile.organizationType} onChange={update('organizationType')}>{ORGANIZATION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
    </div></section>
    <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}><Save size={16} /> Save Profile</button>
    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Profile saves to Firebase when configured, with local browser fallback when it is unavailable.</p>
  </form>;
}
