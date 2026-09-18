import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSystemState } from '../../hooks/useSystemState';
import { 
  Sparkles, 
  Play, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Sun, 
  Flame, 
  Receipt, 
  Leaf, 
  X,
  Zap,
  Car
} from 'lucide-react';

const DEMO_STEPS = [
  {
    step: 1,
    title: '1. Baseline Normal Operation',
    targetRoute: '/dashboard',
    scenarioName: 'Normal Operation',
    tagline: 'Grid 100 kW • Building 61 kW • EV 18 kW • Solar 27 kW',
    explanation: 'System begins in steady state morning operations. Solar PV generates clean power directly offsetting building base loads, with 8 EVs charging smoothly within safe grid capacity margins.',
    expectedMetrics: 'Total Grid Load: ~52 kW net (well below 100 kW limit). Transformer at ~58°C nominal.',
    actionLabel: 'Set Baseline (Normal)'
  },
  {
    step: 2,
    title: '2. Evening EV Rush Hour',
    targetRoute: '/smart-charging',
    scenarioName: 'EV Rush',
    tagline: '18 EVs Plug In Concurrently — Grid Stays Protected',
    explanation: 'Simulates 18 EVs arriving simultaneously. Without smart charging, aggregate demand would blow past 130 kW, causing substation tripping. SmartCharge Grid optimizer engages instantly: urgent vehicles maintain fast charging while flexible commuters throttle to preserve grid headroom.',
    expectedMetrics: 'Grid stays clamped at <= 92 kW safe capacity. Zero breaker trips. Urgent departure SOCs protected.',
    actionLabel: 'Trigger EV Rush Scenario'
  },
  {
    step: 3,
    title: '3. Solar Peak Surplus',
    targetRoute: '/solar',
    scenarioName: 'Solar Peak',
    tagline: 'Rooftop PV Surges to 38+ kW — Clean Charging Maximized',
    explanation: 'Rooftop solar irradiance peaks at midday. The optimizer detects clean power surplus and dynamically boosts charging rates for flexible parked EVs, turning EV batteries into a virtual energy sink and avoiding wasted solar curtailment.',
    expectedMetrics: '100% of generated solar absorbed on-site. EV renewable fraction reaches 84%.',
    actionLabel: 'Trigger Solar Peak Scenario'
  },
  {
    step: 4,
    title: '4. Critical Grid Overload & Emergency Mode',
    targetRoute: '/dashboard',
    scenarioName: 'Grid Overload',
    tagline: 'Building Demand Surges — Emergency Mode Sheds Flexible Loads',
    explanation: 'Severe HVAC/building demand surge pushes total load toward substation danger limits (>95%). The optimizer trips into Emergency Mode: flexible EV charging is immediately halted in <1 second while critical low-SOC vehicles are protected.',
    expectedMetrics: 'Transformer thermal overload prevented. System recovers to safe operating margins.',
    actionLabel: 'Trigger Grid Overload Scenario'
  },
  {
    step: 5,
    title: '5. Financial Proof: Electricity Bill & Savings',
    targetRoute: '/electricity-bill',
    scenarioName: null,
    tagline: 'Without Smart Charging: ₹9,200 vs With Smart Charging: ₹7,500',
    explanation: 'Direct financial demonstration for facility owners. Time-of-use tariff shifting, peak demand avoidance, and solar self-consumption combine to generate ₹1,700/month (18%) in bottom-line energy savings.',
    expectedMetrics: 'Estimated Bill: ₹7,500 vs ₹9,200 unmanaged. Savings: ₹1,700.',
    actionLabel: 'Inspect Electricity Bill'
  },
  {
    step: 6,
    title: '6. Environmental Proof: Sustainability & ESG',
    targetRoute: '/sustainability',
    scenarioName: null,
    tagline: 'Solar Used: 412 kWh • Avoided Emissions: 121+ kg CO₂',
    explanation: 'Verified Scope 2 carbon accounting. Shows verified kilowatt-hours of solar channeled into EV batteries, peak demand reduction of 18%, and equivalent mature trees planted.',
    expectedMetrics: 'Avoided CO₂: 121 kg. Peak Reduction: 18%. Smart Charging Fleet: 84%.',
    actionLabel: 'Inspect Sustainability KPIs'
  }
];

export default function DemoTourModal({ isOpen, onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { controls } = useSystemState();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const currentStep = DEMO_STEPS[currentStepIndex];

  const handleExecuteStep = () => {
    if (currentStep.scenarioName) {
      controls.triggerScenario(currentStep.scenarioName);
    }
    if (currentStep.targetRoute) {
      navigate(currentStep.targetRoute);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < DEMO_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const next = DEMO_STEPS[nextIdx];
      if (next.scenarioName) controls.triggerScenario(next.scenarioName);
      if (next.targetRoute) navigate(next.targetRoute);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      const prev = DEMO_STEPS[prevIdx];
      if (prev.scenarioName) controls.triggerScenario(prev.scenarioName);
      if (prev.targetRoute) navigate(prev.targetRoute);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '1rem'
    }}>
      <div className="card" style={{
        maxWidth: '680px',
        width: '100%',
        padding: '2rem',
        background: 'radial-gradient(ellipse at top, rgba(6, 182, 212, 0.15), rgba(15, 23, 42, 0.98))',
        border: '1.5px solid #06b6d4',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} color="#38bdf8" />
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Hackathon Judge Presentation Mode (Step {currentStep.step} of 6)
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Step Progress Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {DEMO_STEPS.map((s, i) => (
            <div
              key={s.step}
              onClick={() => {
                setCurrentStepIndex(i);
                if (s.scenarioName) controls.triggerScenario(s.scenarioName);
                if (s.targetRoute) navigate(s.targetRoute);
              }}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                background: i <= currentStepIndex ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            />
          ))}
        </div>

        {/* Step Content */}
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f8fafc', marginBottom: '0.4rem' }}>
            {currentStep.title}
          </h2>
          <div className="mono" style={{ fontSize: '0.85rem', fontWeight: '700', color: '#facc15', marginBottom: '1rem' }}>
            {currentStep.tagline}
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.25rem' }}>
            {currentStep.explanation}
          </p>

          <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', fontSize: '0.8rem', color: '#34d399', marginBottom: '1.5rem' }}>
            <strong>Expected Demonstration Effect:</strong> {currentStep.expectedMetrics}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="btn btn-sm"
            style={{ opacity: currentStepIndex === 0 ? 0.4 : 1 }}
          >
            <ArrowLeft size={14} />
            <span>Previous</span>
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleExecuteStep}
              className="btn btn-sm"
              style={{ borderColor: '#06b6d4', color: '#38bdf8' }}
            >
              <Play size={14} />
              <span>{currentStep.actionLabel}</span>
            </button>

            <button
              onClick={handleNext}
              className="btn btn-sm btn-primary"
            >
              <span>{currentStepIndex === DEMO_STEPS.length - 1 ? 'Finish Presentation' : 'Next Step'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
