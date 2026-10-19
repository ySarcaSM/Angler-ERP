// Compras numeradas e recebidas em operações transacionais.
import { runTransaction } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getDoc_, updateDoc_, deleteDoc_, listDocs, docRef, newDocRef, serverTimestamp, increment } from './firestore.js';
const COLLECTION = 'purchases';

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('A compra precisa ter produtos.');
  return items.map((item) => {
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Quantidade da compra inválida.');
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Custo da compra inválido.');
    return { ...item, quantity, unitCost, total: quantity * unitCost };
  });
}
function buildTotals(data) {
  const items = validateItems(data.items);
  const shipping = Number(data.shipping || 0);
  const tax = Number(data.tax || 0);
  if (![shipping,tax].every((value) => Number.isFinite(value) && value >= 0)) throw new Error('Frete ou imposto inválido.');
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  return { items, subtotal, total: subtotal + shipping + tax };
}
export async function listPurchases(companyId, options = {}) {
  const result = await listDocs(COLLECTION, {
    ...options, filters: [{ field:'companyId', op:'==', value:companyId }, ...(options.filters || [])], sortBy:null,
  });
  result.data.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  return result;
}
export async function getPurchase(id) { return getDoc_(COLLECTION,id); }

export async function createPurchase(companyId,data,user) {
  if (!companyId || !user?.uid) throw new Error('Empresa e usuário são obrigatórios.');
  const totals = buildTotals(data);
  const purchaseRef = newDocRef(COLLECTION);
  const counterRef = docRef('counters',companyId);
  const supplierRef = data.supplierId ? docRef('suppliers',data.supplierId) : null;
  return runTransaction(db,async(tx) => {
    const counter = await tx.get(counterRef);
    const supplier = supplierRef ? await tx.get(supplierRef) : null;
    if (supplierRef && (!supplier.exists() || supplier.data().companyId !== companyId)) {
      throw new Error('Fornecedor não pertence à empresa.');
    }
    const nextNumber = Number(counter.exists() ? counter.data().purchaseCount : 0) + 1;
    const purchase = { ...data,...totals,companyId,number:nextNumber,status:'draft',paymentStatus:'pending',createdBy:user.uid };
    tx.set(purchaseRef,{...purchase,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    tx.set(counterRef,{purchaseCount:nextNumber,updatedAt:serverTimestamp()},{merge:true});
    return {id:purchaseRef.id,...purchase};
  });
}
export async function updatePurchase(id,data) {
  const existing=await getPurchase(id);
  if (!existing) throw new Error('Compra não encontrada.');
  if (!['draft','pending'].includes(existing.status)) throw new Error('Compra finalizada ou cancelada não pode ser editada.');
  return updateDoc_(COLLECTION,id,{...data,...buildTotals({...existing,...data}),status:existing.status,companyId:existing.companyId});
}
export async function receivePurchase(purchaseId,companyId) {
  const purchaseRef=docRef(COLLECTION,purchaseId);
  return runTransaction(db, async (tx) => {
    const snap=await tx.get(purchaseRef);
    if (!snap.exists()) throw new Error('Compra não encontrada.');
    const purchase=snap.data();
    if (purchase.companyId!==companyId) throw new Error('Compra de outra empresa.');
    if (purchase.status==='received'||purchase.status==='cancelled') throw new Error('Compra já recebida ou cancelada.');
    const quantities=new Map();
    for (const item of purchase.items||[]) {
      if (!item.productId) continue;
      const amount=Number(item.quantity);
      if (!Number.isSafeInteger(amount)||amount<=0) throw new Error('Quantidade inválida na compra.');
      quantities.set(item.productId,(quantities.get(item.productId)||0)+amount);
    }
    const productRefs=[...quantities.keys()].map(id=>docRef('products',id));
    const productSnapshots=await Promise.all(productRefs.map(ref=>tx.get(ref)));
    const financialRef=docRef('financialTransactions',`purchase_${purchaseId}`);
    const existingFinance=await tx.get(financialRef);
    if (existingFinance.exists()) throw new Error('A compra já possui lançamento financeiro.');
    const products=productRefs.map((ref,i)=>{
      const snap=productSnapshots[i];
      if (!snap.exists()||snap.data().companyId!==companyId) throw new Error('Produto de outra empresa ou inexistente.');
      return {ref,name:snap.data().name,current:Number(snap.data().stock?.current||0),quantity:quantities.get(ref.id)};
    });
    tx.update(purchaseRef,{status:'received',receivedAt:serverTimestamp(),updatedAt:serverTimestamp()});
    for (const product of products) {
      tx.update(product.ref,{'stock.current':increment(product.quantity),updatedAt:serverTimestamp()});
      tx.set(newDocRef('stockMovements'),{
        companyId,productId:product.ref.id,productName:product.name,
        type:'entry',quantity:product.quantity,previousStock:product.current,
        newStock:product.current+product.quantity,reason:`Compra #${purchase.number}`,
        referenceType:'purchase',referenceId:purchaseId,createdAt:serverTimestamp(),
      });
    }
    tx.set(financialRef,{
      companyId,type:'expense',category:'Compras',
      description:`Compra #${purchase.number} — ${purchase.supplierName||'Fornecedor'}`,
      amount:Number(purchase.total||0),date:serverTimestamp(),
      status:purchase.paymentStatus==='paid'?'paid':'pending',
      paymentMethod:purchase.paymentMethod||null,
      referenceType:'purchase',referenceId:purchaseId,
      createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
    });
    return {...purchase,status:'received'};
  });
}
export async function deletePurchase(id) {
  const purchase=await getPurchase(id);
  if (!purchase) throw new Error('Compra não encontrada.');
  if (purchase.status==='received') {
    throw new Error('Compra recebida não pode ser excluída sem estorno de estoque e financeiro.');
  }
  return deleteDoc_(COLLECTION,id);
}
