import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { clearAuditLogs, listAuditLogs } from '../../services/firebase/settings';
import { formatDate } from '../../utils/format';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const DETAIL_LABELS = {
  name: 'Nome', email: 'E-mail', phone: 'Telefone', sellPrice: 'Preço de venda',
  stock: 'Estoque', status: 'Status', city: 'Cidade', state: 'Estado',
  total: 'Total', clientName: 'Cliente', supplierName: 'Fornecedor',
  amount: 'Valor', type: 'Tipo', category: 'Categoria', itemCount: 'Itens',
  reason: 'Motivo', previousStock: 'Estoque anterior', newStock: 'Estoque atual',
};

function detailLabel(key) {
  return DETAIL_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}

function DetailValue({ value }) {
  if (value == null || value === '') return <span className="text-dark-500">Não informado</span>;
  if (typeof value === 'object') {
    return (
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div key={key} className="rounded-lg bg-dark-900/60 px-3 py-2">
            <div className="text-[11px] text-dark-500">{detailLabel(key)}</div>
            <div className="text-xs text-dark-200 mt-0.5"><DetailValue value={nestedValue} /></div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

function ComparisonValue({ value }) {
  if (value == null || value === '') return <span className="text-dark-500">Não informado</span>;
  if (typeof value === 'object') {
    return <span className="text-xs">{Object.entries(value).map(([key, nestedValue]) => `${detailLabel(key)}: ${nestedValue ?? '—'}`).join(' · ')}</span>;
  }
  return <span>{String(value)}</span>;
}

function changeSummary(details) {
  if (!details?.antes || !details?.depois) return null;
  const changedFields = Array.from(new Set([...Object.keys(details.antes), ...Object.keys(details.depois)]))
    .filter((field) => JSON.stringify(details.antes[field]) !== JSON.stringify(details.depois[field]))
    .map(detailLabel);
  return changedFields.length > 0 ? `Alteração: ${changedFields.join(', ')}` : 'Alteração: nenhum campo modificado';
}

export default function LogsPage() {
  const { company } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const result = await listAuditLogs(company.id, { pageSize: 100 });
      setLogs(result.data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!company?.id || logs.length === 0) return;
    if (!confirm('Limpar todos os logs da empresa? Esta ação não pode ser desfeita.')) return;
    setLoading(true);
    try {
      await clearAuditLogs(company.id);
      setLogs([]);
      toast.success('Logs limpos.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [company]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs"
        subtitle="Histórico de atividades da empresa"
        action={(
          <div className="flex gap-2">
            <button type="button" onClick={handleClearLogs} disabled={loading || logs.length === 0} className="btn-secondary text-red-400 disabled:opacity-50" title="Limpar logs">
              <Trash2 size={16} /> Limpar logs
            </button>
            <button type="button" onClick={loadLogs} disabled={loading} className="btn-secondary" title="Atualizar logs">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        )}
      />
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Clock size={18} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-dark-200">Atividades recentes</h3>
        </div>
        <div className="divide-y divide-dark-800/50">
          {loading && <div className="px-6 py-8 text-center text-dark-500 text-sm">Carregando atividades...</div>}
          {!loading && logs.map((log) => (
            <div key={log.id} className="px-6 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-dark-200">{log.description || `${log.userName} — ${log.action} em ${log.entity}`}</div>
                {log.details && (
                  <div className="text-xs text-dark-500 mt-1 break-words">
                    {changeSummary(log.details) || Object.entries(log.details).map(([key, value]) => `${detailLabel(key)}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-dark-500 whitespace-nowrap">{formatDate(log.createdAt?.toDate?.() || log.createdAt)}</span>
                <button type="button" onClick={() => setSelectedLog(log)} className="btn-ghost btn-sm" title="Ver detalhes do log" aria-label="Ver detalhes do log">
                  <Eye size={15} />
                </button>
              </div>
            </div>
          ))}
          {!loading && logs.length === 0 && <div className="px-6 py-8 text-center text-dark-500 text-sm">Nenhuma atividade</div>}
        </div>
      </div>
      <Modal open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} title="Detalhes do log" size="md">
        {selectedLog && (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-dark-500 mb-1">Descrição</div>
              <div className="text-sm text-dark-100">{selectedLog.description || 'Sem descrição.'}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><div className="text-xs text-dark-500">Usuário</div><div className="text-sm text-dark-200">{selectedLog.userName || 'Sistema'}</div></div>
              <div><div className="text-xs text-dark-500">Data</div><div className="text-sm text-dark-200">{formatDate(selectedLog.createdAt?.toDate?.() || selectedLog.createdAt)}</div></div>
              <div><div className="text-xs text-dark-500">Ação</div><div className="text-sm text-dark-200">{selectedLog.action}</div></div>
              <div><div className="text-xs text-dark-500">Entidade</div><div className="text-sm text-dark-200">{selectedLog.entity}</div></div>
              <div className="sm:col-span-2"><div className="text-xs text-dark-500">ID do registro</div><div className="text-sm text-dark-200 font-mono break-all">{selectedLog.entityId || '—'}</div></div>
            </div>
            {selectedLog.details && (
              <div>
                <div className="text-xs text-dark-500 mb-2">Detalhes da alteração</div>
                <div className="space-y-3">
                  {selectedLog.details.antes && selectedLog.details.depois && (
                    <div className="rounded-xl border border-dark-700 overflow-hidden">
                      <div className="grid grid-cols-[1fr_1.2fr_1.2fr] bg-dark-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-dark-500">
                        <span>Campo</span><span>Antes</span><span>Depois</span>
                      </div>
                      {Array.from(new Set([...Object.keys(selectedLog.details.antes), ...Object.keys(selectedLog.details.depois)])).map((field) => {
                        const before = selectedLog.details.antes[field];
                        const after = selectedLog.details.depois[field];
                        const changed = JSON.stringify(before) !== JSON.stringify(after);
                        return (
                          <div key={field} className={`grid grid-cols-[1fr_1.2fr_1.2fr] gap-2 px-3 py-3 border-t border-dark-800 text-xs ${changed ? 'bg-primary-400/10' : 'bg-dark-900/30'}`}>
                            <div className={`font-medium ${changed ? 'text-primary-300' : 'text-dark-400'}`}>{detailLabel(field)}{changed && <span className="ml-1 text-primary-400" title="Campo alterado">●</span>}</div>
                            <div className={changed ? 'text-red-300' : 'text-dark-300'}><ComparisonValue value={before} /></div>
                            <div className={changed ? 'text-emerald-300' : 'text-dark-300'}><ComparisonValue value={after} /></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {Object.entries(selectedLog.details).filter(([key]) => key !== 'antes' && key !== 'depois').map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-dark-800 px-3 py-2 text-xs text-dark-300"><span className="text-dark-500">{detailLabel(key)}:</span> <DetailValue value={value} /></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
