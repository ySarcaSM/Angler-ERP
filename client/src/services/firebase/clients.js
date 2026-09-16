// ═══════════════════════════════════════════
// Clients Service (Firestore)
// ═══════════════════════════════════════════

import {
  createDoc, getDoc_, updateDoc_, deleteDoc_, listDocs, countDocs,
} from './firestore';

const COLLECTION = 'clients';

export async function listClients(companyId, options = {}) {
  return listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    searchField: ['name', 'document', 'email', 'phone', 'contact'],
  });
}

export async function getClient(id) {
  return getDoc_(COLLECTION, id);
}

export async function createClient(companyId, data) {
  return createDoc(COLLECTION, { ...data, companyId });
}

export async function updateClient(id, data) {
  return updateDoc_(COLLECTION, id, data);
}

export async function deleteClient(id) {
  return deleteDoc_(COLLECTION, id);
}

export async function countClients(companyId) {
  return countDocs(COLLECTION, [{ field: 'companyId', op: '==', value: companyId }]);
}
