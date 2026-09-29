import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { createSupplier, getSupplier, updateSupplier } from '../../services/firebase/suppliers';
import { formatPhone } from '../../utils/format';
import { logAudit } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const EMPTY = {
  name: '',
  document: '',
  email: '',
  phone: '',
  cep: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  contractTerm: '',
  notes: '',
  active: true,
};

const formatCnpj = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

const formatCep = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

const isValidCnpj = (value) => {
  const digits = value.replace(/\D/g, '');

  if (digits.length !== 14 || /(\d)\1{13}/.test(digits)) return false;

  const calculateDigit = (length, weights) => {
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return (
    calculateDigit(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[12]) &&
    calculateDigit(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[13])
  );
};

export default function SupplierForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { company, user, userData } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (!id || !company?.id) return;

    getSupplier(id)
      .then((supplier) => {
        if (supplier) {
          setForm({ ...EMPTY, ...supplier });
        } else {
          toast.error('Fornecedor não encontrado.');
        }
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [id, company?.id]);

  const lookupCep = async (value) => {
    const digits = value.replace(/\D/g, '');
    setForm((current) => ({ ...current, cep: formatCep(value) }));

    if (digits.length !== 8) return;

    setCepLoading(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const address = await response.json();

      if (address.erro) {
        throw new Error('CEP não encontrado.');
      }

      setForm((current) => ({
        ...current,
        cep: formatCep(digits),
        street: address.logradouro || '',
        neighborhood: address.bairro || '',
        city: address.localidade || '',
        state: address.uf || '',
      }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCepLoading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    if (form.name.trim().length < 2) {
      toast.error('Informe o nome do fornecedor.');
      return;
    }

    if (!isValidCnpj(form.document)) {
      toast.error('Informe um CNPJ válido.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Informe um e-mail válido.');
      return;
    }

    if (form.phone.replace(/\D/g, '').length < 10) {
      toast.error('Informe um telefone válido.');
      return;
    }

    if (!form.contractTerm || Number(form.contractTerm) < 1) {
      toast.error('Informe o prazo de contrato.');
      return;
    }

    setSaving(true);

    try {
      const supplier = id
        ? await updateSupplier(id, form)
        : await createSupplier(company.id, form);

      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: id ? 'update' : 'create',
        entity: 'Fornecedor',
        entityId: id || supplier.id,
        description: `${userData?.name || 'Usuário'} ${id ? 'alterou' : 'criou'} o fornecedor ${form.name}.`,
      });

      toast.success(id ? 'Fornecedor atualizado!' : 'Fornecedor criado!');
      navigate('/app/suppliers');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-dark-300">Carregando fornecedor...</div>;
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => navigate('/app/suppliers')}
        >
          <ArrowLeft size={18} />
          Voltar
        </button>
        <h1 className="text-2xl font-bold text-dark-100">
          {id ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card">
          <div className="card-body space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
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
                <label className="label">CNPJ *</label>
                <input
                  className="input"
                  value={form.document}
                  onChange={(event) =>
                    setForm({ ...form, document: formatCnpj(event.target.value) })
                  }
                  maxLength={18}
                  required
                />
              </div>

              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Telefone *</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: formatPhone(event.target.value) })
                  }
                  required
                />
              </div>

              <div>
                <label className="label">Prazo de contrato (dias) *</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={form.contractTerm}
                  onChange={(event) =>
                    setForm({ ...form, contractTerm: event.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="label">CEP *</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    value={form.cep}
                    onChange={(event) => lookupCep(event.target.value)}
                    required
                    maxLength={9}
                  />
                  {cepLoading && (
                    <Loader2
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary-400"
                      size={16}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Logradouro</label>
                <input
                  className="input"
                  value={form.street}
                  onChange={(event) => setForm({ ...form, street: event.target.value })}
                />
              </div>

              <div>
                <label className="label">Número</label>
                <input
                  className="input"
                  value={form.number}
                  onChange={(event) => setForm({ ...form, number: event.target.value })}
                />
              </div>

              <div>
                <label className="label">Bairro</label>
                <input
                  className="input"
                  value={form.neighborhood}
                  onChange={(event) =>
                    setForm({ ...form, neighborhood: event.target.value })
                  }
                />
              </div>

              <div>
                <label className="label">Cidade/UF</label>
                <input
                  className="input"
                  value={`${form.city}${form.state ? `/${form.state}` : ''}`}
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="label">Observações</label>
              <textarea
                className="input"
                rows={3}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/app/suppliers')}
          >
            Cancelar
          </button>

          <button className="btn-primary" disabled={saving}>
            {saving ? (
              'Salvando...'
            ) : (
              <>
                <Save size={18} />
                {id ? 'Salvar alterações' : 'Criar Fornecedor'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
