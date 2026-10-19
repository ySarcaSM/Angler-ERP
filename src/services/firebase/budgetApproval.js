import { runTransaction } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { docRef, serverTimestamp } from './firestore.js';

export function buildBudgetApprovalTransaction(companyId, budget) {
  if (!budget) throw new Error('Orçamento inválido.');
  const amount = Number(budget.value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Valor de orçamento inválido.');
  const clientName = budget.clientName || 'Cliente';
  const description = (budget.description || '').trim();
  return {
    companyId, type: 'income', category: 'Orçamento aprovado',
    description: description ? `${clientName}: ${description}` : `Orçamento aprovado para ${clientName}`,
    amount, date: new Date().toISOString().slice(0, 10),
    dueDate: '', paymentMethod: 'pix', status: 'pending',
    clientId: budget.clientId || '', clientName,
    budgetId: budget.id, source: 'budget', sourceId: budget.id,
    referenceType: 'budget', referenceId: budget.id,
  };
}

export async function approveBudget(companyId, budget, user) {
  if (!companyId || !budget?.id) throw new Error('Orçamento inválido.');
  const budgetRef = docRef('budgets', budget.id);
  const transactionRef = docRef('financialTransactions', `budget_${budget.id}`);
  return runTransaction(db, async (tx) => {
    const [budgetSnap, financeSnap] = await Promise.all([tx.get(budgetRef), tx.get(transactionRef)]);
    if (!budgetSnap.exists()) throw new Error('Orçamento não encontrado.');
    const current = { id: budgetSnap.id, ...budgetSnap.data() };
    if (current.companyId !== companyId) throw new Error('Orçamento de outra empresa.');
    if (current.status === 'approved') {
      return { budget: current, transaction: financeSnap.exists() ? { id: financeSnap.id, ...financeSnap.data() } : null, alreadyApproved: true };
    }
    if (current.status === 'cancelled') throw new Error('Um orçamento cancelado não pode ser aprovado.');
    if (financeSnap.exists()) throw new Error('O lançamento financeiro deste orçamento já existe.');
    const payload = buildBudgetApprovalTransaction(companyId, current);
    tx.update(budgetRef, { status: 'approved', approvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.set(transactionRef, { ...payload, createdBy: user?.uid || 'system',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { budget: { ...current, status: 'approved' },
      transaction: { id: transactionRef.id, ...payload }, alreadyApproved: false };
  });
}
