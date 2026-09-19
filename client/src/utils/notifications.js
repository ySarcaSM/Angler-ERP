import { listProducts } from '../services/firebase/products.js';
import { listSales } from '../services/firebase/sales.js';
import { listTransactions } from '../services/firebase/financial.js';

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

  return notifications;
}
