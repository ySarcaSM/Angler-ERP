import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../context/useAuth';
import { getDefaultUISettings, applyUISettings } from '../../services/firebase/settings';

export default function Layout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { company } = useAuth();

  React.useEffect(() => {
    applyUISettings(company?.settings?.ui || getDefaultUISettings());
  }, [company]);

  return (
    <div className="app-ui min-h-screen bg-dark-950">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'}`}>
        <Topbar onMenuToggle={() => setMobileOpen(!mobileOpen)} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
