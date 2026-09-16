import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listPurchases, receivePurchase } from '../../services/firebase/purchases';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import { formatBRL, formatDate, statusLabel } from '../../utils/format';
import toast from 'react-hot-toast';

export default function PurchaseList() {
  const { company } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try { const res = await listPurchases(company.id, { pageSize: 100 }); setData(res.data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const handleReceive = async (id) => {
    try { await receivePurchase(id, company.id); toast.success('Recebida! Estoque atualizado.'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'number', label: '#', render: (v) => <span className="font-mono text-primary-400">#{v}</span> },
    { key: 'supplierName', label: 'Fornecedor' },
    { key: 'total', label: 'Total', render: (v) => <span className="font-semibold text-dark-100">{formatBRL(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={{ draft: 'badge-neutral', ordered: 'badge-info', received: 'badge-success', cancelled: 'badge-danger' }[v] || 'badge-neutral'}>{statusLabel(v)}</span> },
    { key: 'createdAt', label: 'Data', render: (v) => <span className="text-dark-500 text-xs">{formatDate(v?.toDate?.() || v)}</span> },
    { key: '_actions', label: '', width: '60px', render: (_, row) => (row.status === 'ordered' || row.status === 'draft') ? <button onClick={(e) => { e.stopPropagation(); handleReceive(row.id); }} className="btn-ghost btn-sm text-emerald-400"><CheckCircle size={14} /></button> : null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Compras" subtitle={`${data.length} compras`} action={<button className="btn-primary"><Plus size={18} /> Nova Compra</button>} />
      <div className="card">
        <div className="card-header"><div className="flex items-center gap-2 bg-dark-800 rounded-xl px-4 py-2 max-w-sm"><Search size={16} className="text-dark-500" /><input type="text" placeholder="Buscar..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        <DataTable columns={columns} data={data} loading={loading} />
      </div>
    </div>
  );
}
