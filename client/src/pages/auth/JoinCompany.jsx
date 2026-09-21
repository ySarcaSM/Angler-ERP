import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, UserPlus } from 'lucide-react';
import { getCompanyInvitation } from '../../services/firebase/invitations';
import { joinCompany } from '../../services/firebase/auth';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
  viewer: 'Visualizador',
};

export default function JoinCompany() {
  const { invitationId } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', lastName: '', password: '', confirmPassword: '' });

  useEffect(() => {
    getCompanyInvitation(invitationId)
      .then(setInvitation)
      .catch(() => setInvitation(null))
      .finally(() => setLoading(false));
  }, [invitationId]);

  const submit = async (event) => {
    event.preventDefault();
    if (form.password.length < 6) return toast.error('A senha deve ter pelo menos 6 caracteres.');
    if (form.password !== form.confirmPassword) return toast.error('As senhas não conferem.');
    setSaving(true);
    try {
      await joinCompany({ invitation, ...form });
      toast.success('Conta criada. Verifique seu e-mail e entre para acessar a empresa.');
      setForm({ name: '', lastName: '', password: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.code === 'auth/email-already-in-use'
        ? 'Este e-mail já possui uma conta. Solicite um novo convite ao owner.'
        : error.message || 'Não foi possível criar sua conta.');
    } finally {
      setSaving(false);
    }
  };

  const validInvitation = invitation?.status === 'active' && invitation?.email && invitation?.companyId;

  return (
    <main className="min-h-screen bg-dark-950 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md card p-6 sm:p-8">
        {loading ? <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div> : !validInvitation ? (
          <div className="text-center space-y-4"><Building2 size={34} className="mx-auto text-primary-400" /><h1 className="text-xl font-bold text-dark-100">Convite indisponível</h1><p className="text-sm text-dark-400">Este convite é inválido ou já foi utilizado.</p><Link className="btn-primary inline-flex" to="/login">Ir para login</Link></div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6"><div className="rounded-xl bg-primary-400/10 p-3 text-primary-300"><UserPlus size={22} /></div><div><h1 className="text-xl font-bold text-dark-100">Entrar na empresa</h1><p className="text-sm text-dark-500">Crie sua conta para acessar o Angler ERP.</p></div></div>
            <div className="rounded-xl bg-dark-800 p-4 text-sm mb-5"><div className="text-dark-300">Convite para <strong>{invitation.email}</strong></div><div className="mt-1 text-dark-500">Perfil: {ROLE_LABELS[invitation.role] || invitation.role}</div></div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3"><label className="label">Nome<input required className="input mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="label">Sobrenome<input className="input mt-1" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label></div>
              <label className="label">Senha<input required type="password" minLength="6" className="input mt-1" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
              <label className="label">Confirmar senha<input required type="password" minLength="6" className="input mt-1" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
              <button disabled={saving} className="btn-primary w-full disabled:opacity-50" type="submit">{saving ? 'Criando conta...' : 'Criar conta e entrar'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
