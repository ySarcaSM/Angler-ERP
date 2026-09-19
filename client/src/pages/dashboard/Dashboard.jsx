import React, { useState, useEffect } from 'react';
import {
  DollarSign, ShoppingCart, Package, Users, TrendingUp,
  TrendingDown, AlertTriangle,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from '../../context/useAuth';
import { listSales } from '../../services/firebase/sales';
import { subscribeClientCount } from '../../services/firebase/clients';
import { listProducts } from '../../services/firebase/products';
import { getSummary } from '../../services/firebase/financial';
import { formatBRL, timestampToDate } from '../../utils/format';

export default function Dashboard() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState({});
  const [recentSales, setRecentSales] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    if (!company?.id) return;

    const unsubscribe = subscribeClientCount(
      company.id,
      (totalClients) => setCards((current) => ({ ...current, totalClients })),
      (error) => console.error('Client count error:', error),
    );

    return () => unsubscribe();
  }, [company]);

  useEffect(() => {
    if (!company?.id) return;

    const load = async () => {
      try {
        const companyId = company.id;
        const [salesRes, productsRes, finSummary] = await Promise.all([
          listSales(companyId, { pageSize: 50 }),
          listProducts(companyId, { pageSize: 1 }),
          getSummary(companyId),
        ]);

        const sales = Array.from(new Map(
          salesRes.data.map((sale) => [sale.id, sale]),
        ).values());
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthSales = sales.filter((s) => {
          const d = timestampToDate(s.createdAt);
          return d && d >= startOfMonth && s.status !== 'cancelled';
        });
        const monthRevenue = monthSales.reduce((sum, s) => sum + (s.total || 0), 0);

        // Low stock products
        const allProducts = (await listProducts(companyId, { pageSize: 200 })).data;
        const lowStockCount = allProducts.filter((p) => {
          const current = p.stock?.current || 0;
          const minimum = p.stock?.minimum || 0;
          return current <= minimum && p.active;
        }).length;

        // Top products
        const productTotals = {};
        sales.forEach((s) => {
          s.items?.forEach((item) => {
            if (!productTotals[item.productName]) productTotals[item.productName] = { total: 0, qty: 0 };
            productTotals[item.productName].total += item.total || 0;
            productTotals[item.productName].qty += item.quantity || 0;
          });
        });
        const top = Object.entries(productTotals)
          .map(([name, data]) => ({ _id: name, ...data }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

        setCards((current) => ({
          ...current,
          monthRevenue,
          monthSalesCount: monthSales.length,
          totalProducts: allProducts.length,
          lowStockCount,
          monthBalance: finSummary.month.balance,
        }));
        setRecentSales(sales.slice(0, 5));
        setTopProducts(top);
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [company]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  }

  const stats = [
    { label: 'Receita do Mês', value: formatBRL(cards.monthRevenue || 0), icon: DollarSign, color: 'emerald' },
    { label: 'Vendas do Mês', value: cards.monthSalesCount || 0, icon: ShoppingCart, color: 'blue' },
    { label: 'Clientes', value: cards.totalClients || 0, icon: Users, color: 'purple' },
    { label: 'Produtos', value: cards.totalProducts || 0, icon: Package, color: 'amber' },
    { label: 'Estoque Baixo', value: cards.lowStockCount || 0, icon: AlertTriangle, color: cards.lowStockCount > 0 ? 'red' : 'emerald' },
    { label: 'Saldo do Mês', value: formatBRL(cards.monthBalance || 0), icon: cards.monthBalance >= 0 ? TrendingUp : TrendingDown, color: cards.monthBalance >= 0 ? 'emerald' : 'red' },
  ];

  const colorMap = {
    emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/20',
    red: 'from-red-500/10 to-red-600/5 border-red-500/20',
  };
  const iconColorMap = {
    emerald: 'text-emerald-400', blue: 'text-blue-400', purple: 'text-purple-400',
    amber: 'text-amber-400', red: 'text-red-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-100">Dashboard</h1>
        <p className="text-dark-500 text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`card bg-gradient-to-br ${colorMap[stat.color]}`}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <stat.icon size={20} className={iconColorMap[stat.color]} />
              </div>
              <div className="text-xl font-bold text-dark-100">{stat.value}</div>
              <div className="text-xs text-dark-400 mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-dark-200">Top Produtos Vendidos</h3></div>
          <div className="card-body">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="_id" tick={{ fill: '#94a3b8', fontSize: 11 }} width={120} />
                  <Tooltip cursor={false} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#f1f5f9' }} formatter={(v) => [formatBRL(v), 'Total']} />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-dark-500 text-sm">Nenhuma venda registrada</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-dark-200">Vendas Recentes</h3>
            <a href="/app/sales" className="text-xs text-primary-400 hover:text-primary-300">Ver todas →</a>
          </div>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>#</th><th>Cliente</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="font-mono text-dark-400">{sale.number}</td>
                    <td className="text-dark-200">{sale.clientName}</td>
                    <td className="font-medium text-dark-100">{formatBRL(sale.total)}</td>
                    <td>
                      <span className={`badge ${sale.status === 'approved' ? 'badge-success' : sale.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                        {sale.status === 'approved' ? 'Aprovado' : sale.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-dark-500 py-8">Nenhuma venda</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
