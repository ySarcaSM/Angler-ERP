// ═══════════════════════════════════════════
// Settings & Users Service (Firestore)
// ═══════════════════════════════════════════

import {
  doc, getDoc, updateDoc, collection, query, where, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  createDoc, getDoc_, updateDoc_, deleteDoc_, listDocs,
} from './firestore';

// ─── Company ───
export async function getCompany(companyId) {
  return getDoc_('companies', companyId);
}

export async function updateCompany(companyId, data) {
  return updateDoc_('companies', companyId, data);
}

// ─── Users ───
export async function listUsers(companyId) {
  const q = query(collection(db, 'users'), where('companyId', '==', companyId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUser(uid) {
  return getDoc_('users', uid);
}

export async function updateUser(uid, data) {
  return updateDoc_('users', uid, data);
}

export async function deactivateUser(uid) {
  return updateDoc_('users', uid, { active: false });
}

// ─── Audit Log ───
export async function logAudit(companyId, { user, userName, action, entity, entityId, changes }) {
  return createDoc('auditLogs', {
    companyId,
    userId: user?.uid || 'system',
    userName: userName || 'Sistema',
    action,
    entity,
    entityId,
    changes: changes || null,
  });
}

export async function listAuditLogs(companyId, options = {}) {
  return listDocs('auditLogs', {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    sortBy: 'createdAt',
    sortDir: 'desc',
  });
}
