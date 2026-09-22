import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, CheckCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { listPurchases, receivePurchase, createPurchase } from '../../services/firebase/purchases';
import { listSuppliers } from '../../services/firebase/suppliers';
import { listProducts } from '../../services/firebase/products';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { formatBRL, formatDate, statusLabel } from '../../utils/format';
import toast from 'react-hot-toast';
import { logAudit } from '../../services/firebase/settings';

export default function PurchaseList() {
  const { company, user, userData } = useAuth();
  const isOperator = userData?.role === 'operator';
  const isViewer = userData?.role === 'viewer';
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplierId: '', supplierName: '', items: [{ productId: '', productName: '', quantity: 1, unitCost: 0 }] });

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try { const res = await listPurchases(company.id, { pageSize: 100 }); setData(res.data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [company]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!company?.id) return;
    Promise.all([
      listSuppliers(company.id, { pageSize: 200 }),
      listProducts(company.id, { pageSize: 200 }),
    ]).then(([supplierResult, productResult]) => {
      setSuppliers(supplierResult.data);
      setProducts(productResult.data);
    }).catch((error) => toast.error(error.message));
  }, [company]);

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    if (field === 'productId') {
      const product = products.find((item) => item.id === value);
      if (product) {
        items[index].productName = product.name;
        items[index].unitCost = Number(product.costPrice) || 0;
      }
    }
    setForm({ ...form, items });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.supplierId) return toast.error('Selecione um fornecedor.');
    if (!form.items.length || form.items.some((item) => !item.productId || Number(item.quantity) < 1)) {
      return toast.error('Adicione pelo menos um produto com quantidade válida.');
    }
    setSaving(true);
    try {
      const supplier = suppliers.find((item) => item.id === form.supplierId);
      const createdPurchase = await createPurchase(company.id, {
        supplierId: form.supplierId,
        supplierName: supplier?.name || form.supplierName,
        items: form.items.map((item) => ({ ...item, quantity: Math.floor(Number(item.quantity)), unitCost: Number(item.unitCost) || 0 })),
        shipping: 0,
        tax: 0,
        paymentMethod: 'pix',
      }, user);
      await logAudit(company.id, { user, userName: userData?.name, action: 'create', entity: 'Compra', entityId: createdPurchase.id, description: `${userData?.name || 'Usuário'} criou a compra #${createdPurchase.number || createdPurchase.id}.`, details: { supplierName: supplier?.name, total: createdPurchase.total, itemCount: form.items.length } });
      toast.success('Compra criada!');
      setModal(false);
      setForm({ supplierId: '', supplierName: '', items: [{ productId: '', productName: '', quantity: 1, unitCost: 0 }] });
      load();
    } catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  };

  const handleReceive = async (id) => {
    try { const purchase = data.find((item) => item.id === id); await receivePurchase(id, company.id); await logAudit(company.id, { user, userName: userData?.name, action: 'receive', entity: 'Compra', entityId: id, description: `${userData?.name || 'Usuário'} recebeu a compra #${purchase?.number || id} e atualizou o estoque.`, details: { total: purchase?.total, supplierName: purchase?.supplierName } }); toast.success('Recebida! Estoque atualizado.'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'number', label: '#', render: (v) => <span className="font-mono text-primary-400">#{v}</span> },
    { key: 'supplierName', label: 'Fornecedor' },
    { key: 'total', label: 'Total', render: (v) => <span className="font-semibold text-dark-100">{formatBRL(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={{ draft: 'badge-neutral', ordered: 'badge-info', received: 'badge-success', cancelled: 'badge-danger' }[v] || 'badge-neutral'}>{statusLabel(v)}</span> },
    { key: 'createdAt', label: 'Data', render: (v) => <span className="text-dark-500 text-xs">{formatDate(v?.toDate?.() || v)}</span> },
    { key: '_actions', label: '', width: '60px', render: (_, row) => (!isViewer && (row.status === 'ordered' || row.status === 'draft')) ? <button onClick={(e) => { e.stopPropagation(); handleReceive(row.id); }} className="btn-ghost btn-sm text-emerald-400"><CheckCircle size={14} /></button> : null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Compras" subtitle={`${data.length} compras`} action={!isViewer && <button onClick={() => setModal(true)} className="btn-primary"><Plus size={18} /> Nova Compra</button>} />
      <div className="card">
        <div className="card-header"><div className="flex items-center gap-2 bg-dark-800 rounded-xl px-4 py-2 max-w-sm"><Search size={16} className="text-dark-500" /><input type="text" placeholder="Buscar..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        <DataTable columns={columns} data={data} loading={loading} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nova Compra" size="lg" backdropClassName="bg-transparent">
        <form onSubmit={handleCreate} className="space-y-5">
          <div><label className="label">Fornecedor *</label><select className="input" value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} required><option value="">Selecione...</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-dark-200">Itens</h3>{!isViewer && <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { productId: '', productName: '', quantity: 1, unitCost: 0 }] })} className="btn-secondary btn-sm"><Plus size={14} /> Adicionar</button>}</div>
            {form.items.map((item, index) => <div key={index} className="grid grid-cols-12 gap-3 items-end"><div className="col-span-5"><label className="label">Produto *</label><select className="input" value={item.productId} onChange={(event) => updateItem(index, 'productId', event.target.value)} required><option value="">Selecione...</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div><div className="col-span-2"><label className="label">Qtd *</label><input type="number" step="1" min="1" className="input" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} required /></div><div className="col-span-3"><label className="label">Custo unitário</label><input type="number" step="0.01" className="input" value={item.unitCost} onChange={(event) => updateItem(index, 'unitCost', event.target.value)} /></div>{!isViewer && <button type="button" className="btn-ghost btn-sm text-red-400 col-span-2" onClick={() => setForm({ ...form, items: form.items.filter((_, rowIndex) => rowIndex !== index) })} disabled={form.items.length === 1}><Trash2 size={14} /></button>}</div>)}
          </div>
          <div className="flex justify-end gap-3 border-t border-dark-800 pt-4"><button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>{!isViewer && <button type="submit' className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Criar Compra'}</button>}</div>
        </form>
      </Modal>
    </div>
  );
}
