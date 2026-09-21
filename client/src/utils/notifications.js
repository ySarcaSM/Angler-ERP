import { listProducts } from '../services/firebase/products.js';
import { listSales } from '../services/firebase/sales.js';
import { listTransactions } from '../services/firebase/financial.js';

const SYSTEM_NOTIFICATIONS_KEY_PREFIX = 'angler-system-notifications-';

function getSystemNotifications(companyId) {
  try {
    const stored = JSON.parse(localStorage.getItem(`${SYSTEM_NOTIFICATIONS_KEY_PREFIX}${companyId}`) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function addSystemNotification(companyId, notification) {
  if (!companyId) return;
  const entry = {
    id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path: '/assistant',
    ...notification,
  };
  try {
    const notifications = [entry, ...getSystemNotifications(companyId)].slice(0, 20);
    localStorage.setItem(`${SYSTEM_NOTIFICATIONS_KEY_PREFIX}${companyId}`, JSON.stringify(notifications));
    window.dispatchEvent(new CustomEvent('angler:notifications-updated', { detail: { companyId } }));
  } catch {
    // A falha ao registrar o alerta não deve impedir a exibição do toast.
  }
}

export async function loadNotifications(companyId) {
  const [productsResult, salesResult, transactionsResult] = await Promise.all([
    listProducts(companyId, { pageSize: 200 }),
    listSales(companyId, { pageSize: 200 }),
    listTransactions(companyId, { status: 'pending', pageSize: 200 }),
  ]);
  const lowStock = productsResult.data.filter((product) => (
    product.active && (product.stock?.current || 0) <= (product.stock?.minimum || 0)
  ));
  const pendingSales = salesResult.data.filter((sale) => sale.status === 'pending');
  const notifications = [];

  if (lowStock.length > 0) {
    notifications.push({
      id: 'low-stock',
      title: 'Estoque baixo',
      message: `${lowStock.length} produto(s) precisam de reposição.`,
      path: '/app/stock',
    });
  }
  if (pendingSales.length > 0) {
    notifications.push({
      id: 'pending-sales',
      title: 'Vendas pendentes',
      message: `${pendingSales.length} venda(s) aguardam aprovação.`,
      path: '/app/sales?status=pending',
    });
  }
  if (transactionsResult.data.length > 0) {
    notifications.push({
      id: 'pending-financial',
      title: 'Financeiro pendente',
      message: `${transactionsResult.data.length} lançamento(s) aguardam pagamento.`,
      path: '/app/financial',
    });
  }

  return [...getSystemNotifications(companyId), ...notifications];
}
