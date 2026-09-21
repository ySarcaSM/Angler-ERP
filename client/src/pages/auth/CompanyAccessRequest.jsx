import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, LogIn, Send } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { getCompanyData } from '../../services/firebase/auth';
import { createCompanyAccessRequest } from '../../services/firebase/companyAccess';
import toast from 'react-hot-toast';

export default function CompanyAccessRequest() {
  const { companyId } = useParams();
  const { user, userData } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCompanyData(companyId).then(setCompany).catch(() => setCompany(null));
  }, [companyId]);

  const submit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await createCompanyAccessRequest({
        companyId,
        requesterUid: user.uid,
        email: user.email,
        name: userData?.name || user.displayName || '',
      });
      toast.success('Solicitação enviada ao proprietário da empresa.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível enviar a solicitação.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
        <section className="w-full max-w-md card p-8 text-center space-y-4">
          <Building2 size={40} className="mx-auto text-primary-400" />
          <h1 className="text-2xl font-bold text-dark-100">Solicitar acesso à empresa</h1>
          <p className="text-sm text-dark-400">Entre na sua conta pessoal do Angler para solicitar acesso a esta empresa.</p>
          <Link className="btn-primary inline-flex" to="/login">Entrar na minha conta</Link>
        </section>
      </main>
    );
  }

  const alreadyMember = userData?.companyId === companyId || userData?.memberships?.[companyId]?.active;
  const pending = false;

  return (
    <main className="min-h-screen bg-dark-950 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md card p-8">
        <div className="text-center mb-6">
          <Building2 size={40} className="mx-auto text-primary-400" />
          <h1 className="text-2xl font-bold text-dark-100 mt-3">Solicitar acesso</h1>
          <p className="text-sm text-dark-500 mt-1">Empresa: {company?.name || companyId}</p>
        </div>

        {alreadyMember ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 size={32} className="mx-auto text-green-400" />
            <p className="text-sm text-dark-300">Sua conta já possui acesso a esta empresa.</p>
          </div>
        ) : pending ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-dark-300">Sua solicitação está aguardando aprovação do proprietário.</p>
          </div>
        ) : (
          <button disabled={loading} onClick={submit} className="btn-primary w-full">
            <Send size={18} /> {loading ? 'Enviando...' : 'Enviar solicitação ao proprietário'}
          </button>
        )}
      </section>
    </main>
  );
}
