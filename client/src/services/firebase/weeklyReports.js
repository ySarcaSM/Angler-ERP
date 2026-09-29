import { createDoc, listDocs } from './firestore.js';

export async function listWeeklyReports(companyId) {
  const result = await listDocs('weeklyReports', {
    filters: [{ field: 'companyId', op: '==', value: companyId }],
    sortBy: 'startDate',
    sortDir: 'desc',
    pageSize: 6,
  });
  return result.data;
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
