import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { listSales } from '../../services/firebase/sales';
import { listTransactions } from '../../services/firebase/financial';
import { formatBRL, timestampToDate } from '../../utils/format';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function ReportsPage() {
  const { company } = useAuth();
  const [salesData, setSalesData] = useState([]);
  const [profit, setProfit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;
    const load = async () => {
      try {
        const [salesRes, incomeRes, expenseRes] = await Promise.all([
          listSales(company.id, { pageSize: 500 }),
          listTransactions(company.id, { type: 'income', status: 'paid', pageSize: 500 }),
          listTransactions(company.id, { type: 'expense', status: 'paid', pageSize: 500 }),
        ]);

        // Group sales by date
        const salesByDate = {};
        salesRes.data.forEach((s) => {
          if (s.status === 'cancelled') return;
          const d = timestampToDate(s.createdAt);
          const key = d.toISOString().slice(0, 10);
          if (!salesByDate[key]) salesByDate[key] = { _id: key, total: 0, count: 0 };
          salesByDate[key].total += s.total || 0;
          salesByDate[key].count++;
        });
        setSalesData(Object.values(salesByDate).sort((a, b) => a._id.localeCompare(b._id)));

        // Calculate profit
        const inc = incomeRes.data.reduce((sum, t) => sum + (t.amount || 0), 0);
        const exp = expenseRes.data.reduce((sum, t) => sum + (t.amount || 0), 0);
        setProfit({ income: inc, expense: exp, profit: inc - exp, margin: inc > 0 ? ((inc - exp) / inc * 100).toFixed(1) : 0 });
      } catch (err) { toast.error(err.message); }
      finally { setLoading(false); }
    };
    load();
  }, [company]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-dark-100">Relatórios</h1><p className="text-dark-500 text-sm mt-1">Análise do desempenho</p></div>
      {profit && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 p-5">
            <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} className="text-emerald-400" /><span className="text-sm text-dark-400">Receitas</span></div>
            <div className="text-2xl font-bold text-emerald-400">{formatBRL(profit.income)}</div>
          </div>
          <div className="card bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 p-5">
            <div className="flex items-center gap-2 mb-2"><TrendingDown size={18} className="text-red-400" /><span className="text-sm text-dark-400">Despesas</span></div>
            <div className="text-2xl font-bold text-red-400">{formatBRL(profit.expense)}</div>
          </div>
          <div className={`card bg-gradient-to-br ${profit.profit >= 0 ? 'from-blue-500/10 to-blue-600/5 border-blue-500/20' : 'from-amber-500/10 to-amber-600/5 border-amber-500/20'} p-5`}>
            <div className="flex items-center gap-2 mb-2"><DollarSign size={18} className={profit.profit >= 0 ? 'text-blue-400' : 'text-amber-400'} /><span className="text-sm text-dark-400">Lucro</span></div>
            <div className={`text-2xl font-bold ${profit.profit >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>{formatBRL(profit.profit)}</div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-2"><BarChart3 size={18} className="text-purple-400" /><span className="text-sm text-dark-400">Margem</span></div>
            <div className="text-2xl font-bold text-purple-400">{profit.margin}%</div>
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-header"><h3 className="text-sm font-semibold text-dark-200">Vendas por Dia</h3></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={salesData}>
              <defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="_id" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#f1f5f9' }} formatter={(v) => [formatBRL(v), 'Total']} />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#colorSales)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
