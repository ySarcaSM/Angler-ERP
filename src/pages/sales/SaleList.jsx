import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { listSales, approveSale, cancelSale, deleteSale } from '../../services/firebase/sales';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import { formatBRL, formatDate, statusLabel } from '../../utils/format';
import toast from 'react-hot-toast';
import { logAudit } from '../../services/firebase/settings';

export default function SaleList() {
  const navigate = useNavigate();
  const { company, user, userData } = useAuth();
  const isOperator = userData?.role === 'operator';
  const isViewer = userData?.role === 'viewer';
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
    } catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
    finally { setLoading(false); }
  }, [company, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    try { const sale = data.find((item) => item.id === id); await approveSale(id, company.id); await logAudit(company.id, { user, userName: userData?.name, action: 'approve', entity: 'Venda', entityId: id, description: `${userData?.name || 'Usuário'} aprovou a venda #${sale?.number || id} de ${sale?.clientName || 'cliente'}.`, details: { number: sale?.number, clientName: sale?.clientName, total: sale?.total } }); toast.success('Venda aprovada!'); load(); }
    catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
  };

  const handleCancel = async (id) => {
    if (!confirm('Cancelar esta venda?')) return;
    try {
      const sale = data.find((item) => item.id === id);
      const result = await cancelSale(id);
      await logAudit(company.id, { user, userName: userData?.name, action: 'cancel', entity: 'Venda', entityId: id, description: `${userData?.name || 'Usuário'} cancelou a venda #${sale?.number || id} de ${sale?.clientName || 'cliente'}.`, details: { number: sale?.number, clientName: sale?.clientName, total: sale?.total } });
      toast.success('Venda cancelada.');
      load();
    }
    catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deletar esta venda permanentemente?')) return;
    try { const sale = data.find((item) => item.id === id); await deleteSale(id); await logAudit(company.id, { user, userName: userData?.name, action: 'delete', entity: 'Venda', entityId: id, description: `${userData?.name || 'Usuário'} excluiu a venda #${sale?.number || id} de ${sale?.clientName || 'cliente'}.`, details: { number: sale?.number, clientName: sale?.clientName, total: sale?.total, status: sale?.status } }); toast.success('Venda deletada.'); }
    catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
    finally { load(); }
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
        <button onClick={(e) => { e.stopPropagation(); navigate(`/app/sales/${row.id}`); }} className="btn-ghost btn-sm"><Eye size={14} /></button>
        {!isViewer && (row.status === 'draft' || row.status === 'pending') && <button onClick={(e) => { e.stopPropagation(); handleApprove(row.id); }} className="btn-ghost btn-sm text-emerald-400"><CheckCircle size={14} /></button>}
        {!isViewer && row.status !== 'approved' && row.status !== 'cancelled' && <button onClick={(e) => { e.stopPropagation(); handleCancel(row.id); }} className="btn-ghost btn-sm text-red-400" title="Cancelar venda"><XCircle size={14} /></button>}
        {!isViewer && <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="btn-ghost btn-sm text-red-400" title="Deletar venda"><Trash2 size={14} /></button>}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Vendas" subtitle={`${data.length} vendas`} action={userData?.role !== 'viewer' && <button onClick={() => navigate('/app/sales/new')} className="btn-primary"><Plus size={18} /> Nova Venda</button>} />
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
        <DataTable columns={columns} data={data} loading={loading} onRowClick={(row) => navigate(`/app/sales/${row.id}`)} />
      </div>
    </div>
  );
}
