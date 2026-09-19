import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';

// Core Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EVManagementPage from './pages/EVManagementPage';
import BuildingEnergyPage from './pages/BuildingEnergyPage';
import GridPage from './pages/GridPage';
import SolarPage from './pages/SolarPage';
import SimulationPage from './pages/SimulationPage';

// Optimization & Predictions
import SmartChargingPage from './pages/SmartChargingPage';
import PredictionsPage from './pages/PredictionsPage';
import WhatIfPage from './pages/WhatIfPage';
import DemandResponsePage from './pages/DemandResponsePage';

// Stage 3 New Feature Pages
import ElectricityBillPage from './pages/ElectricityBillPage';
import SustainabilityPage from './pages/SustainabilityPage';
import ChargerHealthPage from './pages/ChargerHealthPage';
import AnalyticsPage from './pages/AnalyticsPage';
import DigitalTwinPage from './pages/DigitalTwinPage';
import ChargingCalendarPage from './pages/ChargingCalendarPage';
import ReportsPage from './pages/ReportsPage';
import ParkingLot3DPage from './pages/ParkingLot3DPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ev-management" element={<EVManagementPage />} />
            <Route path="/building-energy" element={<BuildingEnergyPage />} />
            <Route path="/grid" element={<GridPage />} />
            <Route path="/solar" element={<SolarPage />} />
            <Route path="/simulation" element={<SimulationPage />} />

            {/* Optimization */}
            <Route path="/smart-charging" element={<SmartChargingPage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/what-if" element={<WhatIfPage />} />
            <Route path="/demand-response" element={<DemandResponsePage />} />

            {/* Operations */}
            <Route path="/charger-health" element={<ChargerHealthPage />} />
            <Route path="/chargers" element={<ChargerHealthPage />} />
            <Route path="/digital-twin" element={<DigitalTwinPage />} />
            <Route path="/charging-calendar" element={<ChargingCalendarPage />} />
            <Route path="/parking-lot-3d" element={<ParkingLot3DPage />} />

            {/* Analytics & Governance */}
            <Route path="/electricity-bill" element={<ElectricityBillPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/sustainability" element={<SustainabilityPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
