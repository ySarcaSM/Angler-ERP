// ═══════════════════════════════════════════
// Firestore CRUD Service
// ═══════════════════════════════════════════

import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit, startAfter,
  serverTimestamp, increment, writeBatch,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

// ─── Generic CRUD ───

export async function createDoc(collectionPath, data) {
  const colRef = collection(db, collectionPath);
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id, ...data };
}

export async function setDocWithId(collectionPath, id, data) {
  const docRef = doc(db, collectionPath, id);
  await setDoc(docRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id, ...data };
}

export async function updateDoc_(collectionPath, id, data) {
  const docRef = doc(db, collectionPath, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
  return { id, ...data };
}

export async function deleteDoc_(collectionPath, id) {
  const docRef = doc(db, collectionPath, id);
  await deleteDoc(docRef);
  return { id };
}

export async function getDoc_(collectionPath, id) {
  const docRef = doc(db, collectionPath, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

// List documents with filters, sorting, pagination
export async function listDocs(collectionPath, options = {}) {
  const {
    filters = [],
    sortBy = 'createdAt',
    sortDir = 'desc',
    pageSize = 20,
    lastDoc = null,
    searchField = null,
    searchTerm = null,
  } = options;

  const constraints = [];

  for (const f of filters) {
    constraints.push(where(f.field, f.op, f.value));
  }

  if (sortBy) {
    constraints.push(orderBy(sortBy, sortDir));
  }

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }
  constraints.push(limit(pageSize));

  const q = query(collection(db, collectionPath), ...constraints);
  const snapshot = await getDocs(q);

  const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  let filtered = docs;
  if (searchField && searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = docs.filter((d) => {
      const fields = Array.isArray(searchField) ? searchField : [searchField];
      return fields.some((f) => {
        const val = d[f];
        return val && String(val).toLowerCase().includes(term);
      });
    });
  }

  return {
    data: filtered,
    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

export async function countDocs(collectionPath, filters = []) {
  const constraints = filters.map((f) => where(f.field, f.op, f.value));
  const q = query(collection(db, collectionPath), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ─── Batch helpers ───

export function getBatch() {
  return writeBatch(db);
}

// Generate a new doc ref with auto-ID (for use in batch writes)
export function newDocRef(collectionPath) {
  return doc(collection(db, collectionPath));
}

export function docRef(collectionPath, id) {
  return doc(db, collectionPath, id);
}

// Safe timestampToDate — handles Firestore Timestamp, Date, string, null
export function timestampToDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return null;
}

export { serverTimestamp, increment };
