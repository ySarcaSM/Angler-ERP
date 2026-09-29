import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import { createBudget, getBudget, updateBudget } from '../../services/firebase/budgets';
import { listClients } from '../../services/firebase/clients';
import { logAudit } from '../../services/firebase/settings';

export default function BudgetForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { company, user, userData } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [form, setForm] = useState({ clientId: '', description: '', value: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company?.id) {
      listClients(company.id, { pageSize: 200 })
        .then((result) => setClients(result.data))
        .catch((error) => toast.error(error.message));
    }
  }, [company?.id]);

  useEffect(() => {
    if (!id || !company?.id) return;

    getBudget(id)
      .then((budget) => {
        if (budget) {
          setForm({
            clientId: budget.clientId || '',
            description: budget.description || '',
            value: budget.value ?? '',
          });
        } else {
          toast.error('Orçamento não encontrado.');
        }
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [id, company?.id]);

  const submit = async (event) => {
    event.preventDefault();

    if (!form.clientId || Number(form.value) < 0) {
      return toast.error('Informe cliente e um valor válido.');
    }

    setSaving(true);
    try {
      const client = clients.find((item) => item.id === form.clientId);
      const payload = {
        clientId: form.clientId,
        clientName: client?.name || '',
        description: form.description.trim(),
        value: Number(form.value) || 0,
        status: 'draft',
      };

      const budget = id
        ? await updateBudget(id, payload)
        : await createBudget(company.id, payload);

      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: id ? 'update' : 'create',
        entity: 'Orçamento',
        entityId: id || budget.id,
        description: `${userData?.name || 'Usuário'} ${id ? 'alterou' : 'criou'} um orçamento para ${payload.clientName}.`,
      });

      toast.success(id ? 'Orçamento atualizado!' : 'Orçamento criado!');
      navigate('/app/budgets');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" className="btn-ghost" onClick={() => navigate('/app/budgets')}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <h1 className="text-2xl font-bold text-dark-100">
          {id ? 'Editar orçamento' : 'Novo orçamento'}
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card">
          <div className="card-body space-y-5">
            <label className="label">
              Cliente *
              <select className="input mt-1" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
                <option value="">Selecione um cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}{client.document ? ` - ${client.document}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="label">
              Observação
              <textarea className="input mt-1" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>

            <label className="label">
              Valor *
              <input type="number" min="0" step="0.01" className="input mt-1" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/app/budgets')}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving || loading}>
            {saving ? 'Salvando...' : (
              <>
                <Save size={18} />
                {id ? 'Salvar alterações' : 'Criar orçamento'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
