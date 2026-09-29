import React, { useState, useEffect } from 'react';
import { Building2, Save, Users, CreditCard, Crown, Sparkles, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { getCompany, updateCompany, logAudit } from '../../services/firebase/settings';
import AccessibilitySettingsPanel from '../../components/settings/AccessibilitySettingsPanel';
import toast from 'react-hot-toast';

const PLANS = [
  { key: 'testfree', name: 'TestFREE', price: 'R$ 0', period: 'para sempre', description: 'Comece sem custo com acesso ao conteúdo já disponível.', icon: Sparkles },
  { key: 'anglerpro', name: 'AnglerPro', price: 'R$ 119,98', period: '/mês', description: 'Recursos avançados para empresas que querem evoluir.', icon: Crown },
  { key: 'anglerultra', name: 'AnglerUltra', price: 'R$ 199,98', period: '/mês', description: 'Recursos avançados e configurações adicionais da plataforma.', icon: Crown },
];

export default function SettingsPage() {
  const { company: authCompany, user, userData } = useAuth();
  const navigate = useNavigate();
  const isOwner = userData?.role === 'owner';
  const [form, setForm] = useState({ name: '', tradeName: '', document: '', email: '', phone: '', settings: { currency: 'BRL', taxRegime: 'simples', lowStockThreshold: 10 } });
  const [originalForm, setOriginalForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [currentPlan, setCurrentPlan] = useState('testfree');

  useEffect(() => {
    if (!authCompany?.id) return;
    getCompany(authCompany.id).then((c) => {
      if (c) {
        const companyForm = { name: c.name || '', tradeName: c.tradeName || '', document: c.document || '', email: c.email || c.companyEmail || '', phone: c.phone || c.companyPhone || '', settings: { ...form.settings, ...c.settings } };
        setForm(companyForm);
        setOriginalForm(companyForm);
        setCurrentPlan(c.plan || 'testfree');
      }
    }).finally(() => setLoading(false));
  }, [authCompany]);

  const handlePlanChange = async (planKey) => {
    if (!isOwner || planKey === currentPlan || changingPlan) return;
    setChangingPlan(true);
    try {
      await updateCompany(authCompany.id, { plan: planKey });
      setCurrentPlan(planKey);
      toast.success('Plano atualizado!');
    } catch (err) {
      toast.error(err.message || 'Não foi possível atualizar o plano.');
    } finally {
      setChangingPlan(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await updateCompany(authCompany.id, { ...form, companyEmail: form.email, companyPhone: form.phone });
      await logAudit(authCompany.id, { user, userName: userData?.name, action: 'update', entity: 'Configurações da empresa', entityId: authCompany.id, description: `${userData?.name || 'Usuário'} atualizou os dados da empresa.`, details: { antes: originalForm, depois: form } });
      setOriginalForm(form);
      toast.success('Salvo!');
    }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div><h1 className="text-2xl font-bold text-dark-100">Configurações</h1><p className="text-dark-500 text-sm mt-1">Gerencie sua empresa</p></div>
      {(isOwner || userData?.role === 'admin') && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => navigate('/app/users')} className="card p-5 text-left hover:border-primary-500/30 transition-colors"><Users size={24} className="text-primary-400 mb-3" /><div className="text-sm font-semibold text-dark-200">Usuários</div><div className="text-xs text-dark-500">Gerenciar equipe</div></button>
      </div>}
      <form onSubmit={handleSave}>
        <div className="card">
          <div className="card-header flex items-center gap-2"><Building2 size={18} className="text-primary-400" /><h3 className="text-sm font-semibold text-dark-200">Dados da Empresa</h3></div>{!isOwner && <div className="px-5 pt-4 text-sm text-dark-500">Somente o proprietário pode alterar os dados da empresa.</div>}
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Razão Social *</label><input className="input" disabled={!isOwner} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="label">Nome Fantasia</label><input className="input" disabled={!isOwner} value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} /></div>
              <div><label className="label">CNPJ/CPF</label><input className="input" disabled={!isOwner} value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
              <div><label className="label">Email</label><input type="email" className="input" disabled={!isOwner} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Telefone</label><input className="input" disabled={!isOwner} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          {isOwner && (
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : (
                <>
                  <Save size={18} />
                  Salvar
                </>
              )}
            </button>
          )}
        </div>
      </form>
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <CreditCard size={18} className="text-primary-400" />
          <h3 className="text-sm font-semibold text-dark-200">Plano atual</h3>
        </div>
        {!isOwner && <div className="px-5 pt-4 text-sm text-dark-500">Somente o proprietário pode alterar o plano da empresa.</div>}
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const selected = currentPlan === plan.key;
              return (
                <button key={plan.key} type="button" onClick={() => handlePlanChange(plan.key)} disabled={!isOwner || changingPlan}
                  className={`relative text-left p-4 rounded-xl border transition-all ${selected ? 'border-primary-400 bg-primary-400/10' : 'border-dark-700 bg-dark-800/40 hover:border-dark-600'} ${!isOwner ? 'cursor-default opacity-80' : 'cursor-pointer'}`}>
                  {selected && <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 text-dark-950 flex items-center justify-center"><Check size={13} /></div>}
                  <Icon size={22} className={selected ? 'text-primary-300' : 'text-dark-400'} />
                  <div className="mt-3">
                    <div className="text-sm font-semibold text-dark-100">{plan.name}</div>
                    <div className="mt-1"><span className="text-lg font-bold text-primary-300">{plan.price}</span><span className="text-xs text-dark-500 ml-1">{plan.period}</span></div>
                    <p className="text-xs text-dark-500 mt-2 leading-relaxed">{plan.description}</p>
                  </div>
                  <div className="mt-3 text-[11px] font-medium text-dark-500">{selected ? 'Plano atual' : isOwner ? 'Selecionar plano' : 'Disponível'}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AccessibilitySettingsPanel />
    </div>
  );
}
