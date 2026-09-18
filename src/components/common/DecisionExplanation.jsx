import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * DecisionExplanation — reusable card explaining why optimizer changed a charging power
 */
export default function DecisionExplanation({ explanation, compact = false }) {
  const [expanded, setExpanded] = useState(!compact);

  if (!explanation) return null;

  const {
    evName,
    evId,
    oldPower,
    newPower,
    direction,
    delta,
    factors = [],
    peakImpact,
    timestamp
  } = explanation;

  const dirColor = direction === 'reduced' ? '#f87171' : direction === 'increased' ? '#34d399' : '#94a3b8';
  const dirSymbol = direction === 'reduced' ? '↓' : direction === 'increased' ? '↑' : '→';

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginBottom: '0.5rem'
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 0.9rem',
          cursor: compact ? 'pointer' : 'default',
          borderBottom: expanded ? '1px solid var(--border)' : 'none'
        }}
        onClick={() => compact && setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{evId}</span>
          <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{evName}</span>
          <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {oldPower.toFixed(1)} kW
          </span>
          <span style={{ color: dirColor, fontWeight: '700', fontSize: '0.85rem' }}>
            {dirSymbol} {newPower.toFixed(1)} kW
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {timestamp && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          )}
          {compact && (expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
            WHY?
          </div>
          {factors.map((f, i) => (
            <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '4px', height: '4px', background: dirColor, borderRadius: '50%', flexShrink: 0 }} />
              {f}
            </div>
          ))}
          {peakImpact && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.4rem 0.6rem',
              background: direction === 'reduced' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(6, 182, 212, 0.1)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              color: direction === 'reduced' ? '#34d399' : '#38bdf8',
              fontWeight: '600'
            }}>
              ✓ Result: {peakImpact}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
