import React from 'react';
import { Zap, Sun, Building2, Car, Cpu, ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import './PowerFlow.css';

export default function PowerFlow({ 
  gridLimit = 100,
  buildingLoad = 61,
  evLoad = 18,
  solarGeneration = 27,
  transformerLoad = 76,
  totalLoad = 79,
  remainingCapacity = 21,
  gridUtilization = 79
}) {
  const netGridImport = Math.max(0, Number((totalLoad - solarGeneration).toFixed(1)));
  const solarSelfConsumption = Math.min(solarGeneration, totalLoad);
  const excessSolar = Math.max(0, Number((solarGeneration - totalLoad).toFixed(1)));

  // Calculate flow speeds / animation active states
  const hasGridFlow = netGridImport > 1;
  const hasSolarFlow = solarGeneration > 1;
  const hasBuildingFlow = buildingLoad > 1;
  const hasEvFlow = evLoad > 1;

  const getTransformerColor = () => {
    if (transformerLoad >= 95) return 'var(--danger)';
    if (transformerLoad >= 85) return 'var(--warning)';
    return 'var(--transformer)';
  };

  return (
    <div className="power-flow-container card">
      <div className="card-header">
        <div className="flow-title-group">
          <Zap size={18} className="text-cyan" />
          <span className="card-title">Live Microgrid Power Distribution Flow</span>
        </div>
        <div className="flow-header-metrics">
          <div className="flow-badge">
            <span className="mono text-cyan">{totalLoad} kW</span>
            <span className="flow-sub">Total Load</span>
          </div>
          <div className="flow-badge">
            <span className="mono text-emerald">{solarGeneration} kW</span>
            <span className="flow-sub">Solar Gen</span>
          </div>
          <div className="flow-badge">
            <span className="mono text-blue">{netGridImport} kW</span>
            <span className="flow-sub">Net Grid Import</span>
          </div>
        </div>
      </div>

      {/* Interactive Power Diagram */}
      <div className="power-flow-canvas">
        {/* TOP ROW: Generation & Sources */}
        <div className="flow-tier flow-sources">
          {/* Grid Utility Node */}
          <div className="flow-node node-grid">
            <div className="node-icon-wrapper icon-grid">
              <Zap size={22} />
            </div>
            <div className="node-content">
              <div className="node-title">MAIN GRID UTILITY</div>
              <div className="node-value mono">{netGridImport} <span className="node-unit">kW</span></div>
              <div className="node-meta">Contract Limit: {gridLimit} kW</div>
              <div className="node-bar-track">
                <div 
                  className="node-bar-fill fill-grid" 
                  style={{ width: `${Math.min(100, (netGridImport / gridLimit) * 100)}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Energy Summary Central Pill */}
          <div className="energy-bridge-indicator">
            <div className="bridge-pill">
              <span className="status-dot pulse" style={{ background: '#06b6d4' }} />
              <span>Real-Time Balance</span>
            </div>
            <div className="bridge-equation mono">
              {netGridImport}kW (Grid) + {solarGeneration}kW (Solar) = {totalLoad}kW
            </div>
          </div>

          {/* Solar PV Node */}
          <div className="flow-node node-solar">
            <div className="node-icon-wrapper icon-solar">
              <Sun size={22} />
            </div>
            <div className="node-content">
              <div className="node-title">ROOFTOP SOLAR PV</div>
              <div className="node-value mono text-solar">{solarGeneration} <span className="node-unit">kW</span></div>
              <div className="node-meta">Array Peak: 40 kWp</div>
              <div className="node-bar-track">
                <div 
                  className="node-bar-fill fill-solar" 
                  style={{ width: `${Math.min(100, (solarGeneration / 40) * 100)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* SVG Dynamic Flow Connectors */}
        <div className="flow-connectors-svg-wrapper">
          <svg className="flow-svg" viewBox="0 0 800 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="solarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#eab308" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="downstreamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Grid to Substation Line */}
            <path 
              d="M 180 10 L 180 60 L 400 60 L 400 110" 
              className={`flow-path path-grid ${hasGridFlow ? 'active-flow' : ''}`}
              fill="none" 
              stroke="url(#gridGradient)" 
              strokeWidth="4" 
            />

            {/* Solar to Substation Line */}
            <path 
              d="M 620 10 L 620 60 L 400 60 L 400 110" 
              className={`flow-path path-solar ${hasSolarFlow ? 'active-flow-solar' : ''}`}
              fill="none" 
              stroke="url(#solarGradient)" 
              strokeWidth="4" 
            />

            {/* Central Junction Marker */}
            <circle cx="400" cy="60" r="5" fill="#8b5cf6" className="junction-dot" />
          </svg>
        </div>

        {/* MIDDLE TIER: Transformer & Substation */}
        <div className="flow-tier flow-hub">
          <div className="flow-node node-transformer" style={{ borderColor: getTransformerColor() }}>
            <div className="node-icon-wrapper icon-transformer" style={{ color: getTransformerColor() }}>
              <Cpu size={24} />
            </div>
            <div className="node-content">
              <div className="node-title">BUILDING A SUBSTATION & TRANSFORMER</div>
              <div className="node-value mono" style={{ color: getTransformerColor() }}>
                {transformerLoad}% <span className="node-unit">LOAD</span>
              </div>
              <div className="node-meta">
                Capacity: 100 kVA • {transformerLoad >= 85 ? '⚠️ High Thermal Load' : '🟢 Nominal Operation'}
              </div>
            </div>
          </div>
        </div>

        {/* SVG Connectors to Consumers */}
        <div className="flow-connectors-svg-wrapper">
          <svg className="flow-svg" viewBox="0 0 800 100" preserveAspectRatio="none">
            {/* Transformer to Building */}
            <path 
              d="M 400 5 L 400 45 L 200 45 L 200 95" 
              className={`flow-path path-building ${hasBuildingFlow ? 'active-flow' : ''}`}
              fill="none" 
              stroke="#06b6d4" 
              strokeWidth="4" 
            />

            {/* Transformer to EVs */}
            <path 
              d="M 400 5 L 400 45 L 600 45 L 600 95" 
              className={`flow-path path-ev ${hasEvFlow ? 'active-flow-ev' : ''}`}
              fill="none" 
              stroke="#10b981" 
              strokeWidth="4" 
            />
          </svg>
        </div>

        {/* BOTTOM ROW: Sinks & Demands */}
        <div className="flow-tier flow-consumers">
          {/* Building Demand */}
          <div className="flow-node node-consumer node-building">
            <div className="node-icon-wrapper icon-building">
              <Building2 size={22} />
            </div>
            <div className="node-content">
              <div className="node-title">BUILDING DEMAND (HVAC & BASE)</div>
              <div className="node-value mono text-cyan">{buildingLoad} <span className="node-unit">kW</span></div>
              <div className="node-meta">{( (buildingLoad / totalLoad) * 100 ).toFixed(0)}% of total load</div>
              <div className="node-bar-track">
                <div 
                  className="node-bar-fill fill-building" 
                  style={{ width: `${Math.min(100, (buildingLoad / 100) * 100)}%` }} 
                />
              </div>
            </div>
          </div>

          {/* EV Charging Fleet */}
          <div className="flow-node node-consumer node-ev">
            <div className="node-icon-wrapper icon-ev">
              <Car size={22} />
            </div>
            <div className="node-content">
              <div className="node-title">EV CHARGING FLEET (20 BAYS)</div>
              <div className="node-value mono text-emerald">{evLoad} <span className="node-unit">kW</span></div>
              <div className="node-meta">{( (evLoad / totalLoad) * 100 ).toFixed(0)}% of total load</div>
              <div className="node-bar-track">
                <div 
                  className="node-bar-fill fill-ev" 
                  style={{ width: `${Math.min(100, (evLoad / 100) * 100)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
