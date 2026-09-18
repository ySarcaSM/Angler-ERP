// ═══════════════════════════════════════════
// Admin Service — Superadmin (conta master)
// ═══════════════════════════════════════════
// Login único com credenciais hardcoded nas variáveis de ambiente.
// Usa Firebase Auth (email/senha) para obter acesso ao Firestore.
// Painel vê TODAS as contas de TODAS as empresas.

import {
  collection, doc, getDoc, getDocs, query,
  setDoc, deleteDoc, updateDoc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

// ─── Constantes ───

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';
const ADMIN_AUTH_EMAIL = `${ADMIN_EMAIL}@angler-erp.local`;
const SESSION_KEY = 'angler_admin_session';

// ─── Helpers ───

/**
 * Verifica se o usuário atual é o superadmin.
 * Compara dinamicamente — sem UID hardcoded.
 */
export function isCurrentUserAdmin() {
  const stored = getStoredAdminSession();
  const currentUser = auth.currentUser;
  return !!(stored && currentUser && currentUser.uid === stored.uid);
}

/**
 * Re-autentica o admin (quando o token expira).
 */
async function reAuthAdmin() {
  try {
    const credential = await signInWithEmailAndPassword(auth, ADMIN_AUTH_EMAIL, ADMIN_PASSWORD);
    // Atualizar sessão no localStorage
    const adminData = {
      uid: credential.user.uid,
      email: ADMIN_AUTH_EMAIL,
      username: ADMIN_EMAIL,
      role: 'superadmin',
      loginAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(adminData));
    console.log('[Admin] Re-autenticação bem-sucedida. UID:', credential.user.uid);
    return credential.user;
  } catch (err) {
    console.error('[Admin] Re-autenticação falhou:', err);
    throw new Error('Sessão expirada. Faça login novamente.');
  }
}

/**
 * Obtém token válido, re-autenticando se necessário.
 */
async function getValidToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Admin não está autenticado.');
  }

  try {
    // Forçar refresh do token
    return await currentUser.getIdToken(true);
  } catch (err) {
    console.warn('[Admin] Token expirado, tentando re-autenticar...');
    const user = await reAuthAdmin();
    return await user.getIdToken(true);
  }
}

// ─── Autenticação Admin ───

/**
 * Login do superadmin.
 * 1. Valida credenciais contra variáveis de ambiente
 * 2. Cria conta Firebase Auth se não existir
 * 3. Faz signInWithEmailAndPassword
 * 4. Cria documento no Firestore para o AuthContext não deslogar
 * 5. Salva sessão no localStorage
 */
export async function adminLogin(username, password) {
  // Normalizar inputs
  const user = username.trim().toLowerCase();
  const expectedUser = ADMIN_EMAIL.trim().toLowerCase();

  // Validar username
  if (user !== expectedUser) {
    throw new Error('Credenciais inválidas.');
  }

  // Validar senha
  if (!ADMIN_PASSWORD) {
    throw new Error('VITE_ADMIN_PASSWORD não configurada. Verifique o arquivo .env no client/.');
  }
  if (password !== ADMIN_PASSWORD) {
    throw new Error('Credenciais inválidas.');
  }

  // Criar conta se não existir, depois fazer login
  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, ADMIN_AUTH_EMAIL, ADMIN_PASSWORD);
    console.log('[Admin] Conta criada no Firebase Auth. UID:', credential.user.uid);
  } catch (createErr) {
    if (createErr.code === 'auth/email-already-in-use') {
      try {
        credential = await signInWithEmailAndPassword(auth, ADMIN_AUTH_EMAIL, ADMIN_PASSWORD);
        console.log('[Admin] Login com conta existente. UID:', credential.user.uid);
      } catch (signInErr) {
        console.error('[Admin] Erro ao fazer login:', signInErr);
        throw new Error('Erro ao autenticar. Verifique as credenciais.');
      }
    } else {
      console.error('[Admin] Erro ao criar conta:', createErr);
      throw new Error('Erro ao criar conta admin. Verifique a configuração do Firebase.');
    }
  }

  const uid = credential.user.uid;

  // ══════════════════════════════════════════════════════════════
  // IMPORTANTE: Salvar sessão ANTES de qualquer operação async.
  // O AuthContext listener dispara imediatamente após signIn.
  // Se a sessão não estiver no localStorage, o AuthContext
  // vai deslogar o admin.
  // ══════════════════════════════════════════════════════════════
  const adminData = {
    uid,
    email: ADMIN_AUTH_EMAIL,
    username: ADMIN_EMAIL,
    role: 'superadmin',
    loginAt: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(adminData));

  // Criar documento no Firestore (para o AuthContext encontrar o doc)
  try {
    await setDoc(doc(db, 'users', uid), {
      name: 'Superadmin',
      email: ADMIN_AUTH_EMAIL,
      role: 'superadmin',
      status: 'active',
      companyId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log('[Admin] Documento do admin criado/atualizado no Firestore');
  } catch (docErr) {
    console.warn('[Admin] Aviso ao criar documento do admin:', docErr.message);
  }

  // Log do UID para configuração das regras Firestore
  console.log('%c[Admin] UID do superadmin:', 'color: #f59e0b; font-weight: bold;', uid);
  console.log('%c[Admin] Copie este UID e configure em firestore.rules → isSuperAdmin()', 'color: #f59e0b;');

  return adminData;
}

/**
 * Logout do superadmin.
 */
export async function adminLogout() {
  localStorage.removeItem(SESSION_KEY);
  await signOut(auth);
}

/**
 * Verifica se existe uma sessão admin salva.
 */
export function getStoredAdminSession() {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Listener de estado de autenticação admin.
 */
export function onAdminAuthChange(callback) {
  const stored = getStoredAdminSession();

  if (!stored) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser && firebaseUser.uid === stored.uid) {
      callback(stored);
    } else if (firebaseUser) {
      // UID diferente — atualizar sessão
      const updatedSession = { ...stored, uid: firebaseUser.uid };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
      callback(updatedSession);
    } else {
      localStorage.removeItem(SESSION_KEY);
      callback(null);
    }
  });
}

