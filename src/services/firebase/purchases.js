// ═══════════════════════════════════════════
// Purchases Service (Firestore)
// ═══════════════════════════════════════════

import {
  getDoc_, updateDoc_, deleteDoc_, listDocs,
  getBatch, docRef, newDocRef, serverTimestamp, increment,
} from './firestore.js';

const COLLECTION = 'purchases';

export async function listPurchases(companyId, options = {}) {
  const result = await listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    sortBy: null,
  });
  result.data.sort((first, second) => {
    const firstTime = first.createdAt?.toMillis?.() || new Date(first.createdAt || 0).getTime();
    const secondTime = second.createdAt?.toMillis?.() || new Date(second.createdAt || 0).getTime();
    return secondTime - firstTime;
  });
  return result;
}

export async function getPurchase(id) {
  return getDoc_(COLLECTION, id);
}

export async function createPurchase(companyId, data, user) {
  const counterDoc = await getDoc_('counters', companyId);
  const nextNumber = (counterDoc?.purchaseCount || 0) + 1;

  const items = data.items.map((item) => ({
    ...item,
    total: item.quantity * item.unitCost,
  }));
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const total = subtotal + (data.shipping || 0) + (data.tax || 0);

  const purchase = {
    ...data,
    companyId,
    number: nextNumber,
    items,
    subtotal,
    total,
    status: 'draft',
    paymentStatus: 'pending',
    createdBy: user.uid,
  };

  const batch = getBatch();
  const purchaseRef = newDocRef(COLLECTION);
  batch.set(purchaseRef, { ...purchase, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  const counterRef = docRef('counters', companyId);
  batch.set(counterRef, { purchaseCount: nextNumber, updatedAt: serverTimestamp() }, { merge: true });

  await batch.commit();
  return { id: purchaseRef.id, ...purchase };
}

export async function receivePurchase(purchaseId, companyId) {
  const purchase = await getPurchase(purchaseId);
  if (!purchase) throw new Error('Compra não encontrada');
  if (purchase.status === 'received' || purchase.status === 'cancelled') {
    throw new Error('Compra já finalizada ou cancelada');
  }

  const batch = getBatch();

  batch.update(docRef(COLLECTION, purchaseId), {
    status: 'received',
    receivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const item of purchase.items) {
    if (item.productId) {
      const productRef = docRef('products', item.productId);
      const productDoc = await getDoc_('products', item.productId);
      if (productDoc) {
        const previousStock = productDoc.stock?.current || 0;

        batch.update(productRef, {
          'stock.current': increment(item.quantity),
          updatedAt: serverTimestamp(),
        });

        const movementRef = newDocRef('stockMovements');
        batch.set(movementRef, {
          companyId,
          productId: item.productId,
          productName: item.productName,
          type: 'entry',
          quantity: item.quantity,
          previousStock,
          newStock: previousStock + item.quantity,
          unitCost: item.unitCost,
          reason: `Compra #${purchase.number}`,
          referenceType: 'purchase',
          referenceId: purchaseId,
          createdAt: serverTimestamp(),
        });
      }
    }
  }

  const txRef = newDocRef('financialTransactions');
  batch.set(txRef, {
    companyId,
    type: 'expense',
    category: 'Compras',
    description: `Compra #${purchase.number} — ${purchase.supplierName || 'Fornecedor'}`,
    amount: purchase.total,
    date: serverTimestamp(),
    status: purchase.paymentStatus === 'paid' ? 'paid' : 'pending',
    paymentMethod: purchase.paymentMethod,
    referenceType: 'purchase',
    referenceId: purchaseId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return purchase;
}

export async function deletePurchase(id) {
  return deleteDoc_(COLLECTION, id);
}
