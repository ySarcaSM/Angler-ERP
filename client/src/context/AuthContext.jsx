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
  getPersonalCompanyId as getOwnedPersonalCompanyId,
} from '../services/firebase/auth';
import { getStoredAdminSession } from '../services/firebase/admin';
import { listApprovedCompanyAccessRequests } from '../services/firebase/companyAccess';
import { isCurrentUserAdmin } from '../services/firebase/admin';
import toast from 'react-hot-toast';
import { AuthContext } from './AuthContextValue';
import { applyAccessibilityPreferences, DEFAULT_ACCESSIBILITY, promptAccessibilityPreferences, storeAccessibilityPreferences } from '../utils/accessibility';


const activeCompanyStorageKey = (uid) => `angler-active-company-${uid}`;

const OPERATOR_GROUP_MODULES = {
  management: ['clients', 'products', 'sales', 'purchases', 'suppliers', 'locations'],
  financial: ['financial', 'stock', 'reports'],
  budgets: ['measurement', 'formulas', 'budgets'],
};

async function resolvePersonalCompanyId(userData) {
  if (!userData?.uid) return userData?.personalCompanyId || null;
  if (userData.personalCompanyId) return userData.personalCompanyId;

  const membershipOwnerId = userData.memberships
    && Object.keys(userData.memberships).find((id) => userData.memberships[id]?.personal === true);

  if (membershipOwnerId) return membershipOwnerId;

  // Nunca trate um membership externo com role=owner como empresa pessoal.
  // A empresa pessoal é determinada pela relação companies.ownerUid === uid.
  const ownedCompanyId = await getOwnedPersonalCompanyId(userData.uid);
  if (ownedCompanyId) return ownedCompanyId;

  // Compatibilidade com contas antigas em que a empresa pessoal tinha o
  // mesmo ID do usuário, sem transformar um owner externo em empresa própria.
  if (userData.companyId === userData.uid) return userData.uid;

  return null;
}

async function loadCompanies(userData, personalCompanyId) {
  const memberships = userData?.memberships || {};
  const ids = Object.keys(memberships).filter((id) => memberships[id]?.active !== false);

  // Recupera aprovações antigas caso o acesso tenha sido aprovado antes da
  // estrutura de memberships estar consistente no documento do usuário.
  let approvedRequests = [];
  if (userData?.uid) {
    try {
      approvedRequests = await listApprovedCompanyAccessRequests(userData.uid);
    } catch (error) {
      console.warn('[Auth] Não foi possível carregar acessos aprovados:', error);
    }
  }

  // Mantém acessos antigos/legados que podem estar registrados no contexto
  // da solicitação aprovada, mesmo que ainda não tenham sido refletidos
  // corretamente no mapa de memberships.
  approvedRequests.forEach((requestItem) => {
    if (requestItem.companyId && !ids.includes(requestItem.companyId)) ids.push(requestItem.companyId);
  });

  if (personalCompanyId && !ids.includes(personalCompanyId)) {
    ids.push(personalCompanyId);
  }

  // companyId é apenas o contexto ativo. Só deve ser considerado aqui
  // quando também houver membership ou solicitação aprovada para a empresa.
  if (userData?.companyId && !ids.includes(userData.companyId)
    && (memberships[userData.companyId]?.active || approvedRequests.some((item) => item.companyId === userData.companyId))) {
    ids.push(userData.companyId);
  }

  const companies = await Promise.all(ids.map(async (id) => {
    const data = await getCompanyData(id);
    if (!data) return null;

    const membership = memberships[id];
    const approvedRequest = approvedRequests.find((item) => item.companyId === id);
    const membershipRole = membership?.role
      || approvedRequest?.role
      || (id === userData?.companyId ? userData?.role : null);

    return {
      ...data,
      membershipRole,
      membershipActive: membership?.active !== false,
      membershipModules: Array.isArray(membership?.modules) ? membership.modules : [],
      operatorGroup: membership?.operatorGroup || null,
      accessRequestId: membership?.accessRequestId || approvedRequest?.id || null,
    };
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

            const personalCompanyId = await resolvePersonalCompanyId(uData);
            const companies = await loadCompanies(uData, personalCompanyId);
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
      operatorGroup: activeCompany?.id === personalCompanyId
        ? (uData.memberships?.[personalCompanyId]?.operatorGroup || null)
        : (activeMembership.operatorGroup || null),
            };
            if (activeCompany) localStorage.setItem(activeCompanyStorageKey(firebaseUser.uid), activeCompany.id);
            setAvailableCompanies(companies);
            setUserData(activeUserData);
            setUser(firebaseUser);
            // Acessibilidade pertence à conta do usuário, nunca à empresa ativa.
            // Cada usuário possui seu próprio armazenamento local e seu próprio
            // campo accessibilityPreferences no documento users/{uid}.
            const savedAccessibility = uData.accessibilityPreferences;
            if (savedAccessibility) {
              const shouldApply = promptAccessibilityPreferences(savedAccessibility);
              storeAccessibilityPreferences(
                shouldApply ? savedAccessibility : DEFAULT_ACCESSIBILITY,
                firebaseUser.uid,
              );
            } else {
              storeAccessibilityPreferences(DEFAULT_ACCESSIBILITY, firebaseUser.uid);
              applyAccessibilityPreferences(DEFAULT_ACCESSIBILITY);
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

    const personalCompanyId = await resolvePersonalCompanyId(loadedUserData);
    const companies = await loadCompanies(loadedUserData, personalCompanyId);
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
    return { user: fbUser, hasOtherCompanies: companies.some((item) => item.id !== personalCompanyId) };
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
    const role = target.id === userData.personalCompanyId
      ? 'owner'
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

  const getEffectiveModules = useCallback(() => {
    if (!company) return [];
    const companyModules = Array.isArray(company.modules?.enabled) ? company.modules.enabled : [];
    const membership = userData?.memberships?.[company.id];
    const configuredModules = Array.isArray(membership?.modules) ? membership.modules : null;
    if (['owner', 'admin'].includes(userData?.role)) return companyModules;
    if (userData?.role === 'operator') {
      return OPERATOR_GROUP_MODULES[userData?.operatorGroup]
        || OPERATOR_GROUP_MODULES.management;
    }
    return configuredModules || companyModules;
  }, [company, userData]);

  const hasPermission = useCallback((perm, moduleKey) => {
    if (!userData) return false;
    if (moduleKey && !getEffectiveModules().includes(moduleKey)) return false;
    if (userData.role === 'owner' || userData.role === 'admin') return true;
    if (userData.role === 'operator') return ['read', 'create', 'update', 'delete-request'].includes(perm);
    return perm === 'read';
  }, [userData, getEffectiveModules]);

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
    getEffectiveModules,
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

