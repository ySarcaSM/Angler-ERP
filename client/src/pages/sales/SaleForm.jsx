import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createSale, getSale } from '../../services/firebase/sales';
import { listClients } from '../../services/firebase/clients';
import { listProducts } from '../../services/firebase/products';
import { formatBRL } from '../../utils/format';
import toast from 'react-hot-toast';

export default function SaleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { company, user, userData } = useAuth();
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
      if (p) { items[i].productName = p.name; items[i].unitPrice = p.sellPrice; }
    }
    items[i].total = (items[i].quantity * items[i].unitPrice) - (items[i].discount || 0);
    setForm({ ...form, items });
  };

  const subtotal = form.items.reduce((sum, i) => sum + i.total, 0);
  const total = subtotal - form.discount + form.shipping + form.tax;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clientId) return toast.error('Selecione um cliente.');
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === form.clientId);
      await createSale(company.id, { ...form, clientName: client?.name || form.clientName }, { ...user, displayName: userData?.name || user.email });
      toast.success('Venda criada!');
      navigate('/sales');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/sales')} className="btn-ghost"><ArrowLeft size={18} /> Voltar</button>
        <h1 className="text-2xl font-bold text-dark-100">Nova Venda</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card"><div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="label">Tipo</label><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="order">Pedido</option><option value="budget">Orçamento</option></select></div>
            <div><label className="label">Cliente *</label><select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required><option value="">Selecione...</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label">Pagamento</label><select className="input" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="credit_card">Crédito</option><option value="debit_card">Débito</option><option value="bank_transfer">Transferência</option></select></div>
          </div>
        </div></div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-dark-200">Itens</h3>
            <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { productId: '', productName: '', quantity: 1, unitPrice: 0, discount: 0, total: 0 }] })} className="btn-secondary btn-sm"><Plus size={14} /> Adicionar</button>
          </div>
          <div className="card-body space-y-3">
            {form.items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-4">{i === 0 && <label className="label">Produto</label>}<select className="input" value={item.productId} onChange={(e) => updateItem(i, 'productId', e.target.value)}><option value="">Selecione...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="col-span-2">{i === 0 && <label className="label">Qtd</label>}<input type="number" min="0.01" className="input" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                <div className="col-span-2">{i === 0 && <label className="label">Preço</label>}<input type="number" step="0.01" className="input" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} /></div>
                <div className="col-span-2">{i === 0 && <label className="label">Total</label>}<div className="input bg-dark-950 text-dark-300">{formatBRL(item.total)}</div></div>
                <div className="col-span-2">{i === 0 && <label className="label">&nbsp;</label>}<button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })} className="btn-ghost btn-sm text-red-400 w-full" disabled={form.items.length === 1}><Trash2 size={14} /></button></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card"><div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="label">Observações</label><textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-dark-400">Subtotal</span><span className="text-dark-200">{formatBRL(subtotal)}</span></div>
              <div className="flex justify-between text-sm items-center"><span className="text-dark-400">Desconto</span><input type="number" step="0.01" className="input max-w-[120px] text-right" value={form.discount} onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} /></div>
              <div className="flex justify-between text-sm items-center"><span className="text-dark-400">Frete</span><input type="number" step="0.01" className="input max-w-[120px] text-right" value={form.shipping} onChange={(e) => setForm({ ...form, shipping: parseFloat(e.target.value) || 0 })} /></div>
              <div className="border-t border-dark-800 pt-3 flex justify-between"><span className="text-lg font-semibold text-dark-100">Total</span><span className="text-lg font-bold text-primary-400">{formatBRL(total)}</span></div>
            </div>
          </div>
        </div></div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/sales')}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : <><Save size={18} /> Criar Venda</>}</button>
        </div>
      </form>
    </div>
  );
}
