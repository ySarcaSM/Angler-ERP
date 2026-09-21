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
  switchActiveCompany,
} from '../services/firebase/auth';
import { getStoredAdminSession } from '../services/firebase/admin';
import { isCurrentUserAdmin } from '../services/firebase/admin';
import toast from 'react-hot-toast';
import { AuthContext } from './AuthContextValue';
import { applyAccessibilityPreferences, DEFAULT_ACCESSIBILITY, getAccessibilityPreferences, promptAccessibilityPreferences, promptSavedAccessibilityPreferences, storeAccessibilityPreferences } from '../utils/accessibility';


const activeCompanyStorageKey = (uid) => `angler-active-company-${uid}`;

function getPersonalCompanyId(userData) {
  return userData?.personalCompanyId || (userData?.memberships && Object.keys(userData.memberships).find((id) => userData.memberships[id]?.role === 'owner')) || userData?.companyId;
}

async function loadCompanies(userData) {
  const memberships = userData?.memberships || {};
  const ids = Object.keys(memberships).filter((id) => memberships[id]?.active !== false);
  if (userData?.companyId && !ids.includes(userData.companyId)) ids.push(userData.companyId);
  const companies = await Promise.all(ids.map(async (id) => {
    const data = await getCompanyData(id);
    return data ? { ...data, membershipRole: memberships[id]?.role || (id === userData.companyId ? userData.role : null) } : null;
  }));
  return companies.filter(Boolean);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [company, setCompany] = useState(null);
  const [availableCompanies, setAvailableCompanies] = useState([]);
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

            const companies = await loadCompanies(uData);
            const personalCompanyId = getPersonalCompanyId(uData);
            const storedCompanyId = localStorage.getItem(activeCompanyStorageKey(firebaseUser.uid));
            const activeCompanyId = companies.some((item) => item.id === storedCompanyId)
              ? storedCompanyId
              : personalCompanyId;
            const activeCompany = companies.find((item) => item.id === activeCompanyId) || null;
            const activeMembership = activeCompany ? (uData.memberships?.[activeCompany.id] || {}) : {};
            const activeUserData = {
              ...uData,
              personalCompanyId,
              companyId: activeCompany?.id || personalCompanyId,
              role: activeCompany?.id === personalCompanyId ? (uData.memberships?.[personalCompanyId]?.role || 'owner') : (activeMembership.role || uData.role),
            };
            if (activeCompany) localStorage.setItem(activeCompanyStorageKey(firebaseUser.uid), activeCompany.id);
            setAvailableCompanies(companies);
            setUserData(activeUserData);
            setUser(firebaseUser);
            if (activeUserData.accessibilityPreferences) {
              const shouldApply = promptAccessibilityPreferences(uData.accessibilityPreferences);
              storeAccessibilityPreferences(shouldApply ? uData.accessibilityPreferences : DEFAULT_ACCESSIBILITY);
            } else {
              const shouldApply = promptSavedAccessibilityPreferences();
              if (shouldApply) applyAccessibilityPreferences(getAccessibilityPreferences());
            }
            setCompany(activeCompany);
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
        setAvailableCompanies([]);
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

    const companies = await loadCompanies(loadedUserData);
    const personalCompanyId = getPersonalCompanyId(loadedUserData);
    localStorage.setItem(activeCompanyStorageKey(fbUser.uid), personalCompanyId);
    setAvailableCompanies(companies);
    setUser(fbUser);
    setUserData({
      ...loadedUserData,
      personalCompanyId,
      companyId: personalCompanyId,
      role: loadedUserData.memberships?.[personalCompanyId]?.role || loadedUserData.role,
    });
    setCompany(await getCompanyData(personalCompanyId));
    return fbUser;
  }, []);

  const register = useCallback(async (data) => {
    const result = await fbRegister(data);
    return result;
  }, []);

  const navigate = useNavigate();


  const selectCompanyContext = useCallback(async (companyId) => {
    if (!user?.uid || !userData) return;
    const target = availableCompanies.find((item) => item.id === companyId);
    if (!target) throw new Error('Você não possui acesso a esta empresa.');
    const role = target.id === getPersonalCompanyId(userData)
      ? (userData.memberships?.[target.id]?.role || 'owner')
      : (target.membershipRole || userData.memberships?.[target.id]?.role || userData.role);
    await switchActiveCompany(user.uid, companyId, role);
    localStorage.setItem(activeCompanyStorageKey(user.uid), companyId);
    setUserData({ ...userData, companyId, role });
    setCompany(target);
  }, [user, userData, availableCompanies]);

  const switchCompany = selectCompanyContext;

  const logout = useCallback(async () => {
    await fbLogout();
    sessionStorage.removeItem('angler-accessibility-confirmed');
    sessionStorage.removeItem('angler-gemini-api-key');
    setUser(null);
    setUserData(null);
    setCompany(null);
    setAvailableCompanies([]);
    navigate('/');
  }, [navigate]);

  const resetPassword = useCallback(async (email) => {
    await fbResetPassword(email);
  }, []);

  const refreshCompany = useCallback(async () => {
    if (!userData?.companyId) return null;
    const updatedCompany = await getCompanyData(userData.companyId);
    setCompany(updatedCompany);
    return updatedCompany;
  }, [userData?.companyId]);

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
    refreshCompany,
    hasPermission,
    availableCompanies,
    switchCompany,
    selectCompanyContext,
    isAuthenticated: !!user && !!userData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

