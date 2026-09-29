import admin from 'firebase-admin';

function getAdmin() {
  if (admin.apps.length) return admin.firestore();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não configurada.');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  return admin.firestore();
}

const dateValue = (v) => v?.toDate ? v.toDate() : (v ? new Date(v) : null);
const inputDate = (d) => d.toISOString().slice(0, 10);
const endOfPeriod = (start) => { const d = new Date(start); d.setDate(d.getDate() + 6); d.setHours(23,59,59,999); return d; };
const inPeriod = (v, start, end) => { const d = dateValue(v); return d && d >= start && d <= end; };

async function buildReport(db, companyId, startDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end = endOfPeriod(start);
  const [salesSnap, txSnap, budgetSnap] = await Promise.all([
    db.collection('sales').where('companyId', '==', companyId).get(),
    db.collection('financialTransactions').where('companyId', '==', companyId).get(),
    db.collection('budgets').where('companyId', '==', companyId).get(),
  ]);
  const sales = salesSnap.docs.map(d => d.data()).filter(s => s.status !== 'cancelled' && inPeriod(s.createdAt, start, end));
  const tx = txSnap.docs.map(d => d.data());
  const budgets = budgetSnap.docs.map(d => d.data());
  const incomes = tx.filter(t => t.type === 'income' && t.status === 'paid' && inPeriod(t.createdAt,start,end));
  const expenses = tx.filter(t => t.type === 'expense' && t.status === 'paid' && inPeriod(t.createdAt,start,end));
  const pendingIncome = tx.filter(t => t.type === 'income' && t.status === 'pending' && inPeriod(t.createdAt,start,end)).reduce((s,t)=>s+Number(t.amount||0),0);
  const pendingExpense = tx.filter(t => t.type === 'expense' && t.status === 'pending' && inPeriod(t.createdAt,start,end)).reduce((s,t)=>s+Number(t.amount||0),0);
  const income = incomes.reduce((s,t)=>s+Number(t.amount||0),0);
  const expense = expenses.reduce((s,t)=>s+Number(t.amount||0),0);
  const approved = budgets.filter(b=>b.status==='approved');
  const open = budgets.filter(b=>b.status!=='approved' && b.status!=='cancelled');
  const daily = Array.from({length:7},(_,i)=>{
    const ds=new Date(start); ds.setDate(ds.getDate()+i);
    const de=new Date(ds); de.setHours(23,59,59,999);
    const daySales=sales.filter(s=>inPeriod(s.createdAt,ds,de));
    const dayIncome=incomes.filter(t=>inPeriod(t.createdAt,ds,de)).reduce((s,t)=>s+Number(t.amount||0),0);
    const dayExpense=expenses.filter(t=>inPeriod(t.createdAt,ds,de)).reduce((s,t)=>s+Number(t.amount||0),0);
    return {label:ds.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),salesCount:daySales.length,salesTotal:daySales.reduce((s,x)=>s+Number(x.total||0),0),income:dayIncome,expense:dayExpense,profit:dayIncome-dayExpense};
  });
  return {
    companyId,startDate:inputDate(start),endDate:inputDate(end),
    salesCount:sales.length,salesTotal:sales.reduce((s,x)=>s+Number(x.total||0),0),
    income,expense,profit:income-expense,pendingIncome,pendingExpense,
    budgetCount:budgets.length,approvedBudgetCount:approved.length,
    approvedBudgetTotal:approved.reduce((s,b)=>s+Number(b.value||0),0),
    openBudgetTotal:open.reduce((s,b)=>s+Number(b.value||0),0),daily,
    generatedBy:'automation',generatedByName:'Automação semanal',automationGenerated:true,
    createdAt:admin.firestore.FieldValue.serverTimestamp(),updatedAt:admin.firestore.FieldValue.serverTimestamp()
  };
}

export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({error:'Unauthorized'});
  try {
    const db=getAdmin();
    const companies=await db.collection('companies').get();
    const today=new Date(); today.setHours(23,59,59,999);
    let generated=0;
    for (const companyDoc of companies.docs) {
      const automation=companyDoc.data().weeklyReportAutomation;
      if (!automation?.enabled || !automation.startDate) continue;
      const nextStart=automation.nextStartDate || automation.startDate;
      const next=new Date(nextStart+'T00:00:00');
      if (next>today) continue;
      const reportsRef=db.collection('weeklyReports');
      const snap=await reportsRef.where('companyId','==',companyDoc.id).get();
      const reports=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.startDate||'').localeCompare(String(b.startDate||'')));
      if (!reports.some(r=>r.startDate===nextStart)) {
        if (reports.length>=5) await reportsRef.doc(reports[0].id).delete();
        await reportsRef.add(await buildReport(db,companyDoc.id,nextStart));
        generated++;
      }
      next.setDate(next.getDate()+7);
      await companyDoc.ref.set({weeklyReportAutomation:{...automation,nextStartDate:inputDate(next),lastRunAt:admin.firestore.FieldValue.serverTimestamp()}},{merge:true});
    }
    return res.status(200).json({ok:true,generated});
  } catch(error) {
    console.error('[weekly-reports-cron]',error);
    return res.status(500).json({error:error.message||'Erro interno'});
  }
}