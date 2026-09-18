import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  onAuthChange,
  getUserData,
  getCompanyData,
  login as fbLogin,
  register as fbRegister,
  logout as fbLogout,
  resetPassword as fbResetPassword,
} from '../services/firebase/auth';
import { getStoredAdminSession } from '../services/firebase/admin';
import { isCurrentUserAdmin } from '../services/firebase/admin';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Não interferir com a sessão do superadmin
        const adminSession = getStoredAdminSession();
        if (adminSession && firebaseUser.uid === adminSession.uid) {
          setLoading(false);
          return;
        }

        try {
          // Get user data from Firestore
          const uData = await getUserData(firebaseUser.uid);
          if (uData) {
            // Verificar se a conta está desativada
            if (uData.status === 'disabled') {
              await fbLogout();
              setUser(null);
              setUserData(null);
              setCompany(null);
              toast.error('Sua conta foi desativada. Contate o administrador.');
              return;
            }

            setUserData(uData);
            setUser(firebaseUser);

            // Get company data
            if (uData.companyId) {
              const cData = await getCompanyData(uData.companyId);
              setCompany(cData);
            }
          } else {
            // Documento do usuário não existe (foi excluído pelo admin)
            await fbLogout();
            setUser(null);
            setUserData(null);
            setCompany(null);
          }
        } catch (err) {
          console.error('Error loading user data:', err);
        }
      } else {
        setUser(null);
        setUserData(null);
        setCompany(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const fbUser = await fbLogin(email, password);
    return fbUser;
  }, []);

  const register = useCallback(async (data) => {
    const result = await fbRegister(data);
    return result;
  }, []);

  const navigate = useNavigate();

  const logout = useCallback(async () => {
    await fbLogout();
    setUser(null);
    setUserData(null);
    setCompany(null);
    navigate('/');
  }, [navigate]);

  const resetPassword = useCallback(async (email) => {
    await fbResetPassword(email);
  }, []);

  const hasPermission = useCallback((perm) => {
    if (!userData) return false;
    if (userData.role === 'owner') return true;
    // Server-side rules handle real enforcement
    return true;
  }, [userData]);

  const value = {
    user,
    userData,
    company,
    loading,
    login,
    register,
    logout,
    resetPassword,
    hasPermission,
    isAuthenticated: !!user && !!userData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
