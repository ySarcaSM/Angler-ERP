import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { listUsers, deactivateUser, logAudit } from '../../services/firebase/settings';
import {
  listPendingCompanyAccessRequests,
  listCompanyMembers,
  approveCompanyAccessRequest,
  rejectCompanyAccessRequest,
} from '../../services/firebase/companyAccess';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
  viewer: 'Visualizador',
};

export default function UserManagement() {
  const navigate = useNavigate();
  const { company, user, userData } = useAuth();
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(null);
  const [selectedRole, setSelectedRole] = useState('operator');
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [companyUsers, companyMembers, pendingRequests] = await Promise.all([
        listUsers(company.id),
        listCompanyMembers(company.id),
        listPendingCompanyAccessRequests(company.id),
      ]);
      const mergedUsers = [...companyUsers];
      companyMembers.forEach((member) => {
        if (!mergedUsers.some((item) => (item.uid || item.id) === member.uid)) {
          mergedUsers.push({
            id: member.uid,
            uid: member.uid,
            name: member.name,
            email: member.email,
            role: member.role,
            active: member.active,
          });
        }
      });
      setUsers(mergedUsers);
      setRequests(pendingRequests);
    } catch (err) {
      toast.error(err.message || 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [company?.id]);

  const handleApprove = async () => {
    if (!requestOpen) return;
    setProcessing(true);
    try {
      await approveCompanyAccessRequest(requestOpen, selectedRole);
      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: 'approve',
        entity: 'Solicitação de acesso',
        entityId: requestOpen.id,
        description: `${userData?.name || 'Proprietário'} aprovou o acesso de ${requestOpen.email}.`,
        details: { email: requestOpen.email, role: selectedRole },
      });
      toast.success('Acesso aprovado.');
      setRequestOpen(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Não foi possível aprovar o acesso.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (requestItem) => {
    if (!confirm(`Recusar a solicitação de ${requestItem.email}?`)) return;
    try {
      await rejectCompanyAccessRequest(requestItem);
      toast.success('Solicitação recusada.');
      await load();
    } catch (err) {
      toast.error(err.message || 'Não foi possível recusar a solicitação.');
    }
  };

  const handleDeactivate = async (u) => {
    if (!confirm(`Desativar ${u.name}?`)) return;
    try {
      await deactivateUser(u.uid || u.id);
      await logAudit(company.id, {
        user,
        userName: userData?.name,
        action: 'update',
        entity: 'Usuário',
        entityId: u.uid || u.id,
        description: `${userData?.name || 'Usuário'} desativou o usuário ${u.name || u.email}.`,
        details: { name: u.name, email: u.email, role: u.role, status: 'disabled' },
      });
      toast.success('Desativado.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const roleBadge = (role) => {
    const colors = { owner: 'badge-info', admin: 'badge-danger', manager: 'badge-warning', operator: 'badge-success', viewer: 'badge-neutral' };
    return <span className={colors[role] || 'badge-neutral'}>{ROLE_LABELS[role] || role}</span>;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/settings')} className="btn-ghost"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Usuários</h1>
          <p className="text-sm text-dark-500 mt-1">Gerencie os acessos à sua empresa.</p>
        </div>
      </div>

      {requests.length > 0 && (
        <section className="card p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-dark-100">Solicitações de acesso</h2>
            <p className="text-sm text-dark-500 mt-1">Pessoas que entraram na rota da sua empresa e pediram acesso.</p>
          </div>
          {requests.map((requestItem) => (
            <div key={requestItem.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-dark-800">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-dark-100">{requestItem.name || 'Usuário Angler'}</div>
                <div className="text-xs text-dark-500">{requestItem.email}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setSelectedRole('operator'); setRequestOpen(requestItem); }} className="btn-primary btn-sm"><Check size={15} /> Aceitar</button>
                <button onClick={() => handleReject(requestItem)} className="btn-ghost btn-sm text-red-400"><X size={15} /> Recusar</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-dark-100">Usuários da empresa</h2>
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
        ) : users.map((u) => (
          <div key={u.id} className="card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center text-sm font-bold text-dark-300">{u.name?.[0]}{u.lastName?.[0] || ''}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-dark-100">{u.name} {u.lastName}</span>{roleBadge(u.role)}{!u.active && <span className="badge badge-danger">Inativo</span>}</div>
              <div className="text-xs text-dark-500">{u.email}</div>
            </div>
            {u.role !== 'owner' && u.companyId === company.id && <button onClick={() => handleDeactivate(u)} className="btn-ghost btn-sm text-red-400"><Trash2 size={14} /></button>}
          </div>
        ))}
      </section>

      <Modal open={!!requestOpen} onClose={() => !processing && setRequestOpen(null)} title="Aprovar acesso" size="md">
        {requestOpen && (
          <div className="space-y-5">
            <div className="rounded-xl bg-dark-800 p-4">
              <div className="font-medium text-dark-100">{requestOpen.name || 'Usuário Angler'}</div>
              <div className="text-sm text-dark-500 mt-1">{requestOpen.email}</div>
            </div>
            <label className="label">Cargo
              <select className="input mt-1" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
                <option value="admin">Administrador</option>
                <option value="manager">Gerente</option>
                <option value="operator">Operador</option>
                <option value="viewer">Visualizador</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRequestOpen(null)} className="btn-secondary" disabled={processing}>Cancelar</button>
              <button type="button" onClick={handleApprove} className="btn-primary" disabled={processing}>{processing ? 'Aprovando...' : 'Aprovar acesso'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
