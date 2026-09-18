import React, { useState } from 'react';
import { useSystemState } from '../hooks/useSystemState';
import EVTable from '../components/ev/EVTable';
import EVDetailDrawer from '../components/ev/EVDetailDrawer';
import MetricCard from '../components/common/MetricCard';
import { Car, Zap, BatteryCharging, Clock, ShieldCheck, Plus, Sparkles } from 'lucide-react';

export default function EVManagementPage() {
  const { vehicles, evLoad, activeEvCount, totalEvCount, controls } = useSystemState();
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Find updated vehicle reference for drawer
  const activeSelectedVehicle = selectedVehicle 
    ? vehicles.find(v => v.id === selectedVehicle.id) || selectedVehicle 
    : null;

  const avgSoc = Math.round(
    vehicles.reduce((acc, v) => acc + v.currentSoc, 0) / (vehicles.length || 1)
  );

  const highPriorityCount = vehicles.filter(v => v.priority === 'HIGH').length;

  return (
    <div className="ev-management-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>EV Fleet Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Real-time telemetry, charging status, and departure prioritization for 20 residential parking bays.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => controls.triggerScenario('EV Rush')}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem' }}
          >
            <Sparkles size={15} />
            <span>Simulate EV Rush</span>
          </button>
        </div>
      </div>

      {/* Fleet Overview KPI Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        <MetricCard
          title="CONNECTED FLEET"
          value={totalEvCount}
          unit="BAYS"
          icon={Car}
          subtitle="All bays occupied"
          badgeText="100% UTILIZED"
          badgeVariant="info"
        />

        <MetricCard
          title="ACTIVELY CHARGING"
          value={activeEvCount}
          unit={`/ ${totalEvCount}`}
          icon={BatteryCharging}
          statusColor="#34d399"
          progress={(activeEvCount / totalEvCount) * 100}
          progressColor="#10b981"
          subtitle={`${totalEvCount - activeEvCount} waiting / complete`}
        />

        <MetricCard
          title="TOTAL EV POWER DRAW"
          value={evLoad}
          unit="kW"
          icon={Zap}
          statusColor="#38bdf8"
          subtitle="Aggregate charger load"
          badgeText="DYNAMIC"
        />

        <MetricCard
          title="FLEET AVERAGE SOC"
          value={`${avgSoc}%`}
          icon={BatteryCharging}
          progress={avgSoc}
          progressColor={avgSoc < 40 ? 'var(--warning)' : '#10b981'}
          subtitle="Target threshold: 85%"
        />

        <MetricCard
          title="HIGH PRIORITY QUEUE"
          value={highPriorityCount}
          unit="VEHICLES"
          icon={Clock}
          statusColor="#f59e0b"
          subtitle="Urgent morning departures"
          badgeText="HIGH"
          badgeVariant="warning"
        />
      </div>

      {/* Responsive EV Table */}
      <EVTable
        vehicles={vehicles}
        onSelectVehicle={(v) => setSelectedVehicle(v)}
        selectedVehicleId={selectedVehicle?.id}
      />

      {/* Detail Slide-over Drawer */}
      <EVDetailDrawer
        vehicle={activeSelectedVehicle}
        onClose={() => setSelectedVehicle(null)}
        onToggleCharging={(id) => controls.toggleVehicleCharging(id)}
        onUpdatePriority={(id, p) => controls.updateVehiclePriority(id, p)}
      />
    </div>
  );
}
