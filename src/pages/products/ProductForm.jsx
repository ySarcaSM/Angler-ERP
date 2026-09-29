import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { createProduct, getProduct, updateProduct } from '../../services/firebase/products';
import { listLocations } from '../../services/firebase/locations';
import { logAudit } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const EMPTY = {
  name: '',
  description: '',
  costPrice: 0,
  sellPrice: 0,
  stock: { current: 0, minimum: 0, maximum: 0, location: '' },
  active: true,
};

export default function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { company, user, userData } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    listLocations(company.id, { pageSize: 200 })
      .then((result) => setLocations(result.data))
      .catch((error) => toast.error(error.message));
  }, [company]);

  useEffect(() => {
    if (!id || !company?.id) return;
    getProduct(id)
      .then((product) => {
        if (product) {
          setForm({
            ...EMPTY,
            ...product,
            stock: { ...EMPTY.stock, ...product.stock },
          });
        } else {
          toast.error('Produto não encontrado.');
        }
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [id, company?.id]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error('Informe o nome do produto.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        costPrice: Number(form.costPrice) || 0,
        sellPrice: Number(form.sellPrice) || 0,
        stock: {
          ...form.stock,
          current: Number(form.stock.current) || 0,
          minimum: Number(form.stock.minimum) || 0,
          maximum: Number(form.stock.maximum) || 0,
        },
      };

      const product = id
        ? await updateProduct(id, payload)
        : await createProduct(company.id, payload);

      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: id ? 'update' : 'create',
        entity: 'Produto',
        entityId: id || product.id,
        description: `${userData?.name || 'Usuário'} ${id ? 'alterou' : 'criou'} o produto ${payload.name}.`,
      });

      toast.success(id ? 'Produto atualizado!' : 'Produto criado!');
      navigate('/app/products');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" className="btn-ghost" onClick={() => navigate('/app/products')}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <h1 className="text-2xl font-bold text-dark-100">
          {id ? 'Editar Produto' : 'Novo Produto'}
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card">
          <div className="card-body space-y-5">
            <div>
              <label className="label">Nome *</label>
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Descrição</label>
              <textarea
                className="input"
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>

            <div className="border-t border-dark-800 pt-5">
              <h3 className="text-sm font-semibold text-dark-200 mb-3">Preços</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Preço de Custo</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.costPrice || ''}
                    onChange={(event) => setForm({ ...form, costPrice: event.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Preço de Venda</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.sellPrice || ''}
                    onChange={(event) => setForm({ ...form, sellPrice: event.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-dark-800 pt-5">
              <h3 className="text-sm font-semibold text-dark-200 mb-3">Estoque</h3>
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  ['current', 'Atual'],
                  ['minimum', 'Mínimo'],
                  ['maximum', 'Máximo'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input
                      type="number"
                      className="input"
                      value={form.stock[key] || ''}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          stock: { ...form.stock, [key]: event.target.value },
                        })
                      }
                    />
                  </div>
                ))}

                <div>
                  <label className="label">Localização</label>
                  <select
                    className="input"
                    value={form.stock.location}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        stock: { ...form.stock, location: event.target.value },
                      })
                    }
                  >
                    <option value="">Selecione</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/app/products')}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving || loading}>
            {saving ? (
              'Salvando...'
            ) : (
              <span className="flex items-center gap-2">
                <Save size={18} />
                {id ? 'Salvar alterações' : 'Criar Produto'}
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
