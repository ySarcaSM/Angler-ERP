import { collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export async function createCompanyAccessRequest({ companyId, requesterUid, email, name }) {
  const normalizedCompanyId = companyId.trim();
  if (!normalizedCompanyId) {
    throw new Error('Informe o ID da empresa.');
  }

  const companySnapshot = await getDoc(doc(db, 'companies', normalizedCompanyId));
  if (!companySnapshot.exists()) {
    throw new Error('Esta empresa não existe. Confira o ID da empresa e tente novamente.');
  }

  const companyData = companySnapshot.data();
  if (companyData.ownerUid === requesterUid || normalizedCompanyId === requesterUid) {
    throw new Error('Você não pode solicitar acesso à sua própria empresa. Use a opção "Minha conta".');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingQuery = query(
    collection(db, 'companyAccessRequests'),
    where('companyId', '==', normalizedCompanyId),
    where('requesterUid', '==', requesterUid),
    where('status', '==', 'pending'),
  );
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    throw new Error('Você já possui uma solicitação pendente para esta empresa.');
  }

  const ref = await addDoc(collection(db, 'companyAccessRequests'), {
    companyId: normalizedCompanyId,
    requesterUid,
    email: normalizedEmail,
    name: name || '',
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function listCompanyMembers(companyId) {
  const snapshot = await getDocs(query(
    collection(db, 'companyMembers'),
    where('companyId', '==', companyId),
    where('active', '==', true),
  ));
  return snapshot.docs.map((item) => ({ id: item.id, uid: item.data().userId, ...item.data() }));
}

export async function listApprovedCompanyAccessRequests(requesterUid) {
  const q = query(
    collection(db, 'companyAccessRequests'),
    where('requesterUid', '==', requesterUid),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.status === 'approved');
}

export async function getCompanyAccessDiagnostics(userData) {
  const result = {
    uid: userData?.uid || null,
    personalCompanyId: userData?.personalCompanyId || null,
    companyId: userData?.companyId || null,
    role: userData?.role || null,
    accessRequestId: userData?.accessRequestId || null,
    accessRequestCompanyId: userData?.accessRequestCompanyId || null,
    memberships: userData?.memberships || {},
    approvedRequests: [],
    approvedRequestsError: null,
    companies: [],
  };

  if (!userData?.uid) return result;

  try {
    result.approvedRequests = await listApprovedCompanyAccessRequests(userData.uid);
  } catch (error) {
    result.approvedRequestsError = {
      code: error?.code || null,
      message: error?.message || 'Erro ao consultar solicitações aprovadas.',
    };
  }

  const ids = new Set([
    ...Object.keys(userData.memberships || {}),
    userData.personalCompanyId,
    userData.companyId,
    userData.accessRequestCompanyId,
    ...result.approvedRequests.map((item) => item.companyId),
  ].filter(Boolean));

  for (const companyId of ids) {
    try {
      const snapshot = await getDoc(doc(db, 'companies', companyId));
      result.companies.push({
        companyId,
        exists: snapshot.exists(),
        name: snapshot.exists() ? (snapshot.data()?.name || '') : '',
        membership: userData.memberships?.[companyId] || null,
        approvedRequest: result.approvedRequests.find((item) => item.companyId === companyId) || null,
      });
    } catch (error) {
      result.companies.push({
        companyId,
        exists: null,
        name: '',
        membership: userData.memberships?.[companyId] || null,
        approvedRequest: result.approvedRequests.find((item) => item.companyId === companyId) || null,
        error: error?.message || 'Erro ao consultar empresa.',
      });
    }
  }

  return result;
}

export async function listPendingCompanyAccessRequests(companyId) {
  const q = query(
    collection(db, 'companyAccessRequests'),
    where('companyId', '==', companyId),
    where('status', '==', 'pending'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function approveCompanyAccessRequest(requestItem, role) {
  const normalizedCompanyId = requestItem.companyId?.trim();
  if (!normalizedCompanyId) throw new Error('Solicitação sem empresa definida.');

  const companySnapshot = await getDoc(doc(db, 'companies', normalizedCompanyId));
  if (!companySnapshot.exists()) {
    throw new Error('A empresa desta solicitação não existe mais.');
  }

  const companyData = companySnapshot.data();
  if (companyData.ownerUid === requestItem.requesterUid || normalizedCompanyId === requestItem.requesterUid) {
    throw new Error('A solicitação aponta para a própria empresa do usuário e não pode ser aprovada.');
  }

  const userRef = doc(db, 'users', requestItem.requesterUid);
  const requestRef = doc(db, 'companyAccessRequests', requestItem.id);
  const membershipField = `memberships.${normalizedCompanyId}`;

  const batch = writeBatch(db);
  batch.update(userRef, {
    [membershipField]: {
      role,
      active: true,
      accessRequestId: requestItem.id,
      joinedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'companyMembers', normalizedCompanyId + '_' + requestItem.requesterUid), {
    companyId: normalizedCompanyId,
    userId: requestItem.requesterUid,
    email: requestItem.email,
    name: requestItem.name || '',
    role,
    active: true,
    accessRequestId: requestItem.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(requestRef, {
    status: 'approved',
    role,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function rejectCompanyAccessRequest(requestItem) {
  await updateDoc(doc(db, 'companyAccessRequests', requestItem.id), {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
