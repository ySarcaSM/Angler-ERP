import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, query, where } from 'firebase/firestore';

let environment;
let sales, purchases, stock, budgets;
let compiledDir;

before(async () => {
  environment=await initializeTestEnvironment({
    projectId:'demo-angler-operations',
    firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')},
  });
  await environment.withSecurityRulesDisabled(async context => {
    const db=context.firestore();
    await Promise.all([
      setDoc(doc(db,'users/owner'),{
        uid:'owner',companyId:'company',personalCompanyId:'company',role:'owner',
        memberships:{company:{role:'owner',active:true,personal:true}},
      }),
      setDoc(doc(db,'companies/company'),{companyId:'company',ownerUid:'owner',plan:'testfree'}),
      setDoc(doc(db,'clients/customer'),{companyId:'company',name:'Example',totalPurchases:0}),
      setDoc(doc(db,'products/product'),{companyId:'company',name:'Item',stock:{current:6,minimum:1},active:true}),
      setDoc(doc(db,'suppliers/supplier'),{companyId:'company',name:'Fornecedor'}),
      setDoc(doc(db,'budgets/budget-1'),{companyId:'company',status:'draft',value:40,clientName:'Example'}),
    ]);
  });

  // Import the actual repository services, replacing only their Vite Firebase
  // configuration with the authenticated emulator context.
  globalThis.__anglerTestFirestore=environment.authenticatedContext('owner').firestore();
  compiledDir=mkdtempSync(join(process.cwd(),'.angler-operation-test-'));
  await build({
    entryPoints:{
      sales:resolve('src/services/firebase/sales.js'),
      purchases:resolve('src/services/firebase/purchases.js'),
      stock:resolve('src/services/firebase/stock.js'),
      budgets:resolve('src/services/firebase/budgetApproval.js'),
    },
    outdir:compiledDir,
    entryNames:'[name]',
    outExtension:{'.js':'.mjs'},
    bundle:true,platform:'node',format:'esm',
    external:['firebase','firebase/*'],
    plugins:[{
      name:'replace-vite-firebase-with-emulator',
      setup(b) {
        b.onResolve({filter:/config\/firebase(?:\.js)?$/},() => ({path:'firebase-mock',namespace:'angler-test'}));
        b.onLoad({filter:/.*/,namespace:'angler-test'},() => ({
          contents:'export const db = globalThis.__anglerTestFirestore; export const auth = null;',
        }));
      },
    }],
  });
  sales=await import(pathToFileURL(join(compiledDir,'sales.mjs')).href);
  purchases=await import(pathToFileURL(join(compiledDir,'purchases.mjs')).href);
  stock=await import(pathToFileURL(join(compiledDir,'stock.mjs')).href);
  budgets=await import(pathToFileURL(join(compiledDir,'budgets.mjs')).href);
});

after(async ()=>{
  if(environment) await environment.cleanup();
  delete globalThis.__anglerTestFirestore;
  if(compiledDir) rmSync(compiledDir,{recursive:true,force:true});
});

const user={uid:'owner',displayName:'Owner'};
const db=()=>globalThis.__anglerTestFirestore;

test('sale creates once, approves atomically and rejects repeated approval',async()=>{
  const created=await sales.createSale('company',{
    clientId:'customer',clientName:'Example',
    items:[{productId:'product',quantity:2,unitPrice:10,discount:0}],
    discount:0,shipping:0,tax:0,
  },user);
  assert.equal(created.number,1);
  assert.equal(created.total,20);
  // Check an explicit tenant-filtered query before the service list helper.
  const direct=await getDocs(query(collection(db(),'sales'),where('companyId','==','company')));
  assert.equal(direct.size,1);
  await assert.rejects(getDocs(query(
    collection(environment.authenticatedContext('outsider').firestore(),'sales'),
    where('companyId','==','company'),
  )));

  const listed=await sales.listSales('company');
  assert.equal(listed.data.length,1);
  const before=await getDoc(doc(db(),'products/product'));
  assert.equal(before.data().stock.current,6);
  await sales.approveSale(created.id,'company');
  const [after,finance,movements,client]=await Promise.all([
    getDoc(doc(db(),'products/product')),
    getDoc(doc(db(),`financialTransactions/sale_${created.id}`)),
    getDocs(query(collection(db(),'stockMovements'),where('companyId','==','company'))),
    getDoc(doc(db(),'clients/customer')),
  ]);
  assert.equal(after.data().stock.current,4);
  assert.equal(finance.data().amount,20);
  assert.equal(movements.size,1);
  assert.equal(client.data().totalPurchases,20);
  await assert.rejects(sales.approveSale(created.id,'company'));
  await assert.rejects(sales.deleteSale(created.id));
});

test('purchase receive restores stock, finance is unique and repeated receipt is blocked',async()=>{
  const created=await purchases.createPurchase('company',{
    supplierId:'supplier',supplierName:'Fornecedor',
    items:[{productId:'product',productName:'Item',quantity:2,unitCost:5}],
    shipping:0,tax:0,
  },user);
  assert.equal(created.number,1);
  await purchases.receivePurchase(created.id,'company');
  const [product,finance]=await Promise.all([
    getDoc(doc(db(),'products/product')),
    getDoc(doc(db(),`financialTransactions/purchase_${created.id}`)),
  ]);
  assert.equal(product.data().stock.current,6);
  assert.equal(finance.data().amount,10);
  await assert.rejects(purchases.receivePurchase(created.id,'company'));
  await assert.rejects(purchases.deletePurchase(created.id));
});

test('manual stock operations never silently clamp an insufficient balance',async()=>{
  await assert.rejects(stock.adjustStock('company',{
    productId:'product',quantity:100,type:'exit',reason:'Bad',
  },user));
  const result=await stock.adjustStock('company',{
    productId:'product',quantity:3,type:'entry',reason:'Test',
  },user);
  assert.equal(result.newStock,9);
});

test('budget approval creates its income atomically and is idempotent',async()=>{
  const result=await budgets.approveBudget('company',{id:'budget-1'},user);
  assert.equal(result.alreadyApproved,false);
  const [budget,finance]=await Promise.all([
    getDoc(doc(db(),'budgets/budget-1')),
    getDoc(doc(db(),'financialTransactions/budget_budget-1')),
  ]);
  assert.equal(budget.data().status,'approved');
  assert.equal(finance.data().amount,40);
  const again=await budgets.approveBudget('company',{id:'budget-1'},user);
  assert.equal(again.alreadyApproved,true);
});
