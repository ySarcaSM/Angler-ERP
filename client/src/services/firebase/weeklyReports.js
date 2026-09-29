import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { createDoc, deleteDoc_ } from './firestore.js';

export async function listWeeklyReports(companyId) {
  const snapshot = await getDocs(query(
    collection(db, 'weeklyReports'),
    where('companyId', '==', companyId),
  ));

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')))
    .slice(0, 6);
}

export async function deleteWeeklyReport(id) {
  return deleteDoc_('weeklyReports', id);
}


export async function createWeeklyReport(companyId, data) {
  const existing = await listWeeklyReports(companyId);
  if (existing.length >= 5) {
    const error = new Error('Sua empresa já possui o limite de 5 relatórios semanais.');
    error.code = 'weekly-report-limit';
    throw error;
  }

  return createDoc('weeklyReports', {
    companyId,
    ...data,
  });
}
