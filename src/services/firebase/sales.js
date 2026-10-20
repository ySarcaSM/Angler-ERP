// Operações de venda com numeração e aprovação atômicas no Firestore.
import { runTransaction } from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  getDoc_, listDocs, docRef, newDocRef,
  serverTimestamp, increment, requestDeletionForOperator,
} from './firestore.js';

const COLLECTION = 'sales';

function validAmount(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} inválido.`);
  return number;
}
function buildTotals(data) {
  if (!Array.isArray(data.items) || data.items.length === 0) throw new Error('Informe ao menos um produto.');
  const items = data.items.map((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('A quantidade precisa ser um inteiro positivo.');
    const unitPrice = validAmount(item.unitPrice, 'Preço');
    const discount = validAmount(item.discount || 0, 'Desconto do item');
    const gross = quantity * unitPrice;
    if (discount > gross) throw new Error('O desconto do item excede seu valor.');
    return { ...item, quantity, unitPrice, discount, total: gross - discount };
  });
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discountPercent = validAmount(data.discount || 0, 'Desconto percentual');
  if (discountPercent > 100) throw new Error('Desconto percentual acima de 100%.');
  const discountAmount = subtotal * discountPercent / 100;
  const total = subtotal - discountAmount
    + validAmount(data.shipping || 0, 'Frete')
    + validAmount(data.tax || 0, 'Imposto');
  return { items, subtotal, discountPercent, discountAmount, total };
}

export async function listSales(companyId, options = {}) {
  return listDocs(COLLECTION, {
    ...options,
    filters: [{ field: 'companyId', op: '==', value: companyId }, ...(options.filters || [])],
    sortBy: options.sortBy || 'createdAt',
    sortDir: options.sortDir || 'desc',
  });
}
export async function getSale(id) { return getDoc_(COLLECTION, id); }

export async function createSale(companyId, data, user) {
  if (!companyId || !user?.uid) throw new Error('Empresa e usuário são obrigatórios.');
  const totals = buildTotals(data);
  const saleRef = newDocRef(COLLECTION);
  const counterRef = docRef('counters', companyId);
  const clientRef = data.clientId ? docRef('clients', data.clientId) : null;

  return runTransaction(db, async (tx) => {
    const counter = await tx.get(counterRef);
    const client = clientRef ? await tx.get(clientRef) : null;
    if (clientRef && (!client?.exists() || client.data().companyId !== companyId)) {
      throw new Error('Cliente não pertence à empresa atual.');
    }
    const nextNumber = (Number(counter.exists() ? counter.data().saleCount : 0) || 0) + 1;
    const sale = {
      ...data, ...totals, companyId, number: nextNumber, status: 'draft',
      paymentStatus: data.paymentStatus || 'pending',
      createdBy: user.uid,
      createdByName: user.displayName || user.email,
    };
    tx.set(saleRef, { ...sale, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.set(counterRef, { saleCount: nextNumber, updatedAt: serverTimestamp() }, { merge: true });
    return { id: saleRef.id, ...sale };
  });
}

export async function updateSale(id, data) {
  const saleRef = docRef(COLLECTION, id);
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(saleRef);
    if (!snapshot.exists()) throw new Error('Venda não encontrada.');
    const existing = snapshot.data();
    if (!['draft','pending'].includes(existing.status)) {
      throw new Error('Somente vendas em rascunho ou pendentes podem ser editadas.');
    }
    const safe = { ...data };
    delete safe.companyId;
    delete safe.createdBy;
    delete safe.number;
    delete safe.status;
    const totals = buildTotals({ ...existing, ...safe });
    tx.update(saleRef, { ...safe, ...totals, updatedAt: serverTimestamp() });
    return { id, ...existing, ...safe, ...totals };
  });
}

export async function approveSale(saleId, companyId) {
  const saleRef = docRef(COLLECTION, saleId);
  return runTransaction(db, async (tx) => {
    const saleSnap = await tx.get(saleRef);
    if (!saleSnap.exists()) throw new Error('Venda não encontrada.');
    const sale = saleSnap.data();
    if (sale.companyId !== companyId) throw new Error('Venda de outra empresa.');
    if (!['draft', 'pending'].includes(sale.status)) {
      throw new Error('Venda já aprovada, cancelada ou em estado inválido.');
    }
    const quantities = new Map();
    for (const item of sale.items || []) {
      if (!item.productId) continue;
      const quantity = Number(item.quantity);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Quantidade inválida na venda.');
      quantities.set(item.productId, (quantities.get(item.productId) || 0) + quantity);
    }
    const productRefs = [...quantities.keys()].map((id) => docRef('products', id));
    const productSnapshots = await Promise.all(productRefs.map((ref) => tx.get(ref)));
    const clientRef = sale.clientId ? docRef('clients', sale.clientId) : null;
    const clientSnap = clientRef ? await tx.get(clientRef) : null;
    if (clientRef && (!clientSnap.exists() || clientSnap.data().companyId !== companyId)) {
      throw new Error('Cliente da venda não pertence à empresa.');
    }
    const financialRef = docRef('financialTransactions', `sale_${saleId}`);
    const financialSnap = await tx.get(financialRef);
    if (financialSnap.exists()) throw new Error('O lançamento financeiro desta venda já existe.');

    const products = productRefs.map((ref, index) => {
      const snapshot = productSnapshots[index];
      if (!snapshot.exists() || snapshot.data().companyId !== companyId) {
        throw new Error('Um dos produtos não pertence à empresa.');
      }
      const current = Number(snapshot.data().stock?.current || 0);
      const quantity = quantities.get(ref.id);
      if (!Number.isFinite(current) || current < quantity) {
        throw new Error(`Estoque insuficiente para ${snapshot.data().name || ref.id}.`);
      }
      return { ref, data: snapshot.data(), current, quantity };
    });
    tx.update(saleRef, { status: 'approved', approvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    for (const product of products) {
      tx.update(product.ref, { 'stock.current': increment(-product.quantity), updatedAt: serverTimestamp() });
      tx.set(newDocRef('stockMovements'), {
        companyId, productId: product.ref.id, productName: product.data.name,
        type: 'exit', quantity: product.quantity, previousStock: product.current,
        newStock: product.current - product.quantity, reason: `Venda #${sale.number}`,
        referenceType: 'sale', referenceId: saleId, createdAt: serverTimestamp(),
      });
    }
    if (clientRef) {
      tx.update(clientRef, {
        totalPurchases: increment(Number(sale.total || 0)),
        lastPurchaseAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    tx.set(financialRef, {
      companyId, type: 'income', category: 'Vendas',
      description: `Venda #${sale.number} — ${sale.clientName || 'Cliente'}`,
      amount: Number(sale.total || 0), date: serverTimestamp(),
      status: sale.paymentStatus === 'paid' ? 'paid' : 'pending',
      paymentMethod: sale.paymentMethod || null,
      referenceType: 'sale', referenceId: saleId,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return { ...sale, status: 'approved' };
  });
}

export async function cancelSale(saleId) {
  const saleRef = docRef(COLLECTION, saleId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(saleRef);
    if (!snap.exists()) throw new Error('Venda não encontrada.');
    const sale = snap.data();
    if (sale.status === 'cancelled') return { ...sale, action: 'cancelled' };
    if (sale.status === 'approved') throw new Error('Vendas aprovadas não podem ser canceladas sem estorno auditável.');
    tx.update(saleRef, { status: 'cancelled', paymentStatus: 'cancelled', cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { ...sale, action: 'cancelled' };
  });
}

export async function deleteSale(saleId) {
  const sale = await getSale(saleId);
  if (!sale) throw new Error('Venda não encontrada.');
  if (await requestDeletionForOperator(COLLECTION, saleId)) {
    const error = new Error('Solicitação de exclusão enviada para aprovação.');
    error.code = 'deletion-request-created';
    throw error;
  }
  const ref = docRef(COLLECTION, saleId);
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Venda não encontrada.');
    const current = snapshot.data();
    if (current.status === 'approved') {
      throw new Error('Vendas aprovadas não podem ser excluídas. Use um fluxo de estorno auditável.');
    }
    tx.delete(ref);
    return { ...current, action: 'deleted' };
  });
}
