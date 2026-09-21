import React, { useEffect, useState } from 'react';
import { ArrowLeft, Mail, Shield, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { getUser, getCompanyMember } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
  viewer: 'Visualizador',
};

export default function UserDetails() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { company } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!company?.id || !userId) return;
      setLoading(true);

      try {
        let data = null;

        try {
          data = await getUser(userId);
        } catch {
          data = null;
        }

        if (!data || data.companyId !== company.id) {
          data = await getCompanyMember(company.id, userId);
        }

        if (!data) {
          throw new Error('Usuário não encontrado nesta empresa.');
        }

        setProfile(data);
      } catch (err) {
        toast.error(err.message || 'Não foi possível carregar o usuário.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [company?.id, userId]);

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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/users')} className="btn-ghost" title="Voltar para usuários">
          <ArrowLeft size={18} /> Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Usuário</h1>
          <p className="text-sm text-dark-500 mt-1">Detalhes e acesso deste usuário à empresa.</p>
        </div>
      </div>

      <section className="card p-6">
        <div className="flex items-center gap-4 pb-6 border-b border-dark-800">
          <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center text-lg font-bold text-dark-200">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-dark-100">{fullName}</h2>
            <p className="text-sm text-dark-500">{profile.email || 'Sem e-mail informado'}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-6">
          <div className="rounded-xl bg-dark-800 p-4">
            <div className="flex items-center gap-2 text-xs text-dark-500 mb-2">
              <Mail size={14} /> E-mail
            </div>
            <div className="text-sm text-dark-100 break-all">{profile.email || '—'}</div>
          </div>

          <div className="rounded-xl bg-dark-800 p-4">
            <div className="flex items-center gap-2 text-xs text-dark-500 mb-2">
              <Shield size={14} /> Cargo
            </div>
            <div className="text-sm text-dark-100">{ROLE_LABELS[profile.role] || profile.role || '—'}</div>
          </div>

          <div className="rounded-xl bg-dark-800 p-4">
            <div className="flex items-center gap-2 text-xs text-dark-500 mb-2">
              <UserRound size={14} /> Status
            </div>
            <div className="text-sm text-dark-100">{profile.active === false ? 'Inativo' : 'Ativo'}</div>
          </div>

          <div className="rounded-xl bg-dark-800 p-4">
            <div className="text-xs text-dark-500 mb-2">ID do usuário</div>
            <code className="text-sm text-primary-300 font-mono select-all">{profile.uid || profile.id || userId}</code>
          </div>
        </div>
      </section>
    </div>
  );
}
