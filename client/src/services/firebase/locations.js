import {
  createDoc, getDoc_, updateDoc_, deleteDoc_, listDocs,
} from './firestore.js';

const COLLECTION = 'locations';

export async function listLocations(companyId, options = {}) {
  return listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    searchField: ['name', 'cep', 'street', 'city', 'state', 'notes'],
  });
}

export async function getLocation(id) {
  return getDoc_(COLLECTION, id);
}

export async function createLocation(companyId, data) {
  return createDoc(COLLECTION, { ...data, companyId });
}

export async function updateLocation(id, data) {
  return updateDoc_(COLLECTION, id, data);
}

export async function deleteLocation(id) {
  return deleteDoc_(COLLECTION, id);
}
