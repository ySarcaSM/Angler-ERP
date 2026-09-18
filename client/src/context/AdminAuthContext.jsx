// ═══════════════════════════════════════════
// Admin Auth Context — Autenticação do Superadmin
// ═══════════════════════════════════════════
// Contexto isolado da autenticação normal do app.
// Apenas o superadmin (credenciais hardcoded) pode acessar.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminLogin as fbAdminLogin,
  adminLogout as fbAdminLogout,
  onAdminAuthChange,
  getStoredAdminSession,
} from '../services/firebase/admin';
import toast from 'react-hot-toast';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Verificar sessão ao montar
  useEffect(() => {
    // Primeiro, verificar sessão salva (rápido, sem rede)
    const stored = getStoredAdminSession();
    if (stored) {
      setAdmin(stored);
    }

    // Depois, verificar Firebase Auth state
    const unsubscribe = onAdminAuthChange((adminData) => {
      setAdmin(adminData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (username, password) => {
    const adminData = await fbAdminLogin(username, password);
    setAdmin(adminData);
    return adminData;
  }, []);

  const logout = useCallback(async () => {
    await fbAdminLogout();
    setAdmin(null);
    navigate('/admin/login');
  }, [navigate]);

  const value = {
    admin,
    loading,
    isAuthenticated: !!admin,
    login,
    logout,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
