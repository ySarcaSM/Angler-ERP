import React, { useCallback, useEffect, useState } from 'react';
import { Calculator, Copy, Edit2, FlaskConical, Plus, Search, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../context/useAuth';
import { createFormula, deleteFormula, listFormulas, updateFormula } from '../../services/firebase/formulas';
import { logAudit } from '../../services/firebase/settings';

const EMPTY = { name: '', description: '', expression: '', variables: '', constants: '', unit: '', category: 'Geral', active: true };

function formulaAuditData(formula) {
  return {
    name: formula.name || '',
    description: formula.description || '',
    expression: formula.expression || '',
    variables: formula.variables || '',
    constants: formula.constants || '',
    unit: formula.unit || '',
    category: formula.category || 'Geral',
    active: formula.active !== false,
  };
}

function parseNumber(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  return normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.' ? 0 : Number(normalized);
}

function evaluateFormula(formula, values) {
  if (!formula?.expression?.trim()) return { value: null, error: 'A fórmula não possui uma expressão.' };
  const constants = Object.fromEntries((formula.constants || '').split(';').map((item) => item.trim().split('=').map((part) => part.trim())).filter(([name, value]) => name && value && Number.isFinite(parseNumber(value))).map(([name, value]) => [name, parseNumber(value)]));
  const scope = { ...values, ...constants };
  const expression = formula.expression.replace(/(\d),(\d)/g, '$1.$2').replace(/\^/g, '**').replace(/[A-Za-z_][A-Za-z0-9_]*/g, (name) => Object.prototype.hasOwnProperty.call(scope, name) ? `(${scope[name]})` : name);
  if (!/^[0-9+*/().\s-]+$/.test(expression)) return { value: null, error: 'A expressão contém uma variável que não foi cadastrada ou um operador inválido.' };
  try {
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? { value: result, error: '' } : { value: null, error: 'O resultado não é um número válido.' };
  } catch { return { value: null, error: 'Não foi possível calcular. Verifique a expressão.' }; }
}

export default function FormulasPage() {
  return (
    <FormulaManager />
  );
}

function FormulaManager() {
  const { company, user, userData } = useAuth();
  const isReadOnly = ['viewer', 'operator'].includes(userData?.role);
  const [searchParams] = useSearchParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(null);
  const [calculationValues, setCalculationValues] = useState({});
  const [calculationResult, setCalculationResult] = useState(null);
  const [calculationError, setCalculationError] = useState('');

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const result = await listFormulas(company.id, { searchField: ['name', 'expression', 'category'], searchTerm: search });
      setData(filter === 'all' ? result.data : result.data.filter((formula) => filter === 'active' ? formula.active : !formula.active));
    } catch (error) { toast.error(error.message); }
    finally { setLoading(false); }
  }, [company, search, filter]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (formula) => { setForm({ ...EMPTY, ...formula }); setEditing(formula.id); setModal(true); };
  const duplicate = (formula) => { setForm({ ...EMPTY, ...formula, id: undefined, name: `${formula.name} (cópia)`, active: true }); setEditing(null); setModal(true); };
  const openCalculator = (formula) => { setCalculating(formula); setCalculationValues(Object.fromEntries((formula.variables || '').split(',').map((variable) => variable.trim()).filter(Boolean).map((variable) => [variable, '']))); setCalculationResult(null); setCalculationError(''); };
  const calculate = () => {
    const values = Object.fromEntries(Object.entries(calculationValues).map(([name, value]) => [name, parseNumber(value)]));
    const result = evaluateFormula(calculating, values);
    setCalculationResult(result.value);
    setCalculationError(result.error);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.expression.trim()) return toast.error('Informe o nome e a expressão da fórmula.');
    setSaving(true);
    try {
      let saved;
      if (editing) {
        const previousFormula = data.find((formula) => formula.id === editing);
        const before = formulaAuditData(previousFormula || EMPTY);
        const after = formulaAuditData(form);
        saved = await updateFormula(editing, form);
        await logAudit(company.id, { user, userName: userData?.name, action: 'update', entity: 'Fórmula', entityId: editing, description: `${userData?.name || 'Usuário'} alterou a fórmula ${form.name}.`, changes: { antes: before, depois: after }, details: { antes: before, depois: after } });
        toast.success('Fórmula atualizada!');
      } else {
        saved = await createFormula(company.id, form);
        await logAudit(company.id, { user, userName: userData?.name, action: 'create', entity: 'Fórmula', entityId: saved.id, description: `${userData?.name || 'Usuário'} criou a fórmula ${form.name}.`, details: { propriedades: formulaAuditData(form) } });
        toast.success('Fórmula criada!');
      }
      setModal(false);
      load();
    } catch (error) { toast.error(error.message); }
    finally { setSaving(false); }
  };

  const remove = async (formula) => {
    if (!confirm(`Excluir a fórmula ${formula.name}?`)) return;
    try {
      await deleteFormula(formula.id);
      await logAudit(company.id, { user, userName: userData?.name, action: 'delete', entity: 'Fórmula', entityId: formula.id, description: `${userData?.name || 'Usuário'} excluiu a fórmula ${formula.name}.`, details: { propriedades: formulaAuditData(formula) } });
      toast.success('Fórmula excluída.');
      load();
    } catch (error) { toast.error(error.message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Fórmulas" subtitle={`${data.length} fórmula(s) reutilizável(is)`} action={!isReadOnly && <button type="button" className="btn-primary" onClick={openNew}><Plus size={17} /> Nova fórmula</button>} />
      <div className="card">
        <div className="card-header flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl bg-dark-800 px-4 py-2">
            <Search size={16} className="text-dark-500" />
            <input className="w-full bg-transparent text-sm outline-none" placeholder="Buscar por nome, expressão ou categoria..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {['all', 'active', 'inactive'].map((key) => <button key={key} type="button" className={`btn-sm ${filter === key ? 'bg-primary-600 text-white' : 'btn-secondary'}`} onClick={() => setFilter(key)}>{key === 'all' ? 'Todas' : key === 'active' ? 'Ativas' : 'Inativas'}</button>)}
        </div>
        {loading ? <div className="flex h-40 items-center justify-center"><div className="animate-spin h-7 w-7 rounded-full border-2 border-primary-500 border-t-transparent" /></div> : data.length === 0 ? <div className="p-10 text-center text-sm text-dark-500">Nenhuma fórmula cadastrada.</div> : (
          <div className="divide-y divide-dark-800">
            {data.map((formula) => <div key={formula.id} className="flex flex-wrap items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-400/10"><FlaskConical size={19} className="text-primary-400" /></div>
              <div className="min-w-[220px] flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-dark-100">{formula.name}</span><span className={formula.active ? 'badge-success' : 'badge-neutral'}>{formula.active ? 'Ativa' : 'Inativa'}</span><span className="badge-info">{formula.category}</span></div><div className="mt-1 font-mono text-sm text-primary-300">{formula.expression}{formula.unit ? ` (${formula.unit})` : ''}</div><div className="mt-1 text-xs text-dark-500">Variáveis: {formula.variables || 'Nenhuma'}{formula.constants ? ` · Constantes: ${formula.constants}` : ''}{formula.description ? ` · ${formula.description}` : ''}</div></div>
              <div className="flex gap-1"><button type="button" className="btn-ghost btn-sm text-primary-300" title="Calcular" onClick={() => openCalculator(formula)}><Calculator size={15} /></button>{!isReadOnly && <><button type="button" className="btn-ghost btn-sm" title="Duplicar" onClick={() => duplicate(formula)}><Copy size={15} /></button><button type="button" className="btn-ghost btn-sm" title="Editar" onClick={() => openEdit(formula)}><Edit2 size={15} /></button><button type="button" className="btn-ghost btn-sm text-red-400" title="Excluir" onClick={() => remove(formula)}><Trash2 size={15} /></button></>}</div>
            </div>)}
          </div>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar fórmula' : 'Nova fórmula'} size="lg">
        <form className="space-y-4" onSubmit={save}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><label className="label">Nome *<input className="input mt-1" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="label">Categoria<select className="input mt-1" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Geral</option><option>Material</option><option>Produção</option><option>Preço</option><option>Medidas</option></select></label></div>
          <label className="label">Expressão matemática *<input className="input mt-1 font-mono" required placeholder="ex.: (altura * largura) / 10000" value={form.expression} onChange={(event) => setForm({ ...form, expression: event.target.value })} /></label>
          <div className="rounded-xl border border-primary-400/20 bg-primary-400/5 p-4 text-sm text-dark-300"><div className="mb-1 text-xs uppercase tracking-wider text-primary-300">Prévia da expressão</div><code className="font-mono text-primary-200">{form.expression || 'Digite uma expressão acima'}</code></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><label className="label">Variáveis utilizadas<input className="input mt-1" placeholder="altura, largura, comprimento" value={form.variables} onChange={(event) => setForm({ ...form, variables: event.target.value })} /></label><label className="label">Constantes<input className="input mt-1" placeholder="pi=3.14159; margem=1.1" value={form.constants} onChange={(event) => setForm({ ...form, constants: event.target.value })} /></label></div>
          <label className="label">Unidade do resultado<input className="input mt-1" placeholder="m², cm, R$" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label>
          <label className="label">Descrição<textarea className="input mt-1" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className="flex items-center gap-3 text-sm text-dark-300"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Fórmula ativa e disponível para reutilização</label>
          <div className="flex justify-end gap-3 border-t border-dark-800 pt-4"><button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar fórmula'}</button></div>
        </form>
      </Modal>
      <Modal open={Boolean(calculating)} onClose={() => setCalculating(null)} title={`Calcular: ${calculating?.name || ''}`} size="md">
        {calculating && <div className="space-y-4"><div className="rounded-xl border border-primary-400/20 bg-primary-400/5 p-4"><div className="text-xs uppercase tracking-wider text-primary-300">Expressão</div><code className="mt-2 block font-mono text-primary-200">{calculating.expression}</code></div>{Object.keys(calculationValues).length > 0 ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{Object.keys(calculationValues).map((variable) => <label key={variable} className="label">{variable}<input type="text" inputMode="decimal" className="input mt-1" placeholder="Ex.: -1,25" value={calculationValues[variable]} onChange={(event) => setCalculationValues({ ...calculationValues, [variable]: event.target.value })} /></label>)}</div> : <div className="text-sm text-dark-400">Esta fórmula não possui variáveis cadastradas.</div>}<button type="button" className="btn-primary w-full justify-center" onClick={calculate}><Calculator size={16} /> Calcular</button>{calculationError && <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{calculationError}</div>}{calculationResult !== null && <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center"><div className="text-xs text-dark-400">Resultado</div><div className="mt-1 text-2xl font-bold text-emerald-300">{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(calculationResult)} {calculating.unit}</div></div>}</div>}
      </Modal>
    </div>
  );
}
