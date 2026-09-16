import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listSales, approveSale, cancelSale } from '../../services/firebase/sales';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import { formatBRL, formatDate, statusLabel } from '../../utils/format';
import toast from 'react-hot-toast';

export default function SaleList() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const opts = { pageSize: 100, searchTerm: search };
      if (statusFilter) opts.filters = [{ field: 'status', op: '==', value: statusFilter }];
      const res = await listSales(company.id, opts);
      setData(res.data);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [company, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    try { await approveSale(id, company.id); toast.success('Venda aprovada!'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const handleCancel = async (id) => {
    if (!confirm('Cancelar esta venda?')) return;
    try { await cancelSale(id); toast.success('Venda cancelada.'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'number', label: '#', render: (v) => <span className="font-mono text-primary-400 font-medium">#{v}</span> },
    { key: 'clientName', label: 'Cliente' },
    { key: 'total', label: 'Total', render: (v) => <span className="font-semibold text-dark-100">{formatBRL(v)}</span> },
    { key: 'paymentMethod', label: 'Pagamento', render: (v) => <span className="text-dark-400 text-xs">{{ cash: 'Dinheiro', pix: 'PIX', credit_card: 'Crédito', debit_card: 'Débito', bank_transfer: 'Transferência', boleto: 'Boleto' }[v] || v}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={{ draft: 'badge-neutral', pending: 'badge-warning', approved: 'badge-success', cancelled: 'badge-danger' }[v] || 'badge-neutral'}>{statusLabel(v)}</span> },
    { key: 'createdAt', label: 'Data', render: (v) => <span className="text-dark-500 text-xs">{formatDate(v?.toDate?.() || v)}</span> },
    { key: '_actions', label: '', width: '100px', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/${row.id}`); }} className="btn-ghost btn-sm"><Eye size={14} /></button>
        {(row.status === 'draft' || row.status === 'pending') && <button onClick={(e) => { e.stopPropagation(); handleApprove(row.id); }} className="btn-ghost btn-sm text-emerald-400"><CheckCircle size={14} /></button>}
        {row.status !== 'cancelled' && <button onClick={(e) => { e.stopPropagation(); handleCancel(row.id); }} className="btn-ghost btn-sm text-red-400"><XCircle size={14} /></button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Vendas" subtitle={`${data.length} vendas`} action={<button onClick={() => navigate('/app/sales/new')} className="btn-primary"><Plus size={18} /> Nova Venda</button>} />
      <div className="card">
        <div className="card-header flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-dark-800 rounded-xl px-4 py-2 flex-1 max-w-sm">
            <Search size={16} className="text-dark-500" />
            <input type="text" placeholder="Buscar vendas..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="draft">Rascunho</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <DataTable columns={columns} data={data} loading={loading} onRowClick={(row) => navigate(`/sales/${row.id}`)} />
      </div>
    </div>
  );
}
