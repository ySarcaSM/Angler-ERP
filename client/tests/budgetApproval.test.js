import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBudgetApprovalTransaction } from '../src/services/firebase/budgetApproval.js';

test('buildBudgetApprovalTransaction creates a pending income from an approved budget', () => {
  const transaction = buildBudgetApprovalTransaction('company-1', {
    id: 'budget-1',
    clientId: 'client-1',
    clientName: 'Maria Silva',
    description: 'Desenvolvimento de site',
    value: 2500,
  });

  assert.equal(transaction.type, 'income');
  assert.equal(transaction.category, 'Orçamento aprovado');
  assert.equal(transaction.status, 'pending');
  assert.equal(transaction.amount, 2500);
  assert.equal(transaction.budgetId, 'budget-1');
  assert.equal(transaction.clientName, 'Maria Silva');
  assert.match(transaction.description, /Maria Silva/);
});
