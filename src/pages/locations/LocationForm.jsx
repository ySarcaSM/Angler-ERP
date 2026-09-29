import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { createLocation, getLocation, updateLocation } from '../../services/firebase/locations';
import { logAudit } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const EMPTY = {
  name: '',
  notes: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
};

const formatCep = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

export default function LocationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { company, user, userData } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!id || !company?.id) {
      setLoading(false);
      return;
    }

    getLocation(id)
      .then((location) => {
        if (location) setForm({ ...EMPTY, ...location });
        else toast.error('Localização não encontrada.');
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [id, company?.id]);

  const lookup = async (value) => {
    const digits = value.replace(/\D/g, '');
    setForm((current) => ({ ...current, cep: formatCep(value) }));

    if (digits.length !== 8) return;

    setLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();

      if (data.erro) throw new Error('CEP não encontrado.');

      setForm((current) => ({
        ...current,
        cep: formatCep(digits),
        street: data.logradouro || current.street,
        neighborhood: data.bairro || current.neighborhood,
        city: data.localidade || current.city,
        state: data.uf || current.state,
      }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error('Informe o nome da localização.');

    setSaving(true);
    try {
      const location = id
        ? await updateLocation(id, form)
        : await createLocation(company.id, form);

      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: id ? 'update' : 'create',
        entity: 'Localização',
        entityId: id || location.id,
        description: `${userData?.name || 'Usuário'} ${id ? 'alterou' : 'criou'} a localização ${form.name}.`,
      });

      toast.success(id ? 'Localização atualizada!' : 'Localização criada!');
      navigate('/app/locations');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" className="btn-ghost" onClick={() => navigate('/app/locations')}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <h1 className="text-2xl font-bold text-dark-100">
          {id ? 'Editar Localização' : 'Nova Localização'}
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card">
          <div className="card-body space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">CEP</label>
                <div className="relative">
                  <input className="input pr-10" value={form.cep} onChange={(e) => lookup(e.target.value)} maxLength={9} />
                  {loading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary-400" />}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="label">Logradouro</label>
                <input className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              </div>
              <div>
                <label className="label">Número</label>
                <input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </div>
              <div>
                <label className="label">Bairro</label>
                <input className="input" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
              </div>
              <div>
                <label className="label">Cidade</label>
                <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="label">Estado</label>
                <input className="input" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="label">Observações</label>
              <textarea className="input" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/app/locations')}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving || loading}>
            {saving ? 'Salvando...' : (
              <>
                <Save size={18} />
                {id ? 'Salvar alterações' : 'Criar Localização'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
