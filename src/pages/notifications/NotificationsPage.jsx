import React, { useEffect, useState } from 'react';
import { Bell, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { loadNotifications } from '../../utils/notifications';
import PageHeader from '../../components/ui/PageHeader';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const loadedNotifications = await loadNotifications(company.id);
      const dismissed = JSON.parse(localStorage.getItem(`angler-dismissed-notifications-${company.id}`) || '[]');
      setNotifications(loadedNotifications.filter((notification) => !dismissed.includes(notification.id)));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [company]);

  const clearNotifications = () => {
    if (!company?.id || notifications.length === 0) return;
    const storageKey = `angler-dismissed-notifications-${company.id}`;
    const dismissed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const nextDismissed = [...new Set([...dismissed, ...notifications.map((notification) => notification.id)])];
    localStorage.setItem(storageKey, JSON.stringify(nextDismissed));
    setNotifications([]);
    toast.success('Notificações limpas.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        subtitle="Todos os alertas da empresa"
        action={(
          <div className="flex gap-2">
            <button type="button" onClick={clearNotifications} disabled={loading || notifications.length === 0} className="btn-secondary disabled:opacity-50" title="Limpar notificações">
              <Trash2 size={16} /> Limpar notificações
            </button>
            <button type="button" onClick={load} disabled={loading} className="btn-secondary" title="Atualizar notificações">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        )}
      />
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Bell size={18} className="text-primary-400" />
          <h3 className="text-sm font-semibold text-dark-200">Todas as notificações</h3>
        </div>
        {loading && <div className="px-6 py-10 text-center text-sm text-dark-500">Carregando notificações...</div>}
        {!loading && notifications.length > 0 && (
          <div className="divide-y divide-dark-800/50">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => navigate(notification.path)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-dark-800 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-dark-200">{notification.title}</div>
                  <div className="text-sm text-dark-500 mt-1">{notification.message}</div>
                </div>
                <ExternalLink size={16} className="text-dark-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
        {!loading && notifications.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-dark-500">Nenhuma notificação no momento.</div>
        )}
      </div>
    </div>
  );
}
