import React, { useState, useMemo } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import { getOrgConfig } from '../data/organizationConfig';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Car, 
  Zap, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Sun, 
  Moon,
  TrendingUp
} from 'lucide-react';

export default function ChargingCalendarPage() {
  const { vehicles, simHour, organizationMode } = useSystemState();
  const org = getOrgConfig(organizationMode);

  const [selectedDay, setSelectedDay] = useState('today'); // 'today' | 'tomorrow'

  // Construct structured hourly schedule from vehicles and expected arrivals
  const scheduleSlots = useMemo(() => {
    return [
      {
        time: '06:00 AM',
        hour: 6,
        type: 'departure',
        evs: vehicles.filter(v => v.id === 'EV-01' || v.departureTime === '06:00' || v.departureTime === '06:30'),
        label: 'Early Commuter Departures',
        expectedCount: 1,
        demandKw: 7.2,
        notes: 'EV-01 departure guaranteed (100% SOC target met).'
      },
      {
        time: '07:00 AM',
        hour: 7,
        type: 'departure',
        evs: vehicles.filter(v => v.id === 'EV-04' || v.departureTime === '07:00' || v.departureTime === '07:30'),
        label: 'Morning Rush Departures',
        expectedCount: 2,
        demandKw: 14.4,
        notes: 'EV-04 departing for airport route.'
      },
      {
        time: '08:00 AM',
        hour: 8,
        type: 'departure',
        evs: vehicles.filter(v => v.id === 'EV-07' || v.departureTime === '08:00' || v.departureTime === '08:30'),
        label: 'Peak Morning Departures',
        expectedCount: 3,
        demandKw: 21.6,
        notes: 'EV-07 and departmental shuttles departing.'
      },
      {
        time: '12:00 PM',
        hour: 12,
        type: 'solar-window',
        evs: vehicles.filter(v => v.status === 'Charging').slice(0, 4),
        label: 'Solar Peak Absorption Window',
        expectedCount: 6,
        demandKw: 28.0,
        notes: 'Flexible EVs ramped to absorb 35+ kW rooftop solar generation.'
      },
      {
        time: '06:00 PM',
        hour: 18,
        type: 'arrival',
        evs: vehicles.slice(0, 12),
        label: 'Evening Arrival Surge',
        expectedCount: 12,
        demandKw: 42.0,
        notes: '12 EVs expected — smart charging queue will prioritize low SOCs.'
      },
      {
        time: '07:00 PM',
        hour: 19,
        type: 'arrival',
        evs: vehicles.slice(0, 18),
        label: 'Peak Return & Charging Wave',
        expectedCount: 18,
        demandKw: 58.0,
        notes: '18 EVs expected — throttled during residential cooking peak.'
      },
      {
        time: '11:00 PM',
        hour: 23,
        type: 'off-peak',
        evs: vehicles.slice(0, 8),
        label: 'Off-Peak Night Charging Window',
        expectedCount: 8,
        demandKw: 36.0,
        notes: 'Lowest tariff slab (₹4.20/kWh) active. Heavy bulk charging resumes.'
      }
    ];
  }, [vehicles]);

  return (
    <div className="charging-calendar-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>EV Charging Demand Calendar</h1>
            <span className="badge badge-info">Departure & Arrival Schedule</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Predictive timeline of scheduled EV departures, expected return rushes, and optimized charging windows for <strong>{org.name}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`btn btn-sm ${selectedDay === 'today' ? 'btn-primary' : ''}`}
            onClick={() => setSelectedDay('today')}
          >
            Today's Schedule
          </button>
          <button 
            className={`btn btn-sm ${selectedDay === 'tomorrow' ? 'btn-primary' : ''}`}
            onClick={() => setSelectedDay('tomorrow')}
          >
            Tomorrow's Outlook
          </button>
        </div>
      </div>

      {/* Highlights Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
            MORNING DEPARTURES (6–8 AM)
          </div>
          <div className="mono" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981', marginTop: '0.2rem' }}>
            EV-01, 04, 07
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            100% departure guarantee locked
          </div>
        </div>

        <div className="card" style={{ border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
            EVENING COMMUTER RUSH (6–7 PM)
          </div>
          <div className="mono" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#f59e0b', marginTop: '0.2rem' }}>
            18 EVs Expected
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Peak shaving throttling scheduled
          </div>
        </div>

        <div className="card" style={{ border: '1px solid rgba(6, 182, 212, 0.3)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
            CLEAN SOLAR WINDOW (12–2 PM)
          </div>
          <div className="mono" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#38bdf8', marginTop: '0.2rem' }}>
            ~35 kW Solar Direct
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Surplus matched to flexible chargers
          </div>
        </div>
      </div>

      {/* Hourly Schedule Timeline Cards */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} className="text-cyan" />
            <span className="card-title">Future Charging Demand & Slot Allocation</span>
          </div>
          <span className="badge badge-info">24-Hour Plan</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {scheduleSlots.map((slot) => {
            const isPast = slot.hour < simHour;
            const isCurrent = slot.hour === simHour;

            return (
              <div 
                key={slot.time}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 180px',
                  gap: '1.25rem',
                  alignItems: 'center',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: isCurrent ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  border: isCurrent ? '2px solid #06b6d4' : '1px solid var(--border)',
                  opacity: isPast ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Time & Badge */}
                <div>
                  <div className="mono" style={{ fontSize: '1.2rem', fontWeight: '800', color: isCurrent ? '#38bdf8' : '#f8fafc' }}>
                    {slot.time}
                  </div>
                  <span className={`badge badge-${slot.type === 'departure' ? 'success' : slot.type === 'arrival' ? 'warning' : 'purple'}`} style={{ fontSize: '0.68rem', marginTop: '0.25rem' }}>
                    {slot.type.toUpperCase()}
                  </span>
                  {isCurrent && (
                    <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: '700', marginTop: '0.2rem' }}>
                      ● CURRENT TIME
                    </div>
                  )}
                </div>

                {/* Demand Details & EV Badges */}
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc' }}>
                    {slot.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {slot.notes}
                  </div>

                  {/* EV Pills */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                    {slot.evs.slice(0, 6).map(ev => (
                      <span 
                        key={ev.id}
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                          color: '#38bdf8'
                        }}
                      >
                        {ev.id} ({ev.chargerId})
                      </span>
                    ))}
                    {slot.evs.length > 6 && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                        +{slot.evs.length - 6} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Load Metric */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>EXPECTED FLEET</div>
                  <div className="mono" style={{ fontSize: '1.4rem', fontWeight: '900', color: slot.type === 'arrival' ? '#fbbf24' : '#34d399' }}>
                    {slot.expectedCount} EVs
                  </div>
                  <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ~{slot.demandKw} kW demand
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
