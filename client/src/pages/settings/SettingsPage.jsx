import React, { useState, useEffect } from 'react';
import { Building2, Save, Users, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCompany, updateCompany, listAuditLogs } from '../../services/firebase/settings';
import { formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { company: authCompany } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', tradeName: '', document: '', email: '', phone: '', settings: { currency: 'BRL', taxRegime: 'simples', lowStockThreshold: 10 } });
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authCompany?.id) return;
    Promise.all([
      getCompany(authCompany.id),
      listAuditLogs(authCompany.id, { pageSize: 20 }),
    ]).then(([c, log]) => {
      if (c) setForm({ name: c.name || '', tradeName: c.tradeName || '', document: c.document || '', email: c.email || '', phone: c.phone || '', settings: { ...form.settings, ...c.settings } });
      setAuditLog(log.data);
    }).finally(() => setLoading(false));
  }, [authCompany]);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await updateCompany(authCompany.id, form); toast.success('Salvo!'); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div><h1 className="text-2xl font-bold text-dark-100">Configurações</h1><p className="text-dark-500 text-sm mt-1">Gerencie sua empresa</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => navigate('/settings/users')} className="card p-5 text-left hover:border-primary-500/30 transition-colors"><Users size={24} className="text-primary-400 mb-3" /><div className="text-sm font-semibold text-dark-200">Usuários</div><div className="text-xs text-dark-500">Gerenciar equipe</div></button>
        <div className="card p-5"><Clock size={24} className="text-amber-400 mb-3" /><div className="text-sm font-semibold text-dark-200">Log de Atividades</div><div className="text-xs text-dark-500">{auditLog.length} ações recentes</div></div>
      </div>
      <form onSubmit={handleSave}>
        <div className="card">
          <div className="card-header flex items-center gap-2"><Building2 size={18} className="text-primary-400" /><h3 className="text-sm font-semibold text-dark-200">Dados da Empresa</h3></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="label">Razão Social *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="label">Nome Fantasia</label><input className="input" value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} /></div>
              <div><label className="label">CNPJ/CPF</label><input className="input" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Telefone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4"><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : <><Save size={18} /> Salvar</>}</button></div>
      </form>
      <div className="card">
        <div className="card-header"><h3 className="text-sm font-semibold text-dark-200">Log de Atividades</h3></div>
        <div className="divide-y divide-dark-800/50 max-h-96 overflow-y-auto">
          {auditLog.map((log) => (
            <div key={log.id} className="px-6 py-3 flex items-center justify-between">
              <div><span className="text-sm text-dark-200">{log.userName}</span><span className="text-sm text-dark-500"> — {log.action} em {log.entity}</span></div>
              <span className="text-xs text-dark-500">{formatDate(log.createdAt?.toDate?.() || log.createdAt)}</span>
            </div>
          ))}
          {auditLog.length === 0 && <div className="px-6 py-8 text-center text-dark-500 text-sm">Nenhuma atividade</div>}
        </div>
      </div>
    </div>
  );
}
