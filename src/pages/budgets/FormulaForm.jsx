import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import { createFormula, getFormula, updateFormula } from '../../services/firebase/formulas';
import { logAudit } from '../../services/firebase/settings';

const EMPTY = {
  name: '',
  description: '',
  expression: '',
  variables: '',
  constants: '',
  unit: '',
  category: 'Geral',
  active: true,
};

export default function FormulaForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { company, user, userData } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !company?.id) return;

    getFormula(id)
      .then((formula) => {
        if (formula) setForm({ ...EMPTY, ...formula });
        else toast.error('Fórmula não encontrada.');
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, [id, company?.id]);

  const submit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.expression.trim()) {
      return toast.error('Informe o nome e a expressão da fórmula.');
    }

    setSaving(true);
    try {
      const formula = id
        ? await updateFormula(id, form)
        : await createFormula(company.id, form);

      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: id ? 'update' : 'create',
        entity: 'Fórmula',
        entityId: id || formula.id,
        description: `${userData?.name || 'Usuário'} ${id ? 'alterou' : 'criou'} a fórmula ${form.name}.`,
      });

      toast.success(id ? 'Fórmula atualizada!' : 'Fórmula criada!');
      navigate('/app/budgets/formulas');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" className="btn-ghost" onClick={() => navigate('/app/budgets/formulas')}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <h1 className="text-2xl font-bold text-dark-100">
          {id ? 'Editar fórmula' : 'Nova fórmula'}
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="card">
          <div className="card-body space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="label">
                Nome *
                <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>

              <label className="label">
                Categoria
                <select className="input mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option>Geral</option>
                  <option>Material</option>
                  <option>Produção</option>
                  <option>Preço</option>
                  <option>Medidas</option>
                </select>
              </label>
            </div>

            <label className="label">
              Expressão matemática *
              <input className="input mt-1 font-mono" value={form.expression} onChange={(e) => setForm({ ...form, expression: e.target.value })} required />
            </label>

            <div className="rounded-xl border border-primary-400/20 bg-primary-400/5 p-4 text-sm">
              <div className="text-xs uppercase tracking-wider text-primary-300">Prévia</div>
              <code className="text-primary-200">{form.expression || 'Digite uma expressão acima'}</code>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="label">
                Variáveis
                <input className="input mt-1" value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} />
              </label>

              <label className="label">
                Constantes
                <input className="input mt-1" value={form.constants} onChange={(e) => setForm({ ...form, constants: e.target.value })} />
              </label>
            </div>

            <label className="label">
              Unidade
              <input className="input mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>

            <label className="label">
              Descrição
              <textarea className="input mt-1" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>

            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Fórmula ativa
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/app/budgets/formulas')}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving || loading}>
            {saving ? 'Salvando...' : (
              <>
                <Save size={18} />
                {id ? 'Salvar alterações' : 'Criar fórmula'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
