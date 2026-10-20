// Superadmin: o navegador recebe apenas tokens Firebase, nunca credenciais mestre.
import {
  collection, doc, getDoc, getDocs, query, where,
  deleteDoc, updateDoc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// A permissão é concedida EXCLUSIVAMENTE pelo Admin SDK (claim superadmin).
// Uma identidade armazenada em localStorage não é prova de autorização.
export function getStoredAdminSession() {
  return null; // Compatibilidade: não existem sessões administrativas persistidas localmente.
}

export async function isCurrentUserAdmin() {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;
  const token = await currentUser.getIdTokenResult();
  return token.claims.superadmin === true;
}

async function getValidToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Admin não está autenticado.');
  const token = await currentUser.getIdTokenResult(true);
  if (token.claims.superadmin !== true) {
    throw new Error('Conta sem permissão de superadministrador.');
  }
  return token.token;
}

export async function adminLogin(username, password) {
  const email = String(username || '').trim().toLowerCase();
  if (!email.includes('@') || !password) throw new Error('Informe o e-mail e a senha do administrador.');
  const credential = await signInWithEmailAndPassword(auth, email, password);
  try {
    const token = await credential.user.getIdTokenResult(true);
    if (token.claims.superadmin !== true) {
      throw new Error('Esta conta não possui a permissão superadmin.');
    }
    return { uid: credential.user.uid, email: credential.user.email, role: 'superadmin' };
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export async function adminLogout() {
  await signOut(auth);
}

export function onAdminAuthChange(callback) {
  let active = true;
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) { if (active) callback(null); return; }
    try {
      const token = await firebaseUser.getIdTokenResult();
      if (active && auth.currentUser?.uid === firebaseUser.uid) {
        callback(token.claims.superadmin === true
          ? { uid: firebaseUser.uid, email: firebaseUser.email, role: 'superadmin' }
          : null);
      }
    } catch {
      if (active) callback(null);
    }
  });
  return () => { active = false; unsubscribe(); };
}

// ─── Mensagens do formulário de contato ───


/**
 * Lista todas as mensagens enviadas pelo formulário público de contato.
 */
export async function listContactMessages() {
  const q = query(
    collection(db, 'contactMessages'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
    createdAt: item.data().createdAt?.toDate?.() || null,
  }));
}

/**
 * Exclui uma mensagem do formulário de contato.
 * A regra do Firestore permite esta operação somente para o superadmin.
 */
export async function deleteContactMessage(messageId) {
  if (!messageId) throw new Error('ID da mensagem não informado.');

  await getValidToken();
  await deleteDoc(doc(db, 'contactMessages', messageId));

  return { id: messageId, deleted: true };
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
  const users = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() || null,
    updatedAt: d.data().updatedAt?.toDate?.() || null,
  }));

  const companyIds = [...new Set(users.map((user) => user.companyId).filter(Boolean))];
  const companyEntries = await Promise.all(companyIds.map(async (companyId) => {
    const companySnapshot = await getDoc(doc(db, 'companies', companyId));
    return [companyId, companySnapshot.exists() ? companySnapshot.data().name : null];
  }));
  const companyNames = new Map(companyEntries);

  return users.map((user) => ({
    ...user,
    companyName: companyNames.get(user.companyId) || null,
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
// Compatibilidade: a exclusão é sempre realizada no backend seguro.
export async function deleteUserDocument(userId) {
  return deleteUserFull(userId);
}

/**
 * Exclui a conta do painel removendo seu documento no Firestore.
 *
 * A exclusão de outro usuário no Firebase Auth exige Admin SDK no backend.
 * Nunca enviar o token do superadmin para accounts:delete: essa API exclui
 * a conta associada ao próprio token, encerrando a sessão do administrador.
 */
export async function deleteUserFull(userId) {
  if (!userId) throw new Error('UID da conta não informado.');
  const token = await getValidToken();
  const response = await fetch('/api/admin/delete-user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'Falha na exclusão administrativa.');
  return payload;
}

/**
 * Conta total de usuários.
 */
export async function countAllUsers() {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.size;
}
