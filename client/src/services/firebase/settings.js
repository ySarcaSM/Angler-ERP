// ═══════════════════════════════════════════
// Settings & Users Service (Firestore)
// ═══════════════════════════════════════════

import {
  doc, getDoc, updateDoc, collection, query, where, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  createDoc, getDoc_, updateDoc_, deleteDoc_, listDocs, getBatch, docRef,
} from './firestore.js';

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

export async function createCompanyInvitation({ companyId, email, role, createdBy }) {
  return createDoc('companyInvitations', {
    companyId,
    email: email.trim().toLowerCase(),
    role,
    status: 'active',
    createdBy: createdBy || null,
  });
}

// ─── Audit Log ───
export async function logAudit(companyId, { user, userName, action, entity, entityId, changes, description, details }) {
  const actionLabels = { create: 'criou', update: 'alterou', delete: 'excluiu', approve: 'aprovou', cancel: 'cancelou', receive: 'recebeu', pay: 'marcou como pago', adjust: 'ajustou', export: 'exportou' };
  const actor = userName || user?.displayName || user?.email || 'Sistema';
  const readableAction = actionLabels[action] || action;
  return createDoc('auditLogs', {
    companyId,
    userId: user?.uid || 'system',
    userName: userName || 'Sistema',
    action,
    entity,
    ...(entityId !== undefined ? { entityId } : {}),
    changes: changes || null,
    description: description || `${actor} ${readableAction} ${entity}${entityId ? ` (${entityId})` : ''}.`,
    details: details || null,
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

export async function clearAuditLogs(companyId) {
  let lastDoc = null;
  let totalDeleted = 0;

  do {
    const result = await listAuditLogs(companyId, { pageSize: 500, lastDoc });
    if (result.data.length === 0) break;

    const batch = getBatch();
    result.data.forEach((log) => batch.delete(docRef('auditLogs', log.id)));
    await batch.commit();
    totalDeleted += result.data.length;
    lastDoc = result.lastDoc;
  } while (lastDoc);

  return totalDeleted;
}
