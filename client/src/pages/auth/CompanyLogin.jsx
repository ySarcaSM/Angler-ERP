import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Eye, EyeOff, LogIn, ArrowLeft } from 'lucide-react';
import { getCompanyInvitation } from '../../services/firebase/invitations';
import { loginWithCompanyInvitation } from '../../services/firebase/auth';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
  viewer: 'Visualizador',
};

export default function CompanyLogin() {
  const { invitationId } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    getCompanyInvitation(invitationId)
      .then(setInvitation)
      .catch(() => setInvitation(null))
      .finally(() => setLoadingInvitation(false));
  }, [invitationId]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await loginWithCompanyInvitation({ invitation, email: invitation.email, password });
      toast.success('Convite aceito. Entrando na empresa...');
      navigate('/app', { replace: true });
    } catch (error) {
      const messages = {
        'auth/company-login-invalid-credential': 'Email ou senha incorretos. Essa rota exige uma conta Angler existente.',
        'auth/invitation-inactive': 'Este convite já foi utilizado ou não está mais disponível.',
        'auth/already-company-member': 'Sua conta já possui acesso a esta empresa.',
        'permission-denied': 'O Firebase bloqueou a aceitação do convite. Publique as regras atualizadas do Firestore.',
      };
      toast.error(messages[error.code] || error.message || 'Não foi possível aceitar o convite.');
    } finally {
      setLoading(false);
    }
  };

  const valid = invitation?.status === 'active' && invitation?.email && invitation?.companyId;

  return (
    <main className="min-h-screen bg-dark-950 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md card p-6 sm:p-8">
        {loadingInvitation ? (
          <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
        ) : !valid ? (
          <div className="text-center space-y-4">
            <Building2 size={38} className="mx-auto text-primary-400" />
            <h1 className="text-xl font-bold text-dark-100">Convite indisponível</h1>
            <p className="text-sm text-dark-400">Este convite é inválido, expirou ou já foi utilizado.</p>
            <Link className="btn-primary inline-flex" to="/login">Ir para login</Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary-400/10 flex items-center justify-center text-primary-300"><Building2 size={24} /></div>
              <h1 className="text-2xl font-bold text-dark-100">Entrar em outra empresa</h1>
              <p className="text-sm text-dark-500 mt-1">Este acesso só é liberado por convite.</p>
            </div>

            <div className="rounded-xl bg-dark-800 p-4 text-sm mb-5">
              <div className="text-dark-400">Email convidado</div>
              <div className="font-medium text-dark-100 mt-1">{invitation.email}</div>
              <div className="text-dark-500 mt-2">Perfil: <strong>{ROLE_LABELS[invitation.role] || invitation.role}</strong></div>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input className="input mt-1 bg-dark-800/70" value={invitation.email} readOnly />
              </div>
              <div>
                <label className="label">Senha da sua conta Angler</label>
                <div className="relative">
                  <input required type={passwordVisible ? 'text' : 'password'} className="input pr-10 mt-1" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500" onClick={() => setPasswordVisible((value) => !value)}>
                    {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button disabled={loading} className="btn-primary w-full disabled:opacity-50" type="submit">
                {loading ? <div className="animate-spin w-5 h-5 border-2 border-dark-950 border-t-transparent rounded-full" /> : <><LogIn size={18} /> Aceitar convite e entrar</>}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-dark-500">
              Ainda não possui conta? <Link to="/register" className="text-primary-400">Crie sua conta primeiro</Link> e depois use este convite.
            </div>
            <p className="text-center text-sm text-dark-500 mt-5">
              <Link to="/" className="text-dark-400 hover:text-primary-300 inline-flex items-center gap-1"><ArrowLeft size={14} /> Voltar ao início</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
