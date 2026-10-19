import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminLogin as fbAdminLogin,
  adminLogout as fbAdminLogout,
  onAdminAuthChange,
} from '../services/firebase/admin';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => onAdminAuthChange((adminData) => {
    setAdmin(adminData);
    setLoading(false);
  }), []);

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

  return (
    <AdminAuthContext.Provider value={{ admin, loading, isAuthenticated: !!admin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
