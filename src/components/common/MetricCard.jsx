import React from 'react';

export default function MetricCard({
  title,
  value,
  unit = '',
  icon: Icon,
  trend,
  trendDirection = 'neutral',
  progress,
  progressColor = '#16a34a',
  statusColor,
  subtitle,
  badgeText,
  badgeVariant = 'info',
  isHero = false,
  onClick,
  className = ''
}) {
  if (isHero) {
    return (
      <div 
        onClick={onClick}
        className={`donezo-metric-card hero-card ${className}`}
        style={{
          background: 'linear-gradient(135deg, #09261a 0%, #0f4c3a 50%, #15803d 100%)',
          borderRadius: '20px',
          padding: '1.25rem',
          color: '#ffffff',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '145px',
          boxShadow: '0 8px 20px rgba(15, 76, 58, 0.25)',
          cursor: onClick ? 'pointer' : 'default',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {Icon && <Icon size={16} color="#86efac" />}
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.9)' }}>
              {title}
            </span>
          </div>
          {badgeText && (
            <span style={{
              fontSize: '0.7rem',
              fontWeight: '700',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)'
            }}>
              {badgeText}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', margin: '0.6rem 0' }}>
          <span style={{ fontSize: '2.2rem', fontWeight: '800', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {value}
          </span>
          {unit && (
            <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#86efac' }}>
              {unit}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
          {(trend || subtitle) && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.16)',
              fontSize: '0.7rem',
              fontWeight: '600',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <span style={{ fontSize: '0.75rem' }}>↗</span>
              <span>{trend || subtitle}</span>
            </div>
          )}
          {progress !== undefined && (
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#86efac' }}>
              {Math.round(progress)}%
            </span>
          )}
        </div>
      </div>
    );
  }

  // Regular Donezo Crisp White Card
  return (
    <div 
      onClick={onClick}
      className={`donezo-metric-card ${className}`}
      style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '1.25rem',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '145px',
        border: '1px solid #eef2f6',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {Icon && <Icon size={16} color={statusColor || '#64748b'} />}
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#475569' }}>
            {title}
          </span>
        </div>
        {badgeText && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            padding: '0.15rem 0.5rem',
            borderRadius: '9999px',
            background: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0'
          }}>
            {badgeText}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', margin: '0.6rem 0' }}>
        <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#0f172a', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: '0.92rem', fontWeight: '600', color: '#64748b' }}>
            {unit}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
        {(trend || subtitle) && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '0.7rem',
            fontWeight: '600',
            color: '#475569'
          }}>
            <span style={{ color: '#16a34a', fontSize: '0.75rem' }}>↗</span>
            <span>{trend || subtitle}</span>
          </div>
        )}
        {badgeText && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            padding: '0.15rem 0.5rem',
            borderRadius: '9999px',
            background: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0'
          }}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}
