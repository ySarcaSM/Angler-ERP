import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, LayoutDashboard, Users, Package, ShoppingCart, Truck,
  DollarSign, Warehouse, BarChart3, Settings, LogOut,
  FileText, MapPin, ClipboardList, Bell, Bot, Ruler, Calculator, FileSignature, Blocks, ChevronLeft, ChevronRight, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

const NAV_SECTIONS = [
  { label: 'Principal', items: [
    { to: '/', icon: Home, label: 'Home', end: true },
    { to: '/app', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/assistant', icon: Bot, label: 'Assistente de IA', proLabel: 'Angel Pro', moduleKey: 'assistant' },
  ] },
  { label: 'Gestão', items: [
    { to: '/app/clients', icon: Users, label: 'Clientes', moduleKey: 'clients' },
    { to: '/app/products', icon: Package, label: 'Produtos', moduleKey: 'products' },
    { to: '/app/sales', icon: ShoppingCart, label: 'Vendas', moduleKey: 'sales' },
    { to: '/app/purchases', icon: Truck, label: 'Compras', moduleKey: 'purchases' },
    { to: '/app/suppliers', icon: FileText, label: 'Fornecedores', moduleKey: 'suppliers' },
    { to: '/app/locations', icon: MapPin, label: 'Localizações', moduleKey: 'locations' },
  ] },
  { label: 'Financeiro', items: [
    { to: '/app/financial', icon: DollarSign, label: 'Financeiro', moduleKey: 'financial' },
    { to: '/app/stock', icon: Warehouse, label: 'Estoque', moduleKey: 'stock' },
    { to: '/app/reports', icon: BarChart3, label: 'Relatórios', moduleKey: 'reports' },
  ] },
  { label: 'Orçamentos', items: [
    { to: '/app/budgets/profiles', icon: Ruler, label: 'Medição', moduleKey: 'measurement' },
    { to: '/app/budgets/formulas', icon: Calculator, label: 'Fórmulas', moduleKey: 'formulas' },
    { to: '/app/budgets', icon: FileSignature, label: 'Orçamentos', end: true, moduleKey: 'budgets' },
  ] },
  { label: 'Angler Pro', planKey: 'anglerpro', items: [
    { to: '/app/angler-pro/relatorios-semanais', icon: FileText, label: 'Relatórios semanais' },
    { to: '/app/angler-pro/relatorios-customizaveis', icon: BarChart3, label: 'Relatórios customizáveis' },
  ] },
  { label: 'Angler Ultra', planKey: 'anglerultra', items: [
    { to: '/app/angler-ultra/ui', icon: Settings, label: 'Configurações de UI' },
  ] },
  { label: 'Sistema', items: [
    { to: '/app/settings', icon: Settings, label: 'Configurações' },
    { to: '/app/modules', icon: Blocks, label: 'Módulos', viewerHidden: true },
    { to: '/app/users', icon: Users, label: 'Usuários', adminOrOwner: true },
    { to: '/app/requests', icon: ShieldAlert, label: 'Requisições', requestsPage: true },
    { to: '/app/logs', icon: ClipboardList, label: 'Logs' },
    { to: '/app/notifications', icon: Bell, label: 'Notificações' },
  ] },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, userData, company, logout, getEffectiveModules } = useAuth();

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-dark-900 border-r border-dark-700/50 flex flex-col z-40 transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
      <div className={`h-16 flex items-center px-3 border-b border-dark-700/50 ${collapsed ? 'justify-center' : ''}`}>
        <div className="flex items-center gap-3 min-w-0 px-3"><img src="/logo.png" alt="Angler ERP" className="w-9 h-9 object-contain flex-shrink-0" />{!collapsed && <div className="min-w-0"><div className="text-sm font-bold text-gold truncate">Angler ERP</div><div className="text-xs text-dark-500 truncate">{company?.name || 'Empresa'}</div></div>}</div>
      </div>
      <div className="gold-line" />
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV_SECTIONS.map((section) => {
          if (section.planKey === 'anglerpro' && !['anglerpro', 'anglerultra'].includes(company?.plan)) return null;
          if (section.planKey === 'anglerultra' && company?.plan !== 'anglerultra') return null;

          const effectiveModules = getEffectiveModules();
          const visibleItems = section.items.filter((item) => (
            !(userData?.role === 'operator' && !item.moduleKey && !item.requestsPage && !['/', '/app'].includes(item.to))
            && !(userData?.role === 'viewer' && item.viewerHidden)
            && !(userData?.role === 'viewer' && item.moduleKey === 'measurement')
            && (!item.moduleKey || effectiveModules.includes(item.moduleKey) || (userData?.role === 'operator' && item.moduleKey === 'assistant'))
            && (!item.ownerOnly || userData?.role === 'owner')
            && (!item.adminOrOwner || ['owner', 'admin'].includes(userData?.role))
          ));

          if (!visibleItems.length && !section.planKey) return null;

          return <div key={section.label}>{!collapsed && <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary-600">{section.label}</div>}{visibleItems.length > 0 && <div className="space-y-1">{visibleItems.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${collapsed ? 'justify-center' : ''} ${section.planKey ? (isActive ? 'bg-violet-500/15 text-violet-200 border border-violet-400/30 shadow-sm shadow-violet-500/10' : 'text-violet-300/80 hover:text-violet-100 hover:bg-violet-500/10') : (isActive ? 'bg-primary-400/10 text-primary-300 border border-primary-400/20 shadow-sm' : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800')}`}><item.icon size={20} className="flex-shrink-0" />{!collapsed && <span className={section.planKey || (item.proLabel && company?.plan === 'anglerpro') ? 'font-semibold pro-shimmer' : ''}>{item.proLabel && company?.plan === 'anglerpro' ? item.proLabel : item.label}</span>}</NavLink>)}</div>}</div>;
        })}
      </nav>
      <div className="border-t border-dark-700/50 p-3">
        <button onClick={onToggle} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-dark-400 hover:text-primary-300 hover:bg-dark-800 transition-all mb-2 ${collapsed ? 'justify-center' : ''}`}><span className="w-5 flex justify-center flex-shrink-0">{collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}</span>{!collapsed && <span>Recolher</span>}</button>
        <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? 'justify-center' : ''}`}><img src="/logo.png" alt="Logo da empresa" className="w-5 h-5 object-contain flex-shrink-0" />{!collapsed && <div className="min-w-0"><div className="text-sm font-medium text-dark-200 truncate">{company?.name || 'Empresa'}</div><div className="text-xs text-dark-500 truncate">{user?.name || 'Usuário'}</div></div>}</div>
        <button onClick={logout} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-dark-400 hover:text-red-400 hover:bg-dark-800 transition-all ${collapsed ? 'justify-center' : ''}`} title="Sair"><span className="w-5 flex justify-center flex-shrink-0"><LogOut size={18} /></span>{!collapsed && <span>Sair</span>}</button>
      </div>
    </aside>
  );
}
