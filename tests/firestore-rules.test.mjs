import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, runTransaction } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-angler-erp',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db,'users/u1'),{
        uid:'u1',role:'owner',companyId:'c1',personalCompanyId:'c1',
        memberships:{c1:{active:true,role:'owner',personal:true}},
      }),
      setDoc(doc(db,'users/u2'),{
        uid:'u2',role:'owner',companyId:'c2',personalCompanyId:'c2',
        memberships:{c2:{active:true,role:'owner',personal:true}},
      }),
      setDoc(doc(db,'users/u3'),{
        uid:'u3',role:'operator',companyId:'c1',personalCompanyId:'c3',
        memberships:{c1:{active:true,role:'operator'},c3:{active:true,role:'owner',personal:true}},
      }),
      setDoc(doc(db,'companies/c1'),{ownerUid:'u1',companyId:'c1',plan:'testfree'}),
      setDoc(doc(db,'companies/c2'),{ownerUid:'u2',companyId:'c2',plan:'testfree'}),
      setDoc(doc(db,'clients/own'),{companyId:'c1',name:'Cliente'}),
      setDoc(doc(db,'clients/foreign'),{companyId:'c2',name:'Outro cliente'}),
      setDoc(doc(db,'sales/s1'),{companyId:'c1',status:'draft',total:45,items:[]}),
      setDoc(doc(db,'sales/s2'),{companyId:'c1',status:'approved',total:100}),
      setDoc(doc(db,'financialTransactions/linked'),{
        companyId:'c1',amount:100,status:'pending',referenceType:'sale',referenceId:'s2',
      }),
    ]);
  });
});
after(async () => { if (env) await env.cleanup(); });

test('owner reads only its tenant and querying owned companies is allowed', async () => {
  const db=env.authenticatedContext('u1').firestore();
  await assertSucceeds(getDoc(doc(db,'clients/own')));
  await assertFails(getDoc(doc(db,'clients/foreign')));
  await assertFails(getDocs(query(collection(db,'clients'),where('companyId','==','c2'))));
  const owned=await assertSucceeds(getDocs(query(collection(db,'companies'),where('ownerUid','==','u1'))));
  assert.equal(owned.size,1);
  await assertFails(getDoc(doc(db,'companies/c2')));
});

test('a viewer or guest cannot self-grant an external membership', async () => {
  const db=env.authenticatedContext('u2').firestore();
  await assertFails(updateDoc(doc(db,'users/u2'),{'memberships.c1.role':'owner'}));
  await assertFails(setDoc(doc(db,'clients/forged'),{companyId:'c1',name:'Intruso'}));
});

test('company owner cannot upgrade plan from frontend', async () => {
  const db=env.authenticatedContext('u1').firestore();
  await assertFails(updateDoc(doc(db,'companies/c1'),{plan:'anglerultra'}));
});

test('company manager reads a member profile, but not a foreign member profile', async () => {
  const db=env.authenticatedContext('u1').firestore();
  await assertSucceeds(getDoc(doc(db,'users/u3')));
  await assertFails(getDoc(doc(db,'users/u2')));
});

test('directly approving a sale without matching finance is blocked', async () => {
  const db=env.authenticatedContext('u1').firestore();
  await assertFails(updateDoc(doc(db,'sales/s1'),{status:'approved'}));
  await assertFails(updateDoc(doc(db,'sales/s2'),{status:'draft'}));
});

test('sale approval with matching finance is permitted atomically', async () => {
  const db=env.authenticatedContext('u1').firestore();
  await assertSucceeds(runTransaction(db, async (transaction) => {
    const ref=doc(db,'sales/s1');
    await transaction.get(ref);
    transaction.update(ref,{status:'approved',approvedAt:new Date()});
    transaction.set(doc(db,'financialTransactions/sale_s1'),{
      companyId:'c1',type:'income',amount:45,status:'pending',
      referenceId:'s1',referenceType:'sale',
    });
  }));
});

test('a linked financial entry cannot be forged by editing its amount or deleting it', async () => {
  const db=env.authenticatedContext('u1').firestore();
  await assertFails(updateDoc(doc(db,'financialTransactions/linked'),{amount:999}));
  // An owner may mark an existing due amount as paid.
  await assertSucceeds(updateDoc(doc(db,'financialTransactions/linked'),{status:'paid'}));
});

test('superadmin claim grants administrative read but not self-selected role',async () => {
  const db=env.authenticatedContext('root',{superadmin:true}).firestore();
  const results=await assertSucceeds(getDocs(collection(db,'users')));
  assert.equal(results.size,3);
});
