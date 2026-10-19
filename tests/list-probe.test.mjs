import { test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDocs, query, collection, where } from 'firebase/firestore';
const CASES=[
 ['static-equality', "resource.data.companyId == 'company' && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == 'company'",{}],
 ['dynamic-equality', "resource.data.companyId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId",{}],
 ['membership-dynamic', "resource.data.companyId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.memberships.keys()",{}],
 ['claim-equality', "resource.data.companyId == request.auth.token.companyId",{companyId:'company'}],
 ['claim-company-and-db-membership', "resource.data.companyId == request.auth.token.companyId && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.memberships[request.auth.token.companyId].active == true",{companyId:'company'}],
];
test('diagnose Firestore query rule patterns',async()=>{
 for(const [id,condition,claims] of CASES){
  let env;try{
    env=await initializeTestEnvironment({
      projectId:'demo-query-probe-'+id,
      firestore:{host:'127.0.0.1',port:8080,rules:'rules_version = "2"; service cloud.firestore { match /databases/{database}/documents { match /sales/{id} { allow list: if request.auth != null && ('+condition+'); } } }'},
    });
    await env.withSecurityRulesDisabled(async ctx=>{
      await Promise.all([
        setDoc(doc(ctx.firestore(),'users/u1'),{companyId:'company',memberships:{company:{active:true}}}),
        setDoc(doc(ctx.firestore(),'sales/s1'),{companyId:'company',total:10}),
        setDoc(doc(ctx.firestore(),'sales/s2'),{companyId:'other',total:20}),
      ]);
    });
    const db=env.authenticatedContext('u1',claims).firestore();
    const own=await getDocs(query(collection(db,'sales'),where('companyId','==','company'))).then(x=>x.size).catch(e=>'DENIED:'+e.code);
    const other=await getDocs(query(collection(db,'sales'),where('companyId','==','other'))).then(x=>x.size).catch(e=>'DENIED:'+e.code);
    console.log('QUERY-PROBE:',id,own,other);
  }catch(error){console.log('QUERY-PROBE-ERROR:',id,String(error))}finally{if(env)await env.cleanup()}
 }
});
