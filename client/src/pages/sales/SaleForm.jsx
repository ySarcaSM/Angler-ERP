import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { createSale, getSale } from '../../services/firebase/sales';
import { listClients } from '../../services/firebase/clients';
import { listProducts } from '../../services/firebase/products';
import { formatBRL } from '../../utils/format';
import toast from 'react-hot-toast';
import { logAudit } from '../../services/firebase/settings';

export default function SaleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { company, user, userData } = useAuth();
  const isViewer = userData?.role === 'viewer';
  const [form, setForm] = useState({
    type: 'order', clientId: '', clientName: '',
    items: [{ productId: '', productName: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }],
    discount: 0, shipping: 0, tax: 0, paymentMethod: 'pix', dueDate: '', notes: '',
  });
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    Promise.all([
      listClients(company.id, { pageSize: 200 }),
      listProducts(company.id, { pageSize: 200 }),
    ]).then(([c, p]) => { setClients(c.data); setProducts(p.data); });

    if (id) {
      getSale(id).then((sale) => {
        if (sale) {
          setForm((prev) => ({
            ...prev,
            ...sale,
            clientId: sale.clientId || '',
            items: sale.items?.length ? sale.items : prev.items,
          }));
        }
      });
    }
  }, [company, id]);

  const updateItem = (i, field, value) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    if (field === 'productId') {
      const p = products.find((pr) => pr.id === value);
      if (p) {
        items[i].productName = p.name;
        items[i].unitPrice = Number(p.sellPrice) || 0;
        items[i].quantity = items[i].quantity === '' ? '' : Math.min(Number(items[i].quantity) || 1, Number(p.stock?.current) || 0);
      }
    }
    if (field === 'quantity') {
      const product = products.find((p) => p.id === items[i].productId);
      if (value !== '') {
        const quantity = Math.max(0, Math.floor(Number(value) || 0));
        const available = Number(product?.stock?.current) || 0;
        items[i].quantity = product ? Math.min(quantity, available) : quantity;
      }
    }
    items[i].total = ((Number(items[i].quantity) || 0) * (Number(items[i].unitPrice) || 0)) - (Number(items[i].discount) || 0);
    setForm({ ...form, items });
  };

  const subtotal = form.items.reduce((sum, i) => sum + i.total, 0);
  const discountAmount = subtotal * ((Number(form.discount) || 0) / 100);
  const total = subtotal - discountAmount + (Number(form.shipping) || 0) + (Number(form.tax) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientId) return toast.error('Selecione um cliente.');
    if (!form.items.length || form.items.some((item) => !item.productId)) return toast.error('Adicione pelo menos um produto à venda.');
    const quantitiesByProduct = form.items.reduce((totals, item) => ({
      ...totals,
      [item.productId]: (totals[item.productId] || 0) + Number(item.quantity),
    }), {});
    const invalidStock = Object.entries(quantitiesByProduct).find(([productId, quantity]) => {
      const product = products.find((item) => item.id === productId);
      return !Number.isInteger(Number(quantity)) || quantity < 1 || quantity > (Number(product?.stock?.current) || 0);
    });
    if (invalidStock) {
      const product = products.find((item) => item.id === invalidStock[0]);
      const available = Number(product?.stock?.current) || 0;
      return toast.error(`Estoque insuficiente para ${product?.name || 'este produto'}. Disponível: ${available}; solicitado: ${invalidStock[1]}.`);
    }
    if (Number(form.discount) < 0 || Number(form.discount) > 100) return toast.error('O desconto deve estar entre 0% e 100%.');
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === form.clientId);
      const createdSale = await createSale(company.id, { ...form, clientName: client?.name || form.clientName }, { ...user, displayName: userData?.name || user.email });
      await logAudit(company.id, { user, userName: userData?.name, action: 'create', entity: 'Venda', entityId: createdSale.id, description: `${userData?.name || 'Usuário'} criou a venda #${createdSale.number || createdSale.id} para ${client?.name || form.clientName}, no valor de ${formatBRL(createdSale.total)}.`, details: { number: createdSale.number, clientName: client?.name || form.clientName, total: createdSale.total, itemCount: form.items.length } });
      toast.success('Venda criada!');
      navigate('/app/sales');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/sales')} className="btn-ghost"><ArrowLeft size={18} /> Voltar</button>
        <h1 className="text-2xl font-bold text-dark-100">{id ? (isViewer ? "Visualizar Venda" : "Editar Venda") : "Nova Venda"}</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card"><div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="label">Tipo</label><select className="input" disabled={isViewer} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="order">Pedido</option><option value="budget">Orçamento</option></select></div>
            <div><label className="label">Cliente *</label><select className="input" disabled={isViewer} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required><option value="">Selecione...</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label">Pagamento</label><select className="input" disabled={isViewer} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="credit_card">Crédito</option><option value="debit_card">Débito</option><option value="bank_transfer">Transferência</option></select></div>
          </div>
        </div></div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-dark-200">Itens</h3>
            {!isViewer && <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { productId: '', productName: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }] })} className="btn-secondary btn-sm"><Plus size={14} /> Adicionar</button>}
          </div>
          <div className="card-body space-y-3">
            {form.items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-4">{i === 0 && <label className="label">Produto</label>}<select className="input" disabled={isViewer} value={item.productId} onChange={(e) => updateItem(i, 'productId', e.target.value)}><option value="">Selecione...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="col-span-2">{i === 0 && <label className="label">Qtd * {item.productId && <span className="font-normal text-[11px] text-dark-500">(Disponível: {products.find((product) => product.id === item.productId)?.stock?.current || 0})</span>}</label>}<input type="number" inputMode="numeric" step="1" className="input" disabled={isViewer} value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} /></div>
                <div className="col-span-2">{i === 0 && <label className="label">Preço</label>}<input type="number" step="0.01" className="input bg-dark-950/60" value={item.unitPrice} readOnly /></div>
                <div className="col-span-2">{i === 0 && <label className="label">Total</label>}<div className="input bg-dark-950 text-dark-300">{formatBRL(item.total)}</div></div>
                <div className="col-span-2">{i === 0 && <label className="label">&nbsp;</label>}{!isViewer && <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })} className="btn-ghost btn-sm text-red-400 w-full" disabled={form.items.length === 1}><Trash2 size={14} /></button>}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card"><div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="label">Observações</label><textarea className="input" disabled={isViewer} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-dark-400">Subtotal</span><span className="text-dark-200">{formatBRL(subtotal)}</span></div>
              <div className="flex justify-between text-sm items-center"><span className="text-dark-400">Desconto (%)</span><div className="relative max-w-[120px]"><input type="number" step="0.01" className="input pr-7 text-right" disabled={isViewer} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500">%</span></div></div>
              <div className="flex justify-between text-sm items-center"><span className="text-dark-400">Frete</span><input type="number" step="0.01" className="input max-w-[120px] text-right" disabled={isViewer} value={form.shipping} onChange={(e) => setForm({ ...form, shipping: parseFloat(e.target.value) || 0 })} /></div>
              <div className="border-t border-dark-800 pt-3 flex justify-between"><span className="text-lg font-semibold text-dark-100">Total</span><span className="text-lg font-bold text-primary-400">{formatBRL(total)}</span></div>
            </div>
          </div>
        </div></div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/app/sales')}>Cancelar</button>
          {!isViewer && <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : <><Save size={18} /> Criar Venda</>}</button>}
        </div>
      </form>
    </div>
  );
}
