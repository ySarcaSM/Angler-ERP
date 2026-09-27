import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export default function DeleteConfirmModal({ user, onConfirm, onCancel, loading, isSelfDelete }) {
  const [confirmText, setConfirmText] = useState('');

  // Se está excluindo a si mesmo, pede o e-mail. Senão, pede "EXCLUIR".
  const confirmLabel = isSelfDelete ? user?.email : 'EXCLUIR';
  const canDelete = confirmText === confirmLabel;

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel, loading]);

  // Prevenir scroll do body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl">
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 right-4 p-1 rounded-lg text-dark-400 hover:text-white
                     hover:bg-dark-800 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-5">
          {/* Warning icon */}
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>

          {/* Title */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">
              {isSelfDelete ? 'Excluir sua própria conta' : 'Excluir Conta'}
            </h2>
            <p className="text-dark-400 text-sm mt-2">
              Esta ação é <span className="text-red-400 font-medium">irreversível</span>.
              {isSelfDelete ? (
                <> Você será deslogado e não conseguirá mais acessar o sistema.</>
              ) : (
                <> Todos os dados associados a esta conta serão removidos.</>
              )}
            </p>
          </div>

          {/* User info */}
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center">
                <span className="text-sm font-medium text-dark-200">
                  {(user.name || user.email || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {user.name || 'Sem nome'}
                  {isSelfDelete && <span className="ml-2 text-xs text-red-400">(você)</span>}
                </p>
                <p className="text-xs text-dark-400">{user.email}</p>
              </div>
            </div>
          </div>

          {/* What will be deleted */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-dark-300 uppercase tracking-wider">
              Será removido:
            </p>
            <ul className="space-y-1.5">
              {[
                'Documento do usuário no Firestore',
                'Perfil e dados pessoais',
                'Clientes, produtos, vendas, compras e fornecedores',
                'Financeiro, estoque, orçamentos e fórmulas',
                'Locais, configurações, contadores e módulos da empresa',
                'Logs de auditoria, solicitações e chats do assistente',
                'Associações e acessos dessa conta',
                ...(isSelfDelete ? ['Acesso administrativo ao painel'] : []),
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-dark-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Confirm input */}
          <div>
            <label className="block text-sm text-dark-300 mb-2">
              {isSelfDelete ? (
                <>
                  Digite seu e-mail <span className="font-mono font-bold text-red-400">{confirmLabel}</span> para
                  confirmar:
                </>
              ) : (
                <>
                  Digite <span className="font-mono font-bold text-red-400">{confirmLabel}</span> para
                  confirmar:
                </>
              )}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmLabel}
              disabled={loading}
              autoFocus
              className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600
                         text-white placeholder-dark-500 font-mono
                         focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500
                         transition-colors disabled:opacity-50"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600
                         text-dark-300 hover:text-white hover:bg-dark-700
                         font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={!canDelete || loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                         bg-red-600 hover:bg-red-700 disabled:bg-red-600/30
                         text-white font-medium transition-colors disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {isSelfDelete ? 'Excluir minha conta' : 'Excluir Permanentemente'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
