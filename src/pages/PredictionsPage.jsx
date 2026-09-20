import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Car, Clock, Sun, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSystemState } from '../hooks/useSystemState';
import { backendApi } from '../services/backendApi';
import { formatPercent, formatPower } from '../utils/formatters';

function horizonLabel(minutes) {
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

export default function PredictionsPage() {
  const { backendStatus, backendDashboard, backendSystemStatus, vehicles } = useSystemState();
  const [predictions, setPredictions] = useState({});
  const [predictionState, setPredictionState] = useState('IDLE');
  const [failedPredictionIds, setFailedPredictionIds] = useState([]);
  const vehicleIdsKey = vehicles.map((vehicle) => vehicle.id).join('\n');
  const forecast = backendDashboard?.forecast;
  const site = backendSystemStatus?.site;
  const live = backendStatus === 'LIVE';

  useEffect(() => {
    const vehicleIds = vehicleIdsKey ? vehicleIdsKey.split('\n') : [];
    if (!live || vehicleIds.length === 0) return undefined;
    let cancelled = false;
    Promise.allSettled(vehicleIds.map(async (vehicleId) => [vehicleId, await backendApi.getVehiclePrediction(vehicleId)]))
      .then((results) => {
        if (!cancelled) {
          const entries = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
          const failedIds = results.flatMap((result, index) => result.status === 'rejected' ? [vehicleIds[index]] : []);
          setPredictions(Object.fromEntries(entries));
          setFailedPredictionIds(failedIds);
          setPredictionState(failedIds.length ? 'PARTIAL' : 'READY');
        }
      })
    return () => { cancelled = true; };
  }, [live, vehicleIdsKey]);

  const chartData = useMemo(() => {
    if (!forecast) return [];
    return forecast.building_load.map((point, index) => ({
      horizon: horizonLabel(point.horizon_minutes),
      building: point.predicted_value,
      solar: forecast.solar_generation[index]?.predicted_value ?? null
    }));
  }, [forecast]);

  if (!live) return <div className="card"><h1>Predictions & Forecast</h1><p>BACKEND OFFLINE. Forecast and vehicle predictions are unavailable until the authoritative backend reconnects.</p></div>;
  if (!forecast) return <div className="card"><h1>Predictions & Forecast</h1><p>No backend forecast data is available yet. The page will populate when telemetry history has enough samples.</p></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div><h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Predictions & Forecast</h1><p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Backend forecast and mobility prediction outputs. Values are simulation-time projections, not frontend estimates.</p></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Forecast Confidence', value: formatPercent(forecast.confidence * 100), unit: '%', icon: Clock },
          { label: 'Grid Peak Risk', value: formatPercent(forecast.peak_risk * 100), unit: '%', icon: AlertTriangle },
          { label: 'Solar Opportunity', value: formatPercent(forecast.solar_opportunity * 100), unit: '%', icon: Sun },
          { label: 'Available EV Budget', value: formatPower(site?.available_ev_power_kw), unit: 'kW', icon: Zap }
        ].map(({ label, value, unit, icon: Icon }) => <div className="card" key={label}><div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}><Icon size={15} />{label}</div><div className="mono" style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.6rem' }}>{value} <span style={{ fontSize: '0.8rem' }}>{unit}</span></div></div>)}
      </div>

      <div className="card"><div className="card-header"><span className="card-title">Energy Forecast</span><span className="badge badge-info">15 / 30 / 60 min</span></div><div style={{ width: '100%', height: 280, marginTop: '1rem' }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" /><XAxis dataKey="horizon" stroke="#64748b" /><YAxis stroke="#64748b" unit=" kW" /><Tooltip formatter={(value, name) => [`${formatPower(value)} kW`, name]} /><Legend /><Area type="monotone" dataKey="building" name="Building demand" stroke="#38bdf8" fill="#38bdf833" /><Area type="monotone" dataKey="solar" name="Solar generation" stroke="#facc15" fill="#facc1533" /></AreaChart></ResponsiveContainer></div></div>

      <div className="card"><div className="card-header"><span className="card-title">Vehicle Departure Predictions</span><span className="badge badge-info">Backend mobility service</span></div>{predictionState === 'PARTIAL' && <p style={{ color: '#f59e0b', marginTop: '1rem' }}>Predictions could not be loaded for {failedPredictionIds.length} vehicle(s). Other vehicle results remain available.</p>}{predictionState === 'READY' && Object.values(predictions).every((value) => !value) && <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>No prediction available yet. The backend needs recorded departure and energy-use history for each vehicle.</p>}<div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.82rem' }}><thead><tr>{['Vehicle', 'SOC / Target', 'Status', 'Departure', 'Confidence', 'Achievable SOC', 'Readiness'].map((label) => <th key={label} style={{ textAlign: 'left', padding: '0.55rem', color: 'var(--text-muted)' }}>{label}</th>)}</tr></thead><tbody>{vehicles.map((vehicle) => { const prediction = predictions[vehicle.id]; const departure = prediction?.departure_prediction?.most_likely_departure; const confidence = prediction?.confidence; return <tr key={vehicle.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '0.55rem' }}><strong>{vehicle.name}</strong><div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{vehicle.id} · {vehicle.vehicleType}</div></td><td className="mono" style={{ padding: '0.55rem' }}>{formatPercent(vehicle.currentSoc)}% / {vehicle.targetSoc == null ? '—' : `${formatPercent(vehicle.targetSoc)}%`}</td><td style={{ padding: '0.55rem' }}>{vehicle.status}</td><td style={{ padding: '0.55rem' }}>{failedPredictionIds.includes(vehicle.id) ? 'Request failed' : departure ? new Date(departure).toLocaleString() : 'No prediction available'}</td><td className="mono" style={{ padding: '0.55rem' }}>{confidence == null ? '—' : `${formatPercent(confidence * 100)}%`}</td><td className="mono" style={{ padding: '0.55rem' }}>{vehicle.achievableSoc == null ? '—' : `${formatPercent(vehicle.achievableSoc)}%`}</td><td style={{ padding: '0.55rem' }}>{vehicle.readiness?.readiness_state || vehicle.depRisk.label}</td></tr>; })}</tbody></table></div></div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}><Building2 size={18} color="#38bdf8" /><span>Current backend EV load: <strong>{formatPower(site?.ev_load_kw)} kW</strong>. Vehicle decisions remain in Smart Charging.</span><Car size={18} color="#34d399" /></div>
    </div>
  );
}
