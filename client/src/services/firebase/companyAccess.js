import { collection, doc, getDocs, query, updateDoc, where, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export async function createCompanyAccessRequest({ companyId, requesterUid, email, name }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingQuery = query(
    collection(db, 'companyAccessRequests'),
    where('companyId', '==', companyId),
    where('requesterUid', '==', requesterUid),
    where('status', '==', 'pending'),
  );
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    throw new Error('Você já possui uma solicitação pendente para esta empresa.');
  }

  const ref = await addDoc(collection(db, 'companyAccessRequests'), {
    companyId,
    requesterUid,
    email: normalizedEmail,
    name: name || '',
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
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
  const userRef = doc(db, 'users', requestItem.requesterUid);
  const requestRef = doc(db, 'companyAccessRequests', requestItem.id);

  const batch = writeBatch(db);
  batch.update(userRef, {
    memberships: {
      [requestItem.companyId]: {
        role,
        active: true,
        accessRequestId: requestItem.id,
        joinedAt: serverTimestamp(),
      },
    },
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
