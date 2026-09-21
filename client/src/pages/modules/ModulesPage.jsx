import React, { useMemo, useState } from 'react';
import {
  Bot, Calculator, FileSignature, Package, ShoppingCart, Truck, Users,
  DollarSign, Warehouse, BarChart3, FileText, Ruler, Save, Blocks, MapPin, LockKeyhole, UnlockKeyhole,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { logAudit, updateCompany } from '../../services/firebase/settings';
import PageHeader from '../../components/ui/PageHeader';
import toast from 'react-hot-toast';

const MODULES = [
  { key: 'clients', label: 'Clientes', description: 'Cadastros e relacionamento', icon: Users },
  { key: 'products', label: 'Produtos', description: 'Produtos, preços e categorias', icon: Package },
  { key: 'sales', label: 'Vendas', description: 'Pedidos e aprovações', icon: ShoppingCart },
  { key: 'purchases', label: 'Compras', description: 'Pedidos e recebimentos', icon: Truck },
  { key: 'suppliers', label: 'Fornecedores', description: 'Cadastro de fornecedores', icon: FileText },
  { key: 'locations', label: 'Localizações', description: 'Endereços e unidades da empresa', icon: MapPin },
  { key: 'financial', label: 'Financeiro', description: 'Receitas, despesas e pagamentos', icon: DollarSign },
  { key: 'stock', label: 'Estoque', description: 'Movimentações e ajustes', icon: Warehouse },
  { key: 'reports', label: 'Relatórios', description: 'Indicadores e exportações', icon: BarChart3 },
  { key: 'assistant', label: 'Assistente de IA', description: 'Angel Personal Assistant', icon: Bot },
  { key: 'measurement', label: 'Medição', description: 'Aproveitamento de material', icon: Ruler },
  { key: 'formulas', label: 'Fórmulas', description: 'Cálculos de embalagens', icon: Calculator },
  { key: 'budgets', label: 'Orçamentos', description: 'Propostas e acompanhamento', icon: FileSignature },
];

export default function ModulesPage() {
  const { company, user, userData, refreshCompany } = useAuth();
  const defaultEnabled = useMemo(() => MODULES.map((module) => module.key), []);
  const [enabled, setEnabled] = useState(() => company?.modules?.enabled || defaultEnabled);
  const [locked, setLocked] = useState(() => Boolean(company?.modules?.locked));
  const [stampOpen, setStampOpen] = useState(false);
  const [stampText, setStampText] = useState('');
  const [saving, setSaving] = useState(false);
  const isOwner = userData?.role === 'owner';

  const toggleModule = (key) => {
    if (!isOwner || locked) return;
    setEnabled((current) => (current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]));
  };

  const saveModules = async (nextLocked = locked) => {
    if (!company?.id || !isOwner) return;
    // Keep DOM events out of the Firestore payload if this function is ever
    // used directly as an event handler.
    const lockedValue = typeof nextLocked === 'boolean' ? nextLocked : locked;
    setSaving(true);
    try {
      await updateCompany(company.id, { modules: { enabled, locked: lockedValue } });
      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: 'update',
        entity: 'Módulos',
        entityId: company.id,
        description: `${userData?.name || 'Proprietário'} atualizou os módulos ativos da empresa.`,
        details: { enabled, locked: lockedValue },
      });
      await refreshCompany();
      setLocked(lockedValue);
      toast.success('Módulos atualizados.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível atualizar os módulos.');
    } finally {
      setSaving(false);
    }
  };

  const confirmStampChange = async () => {
    if (stampText.trim().toUpperCase() !== 'CARIMBAR') {
      toast.error('Digite CARIMBAR para confirmar.');
      return;
    }
    await saveModules(!locked);
    setStampText('');
    setStampOpen(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader title="Módulos" subtitle="Escolha os recursos disponíveis para sua empresa" action={isOwner && (
        <button type="button" onClick={() => saveModules()} disabled={saving} className="btn-primary disabled:opacity-50"><Save size={18} /> {saving ? 'Salvando...' : 'Salvar módulos'}</button>
      )} />
      {!isOwner && <div className="card p-4 text-sm text-dark-400">Somente o proprietário da empresa pode alterar os módulos ativos.</div>}
      <div className="card">
        <div className="card-header flex items-center gap-2"><Blocks size={18} className="text-primary-400" /><h2 className="text-sm font-semibold text-dark-200">Recursos do sistema</h2><span className="ml-auto text-xs text-dark-500">{enabled.length} de {MODULES.length} ativos</span></div>
        <div className="card-body grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map((module) => {
            const Icon = module.icon;
            const active = enabled.includes(module.key);
            return <button key={module.key} type="button" onClick={() => toggleModule(module.key)} disabled={!isOwner || locked} className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-default ${active ? 'border-primary-400/50 bg-primary-400/10' : 'border-dark-700 bg-dark-900/40'} ${isOwner && !locked ? 'hover:border-primary-400/70' : ''}`}>
              <div className="flex items-start gap-3"><Icon size={20} className={active ? 'text-primary-300' : 'text-dark-500'} /><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-medium text-dark-200"><span>{module.label}</span><span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-dark-600'}`} /></div><p className="mt-1 text-xs text-dark-500">{module.description}</p></div></div>
            </button>;
          })}
        </div>
      </div>
      {isOwner && <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3"><div className={`mt-0.5 rounded-lg p-2 ${locked ? 'bg-primary-400/10 text-primary-300' : 'bg-dark-800 text-dark-400'}`}>{locked ? <LockKeyhole size={20} /> : <UnlockKeyhole size={20} />}</div><div><h2 className="text-sm font-semibold text-dark-200">Carimbar configuração</h2><p className="mt-1 text-sm text-dark-500">{locked ? 'A configuração está carimbada. Remova o carimbo para alterar os módulos.' : 'Carimbe a configuração para impedir alterações nos módulos.'}</p></div></div>
          {!stampOpen && <button type="button" onClick={() => setStampOpen(true)} className="btn-secondary">{locked ? 'Remover carimbo' : 'Carimbar configuração'}</button>}
        </div>
        {stampOpen && <div className="mt-4 border-t border-dark-700 pt-4"><label className="label">Digite <strong>CARIMBAR</strong> para {locked ? 'remover o carimbo' : 'carimbar a configuração'}</label><div className="flex flex-wrap gap-2"><input className="input max-w-sm" value={stampText} onChange={(event) => setStampText(event.target.value)} autoComplete="off" autoFocus /><button type="button" onClick={confirmStampChange} disabled={saving} className="btn-primary disabled:opacity-50">Confirmar</button><button type="button" onClick={() => { setStampOpen(false); setStampText(''); }} className="btn-secondary">Cancelar</button></div></div>}
      </div>}
    </div>
  );
}
