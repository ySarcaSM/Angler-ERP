import { createDoc, updateDoc_, deleteDoc_, listDocs } from './firestore.js';

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

export async function createBudget(companyId, data) {
  return createDoc(COLLECTION, { ...data, companyId });
}

export async function updateBudget(id, data) {
  return updateDoc_(COLLECTION, id, data);
}

export async function deleteBudget(id) {
  return deleteDoc_(COLLECTION, id);
}
