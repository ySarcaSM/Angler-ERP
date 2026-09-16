import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listUsers, deactivateUser } from '../../services/firebase/settings';
import { formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!company?.id) return;
    try { setUsers(await listUsers(company.id)); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [company]);

  const handleDeactivate = async (u) => {
    if (!confirm(`Desativar ${u.name}?`)) return;
    try { await deactivateUser(u.uid || u.id); toast.success('Desativado.'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const roleBadge = (role) => {
    const colors = { owner: 'badge-info', admin: 'badge-danger', manager: 'badge-warning', operator: 'badge-success', viewer: 'badge-neutral' };
    return <span className={colors[role] || 'badge-neutral'}>{role}</span>;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/settings')} className="btn-ghost"><ArrowLeft size={18} /></button>
        <h1 className="text-2xl font-bold text-dark-100">Usuários</h1>
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
    </div>
  );
}
