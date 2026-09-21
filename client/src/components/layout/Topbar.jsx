import React, { useEffect, useState } from 'react';
import { Menu, Bell, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { listProducts } from '../../services/firebase/products';
import { listClients } from '../../services/firebase/clients';
import { listLocations } from '../../services/firebase/locations';
import { listSuppliers } from '../../services/firebase/suppliers';
import { listSales } from '../../services/firebase/sales';
import { listPurchases } from '../../services/firebase/purchases';
import { loadNotifications } from '../../utils/notifications';

function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function Topbar({ onMenuToggle }) {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState([]);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  const moduleTargets = [
    { words: ['produto', 'produtos'], path: '/app/products' },
    { words: ['cliente', 'clientes'], path: '/app/clients' },
    { words: ['venda', 'vendas'], path: '/app/sales' },
    { words: ['compra', 'compras'], path: '/app/purchases' },
    { words: ['fornecedor', 'fornecedores'], path: '/app/suppliers' },
    { words: ['localizacao', 'localizacoes'], path: '/app/locations' },
    { words: ['estoque', 'stock'], path: '/app/stock' },
    { words: ['financeiro', 'financeira'], path: '/app/financial' },
    { words: ['relatorio', 'relatorios'], path: '/app/reports' },
    { words: ['medicao', 'medicoes'], path: '/app/budgets/profiles' },
    { words: ['formula', 'formulas'], path: '/app/budgets/formulas' },
    { words: ['orcamento', 'orcamentos'], path: '/app/budgets' },
  ];

  const navigateToTarget = (path, value) => {
    const query = value ? `?search=${encodeURIComponent(value)}` : '';
    navigate(`${path}${query}`);
  };

  useEffect(() => {
    if (!company?.id) return;
    const storageKey = `angler-dismissed-notifications-${company.id}`;
    try {
      setDismissedNotifications(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
      setDismissedNotifications([]);
    }

    const loadTopbarNotifications = async () => {
      try {
        setNotifications(await loadNotifications(company.id));
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
      }
    };

    loadTopbarNotifications();
    const handleNotificationsUpdate = (event) => {
      if (event.detail?.companyId === company.id) loadTopbarNotifications();
    };
    window.addEventListener('angler:notifications-updated', handleNotificationsUpdate);
    return () => window.removeEventListener('angler:notifications-updated', handleNotificationsUpdate);
  }, [company]);

  const unreadNotifications = notifications.filter((notification) => !dismissedNotifications.includes(notification.id));
  const displayedNotifications = showAllNotifications ? notifications : unreadNotifications;

  const dismissNotification = (notificationId) => {
    if (!company?.id) return;
    const nextDismissed = [...new Set([...dismissedNotifications, notificationId])];
    setDismissedNotifications(nextDismissed);
    localStorage.setItem(`angler-dismissed-notifications-${company.id}`, JSON.stringify(nextDismissed));
  };

  const showAllAndMarkAsRead = () => {
    if (!company?.id) return;
    const nextDismissed = [...new Set([...dismissedNotifications, ...notifications.map((notification) => notification.id)])];
    setDismissedNotifications(nextDismissed);
    localStorage.setItem(`angler-dismissed-notifications-${company.id}`, JSON.stringify(nextDismissed));
    setShowAllNotifications(true);
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!search.trim()) return;
    const text = search.trim();
    const normalized = normalize(text);
    const firstWord = normalized.split(/\s+/)[0];
    const explicitTarget = moduleTargets.find(({ words }) => words.includes(firstWord));
    if (explicitTarget) {
      navigateToTarget(explicitTarget.path, text.slice(firstWord.length).trim());
      return;
    }

    if (!company?.id) return;
    setSearching(true);
    const targets = [
      { path: '/app/products', loader: () => listProducts(company.id, { pageSize: 200 }) },
      { path: '/app/clients', loader: () => listClients(company.id, { pageSize: 200 }) },
      { path: '/app/locations', loader: () => listLocations(company.id, { pageSize: 200 }) },
      { path: '/app/suppliers', loader: () => listSuppliers(company.id, { pageSize: 200 }) },
      { path: '/app/sales', loader: () => listSales(company.id, { pageSize: 200 }) },
      { path: '/app/purchases', loader: () => listPurchases(company.id, { pageSize: 200 }) },
    ];
    try {
      const results = await Promise.all(targets.map(async (target) => {
        try {
          const response = await target.loader();
          const matches = response.data.filter((record) => normalize(JSON.stringify(record)).includes(normalized));
          return { ...target, matches };
        } catch {
          return { ...target, matches: [] };
        }
      }));
      const match = results.find((result) => result.matches.length > 0);
      navigateToTarget(match?.path || '/app/products', text);
    } finally {
      setSearching(false);
    }
  };

  return (
    <header className="h-16 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl text-dark-400 hover:text-primary-300 hover:bg-dark-800 transition-all"
        >
          <Menu size={20} />
        </button>

        <form onSubmit={handleSearch} className="hidden sm:flex items-center gap-2 bg-dark-800 border border-dark-700/50 rounded-xl px-4 py-2 w-72">
          <Search size={16} className="text-dark-500" />
          <input
            type="text"
            placeholder="Buscar produtos, clientes..."
            className="bg-transparent text-sm text-dark-100 placeholder:text-dark-500 outline-none w-full"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={searching}
          />
        </form>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen((open) => !open)}
            className="relative p-2 rounded-xl text-dark-400 hover:text-primary-300 hover:bg-dark-800 transition-all"
            title="Notificações"
          >
          <Bell size={20} />
            {unreadNotifications.length > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] leading-4 rounded-full">{unreadNotifications.length}</span>}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] bg-dark-900 border border-dark-700 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between">
                <span className="text-sm font-semibold text-dark-100">Notificações</span>
                <span className="text-xs text-dark-500">{unreadNotifications.length} não lido(s)</span>
              </div>
              {displayedNotifications.length > 0 ? displayedNotifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => { dismissNotification(notification.id); setNotificationsOpen(false); navigate(notification.path); }}
                  className="w-full text-left px-4 py-3 border-b border-dark-800 hover:bg-dark-800 transition-colors"
                >
                  <div className="text-sm text-dark-200">{notification.title}</div>
                  <div className="text-xs text-dark-500 mt-1">{notification.message}</div>
                </button>
              )) : (
                <div className="px-4 py-8 text-center text-sm text-dark-500">Nenhuma notificação</div>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/app/notifications')}
                  className="w-full px-4 py-3 text-xs text-primary-300 hover:bg-dark-800 transition-colors"
                >
                  {showAllNotifications ? 'Ver não lidas' : 'Ver todas as notificações'}
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
