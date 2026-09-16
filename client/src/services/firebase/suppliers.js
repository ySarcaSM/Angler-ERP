// ═══════════════════════════════════════════
// Suppliers Service (Firestore)
// ═══════════════════════════════════════════

import { createDoc, getDoc_, updateDoc_, deleteDoc_, listDocs } from './firestore';

const COLLECTION = 'suppliers';

export async function listSuppliers(companyId, options = {}) {
  return listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    searchField: ['name', 'document', 'email', 'contact'],
  });
}

export async function getSupplier(id) { return getDoc_(COLLECTION, id); }
export async function createSupplier(companyId, data) { return createDoc(COLLECTION, { ...data, companyId }); }
export async function updateSupplier(id, data) { return updateDoc_(COLLECTION, id, data); }
export async function deleteSupplier(id) { return deleteDoc_(COLLECTION, id); }
