// ═══════════════════════════════════════════
// Admin Service — Gerenciamento de Contas
// ═══════════════════════════════════════════
// 100% gratuito — usa Firestore + Firebase Auth REST API

import {
  collection, doc, getDoc, getDocs, query, where,
  deleteDoc, updateDoc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
} from 'firebase/auth';

// ─── Autenticação Admin ───

export async function adminLogin(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) {
    await signOut(auth);
    throw new Error('Usuário não encontrado no sistema.');
  }

  const userData = userDoc.data();
  if (userData.role !== 'owner' && userData.role !== 'admin') {
    await signOut(auth);
    throw new Error('Acesso negado. Apenas administradores podem acessar este painel.');
  }

  return {
    uid,
    email: credential.user.email,
    role: userData.role,
    name: userData.name || credential.user.displayName,
    companyId: userData.companyId,
  };
}

export async function adminLogout() {
  await signOut(auth);
}

export function onAdminAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function verifyAdminRole(uid) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) return null;

  const data = userDoc.data();
  if (data.role !== 'owner' && data.role !== 'admin') return null;

  return { uid, ...data };
}

// ─── Gerenciamento de Usuários ───

export async function listCompanyUsers(companyId) {
  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId),
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

export async function getUserById(userId) {
  const docRef = doc(db, 'users', userId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

export async function disableUser(userId) {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, {
    status: 'disabled',
    disabledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: userId, status: 'disabled' };
}

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
 */
export async function deleteUserDocument(userId) {
  const docRef = doc(db, 'users', userId);
  await deleteDoc(docRef);
  return { id: userId, deleted: true };
}

/**
 * Exclui a conta do Firebase Auth usando a REST API (gratuito).
 *
 * Como funciona:
 * 1. Pega o ID token do admin logado
 * 2. Chama a REST API do Identity Toolkit para buscar o usuário por email
 * 3. Chama a REST API para deletar o usuário pelo localId (UID)
 *
 * Requer que o Identity Toolkit API esteja habilitado no projeto.
 * (Está habilitado por padrão em todos os projetos Firebase)
 */
export async function deleteAuthUser(targetUid) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Admin não está autenticado.');

  const idToken = await currentUser.getIdToken();

  // Usar a REST API do Identity Toolkit para deletar o usuário
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY não configurada.');

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUid }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error?.error?.message || 'Erro ao deletar conta do Auth';

    // Erros comuns:
    // INVALID_ID_TOKEN → token expirado
    // USER_NOT_FOUND → usuário já foi deletado do Auth
    if (msg === 'USER_NOT_FOUND') return { deleted: false, reason: 'not_found' };

    throw new Error(msg);
  }

  return { deleted: true };
}

/**
 * Exclusão completa: Firestore + Auth.
 * 1. Deleta o documento do Firestore
 * 2. Deleta a conta do Firebase Auth via REST API
 */
export async function deleteUserFull(userId) {
  // 1. Deletar do Firestore
  await deleteUserDocument(userId);

  // 2. Deletar do Firebase Auth
  try {
    await deleteAuthUser(userId);
  } catch (err) {
    // Se falhar ao deletar do Auth, o Firestore doc já foi removido.
    // O usuário não conseguirá usar o app de qualquer forma.
    console.warn('Erro ao deletar do Auth (Firestore já removido):', err.message);
    return { firestore: true, auth: false, error: err.message };
  }

  return { firestore: true, auth: true };
}

/**
 * Auto-exclusão: o admin deleta a própria conta.
 * Usa deleteUser() do SDK client-side (funciona para o próprio usuário).
 */
export async function deleteSelfAccount() {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Nenhum usuário autenticado.');

  // Deletar documento do Firestore primeiro
  await deleteUserDocument(currentUser.uid);

  // Deletar a própria conta do Auth
  await deleteUser(currentUser);

  return { deleted: true };
}

export async function countCompanyUsers(companyId) {
  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
}
