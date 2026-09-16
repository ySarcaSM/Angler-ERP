// ═══════════════════════════════════════════
// Products Service (Firestore)
// ═══════════════════════════════════════════

import {
  createDoc, getDoc_, updateDoc_, deleteDoc_, listDocs, countDocs,
} from './firestore';

const COLLECTION = 'products';

export async function listProducts(companyId, options = {}) {
  return listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    searchField: ['name', 'code', 'barcode', 'category', 'description'],
  });
}

export async function getProduct(id) {
  return getDoc_(COLLECTION, id);
}

export async function createProduct(companyId, data) {
  return createDoc(COLLECTION, { ...data, companyId });
}

export async function updateProduct(id, data) {
  return updateDoc_(COLLECTION, id, data);
}

export async function deleteProduct(id) {
  return deleteDoc_(COLLECTION, id);
}

export async function countProducts(companyId) {
  return countDocs(COLLECTION, [{ field: 'companyId', op: '==', value: companyId }]);
}

export async function getLowStockProducts(companyId) {
  return listDocs(COLLECTION, {
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      { field: 'active', op: '==', value: true },
    ],
    pageSize: 100,
  });
}
