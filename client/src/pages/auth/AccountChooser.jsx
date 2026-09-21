import React from 'react';
import { Building2, UserRound } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

export default function AccountChooser() {
  const { userData, availableCompanies, selectCompanyContext } = useAuth();
  const navigate = useNavigate();
  const personalCompanyId = userData?.personalCompanyId || userData?.uid || userData?.companyId;
  const personal = availableCompanies.find((item) => item.id === personalCompanyId);
  const external = availableCompanies.filter((item) => item.id !== personalCompanyId);
  const enter = async (companyId) => {
    await selectCompanyContext(companyId);
    navigate('/app', { replace: true });
  };

  return (
    <main className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
      <section className="w-full max-w-2xl card p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-dark-100">Onde você quer entrar?</h1>
          <p className="text-sm text-dark-500 mt-2">Sua conta pessoal fica separada dos acessos que outras empresas concederam a você.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {personal && (
            <button onClick={() => enter(personal.id)} className="text-left card p-5 hover:border-primary-500/50">
              <UserRound size={24} className="text-primary-400" />
              <div className="font-semibold text-dark-100 mt-3">Minha conta</div>
              <div className="text-sm text-dark-500 mt-1">{personal.name}</div>
              <div className="text-xs text-dark-600 mt-2">Proprietário da minha empresa</div>
            </button>
          )}
          {external.map((item) => (
            <button key={item.id} onClick={() => enter(item.id)} className="text-left card p-5 hover:border-primary-500/50">
              <Building2 size={24} className="text-primary-400" />
              <div className="font-semibold text-dark-100 mt-3">Acesso como {item.membershipRole || 'membro'}</div>
              <div className="text-sm text-dark-500 mt-1">{item.name}</div>
              <div className="text-xs text-dark-600 mt-2">Empresa de outro proprietário</div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
