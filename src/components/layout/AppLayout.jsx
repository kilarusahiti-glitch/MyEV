import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../../context/AuthContext';
import ToastContainer from '../common/Toast';
import './layout.css';

export default function AppLayout() {
  const { currentUser } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // If not authenticated and not in demo mode, redirect to /login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      
      <div className="main-viewport">
        <TopBar onMenuClick={() => setIsMobileOpen(true)} />
        
        <main className="content-container">
          <Outlet />
        </main>
      </div>

      {/* Global toast notifications */}
      <ToastContainer />
    </div>
  );
}

