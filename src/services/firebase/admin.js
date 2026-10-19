// Superadmin: o navegador recebe apenas tokens Firebase, nunca credenciais mestre.
import {
  collection, doc, getDoc, getDocs, query, where,
  deleteDoc, updateDoc, serverTimestamp, orderBy, writeBatch, deleteField,
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
      // Um erro de permissão não pode ser contornado por login automático.
      throw new Error('Operação negada pelas regras do Firestore. Verifique as permissões superadmin.');
    }

    throw err;
  }
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

  await getValidToken();

  const userRef = doc(db, 'users', userId);
  const userSnapshot = await getDoc(userRef);
  if (!userSnapshot.exists()) {
    return { deleted: true, firestore: false, auth: false, authDetail: 'not_found' };
  }

  const userData = userSnapshot.data();

  // Uma exclusão de conta precisa remover os dados do tenant inteiro, não
  // apenas o documento users/{uid}. O Firestore não remove automaticamente
  // documentos que tenham companyId apontando para uma empresa excluída.
  const ownedCompaniesSnapshot = await getDocs(query(
    collection(db, 'companies'),
    where('ownerUid', '==', userId),
  ));
  const ownedCompanyIds = ownedCompaniesSnapshot.docs.map((item) => item.id);

  const deleteDocs = async (refs) => {
    for (let index = 0; index < refs.length; index += 450) {
      const batch = writeBatch(db);
      refs.slice(index, index + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  };

  const deleteByCompany = async (collectionName, companyId) => {
    const snapshot = await getDocs(query(
      collection(db, collectionName),
      where('companyId', '==', companyId),
    ));
    await deleteDocs(snapshot.docs.map((item) => item.ref));
    return snapshot.size;
  };

  let deletedRecords = 0;

  // Remove subcoleções e índices vinculados à empresa.
  for (const companyId of ownedCompanyIds) {
    const memberSnapshot = await getDocs(collection(db, 'companies', companyId, 'members'));
    await deleteDocs(memberSnapshot.docs.map((item) => item.ref));
    deletedRecords += memberSnapshot.size;

    // Dados operacionais e financeiros do tenant.
    const tenantCollections = [
      'clients',
      'products',
      'sales',
      'purchases',
      'suppliers',
      'locations',
      'financialTransactions',
      'stockMovements',
      'budgets',
      'formulas',
      'auditLogs',
      'deletionRequests',
      'companyAccessRequests',
      'companyMembers',
    ];

    for (const collectionName of tenantCollections) {
      deletedRecords += await deleteByCompany(collectionName, companyId);
    }

    // Chats do assistente possuem uma subcoleção messages que precisa ser
    // removida antes do documento pai.
    const chatsSnapshot = await getDocs(query(
      collection(db, 'assistantChats'),
      where('companyId', '==', companyId),
    ));

    for (const chat of chatsSnapshot.docs) {
      const messagesSnapshot = await getDocs(collection(
        db,
        'assistantChats',
        chat.id,
        'messages',
      ));
      await deleteDocs(messagesSnapshot.docs.map((item) => item.ref));
      deletedRecords += messagesSnapshot.size;
    }

    await deleteDocs(chatsSnapshot.docs.map((item) => item.ref));
    deletedRecords += chatsSnapshot.size;

    // counters/{companyId} não possui companyId dentro do documento.
    await deleteDocs([doc(db, 'counters', companyId)]);

    // A empresa é o documento que guarda configurações, módulos, plano etc.
    await deleteDocs([doc(db, 'companies', companyId)]);
  }

  // Remove o acesso do usuário a empresas de terceiros sem apagar os dados
  // dessas empresas. Isso evita deixar memberships órfãos.
  const companyMembersByUser = await getDocs(query(
    collection(db, 'companyMembers'),
    where('userId', '==', userId),
  ));
  await deleteDocs(companyMembersByUser.docs.map((item) => item.ref));
  deletedRecords += companyMembersByUser.size;

  const companyMemberships = [];
  const usersSnapshot = await getDocs(collection(db, 'users'));
  for (const item of usersSnapshot.docs) {
    if (item.id === userId) continue;

    const memberships = item.data().memberships || {};
    const updates = {};
    for (const companyId of ownedCompanyIds) {
      if (memberships[companyId]) {
        updates[`memberships.${companyId}`] = deleteField();
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = serverTimestamp();
      companyMemberships.push({ ref: item.ref, data: updates });
    }
  }

  // Solicitações de acesso feitas pela conta também são dados da conta.
  const accessRequestsByUser = await getDocs(query(
    collection(db, 'companyAccessRequests'),
    where('requesterUid', '==', userId),
  ));
  await deleteDocs(accessRequestsByUser.docs.map((item) => item.ref));
  deletedRecords += accessRequestsByUser.size;

  // Remove registros de auditoria em empresas externas quando o usuário é o
  // autor. Os logs da empresa excluída já foram removidos acima.
  const auditByUser = await getDocs(query(
    collection(db, 'auditLogs'),
    where('userId', '==', userId),
  ));
  await deleteDocs(auditByUser.docs.map((item) => item.ref));
  deletedRecords += auditByUser.size;

  // Aplicar atualizações de memberships em lotes.
  for (let index = 0; index < companyMemberships.length; index += 450) {
    const batch = writeBatch(db);
    companyMemberships.slice(index, index + 450).forEach(({ ref, data }) => {
      batch.update(ref, data);
    });
    await batch.commit();
  }

  // Finalmente remove o perfil Firestore.
  await deleteDoc(userRef);

  // A exclusão de outro usuário no Firebase Auth exige Admin SDK em backend.
  // Neste projeto o superadmin remove todos os dados do Firestore; a conta
  // Auth pode permanecer sem perfil e, portanto, não consegue entrar no ERP.
  return {
    deleted: true,
    firestore: true,
    auth: false,
    authDetail: 'firebase_auth_requires_backend',
    ownedCompanies: ownedCompanyIds,
    deletedRecords,
    email: userData.email || null,
  };
}

/**
 * Conta total de usuários.
 */
export async function countAllUsers() {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.size;
}
