import React, { useState, useEffect, useRef } from 'react';
import { useSystemState } from '../../hooks/useSystemState';
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import './Toast.css';

export default function ToastContainer() {
  const { toastQueue, controls } = useSystemState();
  const [toasts, setToasts] = useState([]);
  const processedIds = useRef(new Set());

  useEffect(() => {
    if (!toastQueue || toastQueue.length === 0) return;

    const newToasts = toastQueue.filter(t => !processedIds.current.has(t.id));
    if (newToasts.length === 0) return;

    newToasts.forEach(t => processedIds.current.add(t.id));

    setToasts(prev => {
      const combined = [...newToasts.map(t => ({ ...t, visible: true })), ...prev];
      return combined.slice(0, 6); // max 6 toasts
    });

    // Auto-dismiss after 5s
    newToasts.forEach(t => {
      setTimeout(() => {
        setToasts(prev => prev.filter(p => p.id !== t.id));
      }, 5000);
    });

    // Consume from engine
    controls.consumeToasts();
  }, [toastQueue]);

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={16} />;
      case 'warning': return <AlertTriangle size={16} />;
      case 'danger':  return <XCircle size={16} />;
      default:        return <Info size={16} />;
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type || 'info'}`}>
          <div className="toast-icon">{getIcon(t.type)}</div>
          <div className="toast-message">{t.message}</div>
          <button className="toast-dismiss" onClick={() => dismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
