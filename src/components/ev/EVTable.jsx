import React, { useState, useMemo } from 'react';
import StatusBadge from '../common/StatusBadge';
import { Search, Filter, BatteryCharging, Zap, Clock, ChevronRight } from 'lucide-react';

export default function EVTable({ vehicles, onSelectVehicle, selectedVehicleId }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesSearch = 
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.id.toLowerCase().includes(search.toLowerCase()) ||
        v.chargerId.toLowerCase().includes(search.toLowerCase()) ||
        (v.licensePlate && v.licensePlate.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = 
        statusFilter === 'ALL' ? true : v.status.toUpperCase() === statusFilter;

      const matchesPriority = 
        priorityFilter === 'ALL' ? true : v.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [vehicles, search, statusFilter, priorityFilter]);

  const getSocColor = (soc) => {
    if (soc < 25) return 'var(--danger)';
    if (soc < 60) return 'var(--warning)';
    return 'var(--success)';
  };

  return (
    <div className="ev-table-wrapper card">
      {/* Table Toolbar */}
      <div className="table-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        {/* Status Filter Tabs */}
        <div className="status-tabs" style={{ display: 'flex', gap: '0.4rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          {['ALL', 'CHARGING', 'WAITING', 'COMPLETED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`btn-sm ${statusFilter === tab ? 'btn-primary' : 'btn'}`}
              style={{ border: 'none', padding: '0.35rem 0.75rem' }}
            >
              {tab === 'ALL' ? `All (${vehicles.length})` : tab}
            </button>
          ))}
        </div>

        {/* Search & Priority Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search EV or Charger..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ paddingLeft: '32px', fontSize: '0.8rem', padding: '0.45rem 0.75rem 0.45rem 32px' }}
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="select"
            style={{ width: '130px', fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* EV Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Battery (SOC)</th>
              <th>Target</th>
              <th>Departure</th>
              <th>Power</th>
              <th>Priority</th>
              <th>Charger</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map((ev) => {
              const isSelected = selectedVehicleId === ev.id;
              const socColor = getSocColor(ev.currentSoc);

              return (
                <tr
                  key={ev.id}
                  onClick={() => onSelectVehicle(ev)}
                  style={{
                    backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.08)' : undefined,
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                  }}
                >
                  {/* EV Name & ID */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{ev.name}</span>
                      <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {ev.id} • {ev.licensePlate}
                      </span>
                    </div>
                  </td>

                  {/* Battery SOC */}
                  <td style={{ minWidth: '150px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span className="mono" style={{ fontWeight: '700', color: socColor }}>
                          {Math.round(ev.currentSoc)}%
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                          {ev.batteryCapacity} kWh
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, ev.currentSoc))}%`,
                            height: '100%',
                            background: socColor,
                            borderRadius: '3px',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Target SOC */}
                  <td>
                    <span className="mono" style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>
                      {ev.targetSoc}%
                    </span>
                  </td>

                  {/* Departure */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-primary)' }}>
                      <Clock size={13} style={{ color: 'var(--accent)' }} />
                      <span className="mono" style={{ fontSize: '0.8rem' }}>{ev.departureTime}</span>
                    </div>
                  </td>

                  {/* Charging Power */}
                  <td>
                    <span className="mono" style={{ fontWeight: '700', color: ev.chargingPower > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                      {ev.chargingPower.toFixed(1)} kW
                    </span>
                  </td>

                  {/* Priority */}
                  <td>
                    <StatusBadge status={ev.priority} type="priority" />
                  </td>

                  {/* Charger */}
                  <td>
                    <span className="mono" style={{ fontWeight: '600', background: 'rgba(255, 255, 255, 0.04)', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      {ev.chargerId}
                    </span>
                  </td>

                  {/* Status */}
                  <td>
                    <StatusBadge status={ev.status} type="vehicle" />
                  </td>

                  {/* Action Icon */}
                  <td style={{ textAlign: 'right' }}>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
