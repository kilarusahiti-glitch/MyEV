const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, '');

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Backend request failed (${response.status})`);
  }

  return response.json();
}

export const backendApi = {
  health: () => requestJson('/health'),
  getDashboard: () => requestJson('/api/dashboard'),
  getForecast: () => requestJson('/api/forecast'),
  getCalendar: () => requestJson('/api/calendar'),
  getChargerHealthHistory: () => requestJson('/api/chargers/health-history'),
  getVehiclePrediction: (vehicleId) => requestJson(`/api/vehicles/${encodeURIComponent(vehicleId)}/prediction`),
  getSessionHistory: () => requestJson('/api/history/sessions'),
  getTrips: () => requestJson('/api/trips'),
  activateScenario: (scenario) => requestJson(`/api/scenarios/${encodeURIComponent(scenario)}/activate`, { method: 'POST' }),
  resetScenario: () => requestJson('/api/scenarios/reset', { method: 'POST' }),
  simulatorStep: (seconds = 1) => requestJson(`/api/simulator/step?seconds=${encodeURIComponent(seconds)}`, { method: 'POST' }),
  setSimulatorSpeed: (speed) => requestJson('/api/simulator/speed', {
    method: 'POST',
    body: JSON.stringify({ speed })
  }),
  resetSimulator: () => requestJson('/api/simulator/reset', { method: 'POST' }),
  chargeFaster: (vehicleId) => requestJson(`/api/vehicles/${encodeURIComponent(vehicleId)}/charge-faster`, { method: 'POST' }),
  startSession: (sessionId) => requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/start`, { method: 'POST' }),
  pauseSession: (sessionId) => requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/pause`, { method: 'POST' }),
  resumeSession: (sessionId) => requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/resume`, { method: 'POST' }),
  stopSession: (sessionId) => requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/stop`, { method: 'POST' }),
  updateSessionPreferences: (sessionId, preferences) => requestJson(`/api/sessions/${encodeURIComponent(sessionId)}/preferences`, {
    method: 'PATCH',
    body: JSON.stringify(preferences)
  }),
  createTrip: (trip) => requestJson('/api/trips', {
    method: 'POST',
    body: JSON.stringify(trip)
  })
};
