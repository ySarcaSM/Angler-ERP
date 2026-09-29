import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { createClient, getClient, updateClient } from '../../services/firebase/clients';
import { formatPhone } from '../../utils/format';
import { logAudit } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const EMPTY = {
  name: '',
  document: '',
  email: '',
  phone: '',
  whatsapp: '',
  contact: '',
  address: { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' },
  notes: '',
  status: 'active',
};

function cpf(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function validCPF(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || /(\d)\1{10}/.test(digits)) return false;
  const check = (length) => {
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce((acc, digit, index) => acc + Number(digit) * (length + 1 - index), 0);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export default function ClientForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { company, user, userData } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    if (!id || !company?.id) return;
    getClient(id)
      .then((client) => {
        if (client) {
          setForm({
            ...EMPTY,
            ...client,
            address: { ...EMPTY.address, ...client.address },
          });
        } else {
          toast.error('Cliente não encontrado.');
        }
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [id, company?.id]);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};

    if (form.name.trim().length < 2) nextErrors.name = 'Informe o nome completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Informe um e-mail válido.';
    if (form.phone.replace(/\D/g, '').length < 10) nextErrors.phone = 'Informe um telefone válido.';
    if (!validCPF(form.document)) nextErrors.document = 'Informe um CPF válido.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !company?.id) return;

    setSaving(true);
    try {
      const client = id
        ? await updateClient(id, form)
        : await createClient(company.id, form);

      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: id ? 'update' : 'create',
        entity: 'Cliente',
        entityId: id || client.id,
        description: `${userData?.name || 'Usuário'} ${id ? 'alterou' : 'criou'} o cliente ${form.name}.`,
      });

      toast.success(id ? 'Cliente atualizado!' : 'Cliente criado!');
      navigate('/app/clients');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => navigate('/app/clients')} className="btn-ghost">
          <ArrowLeft size={18} /> Voltar
        </button>
        <h1 className="text-2xl font-bold text-dark-100">
          {id ? 'Editar Cliente' : 'Novo Cliente'}
        </h1>
      </div>

      <form onSubmit={submit} aria-busy={loading} className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="label">CPF *</label>
                <input className="input" value={form.document} onChange={(e) => setForm({ ...form, document: cpf(e.target.value) })} maxLength={14} required />
                {errors.document && <p className="text-xs text-red-400 mt-1">{errors.document}</p>}
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="label">Telefone *</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} required />
                {errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <label className="label">Observações</label>
            <textarea className="input" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/app/clients')}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving || loading}>
            {saving ? 'Salvando...' : (
              <>
                <Save size={18} />
                {id ? 'Salvar alterações' : 'Criar Cliente'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
