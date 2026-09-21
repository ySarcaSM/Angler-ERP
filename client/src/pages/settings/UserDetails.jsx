import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Mail, Save, Shield, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { getUser, getCompanyMember, updateCompanyUserAccess } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
  viewer: 'Visualizador',
};

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Proprietário' },
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'operator', label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
];

const MODULES = [
  ['clients', 'Clientes'],
  ['products', 'Produtos'],
  ['sales', 'Vendas'],
  ['purchases', 'Compras'],
  ['suppliers', 'Fornecedores'],
  ['locations', 'Localizações'],
  ['financial', 'Financeiro'],
  ['stock', 'Estoque'],
  ['reports', 'Relatórios'],
  ['assistant', 'Assistente de IA'],
  ['measurement', 'Medição'],
  ['formulas', 'Fórmulas'],
  ['budgets', 'Orçamentos'],
];

export default function UserDetails() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { company } = useAuth();
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState('viewer');
  const [modules, setModules] = useState([]);
  const [adminConfirmation, setAdminConfirmation] = useState('');
  const [ownerConfirmation, setOwnerConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Owner/Admin precisam conseguir personalizar usuários com qualquer módulo,
  // inclusive os que estão desativados nas configurações gerais da empresa.
  // A ativação global continua sendo respeitada na navegação/uso normal.
  const availableModules = useMemo(() => MODULES.map(([key]) => key), []);

  useEffect(() => {
    const load = async () => {
      if (!company?.id || !userId) return;
      setLoading(true);

      try {
        let data = null;
        let isExternal = false;

        try {
          data = await getUser(userId);
        } catch {
          data = null;
        }

        if (!data || data.companyId !== company.id) {
          data = await getCompanyMember(company.id, userId);
          isExternal = true;
        }

        if (!data) throw new Error('Usuário não encontrado nesta empresa.');

        const membership = data.memberships?.[company.id];
        const currentRole = membership?.role || data.role || 'viewer';
        const configuredModules = membership?.modules || data.modules || availableModules;

        // Todos os módulos continuam disponíveis para personalização,
        // mas o estado inicial segue a configuração global da empresa.
        // Assim, módulos desativados começam desmarcados para este usuário.
        const enabledCompanyModules = Array.isArray(company?.modules?.enabled)
          ? company.modules.enabled
          : availableModules;
        const hasIndividualConfiguration = Array.isArray(configuredModules)
          && Boolean(membership?.modules || data.modules);
        const initialModules = hasIndividualConfiguration
          ? configuredModules.filter((key) => availableModules.includes(key))
          : availableModules.filter((key) => enabledCompanyModules.includes(key));

        setProfile({ ...data, isExternal, companyRole: currentRole });
        setRole(currentRole);
        setModules(initialModules);
      } catch (err) {
        toast.error(err.message || 'Não foi possível carregar o usuário.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [company?.id, userId, availableModules]);

  const toggleModule = (key) => {
    setModules((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  };

  const handleSave = async () => {
    if (!profile || !company?.id) return;

    if (role === 'admin' && adminConfirmation.trim().toUpperCase() !== 'ADMINISTRADOR') {
      toast.error('Digite ADMINISTRADOR para confirmar a mudança para administrador.');
      return;
    }

    if (role === 'owner' && ownerConfirmation.trim().toUpperCase() !== 'PROPRIETÁRIO') {
      toast.error('Digite PROPRIETÁRIO para confirmar a mudança para proprietário.');
      return;
    }

    setSaving(true);
    try {
      await updateCompanyUserAccess({
        companyId: company.id,
        uid: userId,
        role,
        modules,
      });
      setProfile((current) => ({ ...current, role, modules }));
      setAdminConfirmation('');
      setOwnerConfirmation('');
      toast.success('Permissões do usuário atualizadas.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível atualizar as permissões.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4 max-w-3xl">
        <button onClick={() => navigate('/app/users')} className="btn-ghost">
          <ArrowLeft size={18} /> Voltar
        </button>
        <div className="card p-6 text-dark-300">Usuário não encontrado.</div>
      </div>
    );
  }

  const fullName = [profile.name, profile.lastName].filter(Boolean).join(' ') || 'Usuário Angler';
  const initials = [profile.name?.[0], profile.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U';
  const isViewer = [role, profile.role, profile.companyRole].some((value) => String(value || '').toLowerCase() === 'viewer');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/users')} className="btn-ghost" title="Voltar para usuários">
          <ArrowLeft size={18} /> Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Usuário</h1>
          <p className="text-sm text-dark-500 mt-1">
            {isViewer
              ? 'O Visualizador possui acesso somente para consulta e cálculo.'
              : 'Configure o cargo e os módulos disponíveis para este usuário.'}
          </p>
        </div>
      </div>

      <section className="card p-6">
        <div className="flex items-center gap-4 pb-6 border-b border-dark-800">
          <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center text-lg font-bold text-dark-200">{initials}</div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-dark-100">{fullName}</h2>
            <p className="text-sm text-dark-500">{profile.email || 'Sem e-mail informado'}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-6">
          <div className="rounded-xl bg-dark-800 p-4">
            <div className="flex items-center gap-2 text-xs text-dark-500 mb-2"><Mail size={14} /> E-mail</div>
            <div className="text-sm text-dark-100 break-all">{profile.email || '—'}</div>
          </div>
          <div className="rounded-xl bg-dark-800 p-4">
            <div className="flex items-center gap-2 text-xs text-dark-500 mb-2"><Shield size={14} /> Cargo atual</div>
            <div className="text-sm text-dark-100">{ROLE_LABELS[profile.role] || profile.role || '—'}</div>
          </div>
          <div className="rounded-xl bg-dark-800 p-4">
            <div className="flex items-center gap-2 text-xs text-dark-500 mb-2"><UserRound size={14} /> Status</div>
            <div className="text-sm text-dark-100">{profile.active === false ? 'Inativo' : 'Ativo'}</div>
          </div>
          <div className="rounded-xl bg-dark-800 p-4">
            <div className="text-xs text-dark-500 mb-2">ID do usuário</div>
            <code className="text-sm text-primary-300 font-mono select-all">{profile.uid || profile.id || userId}</code>
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-dark-100">Cargo</h2>
          <p className="text-sm text-dark-500 mt-1">
            {isViewer
              ? 'O Visualizador possui acesso somente para consulta e cálculo.'
              : 'O cargo define o que o usuário pode fazer nos módulos liberados.'}
          </p>
        </div>

        <select className="input max-w-md" value={role} onChange={(event) => {
          const nextRole = event.target.value;
          setRole(nextRole);
          if (nextRole === 'viewer') setModules(availableModules);
        }}>
          {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        {role === 'owner' && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <label className="label">Confirmação obrigatória</label>
            <p className="text-sm text-dark-400">Para promover este usuário a Proprietário, digite <strong className="text-dark-100">PROPRIETÁRIO</strong>.</p>
            <input
              className="input max-w-md"
              value={ownerConfirmation}
              onChange={(event) => setOwnerConfirmation(event.target.value)}
              placeholder="PROPRIETÁRIO"
              autoComplete="off"
            />
          </div>
        )}

        {role === 'admin' && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <label className="label">Confirmação obrigatória</label>
            <p className="text-sm text-dark-400">Para promover este usuário a Administrador, digite <strong className="text-dark-100">ADMINISTRADOR</strong>.</p>
            <input
              className="input max-w-md"
              value={adminConfirmation}
              onChange={(event) => setAdminConfirmation(event.target.value)}
              placeholder="ADMINISTRADOR"
              autoComplete="off"
            />
          </div>
        )}
      </section>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-dark-100">Módulos deste usuário</h2>
          <p className="text-sm text-dark-500 mt-1">
            {isViewer
              ? 'Defina quais módulos o Visualizador poderá visualizar. Ele continuará sem permissão para alterar dados, exceto o cálculo de fórmulas.'
              : 'Escolha quais módulos da empresa este usuário poderá visualizar e utilizar.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.filter(([key]) => availableModules.includes(key)).map(([key, label]) => {
            const active = modules.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleModule(key)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? 'border-primary-400/50 bg-primary-400/10' : 'border-dark-700 bg-dark-900/40'}`}
              >
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${active ? 'bg-primary-500 border-primary-500' : 'border-dark-600'}`}>
                  {active && <Check size={14} className="text-dark-950" />}
                </span>
                <span className="text-sm text-dark-200">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
          <Save size={18} /> {saving ? 'Salvando...' : 'Salvar permissões'}
        </button>
      </div>
    </div>
  );
}
