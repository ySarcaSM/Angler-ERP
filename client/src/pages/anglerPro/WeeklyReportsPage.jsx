import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileText, Plus, TrendingUp, TrendingDown, DollarSign, BarChart3, Lock, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../context/useAuth';
import { listSales } from '../../services/firebase/sales';
import { listTransactions } from '../../services/firebase/financial';
import { createWeeklyReport, listWeeklyReports } from '../../services/firebase/weeklyReports';
import { timestampToDate } from '../../utils/format';
import { formatBRL } from '../../utils/format';
import toast from 'react-hot-toast';

function toLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function endOfWeek(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatDate(date) {
  return date.toLocaleDateString('pt-BR');
}

function getDate(value) {
  const parsed = timestampToDate(value);
  return parsed || (value ? new Date(value + 'T00:00:00') : null);
}

export default function WeeklyReportsPage() {
  const { company, user, userData } = useAuth();
  const [startDate, setStartDate] = useState(toDateInputValue(new Date()));
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const selectedPeriod = useMemo(() => {
    const start = toLocalDate(startDate);
    const end = endOfWeek(start);
    return { start, end };
  }, [startDate]);

  const loadReports = async () => {
    if (!company?.id) return;
    try {
      setLoading(true);
      setReports(await listWeeklyReports(company.id));
    } catch (error) {
      toast.error(error.message || 'Não foi possível carregar os relatórios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReports(); }, [company?.id]);

  const handleDownloadPdf = (report) => {
    const pdf = new jsPDF();
    const companyName = company?.name || 'Minha empresa';
    const generatedAt = timestampToDate(report.createdAt) || new Date();
    const start = getDate(report.startDate);
    const end = getDate(report.endDate);

    pdf.setFontSize(18);
    pdf.text('Relatório semanal', 20, 20);
    pdf.setFontSize(11);
    pdf.text(companyName, 20, 29);
    pdf.text(`Período: ${formatDate(start)} até ${formatDate(end)}`, 20, 36);
    pdf.text(`Criado por: ${report.generatedByName || 'Usuário'}`, 20, 43);
    pdf.text(`Gerado em: ${formatDate(generatedAt)}`, 20, 50);

    pdf.setDrawColor(210, 210, 210);
    pdf.line(20, 57, 190, 57);
    pdf.setFontSize(13);
    pdf.text('Resumo da semana', 20, 69);
    pdf.setFontSize(11);
    pdf.text(`Vendas realizadas: ${report.salesCount || 0}`, 20, 80);
    pdf.text(`Valor total das vendas: ${formatBRL(report.salesTotal || 0)}`, 20, 88);
    pdf.text(`Receitas: ${formatBRL(report.income || 0)}`, 20, 96);
    pdf.text(`Despesas: ${formatBRL(report.expense || 0)}`, 20, 104);
    pdf.text(`Resultado: ${formatBRL(report.profit || 0)}`, 20, 112);

    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Relatório gerado pelo AnglerERP.', 20, 285);
    pdf.save(`relatorio-semanal-${report.startDate || 'periodo'}.pdf`);
  };

  const handleCreate = async () => {
    if (!company?.id || reports.length >= 5) return;

    setGenerating(true);
    try {
      const start = selectedPeriod.start;
      const end = selectedPeriod.end;
      const [salesRes, incomeRes, expenseRes] = await Promise.all([
        listSales(company.id, { pageSize: 500 }),
        listTransactions(company.id, { type: 'income', status: 'paid', pageSize: 500 }),
        listTransactions(company.id, { type: 'expense', status: 'paid', pageSize: 500 }),
      ]);

      const inPeriod = (value) => {
        const date = timestampToDate(value);
        return date && date >= start && date <= end;
      };

      const sales = salesRes.data.filter((sale) => sale.status !== 'cancelled' && inPeriod(sale.createdAt));
      const incomes = incomeRes.data.filter((item) => inPeriod(item.createdAt));
      const expenses = expenseRes.data.filter((item) => inPeriod(item.createdAt));

      const income = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const expense = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const salesTotal = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

      await createWeeklyReport(company.id, {
        startDate,
        endDate: toDateInputValue(end),
        salesCount: sales.length,
        salesTotal,
        income,
        expense,
        profit: income - expense,
        generatedBy: user?.uid || null,
        generatedByName: userData?.name || user?.displayName || user?.email || 'Usuário',
      });

      toast.success('Relatório semanal criado e salvo.');
      await loadReports();
    } catch (error) {
      toast.error(error.message || 'Não foi possível criar o relatório.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary-400/10 text-primary-300"><FileText size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Relatórios semanais</h1>
            <p className="text-dark-500 text-sm mt-1">Crie e consulte snapshots semanais dos resultados da empresa.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="text-sm font-semibold text-dark-200">Criar novo relatório</h2></div>
        <div className="card-body">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <label className="block">
              <span className="block text-sm font-medium text-dark-300 mb-2">Data de início da semana</span>
              <div className="relative">
                <CalendarDays size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="input pl-10 w-full" />
              </div>
              <span className="block text-xs text-dark-500 mt-2">
                Período: {formatDate(selectedPeriod.start)} até {formatDate(selectedPeriod.end)}
              </span>
            </label>
            <button type="button" onClick={handleCreate} disabled={generating || loading || reports.length >= 5} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed md:mt-7">
              {generating ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Plus size={18} />}
              {generating ? 'Gerando...' : 'Criar relatório'}
            </button>
          </div>
          {reports.length >= 5 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <Lock size={16} /> Limite de 5 relatórios atingido para esta empresa.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div><h2 className="text-sm font-semibold text-dark-200">Relatórios salvos</h2><p className="text-xs text-dark-500 mt-1">{reports.length}/5 relatórios armazenados</p></div>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="flex justify-center py-10"><div className="animate-spin w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
          ) : reports.length === 0 ? (
            <div className="text-center py-10 text-dark-500"><FileText size={30} className="mx-auto mb-3 opacity-60" /><p>Nenhum relatório semanal criado ainda.</p></div>
          ) : (
            <div className="space-y-3">
              {reports.slice(0, 5).map((report) => (
                <div key={report.id} className="rounded-2xl border border-dark-700/60 bg-dark-900/40 p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-semibold text-dark-100">Semana de {formatDate(getDate(report.startDate))} a {formatDate(getDate(report.endDate))}</div>
                      <div className="text-xs text-dark-500 mt-1">Criado por {report.generatedByName || 'Usuário'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-dark-500">{formatDate(timestampToDate(report.createdAt) || new Date())}</div>
                      <button type="button" onClick={() => handleDownloadPdf(report)} className="btn-secondary !px-3 !py-2" title="Baixar PDF">
                        <FileDown size={16} /> PDF
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                    <div className="rounded-xl bg-blue-500/10 p-3"><div className="flex items-center gap-2 text-xs text-dark-500"><BarChart3 size={14} /> Vendas</div><div className="text-lg font-bold text-blue-300 mt-1">{report.salesCount || 0}</div><div className="text-xs text-dark-500">{formatBRL(report.salesTotal || 0)}</div></div>
                    <div className="rounded-xl bg-emerald-500/10 p-3"><div className="flex items-center gap-2 text-xs text-dark-500"><TrendingUp size={14} /> Receitas</div><div className="text-lg font-bold text-emerald-300 mt-1">{formatBRL(report.income || 0)}</div></div>
                    <div className="rounded-xl bg-red-500/10 p-3"><div className="flex items-center gap-2 text-xs text-dark-500"><TrendingDown size={14} /> Despesas</div><div className="text-lg font-bold text-red-300 mt-1">{formatBRL(report.expense || 0)}</div></div>
                    <div className="rounded-xl bg-purple-500/10 p-3"><div className="flex items-center gap-2 text-xs text-dark-500"><DollarSign size={14} /> Resultado</div><div className="text-lg font-bold text-purple-300 mt-1">{formatBRL(report.profit || 0)}</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
