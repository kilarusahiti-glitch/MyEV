import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSystemState } from '../hooks/useSystemState';
import { ORGANIZATION_CONFIGS, getOrgConfig } from '../data/organizationConfig';
import { 
  Settings, 
  Building2, 
  Zap, 
  Car, 
  Sun, 
  Receipt, 
  FlaskConical, 
  Server, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  Copy,
  Sliders,
  Sparkles
} from 'lucide-react';

export default function SettingsPage() {
  const { currentUser, isFirebaseConfigured } = useAuth();
  const { 
    gridLimit, 
    transformerLimit, 
    speed, 
    organizationMode, 
    tariffSettings, 
    buildingDemandMultiplier,
    solarMultiplier,
    totalEvCount,
    controls 
  } = useSystemState();

  const [activeTab, setActiveTab] = useState('organization'); // 'organization' | 'grid' | 'ev' | 'solar' | 'billing' | 'simulation' | 'backend'

  // Local state for forms
  const [selectedOrg, setSelectedOrg] = useState(organizationMode || 'Apartment');
  const [localGridLimit, setLocalGridLimit] = useState(gridLimit || 100);
  const [localTransformerLimit, setLocalTransformerLimit] = useState(transformerLimit || 100);
  const [emergencyThreshold, setEmergencyThreshold] = useState(95);

  // EV
  const [maxChargerPower, setMaxChargerPower] = useState(7.4);
  const [minChargerPower, setMinChargerPower] = useState(1.4);
  const [priorityPolicy, setPriorityPolicy] = useState('Departure & SOC Weighted');

  // Solar
  const [solarCapacity, setSolarCapacity] = useState(40);
  const [solarIrradianceBias, setSolarIrradianceBias] = useState(solarMultiplier || 1.0);

  // Billing
  const [peakRate, setPeakRate] = useState(tariffSettings?.peakRate || 9.50);
  const [midPeakRate, setMidPeakRate] = useState(tariffSettings?.midPeakRate || 6.80);
  const [offPeakRate, setOffPeakRate] = useState(tariffSettings?.offPeakRate || 4.20);
  const [fixedCharge, setFixedCharge] = useState(tariffSettings?.fixedCharge || 550);
  const [taxPercent, setTaxPercent] = useState(Math.round((tariffSettings?.taxRate || 0.09) * 100));
  const [billingCycleDay, setBillingCycleDay] = useState(tariffSettings?.billingCycleDay || 1);

  // Simulation
  const [simSpeed, setSimSpeed] = useState(speed || 1);
  const [buildingProfileBias, setBuildingProfileBias] = useState(buildingDemandMultiplier || 1.0);

  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const envSnippet = `VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`;

  const copyEnvSnippet = () => {
    navigator.clipboard?.writeText(envSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAll = (e) => {
    e.preventDefault();
    // Commit to system engine
    controls.setOrganizationMode(selectedOrg);
    controls.setGridLimit(Number(localGridLimit));
    controls.setTransformerLimit(Number(localTransformerLimit));
    controls.setSpeed(Number(simSpeed));
    controls.setBuildingMultiplier(Number(buildingProfileBias));
    controls.setSolarMultiplier(Number(solarIrradianceBias));

    controls.setTariffSettings({
      peakRate: Number(peakRate),
      midPeakRate: Number(midPeakRate),
      offPeakRate: Number(offPeakRate),
      fixedCharge: Number(fixedCharge),
      taxRate: Number(taxPercent) / 100,
      billingCycleDay: Number(billingCycleDay)
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="settings-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Platform & Facility Configuration</h1>
            <span className="badge badge-info">{organizationMode} Mode</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Configure organization type, substation grid constraints, EV fleet parameters, solar curves, and electricity tariffs.
          </p>
        </div>

        <button onClick={handleSaveAll} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Save size={16} />
          <span>Save All Settings</span>
        </button>
      </div>

      {saved && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} />
          <span>Settings successfully applied to simulation engine and broadcast to all pages!</span>
        </div>
      )}

      {/* Navigation Tabs for Settings */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        {[
          { id: 'organization', label: 'Organization Mode', icon: Building2 },
          { id: 'grid', label: 'Grid', icon: Zap },
          { id: 'ev', label: 'EV Fleet', icon: Car },
          { id: 'solar', label: 'Solar PV', icon: Sun },
          { id: 'billing', label: 'Billing & Tariffs', icon: Receipt },
          { id: 'simulation', label: 'Simulation Engine', icon: FlaskConical },
          { id: 'backend', label: 'Firebase / Cloud', icon: Server }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn btn-sm ${isActive ? 'btn-primary' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', fontSize: '0.78rem' }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. ORGANIZATION MODE SECTION (Requirement #9) */}
      {activeTab === 'organization' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card-header">
            <div>
              <span className="card-title">Select Organization Type</span>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                The same platform dynamically adapts terminology, tariff categories, and sub-metering schemas.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {Object.values(ORGANIZATION_CONFIGS).map(org => {
              const isSelected = selectedOrg === org.id;
              return (
                <div
                  key={org.id}
                  onClick={() => setSelectedOrg(org.id)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                    border: isSelected ? '2px solid #06b6d4' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '800', fontSize: '1.05rem', color: '#f8fafc' }}>
                      {org.id}
                    </span>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: org.badgeColor }} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: '600' }}>
                    {org.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: '1.4' }}>
                    {org.description}
                  </div>

                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <div>Units: <strong>{org.unitsLabel}</strong></div>
                    <div>Fleet: <strong>{org.fleetLabel}</strong></div>
                    <div>Tariff: <strong>{org.tariffCategory}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. GRID SECTION (Requirement #10) */}
      {activeTab === 'grid' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Grid & Substation Constraints</span>
            <span className="badge badge-info">Substation Protection</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Maximum Grid Capacity (kW)
              </label>
              <input
                type="number"
                value={localGridLimit}
                onChange={(e) => setLocalGridLimit(e.target.value)}
                className="input"
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Contract demand limit from utility</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Transformer Safe Limit (kVA)
              </label>
              <input
                type="number"
                value={localTransformerLimit}
                onChange={(e) => setLocalTransformerLimit(e.target.value)}
                className="input"
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nameplate capacity of distribution transformer</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Emergency Curtailment Threshold (%)
              </label>
              <input
                type="number"
                value={emergencyThreshold}
                onChange={(e) => setEmergencyThreshold(e.target.value)}
                className="input"
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Threshold where non-critical EV loads suspend</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. EV SECTION (Requirement #10) */}
      {activeTab === 'ev' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">EV Charging & Priority Engine</span>
            <span className="badge badge-success">OCPP Dispatch</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Maximum Charger Power (kW)
              </label>
              <input
                type="number"
                step="0.1"
                value={maxChargerPower}
                onChange={(e) => setMaxChargerPower(e.target.value)}
                className="input"
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Max AC Level 2 output (e.g. 7.4 kW / 32A)</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Minimum Charger Power (kW)
              </label>
              <input
                type="number"
                step="0.1"
                value={minChargerPower}
                onChange={(e) => setMinChargerPower(e.target.value)}
                className="input"
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IEC 61851 minimum pilot current threshold (6A = 1.4 kW)</span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Priority Dispatch Algorithm
              </label>
              <select
                value={priorityPolicy}
                onChange={(e) => setPriorityPolicy(e.target.value)}
                className="input"
              >
                <option value="Departure & SOC Weighted">Departure & SOC Weighted (Recommended)</option>
                <option value="Earliest Deadline First">Earliest Deadline First (EDF)</option>
                <option value="Lowest SOC First">Lowest Battery SOC First</option>
                <option value="Equal Share Round Robin">Equal Share Pro-Rata</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 4. SOLAR SECTION (Requirement #10) */}
      {activeTab === 'solar' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Solar PV & Forecast Integration</span>
            <span className="badge badge-warning">40 kWp Rooftop</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Solar Array Nameplate Capacity (kWp)
              </label>
              <input
                type="number"
                value={solarCapacity}
                onChange={(e) => setSolarCapacity(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Solar Irradiance Multiplier ({solarIrradianceBias}x)
              </label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={solarIrradianceBias}
                onChange={(e) => setSolarIrradianceBias(e.target.value)}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>0.1x (Overcast)</span>
                <span>1.0x (Clear Sky)</span>
                <span>2.0x (Peak Sun)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. BILLING SECTION (Requirement #10 & #2) */}
      {activeTab === 'billing' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Electricity Billing & Tariff Schedule</span>
            <span className="badge badge-info">Time-of-Use (TOU) Rates</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Peak Tariff (17:00 – 21:00) [₹/kWh]
              </label>
              <input
                type="number"
                step="0.1"
                value={peakRate}
                onChange={(e) => setPeakRate(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Mid-Peak Tariff (08:00 – 17:00) [₹/kWh]
              </label>
              <input
                type="number"
                step="0.1"
                value={midPeakRate}
                onChange={(e) => setMidPeakRate(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Off-Peak Tariff (22:00 – 08:00) [₹/kWh]
              </label>
              <input
                type="number"
                step="0.1"
                value={offPeakRate}
                onChange={(e) => setOffPeakRate(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Monthly Substation Fixed Charge (₹)
              </label>
              <input
                type="number"
                value={fixedCharge}
                onChange={(e) => setFixedCharge(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Electricity Duty / Tax (%)
              </label>
              <input
                type="number"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Monthly Billing Cycle Day
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={billingCycleDay}
                onChange={(e) => setBillingCycleDay(e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. SIMULATION SECTION (Requirement #10) */}
      {activeTab === 'simulation' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Virtual Sensor Simulation Controls</span>
            <span className="badge badge-info">Physics Engine</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Simulation Clock Speed
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[0, 1, 2, 5].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSimSpeed(s)}
                    className={`btn btn-sm ${simSpeed === s ? 'btn-primary' : ''}`}
                    style={{ flex: 1 }}
                  >
                    {s === 0 ? 'Pause' : `${s}x`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Building Base Demand Multiplier ({buildingProfileBias}x)
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={buildingProfileBias}
                onChange={(e) => setBuildingProfileBias(e.target.value)}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>0.5x (Night/Holiday)</span>
                <span>1.0x (Standard)</span>
                <span>2.0x (Extreme Surge)</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Number of Managed EVs
              </label>
              <input
                type="number"
                disabled
                value={totalEvCount}
                className="input"
                style={{ opacity: 0.7 }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>20-bay smart fleet simulated</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. BACKEND / FIREBASE SECTION */}
      {activeTab === 'backend' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card-header">
            <span className="card-title">Firebase & Cloud Database Connection</span>
            <span className={`badge badge-${isFirebaseConfigured ? 'success' : 'warning'}`}>
              {isFirebaseConfigured ? 'FIREBASE CONNECTED' : 'DEMO MODE (LOCAL)'}
            </span>
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            {isFirebaseConfigured ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399' }}>
                <ShieldCheck size={18} />
                <span>Cloud Firestore and Firebase Authentication are active and syncing telemetry.</span>
              </div>
            ) : (
              <div>
                <p>
                  The application is currently running in <strong>Local Simulation Mode</strong>. Virtual sensors generate realistic telemetry locally without requiring external cloud credentials.
                </p>
                <p style={{ marginTop: '0.5rem' }}>
                  To connect live Firebase cloud persistence, add these keys to your <code>.env</code> file:
                </p>
              </div>
            )}
          </div>

          <div style={{ position: 'relative', marginTop: '0.5rem' }}>
            <pre style={{
              background: 'rgba(10, 14, 23, 0.95)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontSize: '0.78rem',
              color: '#38bdf8',
              fontFamily: 'JetBrains Mono, monospace',
              overflowX: 'auto'
            }}>
              {envSnippet}
            </pre>
            <button
              onClick={copyEnvSnippet}
              className="btn-sm btn"
              style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '0.7rem' }}
            >
              {copied ? <CheckCircle2 size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copied ? 'Copied!' : 'Copy Template'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
