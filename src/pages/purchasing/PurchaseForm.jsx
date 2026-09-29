import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { createPurchase, getPurchase, updatePurchase } from '../../services/firebase/purchases';
import { listSuppliers } from '../../services/firebase/suppliers';
import { listProducts } from '../../services/firebase/products';
import { logAudit } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const ITEM = {
  productId: '',
  productName: '',
  quantity: 1,
  unitCost: 0,
};

export default function PurchaseForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { company, user, userData } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplierId: '',
    supplierName: '',
    items: [{ ...ITEM }],
  });

  useEffect(() => {
    if (!company?.id) return;

    Promise.all([
      listSuppliers(company.id, { pageSize: 200 }),
      listProducts(company.id, { pageSize: 200 }),
    ])
      .then(([supplierResult, productResult]) => {
        setSuppliers(supplierResult.data);
        setProducts(productResult.data);
      })
      .catch((error) => toast.error(error.message));
  }, [company]);

  useEffect(() => {
    if (!id) return;

    getPurchase(id)
      .then((purchase) => {
        if (!purchase) {
          toast.error('Compra não encontrada.');
          return;
        }

        setForm({
          supplierId: purchase.supplierId || '',
          supplierName: purchase.supplierName || '',
          items: purchase.items?.length ? purchase.items : [{ ...ITEM }],
        });
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [id]);

  const updateItem = (index, key, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [key]: value };

    if (key === 'productId') {
      const product = products.find((item) => item.id === value);
      if (product) {
        items[index].productName = product.name;
        items[index].unitCost = Number(product.costPrice) || 0;
      }
    }

    setForm({ ...form, items });
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.supplierId) {
      toast.error('Selecione um fornecedor.');
      return;
    }

    if (form.items.some((item) => !item.productId || Number(item.quantity) < 1)) {
      toast.error('Adicione produtos com quantidade válida.');
      return;
    }

    setSaving(true);

    try {
      const supplier = suppliers.find((item) => item.id === form.supplierId);
      const payload = {
        supplierId: form.supplierId,
        supplierName: supplier?.name || '',
        items: form.items.map((item) => ({
          ...item,
          quantity: Math.floor(Number(item.quantity)),
          unitCost: Number(item.unitCost) || 0,
        })),
        shipping: 0,
        tax: 0,
        paymentMethod: 'pix',
      };

      const purchase = id
        ? await updatePurchase(id, payload)
        : await createPurchase(company.id, payload, user);

      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: id ? 'update' : 'create',
        entity: 'Compra',
        entityId: id || purchase.id,
        description: `${userData?.name || 'Usuário'} ${id ? 'alterou' : 'criou'} a compra #${purchase.number || purchase.id}.`,
      });

      toast.success(id ? 'Compra atualizada!' : 'Compra criada!');
      navigate('/app/purchases');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-dark-300">Carregando compra...</div>;
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => navigate('/app/purchases')}
        >
          <ArrowLeft size={18} />
          Voltar
        </button>
        <h1 className="text-2xl font-bold text-dark-100">
          {id ? 'Editar Compra' : 'Nova Compra'}
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card">
          <div className="card-body">
            <label className="label">Fornecedor *</label>
            <select
              className="input"
              value={form.supplierId}
              onChange={(event) =>
                setForm({ ...form, supplierId: event.target.value })
              }
              required
            >
              <option value="">Selecione...</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex justify-between">
            <h3 className="text-sm font-semibold text-dark-200">Itens</h3>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() =>
                setForm({
                  ...form,
                  items: [...form.items, { ...ITEM }],
                })
              }
            >
              <Plus size={14} />
              Adicionar
            </button>
          </div>

          <div className="card-body space-y-3">
            {form.items.map((item, index) => (
              <div
                className="grid grid-cols-12 gap-3 items-end"
                key={index}
              >
                <div className="col-span-5">
                  <label className="label">Produto *</label>
                  <select
                    className="input"
                    value={item.productId}
                    onChange={(event) =>
                      updateItem(index, 'productId', event.target.value)
                    }
                    required
                  >
                    <option value="">Selecione...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="label">Qtd *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="input"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, 'quantity', event.target.value)
                    }
                    required
                  />
                </div>

                <div className="col-span-3">
                  <label className="label">Custo unitário</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={item.unitCost}
                    onChange={(event) =>
                      updateItem(index, 'unitCost', event.target.value)
                    }
                  />
                </div>

                <button
                  type="button"
                  className="btn-ghost btn-sm text-red-400 col-span-2"
                  disabled={form.items.length === 1}
                  onClick={() =>
                    setForm({
                      ...form,
                      items: form.items.filter((_, itemIndex) => itemIndex !== index),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/app/purchases')}
          >
            Cancelar
          </button>

          <button className="btn-primary" disabled={saving}>
            {saving ? (
              'Salvando...'
            ) : (
              <>
                <Save size={18} />
                {id ? 'Salvar alterações' : 'Criar Compra'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
