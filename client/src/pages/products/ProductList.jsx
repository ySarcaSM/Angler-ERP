import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { listProducts, createProduct, updateProduct, deleteProduct } from '../../services/firebase/products';
import { listLocations } from '../../services/firebase/locations';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { formatBRL } from '../../utils/format';
import { logAudit } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const EMPTY = { name: '', description: '', costPrice: 0, sellPrice: 0, stock: { current: 0, minimum: 0, maximum: 0, location: '' }, active: true };

export default function ProductList() {
  const { company, user, userData } = useAuth();
  const isOperator = userData?.role === 'operator';
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(urlSearch);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const opts = { pageSize: 200, searchTerm: search };
      const res = await listProducts(company.id, opts);
      let products = res.data;
      if (filter === 'active') {
        products = products.filter((product) => product.active);
      }
      if (filter === 'lowStock') {
        products = products.filter((p) => (p.stock?.current || 0) <= (p.stock?.minimum || 0) && p.active);
      }
      setData(products);
    } catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
    finally { setLoading(false); }
  }, [company, search, filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);

  useEffect(() => {
    if (!company?.id) return;
    listLocations(company.id, { pageSize: 200 })
      .then((result) => setLocations(result.data))
      .catch((error) => toast.error(`Erro ao carregar localizações: ${error.message}`));
  }, [company]);

  const openNew = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (p) => { setForm({ ...EMPTY, ...p, stock: { ...EMPTY.stock, ...p.stock } }); setEditing(p.id); setModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const { code, category, unit, barcode, ...productData } = form;
      productData.costPrice = Number(productData.costPrice) || 0;
      productData.sellPrice = Number(productData.sellPrice) || 0;
      productData.stock = {
        ...productData.stock,
        current: Number(productData.stock.current) || 0,
        minimum: Number(productData.stock.minimum) || 0,
        maximum: Number(productData.stock.maximum) || 0,
      };
      if (editing) {
        const previousProduct = data.find((product) => product.id === editing);
        await updateProduct(editing, productData);
        await logAudit(company.id, { user, userName: userData?.name, action: 'update', entity: 'Produto', entityId: editing, description: `${userData?.name || 'Usuário'} alterou o produto ${productData.name}.`, details: { antes: { name: previousProduct?.name, sellPrice: previousProduct?.sellPrice, stock: previousProduct?.stock }, depois: { name: productData.name, sellPrice: productData.sellPrice, stock: productData.stock } } });
        toast.success('Produto atualizado!');
      } else {
        const createdProduct = await createProduct(company.id, productData);
        await logAudit(company.id, { user, userName: userData?.name, action: 'create', entity: 'Produto', entityId: createdProduct.id, description: `${userData?.name || 'Usuário'} criou o produto ${productData.name}.`, details: { name: productData.name, sellPrice: productData.sellPrice, stock: productData.stock } });
        toast.success('Produto criado!');
      }
      setModal(false); load();
    } catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
    finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Remover ${p.name}?`)) return;
    try {
      await deleteProduct(p.id);
      await logAudit(company.id, { user, userName: userData?.name, action: 'delete', entity: 'Produto', entityId: p.id, description: `${userData?.name || 'Usuário'} excluiu o produto ${p.name}.`, details: { name: p.name, sellPrice: p.sellPrice } });
      toast.success('Removido.'); load();
    }
    catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
  };

  const stockBadge = (p) => {
    if ((p.stock?.current || 0) <= 0) return <span className="badge-danger">Sem estoque</span>;
    if ((p.stock?.current || 0) <= (p.stock?.minimum || 0)) return <span className="badge-warning">Baixo</span>;
    return <span className="badge-success">OK</span>;
  };

  const columns = [
    { key: 'name', label: 'Produto', render: (v) => <div className="font-medium text-dark-100">{v}</div> },
    { key: 'sellPrice', label: 'Preço', render: (v) => <span className="font-medium text-dark-100">{formatBRL(v)}</span> },
    { key: 'stock', label: 'Estoque', render: (v, row) => <div className="flex items-center gap-2"><span className="font-mono text-dark-200">{v?.current || 0}</span>{stockBadge(row)}</div> },
    { key: '_actions', label: '', width: '80px', render: (_, row) => <div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="btn-ghost btn-sm"><Edit2 size={14} /></button><button onClick={(e) => { e.stopPropagation(); handleDelete(row); }} className="btn-ghost btn-sm text-red-400"><Trash2 size={14} /></button></div> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Produtos" subtitle={`${data.length} produtos`} action={!isOperator && <button onClick={openNew} className="btn-primary"><Plus size={18} /> Novo Produto</button>} />
      <div className="card">
        <div className="card-header flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-dark-800 rounded-xl px-4 py-2 flex-1 max-w-sm">
            <Search size={16} className="text-dark-500" />
            <input type="text" placeholder="Buscar produtos..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {[{ key: 'all', label: 'Todos' }, { key: 'active', label: 'Ativos' }, { key: 'lowStock', label: 'Estoque Baixo', icon: AlertTriangle }].map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={`btn-sm inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${f.key === 'lowStock' ? 'min-w-[120px]' : 'min-w-[68px]'} ${filter === f.key ? 'bg-primary-600 text-white' : 'btn-secondary'}`}>
                {f.icon && <f.icon size={14} className="shrink-0" />}<span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
        <DataTable columns={columns} data={data} loading={loading} onRowClick={openEdit} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Produto' : 'Novo Produto'} size="xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div><label className="label">Descrição</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="border-t border-dark-800 pt-4">
            <h4 className="text-sm font-medium text-dark-300 mb-3">Preços</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Preço de Custo</label><input type="number" step="0.01" className="input" value={form.costPrice === 0 ? '' : form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} /></div>
              <div><label className="label">Preço de Venda</label><input type="number" step="0.01" className="input" value={form.sellPrice === 0 ? '' : form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} /></div>
            </div>
          </div>
          <div className="border-t border-dark-800 pt-4">
            <h4 className="text-sm font-medium text-dark-300 mb-3">Estoque</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><label className="label">Atual</label><input type="number" className="input" value={form.stock.current === 0 ? '' : form.stock.current} onChange={(e) => setForm({ ...form, stock: { ...form.stock, current: e.target.value } })} /></div>
              <div><label className="label">Mínimo</label><input type="number" className="input" value={form.stock.minimum === 0 ? '' : form.stock.minimum} onChange={(e) => setForm({ ...form, stock: { ...form.stock, minimum: e.target.value } })} /></div>
              <div><label className="label">Máximo</label><input type="number" className="input" value={form.stock.maximum === 0 ? '' : form.stock.maximum} onChange={(e) => setForm({ ...form, stock: { ...form.stock, maximum: e.target.value } })} /></div>
              <div><label className="label">Localização</label><select className="input" value={form.stock.location || ''} onChange={(e) => setForm({ ...form, stock: { ...form.stock, location: e.target.value } })}><option value="">Selecione</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
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
