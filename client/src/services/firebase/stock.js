// ═══════════════════════════════════════════
// Stock Service (Firestore)
// ═══════════════════════════════════════════

import {
  listDocs, getDoc_,
  getBatch, docRef, newDocRef, serverTimestamp,
} from './firestore.js';
import { timestampToDate } from '../../utils/format';

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
  const productDoc = await getDoc_('products', productId);
  if (!productDoc) throw new Error('Produto não encontrado');

  const previousStock = productDoc.stock?.current || 0;
  const absQty = Math.abs(quantity);
  const newStock = type === 'entry'
    ? previousStock + absQty
    : Math.max(0, previousStock - absQty);

  const batch = getBatch();

  const productRef = docRef('products', productId);
  batch.update(productRef, {
    'stock.current': newStock,
    updatedAt: serverTimestamp(),
  });

  const movementRef = newDocRef(COLLECTION);
  batch.set(movementRef, {
    companyId,
    productId,
    productName,
    type: 'adjustment',
    quantity: absQty,
    previousStock,
    newStock,
    reason: reason || 'Ajuste manual',
    createdBy: user?.uid || 'unknown',
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return { previousStock, newStock };
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
