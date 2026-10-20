// ═══════════════════════════════════════════
// Stock Service (Firestore)
// ═══════════════════════════════════════════

import {
  listDocs, getDoc_,
  docRef, newDocRef, serverTimestamp,
} from './firestore.js';
import { timestampToDate } from '../../utils/format';
import { runTransaction } from 'firebase/firestore';
import { db } from '../../config/firebase';

const COLLECTION = 'stockMovements';

export async function listMovements(companyId, options = {}) {
  const result = await listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    sortBy: null,
  });

  return {
    ...result,
    data: result.data.sort((first, second) => {
      const firstDate = timestampToDate(first.createdAt)?.getTime() || 0;
      const secondDate = timestampToDate(second.createdAt)?.getTime() || 0;
      return secondDate - firstDate;
    }),
  };
}

export async function adjustStock(companyId, { productId, productName, quantity, type, reason }, user) {
  const amount = Number(quantity);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe uma quantidade positiva.');
  if (!['entry', 'exit'].includes(type)) throw new Error('Tipo de movimento inválido.');
  const productRef = docRef('products', productId);
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(productRef);
    if (!snapshot.exists() || snapshot.data().companyId !== companyId) {
      throw new Error('Produto inexistente ou de outra empresa.');
    }
    const previousStock = Number(snapshot.data().stock?.current || 0);
    if (type === 'exit' && previousStock < amount) throw new Error('Estoque insuficiente para a saída.');
    const newStock = type === 'entry' ? previousStock + amount : previousStock - amount;
    tx.update(productRef, { 'stock.current': newStock, updatedAt: serverTimestamp() });
    tx.set(newDocRef(COLLECTION), {
      companyId, productId, productName: snapshot.data().name || productName,
      type: 'adjustment', direction: type, quantity: amount,
      previousStock, newStock, reason: reason || 'Ajuste manual',
      createdBy: user?.uid || 'unknown', createdAt: serverTimestamp(),
    });
    return { previousStock, newStock };
  });
}

export async function getSummary(companyId) {
  const { data: products } = await listDocs('products', {
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      { field: 'active', op: '==', value: true },
    ],
    pageSize: 1000,
  });

  let totalProducts = 0;
  let lowStock = 0;
  let outOfStock = 0;
  let totalValue = 0;

  for (const p of products) {
    totalProducts++;
    const current = p.stock?.current || 0;
    const minimum = p.stock?.minimum || 0;
    if (current <= 0) outOfStock++;
    else if (current <= minimum) lowStock++;
    totalValue += current * (p.costPrice || 0);
  }

  return { totalProducts, lowStock, outOfStock, totalValue };
}