// ─── Gerenciamento de Usuários (TODOS) ───

/**
 * Lista TODOS os usuários de TODAS as empresas.
 */
export async function listAllUsers() {
  const q = query(
    collection(db, 'users'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() || null,
    updatedAt: d.data().updatedAt?.toDate?.() || null,
  }));
}

/**
 * Busca um usuário por ID.
 */
export async function getUserById(userId) {
  const docRef = doc(db, 'users', userId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Desativa uma conta.
 */
export async function disableUser(userId) {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, {
    status: 'disabled',
    disabledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: userId, status: 'disabled' };
}

/**
 * Reativa uma conta.
 */
export async function enableUser(userId) {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, {
    status: 'active',
    disabledAt: null,
    updatedAt: serverTimestamp(),
  });
  return { id: userId, status: 'active' };
}

/**
 * Exclui o documento do usuário do Firestore.
 * Usa getValidToken() para re-autenticar se o token expirou.
 */
export async function deleteUserDocument(userId) {
  // Garantir que temos um token válido
  await getValidToken();

  const currentUser = auth.currentUser;
  console.log('[Delete] Excluindo userId:', userId, '| Admin:', currentUser?.uid || 'NENHUM');

  if (!currentUser) {
    throw new Error('Admin não está autenticado no Firebase Auth.');
  }

  const docRef = doc(db, 'users', userId);

  try {
    await deleteDoc(docRef);
    console.log('[Delete] Sucesso!');
    return { id: userId, deleted: true };
  } catch (err) {
    console.error('[Delete] Erro Firestore:', err.code, err.message);

    // Se for erro de permissão e o token expirou, tentar re-autenticar
    if (err.code === 'permission-denied') {
      console.warn('[Delete] Erro de permissão. Tentando re-autenticar...');
      await reAuthAdmin();
      await deleteDoc(docRef);
      console.log('[Delete] Sucesso após re-autenticação!');
      return { id: userId, deleted: true };
    }

    throw err;
  }
}

/**
 * Tenta excluir a conta do Firebase Auth via REST API.
 */
export async function deleteAuthUser(targetUid) {
  await getValidToken();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Admin não está autenticado.');

  const idToken = await currentUser.getIdToken();
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY não configurada.');

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, targetUid }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const msg = error?.error?.message || 'Erro desconhecido';
      if (msg === 'USER_NOT_FOUND') return { deleted: false, reason: 'not_found' };
      console.warn('Auth delete retornou:', msg);
      return { deleted: false, reason: msg };
    }

    return { deleted: true };
  } catch (err) {
    console.warn('Erro ao tentar deletar Auth:', err.message);
    return { deleted: false, reason: err.message };
  }
}

/**
 * Exclusão completa: Firestore + tentativa de Auth.
 */
export async function deleteUserFull(userId) {
  await deleteUserDocument(userId);

  let authResult;
  try {
    authResult = await deleteAuthUser(userId);
  } catch (err) {
    authResult = { deleted: false, reason: err.message };
  }

  return {
    firestore: true,
    auth: authResult.deleted,
    authDetail: authResult.reason || 'ok',
  };
}

/**
 * Conta total de usuários.
 */
export async function countAllUsers() {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.size;
}
