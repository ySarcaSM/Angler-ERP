import { createDoc, updateDoc_, deleteDoc_, listDocs } from './firestore.js';

const COLLECTION = 'formulas';

export async function listFormulas(companyId, options = {}) {
  const result = await listDocs(COLLECTION, {
    ...options,
    filters: [
      { field: 'companyId', op: '==', value: companyId },
      ...(options.filters || []),
    ],
    sortBy: null,
    pageSize: options.pageSize || 200,
  });
  return {
    ...result,
    data: result.data.sort((first, second) => String(first.name || '').localeCompare(String(second.name || ''), 'pt-BR')),
  };
}

export async function createFormula(companyId, data) {
  return createDoc(COLLECTION, {
    companyId,
    name: data.name.trim(),
    description: data.description?.trim() || '',
    expression: data.expression.trim(),
    variables: data.variables?.trim() || '',
    constants: data.constants?.trim() || '',
    unit: data.unit?.trim() || '',
    category: data.category?.trim() || 'Geral',
    active: data.active !== false,
  });
}

export async function updateFormula(id, data) {
  return updateDoc_(COLLECTION, id, {
    name: data.name.trim(),
    description: data.description?.trim() || '',
    expression: data.expression.trim(),
    variables: data.variables?.trim() || '',
    constants: data.constants?.trim() || '',
    unit: data.unit?.trim() || '',
    category: data.category?.trim() || 'Geral',
    active: data.active !== false,
  });
}

export async function deleteFormula(id) {
  return deleteDoc_(COLLECTION, id);
}
