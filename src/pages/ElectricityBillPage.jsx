import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSystemState } from '../hooks/useSystemState';
import { calculateBilling, getTodayCostSummary, getHistoricalBills } from '../services/billingService';
import { getOrgConfig } from '../data/organizationConfig';
import { 
  Receipt, 
  Calendar, 
  Clock, 
  Zap, 
  Building2, 
  Car, 
  Sun, 
  TrendingDown, 
  ShieldCheck, 
  AlertCircle, 
  Sliders, 
  Printer, 
  Download, 
  IndianRupee,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line 
} from 'recharts';

export default function ElectricityBillPage() {
  const systemState = useSystemState();
  const { tariffSettings, organizationMode } = systemState;
  const org = getOrgConfig(organizationMode);

  // Dynamic calculations based on current simulation state and user tariff
  const bill = useMemo(() => {
    return calculateBilling(systemState, tariffSettings);
  }, [systemState, tariffSettings]);

  const todayCost = useMemo(() => {
    return getTodayCostSummary(systemState, tariffSettings);
  }, [systemState, tariffSettings]);

  const historicalBills = useMemo(() => {
    return getHistoricalBills(bill);
  }, [bill]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="electricity-bill-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
      {/* Header with Mode & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Utility & Energy Electricity Bill</h1>
            <span className="badge badge-info" style={{ textTransform: 'none', fontSize: '0.78rem' }}>
              {bill.badge}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Facility sub-metering breakdown and time-of-use cost optimization for <strong>{org.name}</strong> ({org.unitsLabel}).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={handlePrint} className="btn btn-sm" title="Print statement">
            <Printer size={15} />
            <span>Print Bill</span>
          </button>
          <Link to="/settings" className="btn btn-sm btn-primary">
            <Sliders size={15} />
            <span>Configure Tariff</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Highlights Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        {/* CURRENT ESTIMATED BILL */}
        <div className="card" style={{ border: '1px solid rgba(16, 185, 129, 0.4)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.04))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Current Estimated Bill
            </span>
            <Receipt size={18} color="#34d399" />
          </div>
          <div className="mono" style={{ fontSize: '2rem', fontWeight: '900', color: '#10b981' }}>
            {bill.currency}{bill.estimatedBill.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={13} color="#10b981" />
            <span>Status: <strong>{bill.paymentStatus}</strong></span>
          </div>
        </div>

        {/* ESTIMATED SAVINGS */}
        <div className="card" style={{ border: '1px solid rgba(6, 182, 212, 0.4)', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(59, 130, 246, 0.04))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Smart Charging Savings
            </span>
            <TrendingDown size={18} color="#38bdf8" />
          </div>
          <div className="mono" style={{ fontSize: '2rem', fontWeight: '900', color: '#38bdf8' }}>
            {bill.currency}{bill.comparison.estimatedSavings.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            <strong>{bill.comparison.savingsPercent}% cost reduction</strong> via off-peak & solar shifting
          </div>
        </div>

        {/* TOTAL CONSUMPTION */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Consumption
            </span>
            <Zap size={18} color="#facc15" />
          </div>
          <div className="mono" style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {bill.totalConsumption}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Billing Period: <strong>{bill.billingPeriod}</strong>
          </div>
        </div>

        {/* DUE DATE */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Payment Due Date
            </span>
            <Calendar size={18} color="#a855f7" />
          </div>
          <div className="mono" style={{ fontSize: '1.6rem', fontWeight: '800', color: '#c084fc' }}>
            {bill.dueDate}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Account: <code>{bill.accountNumber}</code>
          </div>
        </div>
      </div>

      {/* Main Billing Comparison Section: With vs Without Smart Charging */}
      <div className="card" style={{ padding: '1.5rem', background: 'radial-gradient(ellipse at top right, rgba(6, 182, 212, 0.1), rgba(15, 23, 42, 0.95))' }}>
        <div className="card-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <span className="card-title" style={{ fontSize: '1.1rem' }}>Smart Charging Impact Analysis</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Deterministic financial comparison between uncoordinated peak charging and SmartCharge Grid optimizer.
            </div>
          </div>
          <span className="badge badge-success" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            Save {bill.currency}{bill.comparison.estimatedSavings.toLocaleString('en-IN')} This Month
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
          {/* WITHOUT SMART CHARGING */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#f87171', letterSpacing: '0.05em' }}>
                WITHOUT SMART CHARGING
              </span>
            </div>
            <div className="mono" style={{ fontSize: '2.2rem', fontWeight: '900', color: '#f87171', marginBottom: '0.5rem' }}>
              {bill.currency}{bill.comparison.withoutSmartCharging.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              All {systemState.totalEvCount} EVs charge simultaneously on arrival during evening high-demand tariffs (peak demand penalty applied).
            </div>
          </div>

          {/* WITH SMART CHARGING */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '2px solid rgba(16, 185, 129, 0.5)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            position: 'relative'
          }}>
            <div style={{ position: 'absolute', top: '-10px', right: '15px', background: '#10b981', color: '#000', fontSize: '0.68rem', fontWeight: '800', padding: '0.15rem 0.6rem', borderRadius: '999px' }}>
              ACTIVE SYSTEM
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#34d399', letterSpacing: '0.05em' }}>
                WITH SMART CHARGING
              </span>
            </div>
            <div className="mono" style={{ fontSize: '2.2rem', fontWeight: '900', color: '#10b981', marginBottom: '0.5rem' }}>
              {bill.currency}{bill.comparison.withSmartCharging.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Charging loads throttled during building peaks and shifted to off-peak slots and 40 kWp solar window.
            </div>
          </div>

          {/* ESTIMATED SAVINGS CARD */}
          <div style={{
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <TrendingDown size={18} color="#38bdf8" />
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#38bdf8', letterSpacing: '0.05em' }}>
                ESTIMATED SAVINGS
              </span>
            </div>
            <div className="mono" style={{ fontSize: '2.2rem', fontWeight: '900', color: '#38bdf8', marginBottom: '0.5rem' }}>
              {bill.currency}{bill.comparison.estimatedSavings.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Direct savings realized this billing cycle without compromising any EV departure target SOC.
            </div>
          </div>
        </div>
      </div>

      {/* Main Breakdown & Formal Statement */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Itemized Energy Cost Breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Main Cost Breakdown</span>
            <span className="badge badge-info">Calculated from Telemetry</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            {/* Building Consumption */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Building2 size={18} color="#38bdf8" />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>Building Consumption</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>HVAC, base load, lighting</div>
                </div>
              </div>
              <div className="mono" style={{ fontWeight: '700', fontSize: '1rem', color: '#f8fafc' }}>
                {bill.currency}{bill.breakdown.buildingConsumption.toLocaleString('en-IN')}
              </div>
            </div>

            {/* EV Charging */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Car size={18} color="#34d399" />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>EV Charging</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{systemState.totalEvCount} fleet & tenant vehicles</div>
                </div>
              </div>
              <div className="mono" style={{ fontWeight: '700', fontSize: '1rem', color: '#34d399' }}>
                {bill.currency}{bill.breakdown.evCharging.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Solar Offset */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(250, 204, 21, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(250, 204, 21, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Sun size={18} color="#facc15" />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.85rem', color: '#fde047' }}>Solar Offset</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Self-consumed clean energy</div>
                </div>
              </div>
              <div className="mono" style={{ fontWeight: '700', fontSize: '1rem', color: '#facc15' }}>
                -{bill.currency}{Math.abs(bill.breakdown.solarOffset).toLocaleString('en-IN')}
              </div>
            </div>

            {/* Fixed Charges & Taxes Sub-items */}
            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Substation Fixed Demand Charge</span>
                <span className="mono">{bill.currency}{bill.fixedCharges}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Electricity Duty & Tax ({(bill.tariff.taxRate * 100).toFixed(0)}%)</span>
                <span className="mono">{bill.currency}{bill.taxes}</span>
              </div>
            </div>

            {/* Final Estimated Bill Line */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              background: 'rgba(16, 185, 129, 0.12)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(16, 185, 129, 0.4)'
            }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#f8fafc' }}>Estimated Bill</div>
                <div style={{ fontSize: '0.72rem', color: '#34d399' }}>Total Payable Amount</div>
              </div>
              <div className="mono" style={{ fontWeight: '900', fontSize: '1.5rem', color: '#10b981' }}>
                {bill.currency}{bill.estimatedBill.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Today's Real-Time Cost Summary Card (Requirement #2) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Today's Real-Time Cost Summary</span>
            <span className="badge badge-warning">Simulated Day</span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Instantaneous cost rate derived from current active power telemetry × active Time-of-Use tariff.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ACTIVE TOU TARIFF</div>
              <div className="mono" style={{ fontSize: '1.3rem', fontWeight: '800', color: '#38bdf8' }}>
                {bill.currency}{todayCost.currentRate.toFixed(2)} <span style={{ fontSize: '0.75rem' }}>/kWh</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Time: {systemState.simTime}
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NET HOURLY RUN RATE</div>
              <div className="mono" style={{ fontSize: '1.3rem', fontWeight: '800', color: '#facc15' }}>
                {bill.currency}{todayCost.netCostPerHour} <span style={{ fontSize: '0.75rem' }}>/hr</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#34d399', marginTop: '0.2rem' }}>
                Solar offset: -{bill.currency}{todayCost.solarSavingsPerHour}/hr
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TODAY'S CUMULATIVE COST</div>
              <div className="mono" style={{ fontSize: '1.3rem', fontWeight: '800', color: '#f8fafc' }}>
                {bill.currency}{todayCost.todayTotalCost.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Elapsed: {systemState.simHour} hours
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.7rem', color: '#34d399' }}>TODAY'S SMART SAVINGS</div>
              <div className="mono" style={{ fontSize: '1.3rem', fontWeight: '800', color: '#10b981' }}>
                {bill.currency}{todayCost.todaySmartSavings.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#34d399', marginTop: '0.2rem' }}>
                Peak tariff avoidance
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <strong>Tariff Schedule:</strong> Off-Peak (22:00–08:00) @ {bill.currency}{bill.tariff.offPeakRate}/kWh • Mid-Peak (08:00–17:00) @ {bill.currency}{bill.tariff.midPeakRate}/kWh • Peak (17:00–21:00) @ {bill.currency}{bill.tariff.peakRate}/kWh.
          </div>
        </div>
      </div>

      {/* Bill History Trend Chart (Requirement #3) */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={18} className="text-cyan" />
            <span className="card-title">Historical Bill & Savings Trend (Last 5 Months)</span>
          </div>
          <span className="badge badge-info">5-Month Trend</span>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Demonstrates progressive cost reductions as smart charging algorithms and solar integration matured.
        </p>

        <div style={{ width: '100%', height: '300px', marginTop: '1rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={historicalBills} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit={` ${bill.currency}`} domain={[0, 12000]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#111827', 
                  border: '1px solid rgba(255, 255, 255, 0.15)', 
                  borderRadius: '8px', 
                  fontSize: '0.8rem',
                  color: '#f8fafc'
                }} 
                formatter={(val) => [`${bill.currency}${val.toLocaleString('en-IN')}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '10px' }} />
              <Bar dataKey="withoutSmart" name="Without Smart Charging" fill="#ef4444" opacity={0.4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="amount" name="Actual Bill (With Smart Charging)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="savings" name="Optimizer Savings" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Historical Summary Table */}
        <div style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '0.6rem 0.5rem' }}>Billing Month</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Total Consumption</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Without Smart</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>With Smart Charging</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Estimated Savings</th>
                <th style={{ padding: '0.6rem 0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {historicalBills.map((h, i) => (
                <tr key={h.month} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', background: h.isCurrent ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: h.isCurrent ? '700' : '500' }}>
                    {h.month} 2026 {h.isCurrent && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Current</span>}
                  </td>
                  <td className="mono" style={{ padding: '0.6rem 0.5rem' }}>{h.consumption} kWh</td>
                  <td className="mono" style={{ padding: '0.6rem 0.5rem', color: '#f87171' }}>{bill.currency}{h.withoutSmart.toLocaleString('en-IN')}</td>
                  <td className="mono" style={{ padding: '0.6rem 0.5rem', color: '#34d399', fontWeight: '700' }}>{bill.currency}{h.amount.toLocaleString('en-IN')}</td>
                  <td className="mono" style={{ padding: '0.6rem 0.5rem', color: '#38bdf8', fontWeight: '700' }}>+{bill.currency}{h.savings.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <span className={`badge badge-${h.isCurrent ? 'warning' : 'success'}`} style={{ fontSize: '0.68rem' }}>
                      {h.isCurrent ? 'Due Oct 15' : 'Paid in Full'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
