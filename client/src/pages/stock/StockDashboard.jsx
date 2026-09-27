import React, { useState, useEffect } from 'react';
import { Warehouse, AlertTriangle, ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { listMovements, adjustStock, getSummary } from '../../services/firebase/stock';
import { listProducts } from '../../services/firebase/products';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { formatBRL, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';
import { logAudit } from '../../services/firebase/settings';

export default function StockDashboard() {
  const { company, user, userData } = useAuth();
  const isOperator = userData?.role === 'operator';
  const isViewer = userData?.role === 'viewer';
  const [summary, setSummary] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStock, setLowStock] = useState([]);
  const [modal, setModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ productId: '', quantity: 0, reason: '', type: 'entry' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [s, m, prods] = await Promise.all([
        getSummary(company.id),
        listMovements(company.id, { pageSize: 50 }),
        listProducts(company.id, { pageSize: 500 }),
      ]);
      setSummary(s);
      setMovements(m.data);
      setProducts(prods.data);
      setLowStock(prods.data.filter((p) => (p.stock?.current || 0) <= (p.stock?.minimum || 0) && p.active));
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [company]);

  const handleAdjust = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const product = products.find((p) => p.id === form.productId);
      const adjustment = await adjustStock(company.id, { ...form, productName: product?.name }, user);
      await logAudit(company.id, { user, userName: userData?.name, action: 'adjust', entity: 'Estoque', entityId: form.productId, description: `${userData?.name || 'Usuário'} ajustou o estoque de ${product?.name || form.productId}: ${form.type === 'entry' ? 'entrada' : 'saída'} de ${form.quantity}.`, details: { productName: product?.name, type: form.type, quantity: form.quantity, previousStock: adjustment.previousStock, newStock: adjustment.newStock, reason: form.reason } });
      toast.success('Estoque ajustado!'); setModal(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'type', label: 'Tipo', render: (v) => {
      const m = { entry: { icon: ArrowDown, color: 'text-emerald-400', label: 'Entrada' }, exit: { icon: ArrowUp, color: 'text-red-400', label: 'Saída' }, adjustment: { icon: Warehouse, color: 'text-amber-400', label: 'Ajuste' } };
      const t = m[v] || m.adjustment;
      return <span className={`flex items-center gap-1 ${t.color}`}><t.icon size={14} /> {t.label}</span>;
    }},
    { key: 'productName', label: 'Produto' },
    { key: 'quantity', label: 'Qtd', render: (v, row) => <span className="font-mono">{row.type === 'exit' ? '-' : '+'}{v}</span> },
    { key: 'previousStock', label: 'Antes', render: (v) => <span className="font-mono text-dark-400">{v}</span> },
    { key: 'newStock', label: 'Depois', render: (v) => <span className="font-mono text-dark-200">{v}</span> },
    { key: 'reason', label: 'Motivo', render: (v) => <span className="text-dark-400 text-xs">{v || '—'}</span> },
    { key: 'createdAt', label: 'Data', render: (v) => <span className="text-dark-500 text-xs">{formatDate(v?.toDate?.() || v)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" subtitle="Controle de movimentações" action={!isViewer && <button onClick={() => setModal(true)} className="btn-primary"><Plus size={18} /> Ajustar Estoque</button>} />
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card p-5"><div className="text-sm text-dark-400 mb-1">Total de Produtos</div><div className="text-2xl font-bold text-dark-100">{summary.totalProducts}</div></div>
          <div className="card p-5"><div className="text-sm text-dark-400 mb-1">Estoque Baixo</div><div className="text-2xl font-bold text-amber-400">{summary.lowStock}</div></div>
          <div className="card p-5"><div className="text-sm text-dark-400 mb-1">Sem Estoque</div><div className="text-2xl font-bold text-red-400">{summary.outOfStock}</div></div>
          <div className="card p-5"><div className="text-sm text-dark-400 mb-1">Valor em Estoque</div><div className="text-2xl font-bold text-dark-100">{formatBRL(summary.totalValue)}</div></div>
        </div>
      )}
      {lowStock.length > 0 && (
        <div className="card border-amber-500/30 bg-amber-500/5">
          <div className="card-header flex items-center gap-2"><AlertTriangle size={16} className="text-amber-400" /><h3 className="text-sm font-semibold text-amber-300">Produtos com Estoque Baixo</h3></div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-dark-900/50 rounded-xl px-4 py-3">
                <div><div className="text-sm font-medium text-dark-200">{p.name}</div><div className="text-xs text-dark-500">{p.code || 'Sem código'}</div></div>
                <div className="text-right"><div className="text-lg font-bold text-red-400">{p.stock?.current || 0}</div><div className="text-xs text-dark-500">mín: {p.stock?.minimum || 0}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card"><div className="card-header"><h3 className="text-sm font-semibold text-dark-200">Movimentações Recentes</h3></div>
        <DataTable columns={columns} data={movements} loading={loading} />
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Ajustar Estoque">
        <form onSubmit={handleAdjust} className="space-y-4">
          <div><label className="label">Produto *</label><select className="input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required><option value="">Selecione...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} (atual: {p.stock?.current || 0})</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Tipo</label><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="entry">Entrada (+)</option><option value="exit">Saída (-)</option></select></div>
            <div><label className="label">Quantidade *</label><input type="number" min="0.01" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} required /></div>
          </div>
          <div><label className="label">Motivo</label><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Devolução, Correção..." /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Confirmar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
