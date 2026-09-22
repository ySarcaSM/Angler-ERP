import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Plus, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { listTransactions, createTransaction, markAsPaid, getSummary } from '../../services/firebase/financial';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { formatBRL, formatDate, statusLabel } from '../../utils/format';
import toast from 'react-hot-toast';
import { logAudit } from '../../services/firebase/settings';
import { listBudgets, updateBudget } from '../../services/firebase/budgets';
import { approveBudget } from '../../services/firebase/budgetApproval.js';

const EMPTY = { type: 'income', category: '', description: '', amount: 0, date: new Date().toISOString().slice(0,10), dueDate: '', paymentMethod: 'pix', status: 'pending' };

export default function FinancialDashboard() {
  const { company, user, userData } = useAuth();
  const isOperator = userData?.role === 'operator';
  const isViewer = userData?.role === 'viewer';
  const isOperator = userData?.role === 'operator';
  const [summary, setSummary] = useState(null);
  const [data, setData] = useState([]);
  const [budgets, setBudgets] = useState([]);
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
      if (!isOperator) {
        const budgetResult = await listBudgets(company.id, { pageSize: 200 });
        setBudgets(budgetResult.data);
      } else {
        setBudgets([]);
      }
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [company, typeFilter]);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const transaction = await createTransaction(company.id, form, user); await logAudit(company.id, { user, userName: userData?.name, action: 'create', entity: 'Transação financeira', entityId: transaction.id, description: `${userData?.name || 'Usuário'} criou uma ${form.type === 'income' ? 'receita' : 'despesa'} de ${formatBRL(form.amount)}: ${form.description}.`, details: { type: form.type, amount: form.amount, category: form.category, status: form.status } }); toast.success('Transação criada!'); setModal(false); load(); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handlePay = async (id) => {
    try { const transaction = data.find((item) => item.id === id); await markAsPaid(id); await logAudit(company.id, { user, userName: userData?.name, action: 'pay', entity: 'Transação financeira', entityId: id, description: `${userData?.name || 'Usuário'} marcou como pago o lançamento ${transaction?.description || id}.`, details: { amount: transaction?.amount, type: transaction?.type } }); toast.success('Marcado como pago!'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const handleBudgetStatus = async (budget, status) => {
    try {
      if (status === 'approved') {
        const result = await approveBudget(company.id, budget, user);
        if (!result.alreadyApproved) {
          await logAudit(company.id, { user, userName: userData?.name, action: 'update', entity: 'Orçamento', entityId: budget.id, description: `${userData?.name || 'Usuário'} aprovou o orçamento de ${budget.clientName} e gerou a receita pendente no financeiro.`, details: { antes: { status: budget.status || 'draft' }, depois: { status: 'approved', transactionId: result.transaction?.id } } });
        }
        toast.success('Orçamento aprovado e enviado para o financeiro!');
      } else {
        await updateBudget(budget.id, { status });
        await logAudit(company.id, { user, userName: userData?.name, action: 'update', entity: 'Orçamento', entityId: budget.id, description: `${userData?.name || 'Usuário'} marcou o orçamento de ${budget.clientName} como cancelado.`, details: { antes: { status: budget.status || 'draft' }, depois: { status } } });
        toast.success('Orçamento cancelado.');
      }
      load();
    } catch (error) { toast.error(error.message); }
  };

  const columns = [
    { key: 'type', label: 'Tipo', render: (v) => <span className={v === 'income' ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>{v === 'income' ? '↑ Receita' : '↓ Despesa'}</span> },
    { key: 'description', label: 'Descrição' },
    { key: 'category', label: 'Categoria', render: (v) => <span className="badge badge-neutral">{v}</span> },
    { key: 'amount', label: 'Valor', render: (v, row) => <span className={`font-semibold ${row.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>{row.type === 'income' ? '+' : '-'} {formatBRL(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={{ pending: 'badge-warning', paid: 'badge-success', overdue: 'badge-danger' }[v] || 'badge-neutral'}>{statusLabel(v)}</span> },
    { key: 'createdAt', label: 'Data', render: (v) => <span className="text-dark-500 text-xs">{formatDate(v?.toDate?.() || v)}</span> },
    { key: '_actions', label: '', width: '60px', render: (_, row) => !isViewer && row.status === 'pending' ? <button onClick={(e) => { e.stopPropagation(); handlePay(row.id); }} className="btn-ghost btn-sm text-emerald-400"><CheckCircle size={14} /></button> : null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" subtitle="Contas a pagar e receber" action={!isOperator && <button onClick={() => setModal(true)} className="btn-primary"><Plus size={18} /> Nova Transação</button>} />
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
      <div className="card">
        <div className="card-header flex items-center justify-between"><h2 className="text-sm font-semibold text-dark-200">Aprovação de orçamentos</h2><span className="text-xs text-dark-500">{budgets.filter((budget) => !budget.status || budget.status === 'draft').length} pendente(s)</span></div>
        <div className="divide-y divide-dark-800">
          {budgets.length === 0 && <div className="p-6 text-center text-sm text-dark-500">Nenhum orçamento cadastrado.</div>}
          {budgets.map((budget) => {
            const pending = !budget.status || budget.status === 'draft';
            return <div key={budget.id} className="flex flex-wrap items-center gap-4 p-4"><div className="min-w-[220px] flex-1"><div className="font-medium text-dark-100">{budget.clientName}</div><div className="text-sm text-dark-400">{budget.description || 'Sem observação'}</div></div><strong className="text-primary-300">{formatBRL(budget.value)}</strong><span className={budget.status === 'approved' ? 'badge-success' : budget.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}>{budget.status === 'approved' ? 'Aprovado' : budget.status === 'cancelled' ? 'Cancelado' : 'Rascunho'}</span>{!isViewer && !isOperator && pending && <div className="flex gap-1"><button type="button" className="btn-ghost btn-sm text-emerald-400" title="Aprovar orçamento" onClick={() => handleBudgetStatus(budget, 'approved')}><CheckCircle size={15} /></button><button type="button" className="btn-ghost btn-sm text-red-400" title="Cancelar orçamento" onClick={() => handleBudgetStatus(budget, 'cancelled')}><XCircle size={15} /></button></div>}</div>;
          })}
        </div>
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
