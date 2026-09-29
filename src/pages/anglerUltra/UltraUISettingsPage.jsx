import React, { useEffect, useState } from 'react';
import { Palette, Type, LayoutGrid, Save, RotateCcw, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { getCompany, updateCompany, getDefaultUISettings, applyUISettings } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const FONT_OPTIONS = [['Inter', 'Inter'], ['system-ui', 'Sistema'], ['Arial', 'Arial'], ['Verdana', 'Verdana'], ['Georgia', 'Georgia'], ['monospace', 'Monoespaçada']];
const DEFAULT = getDefaultUISettings();

export default function UltraUISettingsPage() {
  const { company, userData } = useAuth();
  const [form, setForm] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEdit = ['owner', 'admin'].includes(userData?.role);

  useEffect(() => {
    if (!company?.id) return;
    getCompany(company.id).then((data) => setForm({ ...DEFAULT, ...(data?.settings?.ui || {}) })).finally(() => setLoading(false));
  }, [company?.id]);

  useEffect(() => {
    if (!loading) applyUISettings(form);
  }, [form, loading]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updateCompany(company.id, { settings: { ...(company.settings || {}), ui: form } });
      toast.success('Configurações de UI salvas!');
    } catch (error) {
      toast.error(error.message || 'Não foi possível salvar as configurações.');
    } finally { setSaving(false); }
  };
  const reset = () => setForm(DEFAULT);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;

  return <div className="space-y-6 max-w-5xl">
    <div className="flex items-center gap-3"><Sparkles className="text-orange-400" /><div><h1 className="text-2xl font-bold text-dark-100">Configurações de UI</h1><p className="text-dark-500 text-sm mt-1">Personalize a aparência do Angler ERP para esta empresa.</p></div></div>
    {!canEdit && <div className="card p-4 text-sm text-dark-400">Você pode visualizar estas configurações, mas somente proprietário ou administrador pode salvá-las.</div>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="card p-6 space-y-5"><h2 className="font-semibold text-dark-100 flex items-center gap-2"><Palette size={18} className="text-orange-400" />Cores</h2>
        {[['primaryButtonColor','Botões principais'],['secondaryButtonColor','Botões secundários'],['dangerButtonColor','Botões de perigo'],['accentColor','Cor de destaque']].map(([key,label]) => <label key={key} className="flex items-center justify-between gap-4"><span className="text-sm text-dark-300">{label}</span><span className="flex items-center gap-2"><input type="color" value={form[key]} onChange={(e)=>set(key,e.target.value)} disabled={!canEdit} className="w-11 h-9 rounded-lg bg-dark-800 border border-dark-700 cursor-pointer disabled:cursor-not-allowed" /><input className="input w-28" value={form[key]} onChange={(e)=>set(key,e.target.value)} disabled={!canEdit} /></span></label>)}
      </section>
      <section className="card p-6 space-y-5"><h2 className="font-semibold text-dark-100 flex items-center gap-2"><Type size={18} className="text-orange-400" />Tipografia</h2>
        <label><span className="label">Fonte</span><select className="input" value={form.fontFamily} onChange={(e)=>set('fontFamily',e.target.value)} disabled={!canEdit}>{FONT_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className="label">Tamanho base</span><select className="input" value={form.fontSize} onChange={(e)=>set('fontSize',e.target.value)} disabled={!canEdit}><option value="90%">Pequeno</option><option value="100%">Normal</option><option value="110%">Grande</option><option value="120%">Muito grande</option></select></label>
      </section>
      <section className="card p-6 space-y-5"><h2 className="font-semibold text-dark-100 flex items-center gap-2"><LayoutGrid size={18} className="text-orange-400" />Aparência</h2>
        <label><span className="label">Arredondamento</span><select className="input" value={form.borderRadius} onChange={(e)=>set('borderRadius',e.target.value)} disabled={!canEdit}><option value="6px">Compacto</option><option value="10px">Suave</option><option value="12px">Padrão</option><option value="18px">Arredondado</option><option value="24px">Bem arredondado</option></select></label>
        <label><span className="label">Densidade</span><select className="input" value={form.density} onChange={(e)=>set('density',e.target.value)} disabled={!canEdit}><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></label>
        <label><span className="label">Sombras dos cards</span><select className="input" value={form.cardShadow} onChange={(e)=>set('cardShadow',e.target.value)} disabled={!canEdit}><option value="none">Sem sombra</option><option value="soft">Suave</option><option value="medium">Média</option></select></label>
      </section>
      <section className="card p-6"><h2 className="font-semibold text-dark-100 mb-4">Prévia</h2><div className="rounded-xl border border-dark-700 p-5 space-y-4"><div><div className="text-lg font-bold text-dark-100">Exemplo de interface</div><p className="text-sm text-dark-400">As alterações são aplicadas somente dentro do /app.</p></div><div className="flex flex-wrap gap-2"><button className="btn-primary">Botão principal</button><button className="btn-secondary">Secundário</button><button className="btn-danger">Excluir</button></div></div></section>
    </div>
    <div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={reset}><RotateCcw size={17}/>Restaurar padrão</button><button type="button" className="btn-primary" onClick={save} disabled={!canEdit || saving}><Save size={17}/>{saving ? 'Salvando...' : 'Salvar configurações'}</button></div>
  </div>;
}
