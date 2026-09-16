// ═══════════════════════════════════════════
// Financial Service (Firestore)
// ═══════════════════════════════════════════

import {
  createDoc, getDoc_, updateDoc_, deleteDoc_, listDocs,
  serverTimestamp, timestampToDate,
} from './firestore';

const COLLECTION = 'financialTransactions';

export async function listTransactions(companyId, options = {}) {
  const filters = [
    { field: 'companyId', op: '==', value: companyId },
  ];
  if (options.type) filters.push({ field: 'type', op: '==', value: options.type });
  if (options.status) filters.push({ field: 'status', op: '==', value: options.status });
  if (options.category) filters.push({ field: 'category', op: '==', value: options.category });

  return listDocs(COLLECTION, {
    ...options,
    filters,
    sortBy: options.sortBy || 'createdAt',
    sortDir: options.sortDir || 'desc',
  });
}

export async function getTransaction(id) { return getDoc_(COLLECTION, id); }

export async function createTransaction(companyId, data, user) {
  return createDoc(COLLECTION, {
    ...data,
    companyId,
    createdBy: user?.uid || 'unknown',
  });
}

export async function updateTransaction(id, data) {
  return updateDoc_(COLLECTION, id, data);
}

export async function markAsPaid(id) {
  return updateDoc_(COLLECTION, id, {
    status: 'paid',
    paidAt: serverTimestamp(),
  });
}

export async function deleteTransaction(id) {
  return deleteDoc_(COLLECTION, id);
}

export async function getSummary(companyId) {
  const { data: income } = await listTransactions(companyId, {
    type: 'income',
    status: 'paid',
    pageSize: 500,
  });
  const { data: expense } = await listTransactions(companyId, {
    type: 'expense',
    status: 'paid',
    pageSize: 500,
  });
  const { data: pendingIncome } = await listTransactions(companyId, {
    type: 'income',
    status: 'pending',
    pageSize: 500,
  });
  const { data: pendingExpense } = await listTransactions(companyId, {
    type: 'expense',
    status: 'pending',
    pageSize: 500,
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthIncome = income
    .filter((t) => {
      const d = timestampToDate(t.createdAt);
      return d && d >= startOfMonth;
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const monthExpense = expense
    .filter((t) => {
      const d = timestampToDate(t.createdAt);
      return d && d >= startOfMonth;
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  return {
    month: { income: monthIncome, expense: monthExpense, balance: monthIncome - monthExpense },
    pending: {
      income: pendingIncome.reduce((sum, t) => sum + (t.amount || 0), 0),
      expense: pendingExpense.reduce((sum, t) => sum + (t.amount || 0), 0),
    },
  };
}
