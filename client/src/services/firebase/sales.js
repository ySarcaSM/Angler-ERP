// ═══════════════════════════════════════════
// Sales Service (Firestore)
// ═══════════════════════════════════════════

import {
  getDoc_, updateDoc_, deleteDoc_, listDocs,
  getBatch, docRef, newDocRef, serverTimestamp, increment,
} from './firestore';

const COLLECTION = 'sales';

export async function listSales(companyId, options = {}) {
  return listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    sortBy: options.sortBy || 'createdAt',
    sortDir: options.sortDir || 'desc',
  });
}

export async function getSale(id) {
  return getDoc_(COLLECTION, id);
}

export async function createSale(companyId, data, user) {
  // Get next sale number
  const counterDoc = await getDoc_('counters', companyId);
  const nextNumber = (counterDoc?.saleCount || 0) + 1;

  // Calculate totals
  const items = data.items.map((item) => ({
    ...item,
    total: (item.quantity * item.unitPrice) - (item.discount || 0),
  }));
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const total = subtotal - (data.discount || 0) + (data.shipping || 0) + (data.tax || 0);

  const sale = {
    ...data,
    companyId,
    number: nextNumber,
    items,
    subtotal,
    total,
    status: data.status || 'draft',
    paymentStatus: data.paymentStatus || 'pending',
    createdBy: user.uid,
    createdByName: user.displayName || user.email,
  };

  const batch = getBatch();

  // Create sale document with auto-generated ID
  const saleRef = newDocRef(COLLECTION);
  batch.set(saleRef, { ...sale, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  // Update counter
  const counterRef = docRef('counters', companyId);
  batch.set(counterRef, { saleCount: nextNumber, updatedAt: serverTimestamp() }, { merge: true });

  // Update client's total purchases
  if (data.clientId) {
    const clientRef = docRef('clients', data.clientId);
    batch.update(clientRef, {
      totalPurchases: increment(total),
      lastPurchaseAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return { id: saleRef.id, ...sale };
}

export async function approveSale(saleId, companyId) {
  const sale = await getSale(saleId);
  if (!sale) throw new Error('Venda não encontrada');
  if (sale.status !== 'draft' && sale.status !== 'pending') {
    throw new Error('Venda não pode ser aprovada neste status');
  }

  const batch = getBatch();

  // Update sale status
  const saleRef = docRef(COLLECTION, saleId);
  batch.update(saleRef, {
    status: 'approved',
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Update stock for each item
  for (const item of sale.items) {
    if (item.productId) {
      const productRef = docRef('products', item.productId);
      const productDoc = await getDoc_('products', item.productId);
      if (productDoc) {
        const previousStock = productDoc.stock?.current || 0;

        batch.update(productRef, {
          'stock.current': increment(-item.quantity),
          updatedAt: serverTimestamp(),
        });

        // Create stock movement with unique ID
        const movementRef = newDocRef('stockMovements');
        batch.set(movementRef, {
          companyId,
          productId: item.productId,
          productName: item.productName,
          type: 'exit',
          quantity: item.quantity,
          previousStock,
          newStock: previousStock - item.quantity,
          reason: `Venda #${sale.number}`,
          referenceType: 'sale',
          referenceId: saleId,
          createdAt: serverTimestamp(),
        });
      }
    }
  }

  // Create financial transaction (income) with unique ID
  const txRef = newDocRef('financialTransactions');
  batch.set(txRef, {
    companyId,
    type: 'income',
    category: 'Vendas',
    description: `Venda #${sale.number} — ${sale.clientName}`,
    amount: sale.total,
    date: serverTimestamp(),
    status: sale.paymentStatus === 'paid' ? 'paid' : 'pending',
    paymentMethod: sale.paymentMethod,
    referenceType: 'sale',
    referenceId: saleId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return sale;
}

export async function cancelSale(saleId) {
  return updateDoc_(COLLECTION, saleId, {
    status: 'cancelled',
    paymentStatus: 'cancelled',
  });
}

export async function deleteSale(id) {
  return deleteDoc_(COLLECTION, id);
}
