import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  Sparkles, 
  CheckCircle2, 
  Zap, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  BatteryCharging, 
  Receipt, 
  BarChart3, 
  Leaf 
} from 'lucide-react';

const ROUTE_META = {
  '/smart-charging': {
    title: 'Smart Charging & Adaptive Optimization',
    icon: Zap,
    stage: 'Stage 2',
    description: 'Dynamic load-shedding algorithms, departure-time based charging queues, and peak-shaving dispatch.',
    features: ['Real-time priority dispatch', 'Time-of-Use tariff minimization', 'Overload prevention throttling']
  },
  '/predictions': {
    title: 'AI Load & Solar Forecasting',
    icon: TrendingUp,
    stage: 'Stage 2',
    description: 'Machine learning prediction models for building energy demand, EV arrival likelihood, and next-day solar irradiance.',
    features: ['24-hour ahead building load prediction', 'Weather-correlated solar forecast', 'EV occupancy modeling']
  },
  '/alerts': {
    title: 'Fault Diagnostics & Alarm Dispatch',
    icon: AlertTriangle,
    stage: 'Stage 2',
    description: 'Central event streaming for ground faults, grid contract warnings, and charger communication drops.',
    features: ['Automated SMS/Email notifications', 'Severity escalation rules', 'Historical fault audit logs']
  },
  '/charger-health': {
    title: 'Charger Fleet Health & Diagnostics',
    icon: BatteryCharging,
    stage: 'Stage 2',
    description: 'Hardware health scores, connector thermals, voltage variance tracking, and predictive maintenance schedules for 20 bays.',
    features: ['Component degradation scores', 'OCPP 2.0.1 status metrics', 'Automated vendor dispatch']
  },
  '/what-if': {
    title: 'What-If Infrastructure Simulator',
    icon: Sparkles,
    stage: 'Stage 2',
    description: 'Simulate adding 50 more EVs, double solar array to 80 kW, or adding an on-site battery storage system (BESS).',
    features: ['Battery Energy Storage (BESS) sizing', 'Fleet expansion stress test', 'Transformer upgrade ROI calculator']
  },
  '/electricity-bill': {
    title: 'Utility Tariff & Billing Analytics',
    icon: Receipt,
    stage: 'Stage 2',
    description: 'Real-time billing calculations, demand charge mitigation, and tenant energy sub-metering breakdown.',
    features: ['Time-of-Use cost tracking', 'Tenant sub-billing generator', 'Peak demand charge savings']
  },
  '/analytics': {
    title: 'Historical Efficiency & Executive Analytics',
    icon: BarChart3,
    stage: 'Stage 2',
    description: 'Multi-month telemetry trends, seasonal demand shifts, charger utilization rates, and carbon accounting.',
    features: ['Exportable CSV/PDF reports', 'Year-over-year efficiency KPIs', 'Contract capacity utilization']
  },
  '/sustainability': {
    title: 'ESG & Clean Energy Reporting',
    icon: Leaf,
    stage: 'Stage 2',
    description: 'Scope 2 emission reductions, renewable energy fractions, and sustainability certification exports.',
    features: ['Avoided metric tons of CO2', 'Clean energy certificate tracking', 'Green building compliance']
  }
};

export default function PlaceholderPage() {
  const location = useLocation();
  const meta = ROUTE_META[location.pathname] || {
    title: 'Advanced Module',
    icon: Sparkles,
    stage: 'Stage 2',
    description: 'This feature is scheduled for Stage 2 implementation.',
    features: ['Advanced optimization logic', 'Extended cloud services']
  };

  const Icon = meta.icon;

  return (
    <div className="placeholder-page" style={{ maxWidth: '800px', margin: '2rem auto', textAlign: 'center' }}>
      <div className="card" style={{ padding: '3rem 2rem', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(6, 182, 212, 0.1)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#38bdf8',
          marginBottom: '1.25rem'
        }}>
          <Icon size={32} />
        </div>

        <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.3)', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.75rem' }}>
          {meta.stage} UPCOMING MODULE
        </div>

        <h1 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.75rem' }}>
          {meta.title}
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '550px', margin: '0 auto 2rem auto', lineHeight: '1.6' }}>
          {meta.description}
        </p>

        {/* Feature List Preview */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          maxWidth: '500px',
          margin: '0 auto 2rem auto',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Planned Stage 2 Architecture:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {meta.features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <Link to="/dashboard" className="btn btn-primary">
            <span>Return to Live Dashboard</span>
          </Link>
          <Link to="/simulation" className="btn">
            <span>Open Simulation Controls</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
