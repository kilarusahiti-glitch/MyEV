import React from 'react';

export default function StatusBadge({ status, type = 'status' }) {
  if (type === 'priority') {
    switch (status) {
      case 'HIGH':
        return <span className="badge badge-danger">HIGH</span>;
      case 'MEDIUM':
        return <span className="badge badge-warning">MED</span>;
      case 'LOW':
        return <span className="badge badge-info">LOW</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  }

  if (type === 'charger') {
    switch (status) {
      case 'online':
        return (
          <span className="badge badge-success">
            <span className="status-dot pulse" style={{ background: '#10b981' }} />
            Online
          </span>
        );
      case 'reduced':
        return (
          <span className="badge badge-warning">
            <span className="status-dot" style={{ background: '#f59e0b' }} />
            Reduced
          </span>
        );
      case 'offline':
        return (
          <span className="badge badge-danger">
            <span className="status-dot" style={{ background: '#ef4444' }} />
            Offline
          </span>
        );
      default:
        return <span className="badge">{status}</span>;
    }
  }

  // Vehicle Status
  switch (status) {
    case 'Charging':
      return (
        <span className="badge badge-info">
          <span className="status-dot pulse" style={{ background: '#38bdf8' }} />
          Charging
        </span>
      );
    case 'Waiting':
      return (
        <span className="badge badge-warning">
          <span className="status-dot" style={{ background: '#f59e0b' }} />
          Waiting
        </span>
      );
    case 'Completed':
      return (
        <span className="badge badge-success">
          <span className="status-dot" style={{ background: '#10b981' }} />
          Completed
        </span>
      );
    default:
      return <span className="badge">{status}</span>;
  }
}
