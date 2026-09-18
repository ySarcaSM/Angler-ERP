import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, Trash2, Search, LogOut, RefreshCw,
  UserCheck, UserX, ChevronDown, AlertTriangle, Loader2,
  Building2, Mail, Calendar, Eye, Copy, CheckCircle2,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  listAllUsers,
  disableUser,
  enableUser,
  deleteUserFull,
} from '../../services/firebase/admin';
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
  const { admin, isAuthenticated, loading: authLoading, logout } = useAdminAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // ─── Verificar autenticação ───

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // ─── Carregar TODOS os usuários ───

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      toast.error('Erro ao carregar lista de usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadUsers();
    }
  }, [isAuthenticated, loadUsers]);

  // ─── Empresas únicas (para filtro) ───

  const companies = [...new Set(users.map((u) => u.companyId).filter(Boolean))];

  // ─── Filtrar usuários ───

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchTerm ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.companyId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    const userStatus = user.status || 'active';
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && userStatus !== 'disabled') ||
      (statusFilter === 'disabled' && userStatus === 'disabled');

    const matchesCompany =
      companyFilter === 'all' || user.companyId === companyFilter;

    return matchesSearch && matchesRole && matchesStatus && matchesCompany;
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
    setActionLoading(user.id);
    try {
      const result = await deleteUserFull(user.id);

      if (result.auth) {
        toast.success(`Conta de ${user.name || user.email} excluída (Firestore + Auth).`);
      } else {
        toast.success(`Documento removido do Firestore. O login foi bloqueado.`);
      }

      setShowDeleteModal(null);
      setSelectedUser(null);
      await loadUsers();
    } catch (err) {
      toast.error(`Erro ao excluir conta: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
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
    companies: companies.length,
  };

  // ─── Loading inicial ───

  if (authLoading || !isAuthenticated) {
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
                <h1 className="text-lg font-semibold text-white">Administração do Sistema</h1>
                <p className="text-xs text-dark-400">
                  Logado como <span className="text-red-400 font-medium">{admin?.username || 'admin'}</span>
                  {' '}· <span className="text-dark-500">Superadmin</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total de Contas', value: stats.total, icon: Users, color: 'text-white' },
            { label: 'Ativos', value: stats.active, icon: UserCheck, color: 'text-green-400' },
            { label: 'Desativados', value: stats.disabled, icon: UserX, color: 'text-red-400' },
            { label: 'Admins/Owners', value: stats.admins, icon: Shield, color: 'text-yellow-400' },
            { label: 'Empresas', value: stats.companies, icon: Building2, color: 'text-blue-400' },
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
                placeholder="Buscar por nome, e-mail ou empresa..."
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

            {companies.length > 1 && (
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600
                           text-white focus:outline-none focus:ring-2 focus:ring-red-500/50
                           transition-colors"
              >
                <option value="all">Todas as empresas</option>
                {companies.map((cId) => (
                  <option key={cId} value={cId}>{cId}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
              <span className="ml-3 text-dark-400">Carregando todas as contas...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-dark-400">
              <Users className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-lg font-medium">Nenhuma conta encontrada</p>
              <p className="text-sm mt-1">
                {searchTerm ? 'Tente ajustar os filtros de busca.' : 'Nenhuma conta cadastrada no sistema.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                        Usuário
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-dark-400 uppercase tracking-wider">
                        Empresa
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
                                </p>
                                <p className="text-xs text-dark-400">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono text-dark-400 bg-dark-800 px-2 py-1 rounded">
                              {user.companyId || '—'}
                            </span>
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
                              {/* Ver detalhes */}
                              <button
                                onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                                className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-colors"
                                title="Ver detalhes"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Toggle status */}
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

                              {/* Delete */}
                              <button
                                onClick={() => setShowDeleteModal(user)}
                                disabled={isLoading}
                                className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Excluir conta permanentemente"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tablet/Mobile Cards */}
              <div className="lg:hidden divide-y divide-dark-800">
                {filteredUsers.map((user) => {
                  const isDisabled = user.status === 'disabled';
                  const isLoading = actionLoading === user.id;
                  const isExpanded = selectedUser?.id === user.id;

                  return (
                    <div key={user.id} className={`p-4 space-y-3 ${isDisabled ? 'opacity-60' : ''}`}>
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
                            </p>
                            <p className="text-xs text-dark-400">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
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
                        {user.companyId && (
                          <span className="text-xs font-mono text-dark-500 bg-dark-800 px-2 py-0.5 rounded">
                            {user.companyId}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setSelectedUser(isExpanded ? null : user)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                     text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detalhes
                        </button>

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

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="bg-dark-800 border border-dark-700 rounded-lg p-3 space-y-2 text-xs">
                          <p className="text-dark-400 font-medium uppercase tracking-wider">Dados da Conta</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-dark-500">UID:</span>
                              <p className="text-dark-300 font-mono break-all">{user.id}</p>
                            </div>
                            <div>
                              <span className="text-dark-500">Empresa:</span>
                              <p className="text-dark-300 font-mono">{user.companyId || '—'}</p>
                            </div>
                            <div>
                              <span className="text-dark-500">Criado em:</span>
                              <p className="text-dark-300">{formatDate(user.createdAt)}</p>
                            </div>
                            <div>
                              <span className="text-dark-500">Atualizado:</span>
                              <p className="text-dark-300">{formatDate(user.updatedAt)}</p>
                            </div>
                          </div>
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
                Exibindo {filteredUsers.length} de {users.length} contas registradas
              </p>
            </div>
          )}
        </div>

        {/* User Detail Panel (desktop) */}
        {selectedUser && (
          <div className="hidden lg:block bg-dark-900 border border-dark-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Detalhes da Conta</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-dark-400 hover:text-white transition-colors text-sm"
              >
                Fechar
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-dark-500 mb-1">Nome</p>
                <p className="text-sm text-white">{selectedUser.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">E-mail</p>
                <p className="text-sm text-white">{selectedUser.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">UID</p>
                <p className="text-sm text-white font-mono break-all">{selectedUser.id}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Empresa (companyId)</p>
                <p className="text-sm text-white font-mono">{selectedUser.companyId || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Cargo</p>
                <p className="text-sm text-white capitalize">{selectedUser.role || 'viewer'}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Status</p>
                <p className="text-sm text-white">{selectedUser.status === 'disabled' ? 'Desativado' : 'Ativo'}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Criado em</p>
                <p className="text-sm text-white">{formatDate(selectedUser.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1">Atualizado em</p>
                <p className="text-sm text-white">{formatDate(selectedUser.updatedAt)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Bootstrap Notice — mostra UID do admin para configurar regras */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-200/80 space-y-2">
            <p className="font-medium text-yellow-300">⚙️ Modo Bootstrap — Regras Firestore</p>
            <p>
              As regras do Firestore estão em modo permissivo para permitir o primeiro login.
              Após configurar, <strong>trave o acesso</strong> substituindo o UID nas regras:
            </p>
            <div className="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-2 font-mono text-xs">
              <span className="text-dark-400">Seu UID:</span>
              <code className="text-yellow-300 break-all">{admin?.uid || '...'}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(admin?.uid || '');
                  toast.success('UID copiado!');
                }}
                className="ml-auto p-1 rounded hover:bg-dark-700 text-dark-400 hover:text-yellow-300 transition-colors"
                title="Copiar UID"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-xs text-dark-400">
              <li>Copie o UID acima</li>
              <li>Abra <code className="text-dark-300">firestore.rules</code></li>
              <li>Na função <code className="text-dark-300">isSuperAdmin()</code>, troque por: <code className="text-yellow-300">request.auth.uid == '{admin?.uid || 'SEU_UID'}'</code></li>
              <li>Faça deploy das regras no Firebase Console</li>
            </ol>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-200/80">
            <p className="font-medium text-red-300">Painel Superadmin — Acesso Total</p>
            <p className="mt-1">
              Este painel exibe <strong>todas as contas</strong> registradas no sistema, de todas as empresas.
              Ao excluir uma conta, o documento é removido do Firestore, impedindo o login.
              A exclusão do Firebase Auth depende das permissões da API.
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
          isSelfDelete={false}
        />
      )}
    </div>
  );
}
