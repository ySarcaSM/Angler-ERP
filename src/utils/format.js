export function formatBRL(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Safely convert Firestore Timestamp, Date, string, or null to Date
export function timestampToDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate(); // Firestore Timestamp
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return null;
}

export function formatDate(date) {
  const d = timestampToDate(date);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTime(date) {
  const d = timestampToDate(date);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

export function formatPhone(phone) {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function formatDocument(doc) {
  if (!doc) return '—';
  const cleaned = doc.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0,3)}.${cleaned.slice(3,6)}.${cleaned.slice(6,9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 14) {
    return `${cleaned.slice(0,2)}.${cleaned.slice(2,5)}.${cleaned.slice(5,8)}/${cleaned.slice(8,12)}-${cleaned.slice(12)}`;
  }
  return doc;
}

export const STATUS_LABELS = {
  draft: 'Rascunho',
  pending: 'Pendente',
  approved: 'Aprovado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  returned: 'Devolvido',
  ordered: 'Pedido',
  partial: 'Parcial',
  received: 'Recebido',
  paid: 'Pago',
  overdue: 'Vencido',
  active: 'Ativo',
  inactive: 'Inativo',
  blocked: 'Bloqueado',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}
