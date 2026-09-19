import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  Zap,
  Building2,
  Cpu,
  Sun,
  TrendingUp,
  BatteryCharging,
  FlaskConical,
  Sparkles,
  Receipt,
  BarChart3,
  Leaf,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CalendarDays,
  Network,
  FileText,
  Layers3,
  CheckSquare,
  HelpCircle,
  LogOut
} from 'lucide-react';

const NAV_GROUPS = [
  {
    title: 'MENU',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/parking-lot-3d', label: 'Parking Lot 3D', icon: Layers3, badge: '3D' },
      { path: '/ev-management', label: 'EV Management', icon: Car, badge: '20' },
      { path: '/smart-charging', label: 'Smart Charging', icon: Zap },
      { path: '/building-energy', label: 'Building Energy', icon: Building2 },
      { path: '/grid', label: 'Grid & Substation', icon: Cpu },
      { path: '/solar', label: 'Solar PV', icon: Sun },
      { path: '/digital-twin', label: 'Digital Twin', icon: Network },
      { path: '/predictions', label: 'Predictions', icon: TrendingUp },
      { path: '/what-if', label: 'What-If Simulator', icon: Sparkles },
    ]
  },
  {
    title: 'OPERATIONS & BILLING',
    items: [
      { path: '/electricity-bill', label: 'Electricity Bill', icon: Receipt },
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/charger-health', label: 'Charger Health', icon: BatteryCharging },
      { path: '/charging-calendar', label: 'Calendar', icon: CalendarDays },
      { path: '/sustainability', label: 'Sustainability', icon: Leaf },
      { path: '/reports', label: 'Reports', icon: FileText },
      { path: '/simulation', label: 'Simulation', icon: FlaskConical, badge: 'ACTIVE' },
    ]
  }
];

export default function Sidebar({ isMobileOpen, setIsMobileOpen }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header — Donezo Style */}
        <div className="sidebar-header">
          <div className="brand-logo-container">
            <div className="brand-donezo-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="2.5" strokeDasharray="4 2" />
                <circle cx="12" cy="12" r="4.5" fill="#166534" />
              </svg>
            </div>
            {!collapsed && (
              <div className="brand-title">
                <span className="brand-main">VoltFlow</span>
                <span className="brand-sub">Smart Grid AI</span>
              </div>
            )}
          </div>
          <button 
            className="collapse-btn" 
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} style={{ marginBottom: '1.25rem' }}>
              <div className="nav-section-title">
                {!collapsed ? group.title : '•••'}
              </div>

              <ul className="nav-list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path} className="nav-item">
                      <NavLink
                        to={item.path}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        onClick={() => setIsMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="nav-active-indicator" />
                        <Icon size={18} className="nav-icon" />
                        {!collapsed && (
                          <div className="nav-label-group">
                            <span className="nav-text">{item.label}</span>
                            {item.badge && (
                              <span className={`nav-badge ${item.badge === 'ACTIVE' || item.badge === '3D' ? 'badge-active' : ''}`}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom Banner Card — Donezo App Promo Style */}
      </aside>
    </>
  );
}
