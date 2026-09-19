import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  onAuthChange,
  getUserData,
  getCompanyData,
  login as fbLogin,
  register as fbRegister,
  logout as fbLogout,
  resetPassword as fbResetPassword,
  isRegistrationInProgress,
} from '../services/firebase/auth';
import { getStoredAdminSession } from '../services/firebase/admin';
import { isCurrentUserAdmin } from '../services/firebase/admin';
import toast from 'react-hot-toast';
import { AuthContext } from './AuthContextValue';
import { applyAccessibilityPreferences, DEFAULT_ACCESSIBILITY, getAccessibilityPreferences, promptAccessibilityPreferences, promptSavedAccessibilityPreferences, storeAccessibilityPreferences } from '../utils/accessibility';

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
            if (uData.accessibilityPreferences) {
              const shouldApply = promptAccessibilityPreferences(uData.accessibilityPreferences);
              storeAccessibilityPreferences(shouldApply ? uData.accessibilityPreferences : DEFAULT_ACCESSIBILITY);
            } else {
              const shouldApply = promptSavedAccessibilityPreferences();
              if (shouldApply) applyAccessibilityPreferences(getAccessibilityPreferences());
            }

            // Get company data
            if (uData.companyId) {
              const cData = await getCompanyData(uData.companyId);
              setCompany(cData);
            }
          } else {
            // Documento do usuário não existe (foi excluído pelo admin)
            if (!isRegistrationInProgress()) {
              await fbLogout();
            }
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
    let loadedUserData;
    try {
      loadedUserData = await getUserData(fbUser.uid);
    } catch (error) {
      await fbLogout();
      if (error.code === 'permission-denied') {
        throw new Error('O Firebase bloqueou a leitura do perfil. Publique as regras do Firestore e tente novamente.');
      }
      throw error;
    }

    if (!loadedUserData) {
      await fbLogout();
      throw new Error('Perfil da conta não encontrado. Faça o cadastro novamente.');
    }

    if (loadedUserData.status === 'disabled') {
      await fbLogout();
      throw new Error('Sua conta foi desativada. Contate o administrador.');
    }

    if (loadedUserData.requiresEmailVerification && !fbUser.emailVerified) {
      await fbLogout();
      const error = new Error('Verifique seu email antes de entrar.');
      error.code = 'auth/email-not-verified';
      throw error;
    }

    setUser(fbUser);
    setUserData(loadedUserData);
    setCompany(loadedUserData.companyId ? await getCompanyData(loadedUserData.companyId) : null);
    return fbUser;
  }, []);

  const register = useCallback(async (data) => {
    const result = await fbRegister(data);
    return result;
  }, []);

  const navigate = useNavigate();

  const logout = useCallback(async () => {
    await fbLogout();
    sessionStorage.removeItem('angler-accessibility-confirmed');
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

