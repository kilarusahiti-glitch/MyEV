import React, { useState } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { getOrgConfig } from '../data/organizationConfig';
import { 
  Zap, 
  Cpu, 
  Building2, 
  Car, 
  Sun, 
  Activity, 
  Thermometer, 
  ShieldCheck, 
  AlertTriangle, 
  Flame, 
  CheckCircle2, 
  Layers, 
  Info,
  Maximize2
} from 'lucide-react';

export default function DigitalTwinPage() {
  const {
    gridLimit,
    buildingLoad,
    evLoad,
    solarGeneration,
    totalLoad,
    remainingCapacity,
    gridUtilization,
    transformerLoad,
    transformerTemp,
    voltage,
    current,
    systemStatus,
    statusMessage,
    vehicles,
    chargers,
    organizationMode
  } = useSystemState();

  const org = getOrgConfig(organizationMode);

  const [selectedNode, setSelectedNode] = useState('TRANSFORMER'); // default inspect transformer

  // Node health color evaluation
  const getNodeStatus = (type) => {
    switch (type) {
      case 'GRID':
        if (gridUtilization >= 95) return { status: 'CRITICAL', color: '#ef4444', label: 'Overloaded' };
        if (gridUtilization >= 85) return { status: 'WARNING', color: '#f59e0b', label: 'Near Capacity' };
        return { status: 'NORMAL', color: '#10b981', label: 'Nominal' };
      
      case 'TRANSFORMER':
        if (transformerLoad >= 95 || transformerTemp >= 75) return { status: 'CRITICAL', color: '#ef4444', label: 'Thermal Warning' };
        if (transformerLoad >= 85 || transformerTemp >= 65) return { status: 'WARNING', color: '#f59e0b', label: 'Elevated Temp' };
        return { status: 'NORMAL', color: '#10b981', label: 'Optimal' };

      case 'SOLAR':
        if (solarGeneration > 20) return { status: 'NORMAL', color: '#10b981', label: 'High Yield' };
        if (solarGeneration > 5) return { status: 'NORMAL', color: '#facc15', label: 'Active' };
        return { status: 'NORMAL', color: '#64748b', label: 'Low/Night' };

      case 'BUILDING':
        return { status: 'NORMAL', color: '#06b6d4', label: 'Stable' };

      default:
        return { status: 'NORMAL', color: '#10b981', label: 'Online' };
    }
  };

  const gridStatus = getNodeStatus('GRID');
  const transformerStatus = getNodeStatus('TRANSFORMER');
  const solarStatus = getNodeStatus('SOLAR');
  const buildingStatus = getNodeStatus('BUILDING');

  const primaryEvs = vehicles.slice(0, 5);

  return (
    <div className="digital-twin-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Substation & Microgrid Digital Twin</h1>
            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="status-dot pulse" style={{ background: '#10b981' }} />
              <span>Real-Time State Mirror</span>
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Deterministic interactive topology of <strong>{org.name}</strong>. Node status reflects live telemetry and transformer diagnostics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399' }}>
            <span className="status-dot" style={{ background: '#10b981' }} /> Green = Normal
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fbbf24' }}>
            <span className="status-dot" style={{ background: '#f59e0b' }} /> Orange = Warning
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f87171' }}>
            <span className="status-dot" style={{ background: '#ef4444' }} /> Red = Critical
          </span>
        </div>
      </div>

      {/* Main Interactive Twin Container */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 360px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Graphical Topology Diagram */}
        <div className="card" style={{
          padding: '2rem',
          background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.95), rgba(10, 14, 23, 1))',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle Grid Background Pattern */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
            {/* Top Tier: GRID and SOLAR in parallel supply */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', width: '100%', maxWidth: '650px' }}>
              {/* GRID NODE */}
              <div 
                onClick={() => setSelectedNode('GRID')}
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: selectedNode === 'GRID' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: `2px solid ${selectedNode === 'GRID' ? '#3b82f6' : gridStatus.color}`,
                  boxShadow: `0 0 15px ${gridStatus.color}25`,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: `${gridStatus.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: gridStatus.color }}>
                    <Zap size={22} />
                  </div>
                </div>
                <div style={{ fontWeight: '800', fontSize: '1rem', color: '#f8fafc' }}>UTILITY GRID</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: '900', color: gridStatus.color, marginTop: '0.2rem' }}>
                  {totalLoad} kW
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ceiling: {gridLimit} kW ({gridUtilization}%)</div>
                <span className={`badge badge-${gridStatus.status === 'CRITICAL' ? 'danger' : gridStatus.status === 'WARNING' ? 'warning' : 'success'}`} style={{ marginTop: '0.5rem', fontSize: '0.68rem' }}>
                  {gridStatus.label}
                </span>
              </div>

              {/* SOLAR NODE */}
              <div 
                onClick={() => setSelectedNode('SOLAR')}
                style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: selectedNode === 'SOLAR' ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: `2px solid ${selectedNode === 'SOLAR' ? '#facc15' : solarStatus.color}`,
                  boxShadow: `0 0 15px ${solarStatus.color}25`,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: `${solarStatus.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: solarStatus.color }}>
                    <Sun size={22} />
                  </div>
                </div>
                <div style={{ fontWeight: '800', fontSize: '1rem', color: '#f8fafc' }}>SOLAR PV ARRAY</div>
                <div className="mono" style={{ fontSize: '1.25rem', fontWeight: '900', color: '#facc15', marginTop: '0.2rem' }}>
                  {solarGeneration} kW
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>40 kWp Rooftop System</div>
                <span className="badge badge-warning" style={{ marginTop: '0.5rem', fontSize: '0.68rem' }}>
                  {solarStatus.label}
                </span>
              </div>
            </div>

            {/* Vertical Flow Conduits */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '480px', height: '30px' }}>
              <div style={{ width: '2px', height: '100%', background: `linear-gradient(to bottom, ${gridStatus.color}, ${transformerStatus.color})`, margin: '0 auto' }} />
              <div style={{ width: '2px', height: '100%', background: `linear-gradient(to bottom, #facc15, #06b6d4)`, margin: '0 auto' }} />
            </div>

            {/* Mid Tier 1: TRANSFORMER NODE */}
            <div 
              onClick={() => setSelectedNode('TRANSFORMER')}
              style={{
                width: '100%',
                maxWidth: '420px',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: selectedNode === 'TRANSFORMER' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                border: `2px solid ${selectedNode === 'TRANSFORMER' ? '#a855f7' : transformerStatus.color}`,
                boxShadow: `0 0 15px ${transformerStatus.color}25`,
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: `${transformerStatus.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: transformerStatus.color }}>
                  <Cpu size={22} />
                </div>
              </div>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: '#f8fafc' }}>SUBSTATION TRANSFORMER</div>
              <div className="mono" style={{ fontSize: '1.25rem', fontWeight: '900', color: transformerStatus.color, marginTop: '0.2rem' }}>
                {transformerLoad}% Load • {transformerTemp.toFixed(1)}°C
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>100 kVA Step-down (11kV → 415V 3-Phase)</div>
              <span className={`badge badge-${transformerStatus.status === 'CRITICAL' ? 'danger' : transformerStatus.status === 'WARNING' ? 'warning' : 'success'}`} style={{ marginTop: '0.5rem', fontSize: '0.68rem' }}>
                {transformerStatus.label}
              </span>
            </div>

            {/* Vertical Flow Conduit to Building */}
            <div style={{ width: '2px', height: '30px', background: `linear-gradient(to bottom, ${transformerStatus.color}, #06b6d4)` }} />

            {/* Mid Tier 2: BUILDING MAIN DISTRIBUTION */}
            <div 
              onClick={() => setSelectedNode('BUILDING')}
              style={{
                width: '100%',
                maxWidth: '480px',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: selectedNode === 'BUILDING' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                border: `2px solid ${selectedNode === 'BUILDING' ? '#06b6d4' : '#06b6d4'}`,
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.25)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
                  <Building2 size={22} />
                </div>
              </div>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: '#f8fafc' }}>BUILDING MAIN FEEDER</div>
              <div className="mono" style={{ fontSize: '1.25rem', fontWeight: '900', color: '#38bdf8', marginTop: '0.2rem' }}>
                {buildingLoad} kW Base Load
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>HVAC, Lighting & Common Services</div>
              <span className="badge badge-info" style={{ marginTop: '0.5rem', fontSize: '0.68rem' }}>
                Nominal Dispatch
              </span>
            </div>

            {/* Branching Tree Conduits into EVs */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ width: '2px', height: '24px', background: '#06b6d4' }} />
              <div style={{ width: '85%', height: '2px', background: 'linear-gradient(to right, #10b981, #06b6d4, #10b981)' }} />
            </div>

            {/* Bottom Tier: EV Fleet Nodes (EV-01 to EV-05) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', width: '100%' }}>
              {primaryEvs.map((ev, i) => {
                const isSelected = selectedNode === ev.id;
                const charger = chargers.find(c => c.id === ev.chargerId);
                const isOffline = charger && charger.status === 'offline';
                const isCharging = ev.status === 'Charging' && !isOffline;

                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedNode(ev.id)}
                    style={{
                      padding: '0.85rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1.5px solid ${isSelected ? '#10b981' : isOffline ? '#ef4444' : isCharging ? '#10b981' : 'var(--border)'}`,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div className="mono" style={{ fontWeight: '800', fontSize: '0.9rem', color: '#f8fafc' }}>
                      {ev.id}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.chargerId}
                    </div>
                    <div className="mono" style={{ fontSize: '0.85rem', fontWeight: '700', color: isCharging ? '#34d399' : isOffline ? '#ef4444' : '#64748b', marginTop: '0.25rem' }}>
                      {isOffline ? 'OFFLINE' : isCharging ? `${ev.chargingPower} kW` : 'WAITING'}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#38bdf8', marginTop: '0.15rem' }}>
                      SOC: {Math.round(ev.currentSoc)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Real-Time Node Inspector Panel */}
        <div className="card" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(6, 182, 212, 0.4)' }}>
          <div className="card-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} className="text-cyan" />
              <span className="card-title">Node Telemetry Inspector</span>
            </div>
            <span className="badge badge-info">{selectedNode}</span>
          </div>

          {selectedNode === 'GRID' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>Utility Grid Substation</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>11 kV High-Tension (HT) Interconnect</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CURRENT LOAD</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8' }}>{totalLoad} kW</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>SAFE CEILING</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>{gridLimit} kW</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>LINE VOLTAGE</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#34d399' }}>{voltage} V</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>TOTAL CURRENT</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#facc15' }}>{current} A</div>
                </div>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '4px', background: `${gridStatus.color}15`, border: `1px solid ${gridStatus.color}40`, fontSize: '0.78rem' }}>
                <strong>Status:</strong> {statusMessage}
              </div>
            </div>
          )}

          {selectedNode === 'TRANSFORMER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>Oil-Immersed Transformer</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>100 kVA Step-Down Substation Asset</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>TRANSFORMER LOAD</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: transformerStatus.color }}>{transformerLoad}%</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>TOP-OIL TEMP</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: transformerTemp > 65 ? '#ef4444' : '#34d399' }}>{transformerTemp.toFixed(1)}°C</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>THERMAL MARGIN</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8' }}>{(100 - transformerLoad).toFixed(1)}%</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>FREQUENCY</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>50.0 Hz</div>
                </div>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '4px', background: `${transformerStatus.color}15`, border: `1px solid ${transformerStatus.color}40`, fontSize: '0.78rem' }}>
                <strong>Thermal Inertia Model:</strong> Real-time temperature calculations prevent catastrophic insulation degradation during concurrent EV fast charging sessions.
              </div>
            </div>
          )}

          {selectedNode === 'SOLAR' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>Solar Photovoltaic Inverter</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Rooftop Bifacial Array • SunSpec Protocol</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>ACTIVE GENERATION</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#facc15' }}>{solarGeneration} kW</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>NAMEPLATE RATING</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>40 kWp</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>INVERTER EFFICIENCY</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#34d399' }}>98.4%</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>EXPORT STATUS</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8' }}>Self-Consumed</div>
                </div>
              </div>
            </div>
          )}

          {selectedNode === 'BUILDING' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>Facility Base Load</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{org.unitsLabel} • Main Switchboard</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>BASE DEMAND</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#06b6d4' }}>{buildingLoad} kW</div>
                </div>
                <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>HVAC FRACTION</div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>52%</div>
                </div>
              </div>
            </div>
          )}

          {selectedNode.startsWith('EV-') && (() => {
            const ev = vehicles.find(v => v.id === selectedNode);
            const charger = ev ? chargers.find(c => c.id === ev.chargerId) : null;
            if (!ev) return null;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f8fafc' }}>{ev.name} ({ev.id})</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Bay: {ev.chargerId} • Priority: {ev.priority}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>ALLOCATED POWER</div>
                    <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#10b981' }}>{ev.chargingPower} kW</div>
                  </div>
                  <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>CURRENT / TARGET SOC</div>
                    <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8' }}>{Math.round(ev.currentSoc)}% / {ev.targetSoc}%</div>
                  </div>
                  <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>ENERGY NEEDED</div>
                    <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#facc15' }}>{ev.energyRequired} kWh</div>
                  </div>
                  <div style={{ padding: '0.65rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>DEPARTURE TIME</div>
                    <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#c084fc' }}>{ev.departureTime}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
