import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, Trash2, Search, LogOut, RefreshCw,
  UserCheck, UserX, ChevronDown, AlertTriangle, Loader2,
} from 'lucide-react';
import {
  listCompanyUsers,
  disableUser,
  enableUser,
  deleteUserFull,
  deleteSelfAccount,
  adminLogout,
  verifyAdminRole,
} from '../../services/firebase/admin';
import { auth } from '../../config/firebase';
import DeleteConfirmModal from '../../components/admin/DeleteConfirmModal';
import toast from 'react-hot-toast';

// ─── Helpers ───

function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getRoleBadge(role) {
  const styles = {
    owner: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    admin: 'bg-red-500/10 text-red-400 border-red-500/20',
    manager: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    operator: 'bg-green-500/10 text-green-400 border-green-500/20',
    viewer: 'bg-dark-500/10 text-dark-400 border-dark-500/20',
  };
  return styles[role] || styles.viewer;
}

function getStatusBadge(status) {
  if (status === 'disabled') {
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  }
  return 'bg-green-500/10 text-green-400 border-green-500/20';
}

// ─── Component ───

export default function AdminPanel() {
  const navigate = useNavigate();

  const [adminUser, setAdminUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // ─── Verificar autenticação ───

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        navigate('/admin/login');
        return;
      }

      try {
        const admin = await verifyAdminRole(firebaseUser.uid);
        if (!admin) {
          toast.error('Acesso negado. Permissão de administrador necessária.');
          await adminLogout();
          navigate('/admin/login');
          return;
        }
        setAdminUser(admin);
      } catch (err) {
        console.error('Erro ao verificar admin:', err);
        navigate('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // ─── Carregar usuários ───

  const loadUsers = useCallback(async () => {
    if (!adminUser?.companyId) return;

    setLoading(true);
    try {
      const data = await listCompanyUsers(adminUser.companyId);
      setUsers(data);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      toast.error('Erro ao carregar lista de usuários.');
    } finally {
      setLoading(false);
    }
  }, [adminUser]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ─── Filtrar usuários ───

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchTerm ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    const userStatus = user.status || 'active';
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && userStatus !== 'disabled') ||
      (statusFilter === 'disabled' && userStatus === 'disabled');

    return matchesSearch && matchesRole && matchesStatus;
  });

  // ─── Ações ───

  const handleToggleStatus = async (user) => {
    const userId = user.id;
    const isDisabled = user.status === 'disabled';
    const action = isDisabled ? 'reativar' : 'desativar';

    if (!confirm(`Deseja ${action} a conta de ${user.name || user.email}?`)) return;

    setActionLoading(userId);
    try {
      if (isDisabled) {
        await enableUser(userId);
        toast.success(`Conta de ${user.name || user.email} reativada.`);
      } else {
        await disableUser(userId);
        toast.success(`Conta de ${user.name || user.email} desativada.`);
      }
      await loadUsers();
    } catch (err) {
      toast.error(`Erro ao ${action} conta: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (user) => {
    const isSelf = user.id === adminUser?.uid;
    setActionLoading(user.id);
    try {
      if (isSelf) {
        // Auto-exclusão: deleta Firestore + Auth do próprio usuário
        await deleteSelfAccount();
        toast.success('Sua conta foi excluída.');
        setShowDeleteModal(null);
        navigate('/admin/login');
        return;
      }

      // Exclusão de outro usuário: deleta Firestore + Auth
      const result = await deleteUserFull(user.id);

      if (result.auth) {
        toast.success(`Conta de ${user.name || user.email} excluída (Firestore + Auth).`);
      } else {
        toast.success(`Documento removido do Firestore. Auth: ${result.error || 'verifique manualmente.'}`);
      }

      setShowDeleteModal(null);
      await loadUsers();
    } catch (err) {
      toast.error(`Erro ao excluir conta: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    try {
      await adminLogout();
      navigate('/admin/login');
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
    }
  };

  // ─── Estatísticas ───

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status !== 'disabled').length,
    disabled: users.filter((u) => u.status === 'disabled').length,
    admins: users.filter((u) => u.role === 'owner' || u.role === 'admin').length,
  };

  // ─── Loading inicial ───

  if (!adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
      </div>
    );
  }

  // ─── Render ───

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="bg-dark-900 border-b border-dark-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10">
                <Shield className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Administração de Contas</h1>
                <p className="text-xs text-dark-400">
                  Logado como <span className="text-dark-200">{adminUser.name || adminUser.email}</span>
                  {' '}· <span className="capitalize">{adminUser.role}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadUsers}
                disabled={loading}
                className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
                title="Atualizar lista"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-dark-300
                           hover:text-white hover:bg-dark-800 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: Users, color: 'text-white' },
            { label: 'Ativos', value: stats.active, icon: UserCheck, color: 'text-green-400' },
            { label: 'Desativados', value: stats.disabled, icon: UserX, color: 'text-red-400' },
            { label: 'Admins', value: stats.admins, icon: Shield, color: 'text-yellow-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-dark-900 border border-dark-700 rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-dark-400">{label}</p>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600
                           text-white placeholder-dark-500
                           focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500
                           transition-colors"
              />
            </div>

            {/* Toggle filters (mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="sm:hidden flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                         bg-dark-800 border border-dark-600 text-dark-300 hover:text-white transition-colors"
            >
              Filtros
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Filter dropdowns */}
          <div className={`flex flex-col sm:flex-row gap-3 ${showFilters ? '' : 'hidden sm:flex'}`}>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600
                         text-white focus:outline-none focus:ring-2 focus:ring-red-500/50
                         transition-colors"
            >
              <option value="all">Todos os cargos</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600
                         text-white focus:outline-none focus:ring-2 focus:ring-red-500/50
                         transition-colors"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="disabled">Desativados</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
              <span className="ml-3 text-dark-400">Carregando usuários...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-dark-400">
              <Users className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-lg font-medium">Nenhum usuário encontrado</p>
              <p className="text-sm mt-1">
                {searchTerm ? 'Tente ajustar os filtros de busca.' : 'Nenhum usuário cadastrado nesta empresa.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                        Usuário
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                        Cargo
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                        Criado em
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800">
                    {filteredUsers.map((user) => {
                      const isCurrentUser = user.id === adminUser.uid;
                      const isDisabled = user.status === 'disabled';
                      const isLoading = actionLoading === user.id;

                      return (
                        <tr
                          key={user.id}
                          className={`hover:bg-dark-800/50 transition-colors ${isDisabled ? 'opacity-60' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-dark-700 flex items-center justify-center">
                                <span className="text-sm font-medium text-dark-200">
                                  {(user.name || user.email || '?')[0].toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {user.name || 'Sem nome'}
                                  {isCurrentUser && (
                                    <span className="ml-2 text-xs text-dark-400">(você)</span>
                                  )}
                                </p>
                                <p className="text-xs text-dark-400">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${getRoleBadge(user.role)}`}
                            >
                              {user.role || 'viewer'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(user.status)}`}
                            >
                              {isDisabled ? 'Desativado' : 'Ativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-dark-300">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {/* Toggle status */}
                              {!isCurrentUser && user.role !== 'owner' && (
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  disabled={isLoading}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isDisabled
                                      ? 'text-green-400 hover:bg-green-500/10'
                                      : 'text-yellow-400 hover:bg-yellow-500/10'
                                  }`}
                                  title={isDisabled ? 'Reativar conta' : 'Desativar conta'}
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : isDisabled ? (
                                    <UserCheck className="w-4 h-4" />
                                  ) : (
                                    <UserX className="w-4 h-4" />
                                  )}
                                </button>
                              )}

                              {/* Delete — pode excluir a si mesmo, outros owners não */}
                              {(isCurrentUser || user.role !== 'owner') && (
                                <button
                                  onClick={() => setShowDeleteModal(user)}
                                  disabled={isLoading}
                                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Excluir conta permanentemente"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-dark-800">
                {filteredUsers.map((user) => {
                  const isCurrentUser = user.id === adminUser.uid;
                  const isDisabled = user.status === 'disabled';
                  const isLoading = actionLoading === user.id;

                  return (
                    <div
                      key={user.id}
                      className={`p-4 space-y-3 ${isDisabled ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center">
                            <span className="text-sm font-medium text-dark-200">
                              {(user.name || user.email || '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {user.name || 'Sem nome'}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-dark-400">(você)</span>
                              )}
                            </p>
                            <p className="text-xs text-dark-400">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${getRoleBadge(user.role)}`}
                        >
                          {user.role || 'viewer'}
                        </span>
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(user.status)}`}
                        >
                          {isDisabled ? 'Desativado' : 'Ativo'}
                        </span>
                        <span className="text-xs text-dark-500 ml-auto">
                          {formatDate(user.createdAt)}
                        </span>
                      </div>

                      {/* Actions — pode excluir a si mesmo, outros owners não */}
                      {(isCurrentUser || user.role !== 'owner') && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={isLoading}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isDisabled
                                ? 'text-green-400 bg-green-500/10 hover:bg-green-500/20'
                                : 'text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20'
                            }`}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isDisabled ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Reativar
                              </>
                            ) : (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                Desativar
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setShowDeleteModal(user)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                       text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer */}
          {!loading && filteredUsers.length > 0 && (
            <div className="border-t border-dark-700 px-6 py-3">
              <p className="text-xs text-dark-500">
                Exibindo {filteredUsers.length} de {users.length} usuários
              </p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
          <AlertTriangle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-200/80">
            <p className="font-medium text-green-300">Exclusão completa (Firestore + Auth)</p>
            <p className="mt-1">
              Ao excluir uma conta, o documento é removido do Firestore e a conta
              do Firebase Auth é deletada via REST API. O email fica liberado para
              reutilização. Tudo funciona no plano gratuito do Firebase.
            </p>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          user={showDeleteModal}
          onConfirm={() => handleDeleteUser(showDeleteModal)}
          onCancel={() => setShowDeleteModal(null)}
          loading={actionLoading === showDeleteModal.id}
          isSelfDelete={showDeleteModal.id === adminUser?.uid}
        />
      )}
    </div>
  );
}
