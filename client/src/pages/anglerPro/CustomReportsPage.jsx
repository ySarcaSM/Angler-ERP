import React, { useMemo, useState } from 'react';
import {
  BarChart3, Check, ChevronDown, FileDown, FileText, LineChart, PieChart, Plus, Settings2, SlidersHorizontal, Sparkles, Table2, Trash2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../context/useAuth';
import { listSales } from '../../services/firebase/sales';
import { listTransactions } from '../../services/firebase/financial';
import { listBudgets } from '../../services/firebase/budgets';
import { timestampToDate, formatBRL } from '../../utils/format';
import toast from 'react-hot-toast';

const METRICS = [
  { key: 'salesCount', label: 'Quantidade de vendas', group: 'Vendas' },
  { key: 'salesTotal', label: 'Faturamento', group: 'Vendas', money: true },
  { key: 'averageTicket', label: 'Ticket médio', group: 'Vendas', money: true },
  { key: 'income', label: 'Receitas pagas', group: 'Financeiro', money: true },
  { key: 'expense', label: 'Despesas pagas', group: 'Financeiro', money: true },
  { key: 'profit', label: 'Resultado', group: 'Financeiro', money: true },
  { key: 'pendingIncome', label: 'A receber', group: 'Financeiro', money: true },
  { key: 'pendingExpense', label: 'A pagar', group: 'Financeiro', money: true },
  { key: 'budgetCount', label: 'Quantidade de orçamentos', group: 'Orçamentos' },
  { key: 'approvedBudgetCount', label: 'Orçamentos aprovados', group: 'Orçamentos' },
  { key: 'approvedBudgetTotal', label: 'Valor aprovado em orçamentos', group: 'Orçamentos', money: true },
  { key: 'openBudgetTotal', label: 'Valor em aberto em orçamentos', group: 'Orçamentos', money: true },
];

const CHARTS = [
  { key: 'bar', label: 'Barras', icon: BarChart3 },
  { key: 'line', label: 'Linhas', icon: LineChart },
  { key: 'pie', label: 'Pizza', icon: PieChart },
];

const CHART_DATA = [
  { key: 'salesTotal', label: 'Faturamento por dia', money: true },
  { key: 'profit', label: 'Resultado por dia', money: true },
  { key: 'incomeExpense', label: 'Receitas x despesas', money: true },
  { key: 'salesCount', label: 'Vendas por dia' },
];

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

function formatDate(date) {
  return date.toLocaleDateString('pt-BR');
}

function getDate(value) {
  const parsed = timestampToDate(value);
  return parsed || (value ? new Date(value + 'T00:00:00') : null);
}

function formatMetric(metric, value) {
  if (metric.money) return formatBRL(value || 0);
  return Number(value || 0).toLocaleString('pt-BR');
}

function buildDays(start, end) {
  const days = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function CustomReportsPage() {
  const { company } = useAuth();
  const [title, setTitle] = useState('Relatório personalizado');
  const [charts, setCharts] = useState([
    { id: 1, title: 'Desempenho financeiro', type: 'bar', metrics: ['income', 'expense', 'profit'] },
    { id: 2, title: 'Vendas', type: 'line', metrics: ['salesTotal', 'salesCount'] },
  ]);
  const [includeTable, setIncludeTable] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);

  const selectedMetricKeys = useMemo(() => [...new Set(charts.flatMap((chart) => chart.metrics))], [charts]);
  const selectedMetricObjects = selectedMetricKeys.map((key) => METRICS.find((metric) => metric.key === key)).filter(Boolean);

  const addChart = () => setCharts((current) => [...current, { id: Date.now(), title: \`Gráfico \${current.length + 1}\`, type: 'bar', metrics: ['salesTotal'] }]);
  const removeChart = (id) => setCharts((current) => current.length > 1 ? current.filter((chart) => chart.id !== id) : current);
  const updateChart = (id, patch) => setCharts((current) => current.map((chart) => chart.id === id ? { ...chart, ...patch } : chart));
  const toggleChartMetric = (chart, key) => updateChart(chart.id, { metrics: chart.metrics.includes(key) ? (chart.metrics.length > 1 ? chart.metrics.filter((item) => item !== key) : chart.metrics) : [...chart.metrics, key] });

  const generateData = async () => {
    if (!company?.id) throw new Error('Empresa não identificada.');

    const [salesRes, paidIncomeRes, paidExpenseRes, pendingIncomeRes, pendingExpenseRes, budgetsRes] = await Promise.all([
      listSales(company.id, { pageSize: 500 }),
      listTransactions(company.id, { type: 'income', status: 'paid', pageSize: 500 }),
      listTransactions(company.id, { type: 'expense', status: 'paid', pageSize: 500 }),
      listTransactions(company.id, { type: 'income', status: 'pending', pageSize: 500 }),
      listTransactions(company.id, { type: 'expense', status: 'pending', pageSize: 500 }),
      listBudgets(company.id, { pageSize: 500 }),
    ]);

    const sales = salesRes.data.filter((sale) => sale.status !== 'cancelled');
    const incomes = paidIncomeRes.data;
    const expenses = paidExpenseRes.data;
    const pendingIncomes = pendingIncomeRes.data;
    const pendingExpenses = pendingExpenseRes.data;
    const budgets = budgetsRes.data;
    const approvedBudgets = budgets.filter((item) => item.status === 'approved');
    const openBudgets = budgets.filter((item) => item.status !== 'approved' && item.status !== 'cancelled');

    const salesTotal = sales.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const income = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expense = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pendingIncome = pendingIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pendingExpense = pendingExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const approvedBudgetTotal = approvedBudgets.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const openBudgetTotal = openBudgets.reduce((sum, item) => sum + Number(item.value || 0), 0);

    const dates = [...sales, ...incomes, ...expenses].map((item) => timestampToDate(item.createdAt)).filter(Boolean).sort((a, b) => a - b);
    const start = dates[0] || new Date();
    const end = dates[dates.length - 1] || new Date();
    const days = buildDays(start, end);
    const daily = days.map((day) => {
      const dayStart = new Date(day);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const daySales = sales.filter((item) => {
        const date = timestampToDate(item.createdAt);
        return date && date >= dayStart && date <= dayEnd;
      });
      const dayIncome = incomes.filter((item) => {
        const date = timestampToDate(item.createdAt);
        return date && date >= dayStart && date <= dayEnd;
      }).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const dayExpense = expenses.filter((item) => {
        const date = timestampToDate(item.createdAt);
        return date && date >= dayStart && date <= dayEnd;
      }).reduce((sum, item) => sum + Number(item.amount || 0), 0);

      return {
        date: day,
        label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        salesCount: daySales.length,
        salesTotal: daySales.reduce((sum, item) => sum + Number(item.total || 0), 0),
        income: dayIncome,
        expense: dayExpense,
        profit: dayIncome - dayExpense,
        incomeExpense: dayIncome + dayExpense,
      };
    });

    return {
      title: title.trim() || 'Relatório personalizado',
      start,
      end,
      charts,
      salesCount: sales.length,
      salesTotal,
      averageTicket: sales.length ? salesTotal / sales.length : 0,
      income,
      expense,
      profit: income - expense,
      pendingIncome,
      pendingExpense,
      budgetCount: budgets.length,
      approvedBudgetCount: approvedBudgets.length,
      approvedBudgetTotal,
      openBudgetTotal,
      daily,
    };
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateData();
      setPreview(data);
      const pdf = new jsPDF();
      const companyName = company?.name || 'Minha empresa';
      const margin = 18;
      const pageWidth = 210;
      const contentWidth = pageWidth - margin * 2;

      const footer = (page) => {
        pdf.setFontSize(8);
        pdf.setTextColor(130, 130, 130);
        pdf.text('Relatório gerado pelo AnglerERP.', margin, 287);
        pdf.text(`Página ${page}`, pageWidth - margin, 287, { align: 'right' });
      };

      const header = () => {
        pdf.setFillColor(31, 41, 55);
        pdf.rect(0, 0, pageWidth, 20, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(17);
        pdf.text(data.title, margin, 13);
        pdf.setTextColor(35, 35, 35);
        pdf.setFontSize(10);
        pdf.text(companyName, margin, 29);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Período: ${formatDate(data.start)} até ${formatDate(data.end)}`, margin, 36);
      };

      const metricValue = (key) => data[key];
      const drawMetric = (x, y, w, metric) => {
        pdf.setFillColor(245, 247, 250);
        pdf.roundedRect(x, y, w, 25, 3, 3, 'F');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 100, 100);
        pdf.text(metric.label, x + 4, y + 8);
        pdf.setFontSize(11);
        pdf.setTextColor(35, 35, 35);
        pdf.text(formatMetric(metric, metricValue(metric.key)), x + 4, y + 18);
      };

      header();
      let y = 46;
      const columns = Math.min(3, Math.max(1, selectedMetricObjects.length));
      const cardW = (contentWidth - (columns - 1) * 4) / columns;
      selectedMetricObjects.forEach((metric, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        drawMetric(margin + col * (cardW + 4), y + row * 30, cardW, metric);
      });
      y += Math.ceil(selectedMetricObjects.length / columns) * 30 + 10;

      const drawBars = (x, top, w, h, values, labels, titleText) => {
        const max = Math.max(...values.map(Number), 1);
        pdf.setFontSize(11);
        pdf.setTextColor(35, 35, 35);
        pdf.text(titleText, x, top);
        const chartTop = top + 7;
        const base = chartTop + h;
        pdf.setDrawColor(220, 220, 220);
        pdf.line(x, base, x + w, base);
        const gap = 3;
        const barW = Math.max(5, (w - gap * Math.max(values.length - 1, 0)) / Math.max(values.length, 1));
        values.forEach((value, index) => {
          const barH = (Number(value || 0) / max) * (h - 10);
          const bx = x + index * (barW + gap);
          pdf.setFillColor(59, 130, 246);
          pdf.roundedRect(bx, base - barH, barW, barH, 1, 1, 'F');
          if (values.length <= 16) {
            pdf.setFontSize(6.5);
            pdf.setTextColor(100, 100, 100);
            pdf.text(labels[index], bx + barW / 2, base + 8, { align: 'center' });
          }
        });
      };

      const drawLine = (x, top, w, h, values, labels, titleText) => {
        const numeric = values.map(Number);
        const max = Math.max(...numeric, 1);
        const min = Math.min(...numeric, 0);
        const range = Math.max(max - min, 1);
        const base = top + 7 + h;
        const chartTop = top + 7;
        pdf.setFontSize(11);
        pdf.setTextColor(35, 35, 35);
        pdf.text(titleText, x, top);
        const points = numeric.map((value, index) => ({
          x: x + (numeric.length <= 1 ? w / 2 : (index * w) / (numeric.length - 1)),
          y: base - ((value - min) / range) * (h - 10),
        }));
        pdf.setDrawColor(16, 185, 129);
        pdf.setLineWidth(1.1);
        for (let index = 1; index < points.length; index += 1) {
          pdf.line(points[index - 1].x, points[index - 1].y, points[index].x, points[index].y);
        }
        points.forEach((point, index) => {
          pdf.setFillColor(16, 185, 129);
          pdf.circle(point.x, point.y, 1.6, 'F');
          if (numeric.length <= 16) {
            pdf.setFontSize(6.5);
            pdf.setTextColor(100, 100, 100);
            pdf.text(labels[index], point.x, base + 8, { align: 'center' });
          }
        });
        pdf.setLineWidth(0.2);
        void chartTop;
      };

      const drawPie = (x, top, size, values, labels, titleText) => {
        pdf.setFontSize(11);
        pdf.setTextColor(35, 35, 35);
        pdf.text(titleText, x, top);
        const cx = x + size / 2;
        const cy = top + 40;
        const radius = 28;
        const total = values.reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
        if (!total) {
          pdf.setFontSize(9);
          pdf.setTextColor(120, 120, 120);
          pdf.text('Sem dados para o gráfico.', cx, cy, { align: 'center' });
          return;
        }
        const fills = [
          [59, 130, 246], [16, 185, 129], [245, 158, 11], [168, 85, 247],
          [236, 72, 153], [14, 165, 233], [239, 68, 68],
        ];
        let angle = -Math.PI / 2;
        values.forEach((value, index) => {
          const portion = Math.max(0, Number(value || 0)) / total;
          const next = angle + portion * Math.PI * 2;
          const points = [[cx, cy]];
          const steps = Math.max(2, Math.ceil(Math.abs(next - angle) * 12));
          for (let step = 0; step <= steps; step += 1) {
            const current = angle + (next - angle) * (step / steps);
            points.push([cx + Math.cos(current) * radius, cy + Math.sin(current) * radius]);
          }
          const flat = points.flat();
          const color = fills[index % fills.length];
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.lines(points.slice(1).map((point, pointIndex) => [
            point[0] - (pointIndex === 0 ? cx : points[pointIndex][0]),
            point[1] - (pointIndex === 0 ? cy : points[pointIndex][1]),
          ]), cx, cy, [1, 1], 'F', true);
          angle = next;
        });
        pdf.setFontSize(8);
        labels.forEach((label, index) => {
          const ly = top + 10 + index * 9;
          pdf.setFillColor(...fills[index % fills.length]);
          pdf.rect(x + size - 55, ly - 5, 4, 4, 'F');
          pdf.setTextColor(80, 80, 80);
          pdf.text(label, x + size - 49, ly - 1);
        });
      };



      if (y > 145) {
        pdf.addPage();
        header();
        y = 48;
      }

      charts.forEach((chart) => {
        if (y > 205) { pdf.addPage(); header(); y = 48; }
        const chartMetrics = chart.metrics.map((key) => METRICS.find((metric) => metric.key === key)).filter(Boolean);
        if (!chartMetrics.length) return;
        const values = chart.type === 'pie' ? chartMetrics.map((metric) => data.summary[metric.key]) : data.daily.map((day) => day[chartMetrics[0].key]);
        const labels = data.daily.map((day) => day.label);
        if (chart.type === 'pie') drawPie(margin, y, contentWidth, values, chartMetrics.map((metric) => metric.label), chart.title);
        else if (chart.type === 'line') drawLine(margin, y, contentWidth, 70, values, labels, chart.title);
        else drawBars(margin, y, contentWidth, 70, values, labels, chart.title);
        y += 88;
      });

      if (includeTable) {
        if (y > 235) {
          pdf.addPage();
          header();
          y = 48;
        }
        pdf.setFontSize(12);
        pdf.setTextColor(35, 35, 35);
        pdf.text('Detalhamento por dia', margin, y);
        y += 9;
        pdf.setFillColor(239, 246, 255);
        pdf.rect(margin, y - 6, contentWidth, 9, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(70, 80, 90);
        pdf.text('Dia', margin + 2, y);
        pdf.text('Vendas', margin + 34, y);
        pdf.text('Faturamento', margin + 62, y);
        pdf.text('Receitas', margin + 97, y);
        pdf.text('Despesas', margin + 127, y);
        pdf.text('Resultado', margin + 157, y);
        y += 9;
        data.daily.forEach((day) => {
          if (y > 275) {
            footer(2);
            pdf.addPage();
            header();
            y = 48;
          }
          pdf.setTextColor(70, 70, 70);
          pdf.text(day.label, margin + 2, y);
          pdf.text(String(day.salesCount), margin + 34, y);
          pdf.text(formatBRL(day.salesTotal), margin + 62, y);
          pdf.text(formatBRL(day.income), margin + 97, y);
          pdf.text(formatBRL(day.expense), margin + 127, y);
          pdf.text(formatBRL(day.profit), margin + 157, y);
          y += 8;
        });
      }

      footer(pdf.getNumberOfPages());
      pdf.save(`${data.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'relatorio-personalizado'}.pdf`);
      toast.success('Relatório personalizado gerado em PDF.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível gerar o relatório.');
    } finally {
      setGenerating(false);
    }
  };

  const previewRows = preview ? selectedMetricObjects.map((metric) => ({
    ...metric,
    value: preview[metric.key],
  })) : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary-400/10 text-primary-300"><SlidersHorizontal size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">Relatórios customizáveis</h1>
            <p className="text-dark-500 text-sm mt-1">Monte o relatório com as informações, indicadores e gráficos que você quiser e gere um PDF automaticamente.</p>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] gap-6">
        <div className="space-y-6">
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-dark-200">Identificação</h2></div>
            <div className="card-body">
              <label><span className="block text-sm font-medium text-dark-300 mb-2">Título do relatório</span><input className="input w-full" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center justify-between"><div><h2 className="text-sm font-semibold text-dark-200">Painel de gráficos</h2><p className="text-xs text-dark-500 mt-1">Adicione vários gráficos e combine várias informações em cada um.</p></div><button type="button" onClick={addChart} className="btn-secondary text-xs"><Plus size={15}/> Adicionar gráfico</button></div>
            <div className="card-body space-y-5">
              {charts.map((chart, index) => <div key={chart.id} className="rounded-2xl border border-dark-700/60 bg-dark-900/30 p-4 space-y-4">
                <div className="flex items-center gap-3"><span className="w-8 h-8 rounded-xl bg-primary-400/10 text-primary-300 flex items-center justify-center text-sm font-bold">{index + 1}</span><input className="input h-9 flex-1" value={chart.title} onChange={(event) => updateChart(chart.id, { title: event.target.value })}/><button type="button" onClick={() => removeChart(chart.id)} disabled={charts.length === 1} className="p-2 text-dark-500 hover:text-red-300 disabled:opacity-30"><Trash2 size={17}/></button></div>
                <div><div className="text-xs font-semibold uppercase tracking-wider text-dark-500 mb-2">Estilo</div><div className="grid grid-cols-3 gap-2">{CHARTS.map((type) => { const Icon=type.icon; return <button key={type.key} type="button" onClick={() => updateChart(chart.id,{type:type.key})} className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 text-xs ${chart.type===type.key?'border-primary-400/40 bg-primary-400/10 text-primary-200':'border-dark-700/60 text-dark-500'}`}><Icon size={19}/>{type.label}</button>; })}</div></div>
                <div><div className="text-xs font-semibold uppercase tracking-wider text-dark-500 mb-2">Informações do gráfico</div><div className="grid sm:grid-cols-2 gap-2">{METRICS.map((metric) => { const active=chart.metrics.includes(metric.key); return <button key={metric.key} type="button" onClick={() => toggleChartMetric(chart,metric.key)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${active?'border-primary-400/30 bg-primary-400/10 text-primary-200':'border-dark-700/50 text-dark-500'}`}><span className={`w-4 h-4 rounded border flex items-center justify-center ${active?'bg-primary-500 border-primary-500 text-white':'border-dark-600'}`}>{active&&<Check size={10}/>}</span>{metric.label}</button>; })}</div></div>
              </div>)}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-dark-200">3. Gráfico</h2></div>
            <div className="card-body space-y-5">
              <div>
                <div className="text-sm font-medium text-dark-300 mb-2">Estilo</div>
                <div className="grid grid-cols-3 gap-2">
                  {CHARTS.map((chart) => {
                    const Icon = chart.icon;
                    const active = chartType === chart.key;
                    return <button key={chart.key} type="button" onClick={() => setChartType(chart.key)} className={`rounded-xl border p-3 flex flex-col items-center gap-2 text-sm transition ${active ? 'border-primary-400/40 bg-primary-400/10 text-primary-200' : 'border-dark-700/60 text-dark-400 hover:text-dark-200'}`}><Icon size={20} /><span>{chart.label}</span></button>;
                  })}
                </div>
              </div>
              <label>
                <span className="block text-sm font-medium text-dark-300 mb-2">Informação exibida no gráfico</span>
                <div className="relative"><ChevronDown size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" /><select className="input w-full appearance-none" value={chartData} onChange={(event) => setChartData(event.target.value)}>{CHART_DATA.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
              </label>
              <button type="button" onClick={() => setIncludeTable((value) => !value)} className={`flex items-center gap-3 w-full rounded-xl border p-3 text-left ${includeTable ? 'border-primary-400/40 bg-primary-400/10' : 'border-dark-700/60'}`}>
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${includeTable ? 'bg-primary-500 border-primary-500 text-white' : 'border-dark-600'}`}>{includeTable && <Check size={13} />}</span>
                <Table2 size={17} className="text-dark-400" /><span className="text-sm text-dark-300">Incluir tabela de detalhamento diário</span>
              </button>
            </div>
          </div>

          <div className="card"> className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed">
            {generating ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <FileDown size={19} />}
            {generating ? 'Gerando PDF...' : 'Gerar relatório em PDF'}
          </div>
          <button type="button" onClick={handleGenerate} disabled={generating} className="btn-primary w-full justify-center py-3.5 disabled:opacity-50">
            {generating ? 'Gerando PDF...' : 'Gerar relatório em PDF'}
          </button>
        </div>

        <div className="card h-fit xl:sticky xl:top-6">
          <div className="card-header"><div className="flex items-center gap-2"><Sparkles size={17} className="text-primary-300" /><h2 className="text-sm font-semibold text-dark-200">Resumo da configuração</h2></div></div>
          <div className="card-body space-y-4">
            <div className="rounded-2xl bg-dark-900/60 border border-dark-700/50 p-4">
              <div className="flex items-center gap-2 text-xs text-dark-500"><FileText size={14} /> Documento</div>
              <div className="text-base font-semibold text-dark-100 mt-1">{title || 'Relatório personalizado'}</div>
              <div className="text-xs text-dark-500 mt-1">{charts.length} gráfico(s) configurado(s)</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-500 mb-2">Gráficos</div><div className="space-y-2">{charts.map((chart,index)=><div key={chart.id} className="text-sm text-dark-300">{index+1}. {chart.title} — {chart.metrics.length} informação(ões)</div>)}</div><div className="rounded-xl bg-primary-400/5 border border-primary-400/10 p-3 text-xs text-dark-400">
              O PDF é montado automaticamente com os dados disponíveis da empresa. O gráfico e a tabela acompanham as opções selecionadas.
            </div>
            {preview && <div className="flex items-center gap-2 text-xs text-emerald-300"><Check size={14} /> Dados calculados e prontos para exportação.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
