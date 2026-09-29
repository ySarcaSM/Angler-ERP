import { createTransaction } from './financial.js';
import { updateBudget } from './budgets.js';

export function buildBudgetApprovalTransaction(companyId, budget) {
  if (!budget) {
    throw new Error('Orçamento inválido.');
  }

  const amount = Number(budget.value) || 0;
  const clientName = budget.clientName || 'Cliente';
  const description = (budget.description || '').trim();

  return {
    companyId,
    type: 'income',
    category: 'Orçamento aprovado',
    description: description
      ? `${clientName}: ${description}`
      : `Orçamento aprovado para ${clientName}`,
    amount,
    date: new Date().toISOString().slice(0, 10),
    dueDate: '',
    paymentMethod: 'pix',
    status: 'pending',
    clientId: budget.clientId || '',
    clientName,
    budgetId: budget.id || '',
    source: 'budget',
    sourceId: budget.id || '',
  };
}

export async function approveBudget(companyId, budget, user) {
  if (!budget || !budget.id) {
    throw new Error('Orçamento inválido.');
  }

  if (budget.status === 'approved') {
    return { budget, transaction: null, alreadyApproved: true };
  }

  const updated = await updateBudget(budget.id, { status: 'approved' });
  const transaction = await createTransaction(
    companyId,
    buildBudgetApprovalTransaction(companyId, { ...budget, id: budget.id, status: 'approved' }),
    user,
  );

  return { budget: updated, transaction, alreadyApproved: false };
}
