import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, ShoppingCart, Truck,
  DollarSign, Warehouse, BarChart3, Settings, LogOut,
  FileText, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/app/clients', icon: Users, label: 'Clientes' },
      { to: '/app/products', icon: Package, label: 'Produtos' },
      { to: '/app/sales', icon: ShoppingCart, label: 'Vendas' },
      { to: '/app/purchases', icon: Truck, label: 'Compras' },
      { to: '/app/suppliers', icon: FileText, label: 'Fornecedores' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/app/financial', icon: DollarSign, label: 'Financeiro' },
      { to: '/app/stock', icon: Warehouse, label: 'Estoque' },
      { to: '/app/reports', icon: BarChart3, label: 'Relatórios' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/app/settings', icon: Settings, label: 'Configurações' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, company, logout } = useAuth();
  const location = useLocation();

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-dark-900 border-r border-dark-700/50 flex flex-col z-40 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-dark-700/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-300 to-primary-700 flex items-center justify-center text-dark-950 font-bold text-sm flex-shrink-0 shadow-gold-glow">
            A
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-gold truncate">Angler ERP</div>
              <div className="text-xs text-dark-500 truncate">{company?.name || 'Empresa'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Gold accent line */}
      <div className="gold-line" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary-600">
                {section.label}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-primary-400/10 text-primary-300 border border-primary-400/20 shadow-sm'
                        : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
                    }`
                  }
                >
                  <item.icon size={20} className="flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-dark-700/50 p-3">
        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-dark-400 hover:text-primary-300 hover:bg-dark-800 transition-all mb-2"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          {!collapsed && <span>Recolher</span>}
        </button>

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400/20 to-primary-700/20 border border-primary-400/20 flex items-center justify-center text-xs font-bold text-primary-300 flex-shrink-0">
            {user?.name?.[0]}{user?.lastName?.[0] || ''}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-dark-200 truncate">{user?.name}</div>
              <div className="text-xs text-dark-500 capitalize">{user?.role}</div>
            </div>
          )}
          <button onClick={logout} className="text-dark-500 hover:text-red-400 transition-colors" title="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
