// ═══════════════════════════════════════════
// Suppliers Service (Firestore)
// ═══════════════════════════════════════════

import { createDoc, getDoc_, updateDoc_, deleteDoc_, listDocs } from './firestore.js';

const COLLECTION = 'suppliers';

export async function listSuppliers(companyId, options = {}) {
  const result = await listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    searchField: ['name', 'document', 'email', 'contact'],
    sortBy: null,
  });
  result.data.sort((first, second) => {
    const firstTime = first.createdAt?.toMillis?.() || new Date(first.createdAt || 0).getTime();
    const secondTime = second.createdAt?.toMillis?.() || new Date(second.createdAt || 0).getTime();
    return secondTime - firstTime;
  });
  return result;
}

export async function getSupplier(id) { return getDoc_(COLLECTION, id); }
export async function createSupplier(companyId, data) { return createDoc(COLLECTION, { ...data, companyId }); }
export async function updateSupplier(id, data) { return updateDoc_(COLLECTION, id, data); }
export async function deleteSupplier(id) { return deleteDoc_(COLLECTION, id); }
