import { createDoc, getDoc_, listDocs, docRef, serverTimestamp, requestDeletionForOperator } from './firestore.js';
import { runTransaction } from 'firebase/firestore';
import { db } from '../../config/firebase';

const COLLECTION = 'budgets';

export async function listBudgets(companyId, options = {}) {
  const result = await listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    sortBy: null,
    pageSize: options.pageSize || 200,
  });
  return {
    ...result,
    data: result.data.sort((first, second) => String(second.updatedAt || second.createdAt || '').localeCompare(String(first.updatedAt || first.createdAt || ''))),
  };
}

export async function getBudget(id) { return getDoc_(COLLECTION, id); }

export async function createBudget(companyId, data) {
  return createDoc(COLLECTION, { ...data, companyId });
}

export async function updateBudget(id, data) {
  return runTransaction(db, async (tx) => {
    const ref = docRef(COLLECTION, id);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Orçamento não encontrado.');
    const current = snapshot.data();
    if (['approved','cancelled'].includes(current.status)) {
      throw new Error('Orçamento aprovado ou cancelado está bloqueado para edição.');
    }
    if (data.status && !['draft','pending'].includes(data.status)) {
      throw new Error('Mudança de status inválida.');
    }
    const safe = { ...data };
    delete safe.companyId;
    delete safe.createdAt;
    delete safe.approvedAt;
    tx.update(ref, { ...safe, updatedAt: serverTimestamp() });
    return { id, ...current, ...safe };
  });
}
export async function deleteBudget(id) {
  const current = await getBudget(id);
  if (!current) throw new Error('Orçamento não encontrado.');
  if (current.status === 'approved') throw new Error('Orçamento aprovado precisa de estorno antes de ser excluído.');
  if (await requestDeletionForOperator(COLLECTION, id)) {
    const error = new Error('Solicitação de exclusão enviada para aprovação.');
    error.code = 'deletion-request-created';
    throw error;
  }
  return runTransaction(db, async (tx) => {
    const ref = docRef(COLLECTION, id);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Orçamento não encontrado.');
    if (snapshot.data().status === 'approved') throw new Error('Orçamento aprovado exige estorno.');
    tx.delete(ref);
    return { id, ...snapshot.data() };
  });
}
