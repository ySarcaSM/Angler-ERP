import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listProducts, createProduct, updateProduct, deleteProduct } from '../../services/firebase/products';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { formatBRL } from '../../utils/format';
import toast from 'react-hot-toast';

const EMPTY = { name: '', code: '', description: '', category: '', unit: 'un', costPrice: 0, sellPrice: 0, stock: { current: 0, minimum: 0, maximum: 0, location: '' }, barcode: '', active: true };

export default function ProductList() {
  const { company } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const opts = { pageSize: 200, searchTerm: search };
      if (filter === 'active') opts.filters = [{ field: 'active', op: '==', value: true }];
      const res = await listProducts(company.id, opts);
      let products = res.data;
      if (filter === 'lowStock') {
        products = products.filter((p) => (p.stock?.current || 0) <= (p.stock?.minimum || 0) && p.active);
      }
      setData(products);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [company, search, filter]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (p) => { setForm({ ...EMPTY, ...p, stock: { ...EMPTY.stock, ...p.stock } }); setEditing(p.id); setModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await updateProduct(editing, form); toast.success('Produto atualizado!'); }
      else { await createProduct(company.id, form); toast.success('Produto criado!'); }
      setModal(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Remover ${p.name}?`)) return;
    try { await deleteProduct(p.id); toast.success('Removido.'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const stockBadge = (p) => {
    if ((p.stock?.current || 0) <= 0) return <span className="badge-danger">Sem estoque</span>;
    if ((p.stock?.current || 0) <= (p.stock?.minimum || 0)) return <span className="badge-warning">Baixo</span>;
    return <span className="badge-success">OK</span>;
  };

  const columns = [
    { key: 'code', label: 'Código', render: (v) => <span className="font-mono text-dark-400 text-xs">{v || '—'}</span> },
    { key: 'name', label: 'Produto', render: (v, row) => <div><div className="font-medium text-dark-100">{v}</div>{row.category && <div className="text-xs text-dark-500">{row.category}</div>}</div> },
    { key: 'sellPrice', label: 'Preço', render: (v) => <span className="font-medium text-dark-100">{formatBRL(v)}</span> },
    { key: 'stock', label: 'Estoque', render: (v, row) => <div className="flex items-center gap-2"><span className="font-mono text-dark-200">{v?.current || 0} {row.unit}</span>{stockBadge(row)}</div> },
    { key: '_actions', label: '', width: '80px', render: (_, row) => <div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="btn-ghost btn-sm"><Edit2 size={14} /></button><button onClick={(e) => { e.stopPropagation(); handleDelete(row); }} className="btn-ghost btn-sm text-red-400"><Trash2 size={14} /></button></div> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Produtos" subtitle={`${data.length} produtos`} action={<button onClick={openNew} className="btn-primary"><Plus size={18} /> Novo Produto</button>} />
      <div className="card">
        <div className="card-header flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-dark-800 rounded-xl px-4 py-2 flex-1 max-w-sm">
            <Search size={16} className="text-dark-500" />
            <input type="text" placeholder="Buscar produtos..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {[{ key: 'all', label: 'Todos' }, { key: 'active', label: 'Ativos' }, { key: 'lowStock', label: 'Estoque Baixo', icon: AlertTriangle }].map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={`btn-sm ${filter === f.key ? 'bg-primary-600 text-white' : 'btn-secondary'}`}>
                {f.icon && <f.icon size={14} />} {f.label}
              </button>
            ))}
          </div>
        </div>
        <DataTable columns={columns} data={data} loading={loading} onRowClick={openEdit} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Produto' : 'Novo Produto'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="label">Código (SKU)</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="label">Nome *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label className="label">Categoria</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><label className="label">Unidade</label><select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option value="un">Unidade</option><option value="kg">Quilograma</option><option value="m">Metro</option><option value="l">Litro</option><option value="cx">Caixa</option></select></div>
            <div><label className="label">Código de Barras</label><input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
          </div>
          <div><label className="label">Descrição</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="border-t border-dark-800 pt-4">
            <h4 className="text-sm font-medium text-dark-300 mb-3">Preços</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Preço de Custo</label><input type="number" step="0.01" className="input" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="label">Preço de Venda</label><input type="number" step="0.01" className="input" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: parseFloat(e.target.value) || 0 })} /></div>
            </div>
          </div>
          <div className="border-t border-dark-800 pt-4">
            <h4 className="text-sm font-medium text-dark-300 mb-3">Estoque</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><label className="label">Atual</label><input type="number" className="input" value={form.stock.current} onChange={(e) => setForm({ ...form, stock: { ...form.stock, current: parseFloat(e.target.value) || 0 } })} /></div>
              <div><label className="label">Mínimo</label><input type="number" className="input" value={form.stock.minimum} onChange={(e) => setForm({ ...form, stock: { ...form.stock, minimum: parseFloat(e.target.value) || 0 } })} /></div>
              <div><label className="label">Máximo</label><input type="number" className="input" value={form.stock.maximum} onChange={(e) => setForm({ ...form, stock: { ...form.stock, maximum: parseFloat(e.target.value) || 0 } })} /></div>
              <div><label className="label">Localização</label><input className="input" value={form.stock.location} onChange={(e) => setForm({ ...form, stock: { ...form.stock, location: e.target.value } })} /></div>
            </div>
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
