import React, { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { createCompanyInvitation, listUsers, deactivateUser, logAudit } from '../../services/firebase/settings';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const navigate = useNavigate();
  const { company, user, userData } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'operator' });

  const load = async () => {
    if (!company?.id) return;
    try { setUsers(await listUsers(company.id)); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [company]);

  const handleDeactivate = async (u) => {
    if (!confirm(`Desativar ${u.name}?`)) return;
    try { await deactivateUser(u.uid || u.id); await logAudit(company.id, { user, userName: userData?.name, action: 'update', entity: 'Usuário', entityId: u.uid || u.id, description: `${userData?.name || 'Usuário'} desativou o usuário ${u.name || u.email}.`, details: { name: u.name, email: u.email, role: u.role, status: 'disabled' } }); toast.success('Desativado.'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const createInvite = async (event) => {
    event.preventDefault();
    if (!company?.id) return;
    setCreatingInvite(true);
    try {
      const invitation = await createCompanyInvitation({
        companyId: company.id,
        email: inviteForm.email,
        role: inviteForm.role,
        createdBy: user?.uid,
      });
      await logAudit(company.id, { user, userName: userData?.name, action: 'create', entity: 'Convite de usuário', entityId: invitation.id, description: `${userData?.name || 'Proprietário'} gerou um convite para ${inviteForm.email}.`, details: { email: inviteForm.email, role: inviteForm.role } });
      setInviteLink(`${window.location.origin}/join/${invitation.id}`);
      toast.success('Link de convite gerado.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível gerar o convite.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const closeInvite = () => {
    setInviteOpen(false);
    setInviteLink('');
    setInviteForm({ email: '', role: 'operator' });
  };

  const roleBadge = (role) => {
    const colors = { owner: 'badge-info', admin: 'badge-danger', manager: 'badge-warning', operator: 'badge-success', viewer: 'badge-neutral' };
    return <span className={colors[role] || 'badge-neutral'}>{role}</span>;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
        <button onClick={() => navigate('/app/settings')} className="btn-ghost"><ArrowLeft size={18} /></button>
        <h1 className="text-2xl font-bold text-dark-100">Usuários</h1>
        </div>
        <button type="button" onClick={() => setInviteOpen(true)} className="btn-primary"><Plus size={18} /> Gerar link</button>
      </div>
      {loading ? <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" /></div> : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center text-sm font-bold text-dark-300">{u.name?.[0]}{u.lastName?.[0] || ''}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="font-medium text-dark-100">{u.name} {u.lastName}</span>{roleBadge(u.role)}{!u.active && <span className="badge badge-danger">Inativo</span>}</div>
                <div className="text-xs text-dark-500">{u.email}</div>
              </div>
              {u.role !== 'owner' && <button onClick={() => handleDeactivate(u)} className="btn-ghost btn-sm text-red-400"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={inviteOpen} onClose={closeInvite} title="Convidar usuário" size="md">
        {!inviteLink ? <form onSubmit={createInvite} className="space-y-4">
          <p className="text-sm text-dark-400">O link pode ser usado uma única vez pelo e-mail informado.</p>
          <label className="label">E-mail do usuário<input required type="email" className="input mt-1" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} /></label>
          <label className="label">Perfil<select className="input mt-1" value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value })}><option value="admin">Administrador</option><option value="manager">Gerente</option><option value="operator">Operador</option><option value="viewer">Visualizador</option></select></label>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={closeInvite} className="btn-secondary">Cancelar</button><button disabled={creatingInvite} className="btn-primary disabled:opacity-50" type="submit">{creatingInvite ? 'Gerando...' : 'Gerar link'}</button></div>
        </form> : <div className="space-y-4"><p className="text-sm text-dark-400">Envie este link para a pessoa convidada. Ele expira após ser usado.</p><div className="flex gap-2"><input readOnly className="input flex-1" value={inviteLink} /><button type="button" onClick={copyInviteLink} className="btn-secondary" title="Copiar link"><Copy size={18} /></button></div><div className="flex justify-end"><button type="button" onClick={closeInvite} className="btn-primary"><LinkIcon size={16} /> Concluído</button></div></div>}
      </Modal>
    </div>
  );
}
