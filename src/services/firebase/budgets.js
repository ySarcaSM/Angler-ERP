import { createDoc, getDoc_, updateDoc_, deleteDoc_, listDocs } from './firestore.js';

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
  const current = await getBudget(id);
  if (!current) throw new Error('Orçamento não encontrado.');
  if (['approved','cancelled'].includes(current.status)) {
    throw new Error('Orçamento aprovado ou cancelado está bloqueado para edição.');
  }
  if (data.status && !['draft','pending'].includes(data.status)) {
    throw new Error('Mudança de status inválida.');
  }
  return updateDoc_(COLLECTION, id, data);
}

export async function deleteBudget(id) {
  const current = await getBudget(id);
  if (!current) throw new Error('Orçamento não encontrado.');
  if (current.status === 'approved') throw new Error('Orçamento aprovado precisa de estorno antes de ser excluído.');
  return deleteDoc_(COLLECTION, id);
}
