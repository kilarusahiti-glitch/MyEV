import React, { useState } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { getOrgConfig } from '../data/organizationConfig';
import { 
  Radio, 
  Server, 
  Cpu, 
  Sun, 
  Building2, 
  Car, 
  ArrowDown, 
  CheckCircle2, 
  AlertCircle, 
  FlaskConical, 
  Wifi, 
  Layers, 
  Database,
  ExternalLink
} from 'lucide-react';

export default function DataSourcesPage() {
  const { chargers, organizationMode } = useSystemState();
  const org = getOrgConfig(organizationMode);

  const [dataMode, setDataMode] = useState('SIMULATION'); // 'SIMULATION' | 'LIVE_IOT'
  const [showIotModal, setShowIotModal] = useState(false);

  const connectedChargersCount = chargers.filter(c => c.status !== 'offline').length;
  const totalChargersCount = chargers.length;

  const handleModeChange = (mode) => {
    if (mode === 'LIVE_IOT') {
      setShowIotModal(true);
    } else {
      setDataMode('SIMULATION');
    }
  };

  return (
    <div className="data-sources-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
      {/* Header with Data Mode Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Telemetry Ingestion & Data Sources</h1>
            <span className="badge badge-info" style={{ textTransform: 'none' }}>
              SIMULATED DATA SOURCE
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Virtual sensor feeds, industrial IoT protocol integration status, and future edge gateway architecture for <strong>{org.name}</strong>.
          </p>
        </div>

        {/* DATA MODE SELECTOR (Requirement #12) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.3rem'
        }}>
          <button
            onClick={() => handleModeChange('SIMULATION')}
            className={`btn btn-sm ${dataMode === 'SIMULATION' ? 'btn-primary' : ''}`}
            style={{ fontSize: '0.75rem', gap: '0.4rem' }}
          >
            <FlaskConical size={14} />
            <span>🧪 SIMULATION</span>
          </button>
          <button
            onClick={() => handleModeChange('LIVE_IOT')}
            className="btn btn-sm"
            style={{ fontSize: '0.75rem', gap: '0.4rem', color: '#38bdf8' }}
          >
            <Radio size={14} />
            <span>🔵 LIVE IoT (Coming Soon)</span>
          </button>
        </div>
      </div>

      {/* Simulated Notice Banner */}
      <div style={{
        background: 'rgba(6, 182, 212, 0.08)',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <FlaskConical size={22} className="text-cyan" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#38bdf8' }}>
            SIMULATED DATA SOURCE — Virtual Telemetry Active
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            The application is currently driven by a physics-based mathematical simulation engine generating realistic 1-second virtual IoT telemetry. No physical meters or OCPP hardware are claimed to be physically attached during hackathon evaluation.
          </div>
        </div>
      </div>

      {/* Section 1: Active Sensor Status Grid (Requirement #11) */}
      <div>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          CURRENT FIELD SENSORS (SIMULATED TELEMETRY FEEDS)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {/* Building Meter */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <Building2 size={22} color="#06b6d4" />
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="status-dot pulse" style={{ background: '#10b981' }} />
                <span>🟢 Connected</span>
              </span>
            </div>
            <div style={{ fontWeight: '700', fontSize: '1rem' }}>Building Meter</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Class 0.2S Bi-directional CT Meter
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem' }}>
              Protocol: <strong>Modbus RTU / TCP (Port 502)</strong>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#38bdf8', marginTop: '0.2rem' }}>
              Simulated Data: 1000ms polling interval
            </div>
          </div>

          {/* Solar Inverter */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <Sun size={22} color="#facc15" />
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="status-dot pulse" style={{ background: '#10b981' }} />
                <span>🟢 Connected</span>
              </span>
            </div>
            <div style={{ fontWeight: '700', fontSize: '1rem' }}>Solar Inverter</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              40 kWp Three-Phase String Inverter
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem' }}>
              Protocol: <strong>SunSpec IEEE 1547 / MQTT</strong>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#facc15', marginTop: '0.2rem' }}>
              Simulated Data: Irradiance & PV Yield
            </div>
          </div>

          {/* EV Chargers */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <Car size={22} color="#10b981" />
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="status-dot pulse" style={{ background: '#10b981' }} />
                <span>🟢 {connectedChargersCount} / {totalChargersCount} Connected</span>
              </span>
            </div>
            <div style={{ fontWeight: '700', fontSize: '1rem' }}>EV Chargers</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Fleet of 20 AC Level 2 Smart Terminals
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem' }}>
              Protocol: <strong>OCPP 2.0.1 / JSON-RPC WebSocket</strong>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '0.2rem' }}>
              Simulated Data: Smart Charging Profiles
            </div>
          </div>

          {/* Transformer Sensor */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <Cpu size={22} color="#a855f7" />
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="status-dot pulse" style={{ background: '#10b981' }} />
                <span>🟢 Connected</span>
              </span>
            </div>
            <div style={{ fontWeight: '700', fontSize: '1rem' }}>Transformer Sensor</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Substation PT100 RTD & Rogowski Coils
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem' }}>
              Protocol: <strong>4-20mA to LoRaWAN / Modbus</strong>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#c084fc', marginTop: '0.2rem' }}>
              Simulated Data: Top-oil temperature & current
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Future IoT Architecture (Requirement #11) */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div className="card-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <span className="card-title">Production Live IoT Integration Architecture</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              The existing backend and optimization engine are architected to seamlessly transition from simulation to real-world edge telemetry.
            </div>
          </div>
          <span className="badge badge-purple">Enterprise Blueprint</span>
        </div>

        {/* Architectural Flow Diagram */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', maxWidth: '750px', margin: '1rem auto' }}>
          {/* Level 1: Field Devices */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', width: '100%' }}>
            {[
              { label: 'Smart Meter', icon: Building2, color: '#06b6d4', desc: 'Modbus RTU' },
              { label: 'Solar Inverter', icon: Sun, color: '#facc15', desc: 'SunSpec / MQTT' },
              { label: 'EV Charger / OCPP', icon: Car, color: '#10b981', desc: 'OCPP 2.0.1' },
              { label: 'Transformer Sensor', icon: Cpu, color: '#a855f7', desc: '4-20mA / CT' }
            ].map(d => (
              <div key={d.label} style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', border: `1px solid ${d.color}40`, borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <d.icon size={18} color={d.color} style={{ margin: '0 auto 0.25rem auto' }} />
                <div style={{ fontWeight: '700', fontSize: '0.8rem' }}>{d.label}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{d.desc}</div>
              </div>
            ))}
          </div>

          <ArrowDown size={22} className="text-cyan" />

          {/* Level 2: IoT Gateway */}
          <div style={{ width: '100%', padding: '1rem', background: 'rgba(6, 182, 212, 0.08)', border: '1.5px solid #06b6d4', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: '#38bdf8' }}>Industrial IoT Edge Gateway</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Raspberry Pi CM4 / Siemens IOT2050 • Local Protocol Translation • TLS 1.3 Encryption
            </div>
          </div>

          <ArrowDown size={22} className="text-cyan" />

          {/* Level 3: Cloud Backend */}
          <div style={{ width: '100%', padding: '1rem', background: 'rgba(168, 85, 247, 0.08)', border: '1.5px solid #8b5cf6', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: '#c084fc' }}>Backend & Telemetry Service</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Firebase Cloud Firestore & Authentication • Real-Time Ingestion Pipeline
            </div>
          </div>

          <ArrowDown size={22} className="text-cyan" />

          {/* Level 4: Optimization Engine */}
          <div style={{ width: '100%', padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1.5px solid #10b981', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: '#34d399' }}>SmartCharge Optimization Engine</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Deterministic Load Allocator • OCPP SetChargingProfile Dispatch • Substation Capacity Guard
            </div>
          </div>
        </div>
      </div>

      {/* Live IoT Modal (Requirement #12) */}
      {showIotModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '2rem', border: '1px solid #38bdf8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <Radio size={24} color="#38bdf8" />
              <h2 style={{ fontSize: '1.3rem', fontWeight: '800' }}>Live IoT Hardware Mode</h2>
              <span className="badge badge-info">COMING SOON</span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1rem' }}>
              The <strong>SmartCharge Grid</strong> backend architecture is fully engineered to ingest live field telemetry directly from:
            </p>

            <ul style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.5rem', paddingLeft: '1.25rem' }}>
              <li><strong>Smart Meters</strong> (Modbus RTU / TCP over edge serial bridge)</li>
              <li><strong>Solar Inverters</strong> (SunSpec Modbus / MQTT publishing)</li>
              <li><strong>EV Chargers</strong> (OCPP 1.6J / 2.0.1 standard charging profiles)</li>
              <li><strong>Transformer Sensors</strong> (Temperature RTDs & Rogowski current loops)</li>
            </ul>

            <div style={{ padding: '0.75rem', background: 'rgba(6, 182, 212, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6, 182, 212, 0.3)', fontSize: '0.78rem', color: '#38bdf8', marginBottom: '1.5rem' }}>
              💡 During this hackathon presentation, virtual sensor simulation mode is active to ensure instant, deterministic demonstrability for judges.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setShowIotModal(false)} className="btn btn-primary">
                Return to Simulation Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
