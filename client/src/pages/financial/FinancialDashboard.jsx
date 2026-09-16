import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Plus, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listTransactions, createTransaction, markAsPaid, getSummary } from '../../services/firebase/financial';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { formatBRL, formatDate, statusLabel } from '../../utils/format';
import toast from 'react-hot-toast';

const EMPTY = { type: 'income', category: '', description: '', amount: 0, date: new Date().toISOString().slice(0,10), dueDate: '', paymentMethod: 'pix', status: 'pending' };

export default function FinancialDashboard() {
  const { company, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [s, txns] = await Promise.all([
        getSummary(company.id),
        listTransactions(company.id, { pageSize: 100, type: typeFilter || undefined }),
      ]);
      setSummary(s);
      setData(txns.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [company, typeFilter]);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await createTransaction(company.id, form, user); toast.success('Transação criada!'); setModal(false); load(); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handlePay = async (id) => {
    try { await markAsPaid(id); toast.success('Marcado como pago!'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'type', label: 'Tipo', render: (v) => <span className={v === 'income' ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>{v === 'income' ? '↑ Receita' : '↓ Despesa'}</span> },
    { key: 'description', label: 'Descrição' },
    { key: 'category', label: 'Categoria', render: (v) => <span className="badge badge-neutral">{v}</span> },
    { key: 'amount', label: 'Valor', render: (v, row) => <span className={`font-semibold ${row.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>{row.type === 'income' ? '+' : '-'} {formatBRL(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={{ pending: 'badge-warning', paid: 'badge-success', overdue: 'badge-danger' }[v] || 'badge-neutral'}>{statusLabel(v)}</span> },
    { key: 'createdAt', label: 'Data', render: (v) => <span className="text-dark-500 text-xs">{formatDate(v?.toDate?.() || v)}</span> },
    { key: '_actions', label: '', width: '60px', render: (_, row) => row.status === 'pending' ? <button onClick={(e) => { e.stopPropagation(); handlePay(row.id); }} className="btn-ghost btn-sm text-emerald-400"><CheckCircle size={14} /></button> : null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" subtitle="Contas a pagar e receber" action={<button onClick={() => setModal(true)} className="btn-primary"><Plus size={18} /> Nova Transação</button>} />
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 p-5">
            <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center"><TrendingUp size={20} className="text-emerald-400" /></div><div className="text-sm text-dark-400">Receitas do Mês</div></div>
            <div className="text-2xl font-bold text-emerald-400">{formatBRL(summary.month.income)}</div>
          </div>
          <div className="card bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 p-5">
            <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center"><TrendingDown size={20} className="text-red-400" /></div><div className="text-sm text-dark-400">Despesas do Mês</div></div>
            <div className="text-2xl font-bold text-red-400">{formatBRL(summary.month.expense)}</div>
          </div>
          <div className={`card bg-gradient-to-br ${summary.month.balance >= 0 ? 'from-blue-500/10 to-blue-600/5 border-blue-500/20' : 'from-amber-500/10 to-amber-600/5 border-amber-500/20'} p-5`}>
            <div className="flex items-center gap-3 mb-3"><div className={`w-10 h-10 rounded-xl ${summary.month.balance >= 0 ? 'bg-blue-500/20' : 'bg-amber-500/20'} flex items-center justify-center`}><DollarSign size={20} className={summary.month.balance >= 0 ? 'text-blue-400' : 'text-amber-400'} /></div><div className="text-sm text-dark-400">Saldo</div></div>
            <div className={`text-2xl font-bold ${summary.month.balance >= 0 ? 'text-blue-400' : 'text-amber-400'}`}>{formatBRL(summary.month.balance)}</div>
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-header"><select className="input max-w-[160px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option></select></div>
        <DataTable columns={columns} data={data} loading={loading} />
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nova Transação">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Tipo *</label><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required><option value="income">Receita</option><option value="expense">Despesa</option></select></div>
            <div><label className="label">Categoria *</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required placeholder="Vendas, Compras..." /></div>
          </div>
          <div><label className="label">Descrição *</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Valor *</label><input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} required /></div>
            <div><label className="label">Data</label><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
