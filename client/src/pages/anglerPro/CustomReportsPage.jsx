import React, { useMemo, useState } from 'react';
import {
  BarChart3, Check, FileDown, FileText, LineChart, PieChart, Plus, SlidersHorizontal, Sparkles, Table2, Trash2,
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

function toLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
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

      const CHART_COLORS = [
        [59, 130, 246], [16, 185, 129], [245, 158, 11], [168, 85, 247],
        [236, 72, 153], [14, 165, 233], [239, 68, 68], [20, 184, 166],
      ];

      const drawLegend = (x, yLegend, metrics) => {
        let cursor = x;
        pdf.setFontSize(7);
        metrics.forEach((metric, index) => {
          const color = CHART_COLORS[index % CHART_COLORS.length];
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.rect(cursor, yLegend - 4, 4, 4, 'F');
          pdf.setTextColor(80, 80, 80);
          pdf.text(metric.label, cursor + 6, yLegend);
          cursor += 6 + pdf.getTextWidth(metric.label) + 10;
        });
      };

      const drawBars = (x, top, w, h, series, labels, titleText) => {
        const max = Math.max(...series.flatMap((item) => item.values.map(Number)), 1);
        pdf.setFontSize(11);
        pdf.setTextColor(35, 35, 35);
        pdf.text(titleText, x, top);
        const chartTop = top + 9;
        const base = chartTop + h;
        const groupW = w / Math.max(labels.length, 1);
        const barGap = 1.5;
        const barW = Math.max(2, Math.min(14, (groupW * 0.72) / Math.max(series.length, 1)));
        pdf.setDrawColor(220, 220, 220);
        pdf.line(x, base, x + w, base);
        labels.forEach((label, index) => {
          const totalW = barW * series.length + barGap * Math.max(series.length - 1, 0);
          const groupX = x + index * groupW + (groupW - totalW) / 2;
          series.forEach((item, seriesIndex) => {
            const value = Math.max(0, Number(item.values[index] || 0));
            const barH = (value / max) * (h - 12);
            const color = CHART_COLORS[seriesIndex % CHART_COLORS.length];
            pdf.setFillColor(color[0], color[1], color[2]);
            pdf.roundedRect(groupX + seriesIndex * (barW + barGap), base - barH, barW, barH, 0.8, 0.8, 'F');
          });
          if (labels.length <= 16) {
            pdf.setFontSize(6.5);
            pdf.setTextColor(100, 100, 100);
            pdf.text(label, x + index * groupW + groupW / 2, base + 8, { align: 'center' });
          }
        });
        drawLegend(x, base + 19, series.map((item) => item.metric));
      };

      const drawLines = (x, top, w, h, series, labels, titleText) => {
        const allValues = series.flatMap((item) => item.values.map(Number));
        const max = Math.max(...allValues, 1);
        const min = Math.min(...allValues, 0);
        const range = Math.max(max - min, 1);
        const base = top + 9 + h;
        pdf.setFontSize(11);
        pdf.setTextColor(35, 35, 35);
        pdf.text(titleText, x, top);
        series.forEach((item, seriesIndex) => {
          const color = CHART_COLORS[seriesIndex % CHART_COLORS.length];
          pdf.setDrawColor(color[0], color[1], color[2]);
          pdf.setFillColor(color[0], color[1], color[2]);
          const points = item.values.map((value, index) => ({
            x: x + (item.values.length <= 1 ? w / 2 : (index * w) / (item.values.length - 1)),
            y: base - ((Number(value || 0) - min) / range) * (h - 12),
          }));
          pdf.setLineWidth(1);
          for (let index = 1; index < points.length; index += 1) {
            pdf.line(points[index - 1].x, points[index - 1].y, points[index].x, points[index].y);
          }
          points.forEach((point) => pdf.circle(point.x, point.y, 1.4, 'F'));
        });
        if (labels.length <= 16) {
          labels.forEach((label, index) => {
            const px = x + (labels.length <= 1 ? w / 2 : (index * w) / (labels.length - 1));
            pdf.setFontSize(6.5);
            pdf.setTextColor(100, 100, 100);
            pdf.text(label, px, base + 8, { align: 'center' });
          });
        }
        pdf.setLineWidth(0.2);
        drawLegend(x, base + 19, series.map((item) => item.metric));
      };

      const drawPie = (x, top, size, values, labels, titleText) => {
        pdf.setFontSize(11);
        pdf.setTextColor(35, 35, 35);
        pdf.text(titleText, x, top);
        const cx = x + size / 2;
        const cy = top + 48;
        const radius = 28;
        const total = values.reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
        if (!total) {
          pdf.setFontSize(9);
          pdf.setTextColor(120, 120, 120);
          pdf.text('Sem dados para o gráfico.', cx, cy, { align: 'center' });
          return;
        }
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
          const color = CHART_COLORS[index % CHART_COLORS.length];
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.lines(points.slice(1).map((point, pointIndex) => [
            point[0] - (pointIndex === 0 ? cx : points[pointIndex][0]),
            point[1] - (pointIndex === 0 ? cy : points[pointIndex][1]),
          ]), cx, cy, [1, 1], 'F', true);
          angle = next;
        });
        pdf.setFontSize(8);
        labels.forEach((label, index) => {
          const ly = top + 18 + index * 9;
          const color = CHART_COLORS[index % CHART_COLORS.length];
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.rect(x + size - 65, ly - 5, 4, 4, 'F');
          pdf.setTextColor(80, 80, 80);
          pdf.text(label, x + size - 59, ly - 1);
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
        const labels = data.daily.map((day) => day.label);
        if (chart.type === 'pie') {
          drawPie(margin, y, contentWidth, chartMetrics.map((metric) => data[metric.key]), chartMetrics.map((metric) => metric.label), chart.title);
        } else {
          const series = chartMetrics.map((metric) => ({ metric, values: data.daily.map((day) => day[metric.key] || 0) }));
          if (chart.type === 'line') drawLines(margin, y, contentWidth, 70, series, labels, chart.title);
          else drawBars(margin, y, contentWidth, 70, series, labels, chart.title);
        }
        y += chart.type === 'pie' ? 88 : 98;
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
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-primary-400/10 text-primary-300"><SlidersHorizontal size={24} /></div>
        <div>
          <h1 className="text-2xl font-bold text-dark-100">Relatórios customizáveis</h1>
          <p className="text-dark-500 text-sm mt-1">Monte um painel no estilo Power BI com vários gráficos e indicadores.</p>
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
            <div className="card-header flex items-center justify-between">
              <div><h2 className="text-sm font-semibold text-dark-200">Painel de gráficos</h2><p className="text-xs text-dark-500 mt-1">Cada gráfico pode ter estilo e múltiplas informações independentes.</p></div>
              <button type="button" onClick={addChart} className="btn-secondary text-xs"><Plus size={15}/> Adicionar gráfico</button>
            </div>
            <div className="card-body space-y-5">
              {charts.map((chart, index) => (
                <div key={chart.id} className="rounded-2xl border border-dark-700/60 bg-dark-900/30 p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-primary-400/10 text-primary-300 flex items-center justify-center text-sm font-bold">{index + 1}</span>
                    <input className="input h-9 flex-1" value={chart.title} onChange={(event) => updateChart(chart.id, { title: event.target.value })} />
                    <button type="button" onClick={() => removeChart(chart.id)} disabled={charts.length === 1} className="p-2 text-dark-500 hover:text-red-300 disabled:opacity-30"><Trash2 size={17}/></button>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-dark-500 mb-2">Estilo</div>
                    <div className="grid grid-cols-3 gap-2">
                      {CHARTS.map((type) => {
                        const Icon = type.icon;
                        return <button key={type.key} type="button" onClick={() => updateChart(chart.id, { type: type.key })} className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 text-xs ${chart.type === type.key ? 'border-primary-400/40 bg-primary-400/10 text-primary-200' : 'border-dark-700/60 text-dark-500'}`}><Icon size={19}/>{type.label}</button>;
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2"><div className="text-xs font-semibold uppercase tracking-wider text-dark-500">Informações do gráfico</div><span className="text-xs text-primary-300">{chart.metrics.length} selecionada(s)</span></div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {METRICS.map((metric) => {
                        const active = chart.metrics.includes(metric.key);
                        return <button key={metric.key} type="button" onClick={() => toggleChartMetric(chart, metric.key)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${active ? 'border-primary-400/30 bg-primary-400/10 text-primary-200' : 'border-dark-700/50 text-dark-500'}`}><span className={`w-4 h-4 rounded border flex items-center justify-center ${active ? 'bg-primary-500 border-primary-500 text-white' : 'border-dark-600'}`}>{active && <Check size={10}/>}</span>{metric.label}</button>;
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setIncludeTable((value) => !value)} className={`card w-full text-left ${includeTable ? 'border-primary-400/20' : ''}`}>
            <div className="card-body flex items-center gap-3">
              <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${includeTable ? 'bg-primary-500 border-primary-500 text-white' : 'border-dark-600'}`}>{includeTable && <Check size={13}/>}</span>
              <Table2 size={17} className="text-dark-400"/>
              <div><div className="text-sm text-dark-200">Incluir detalhamento</div><div className="text-xs text-dark-500">Adiciona a tabela diária ao PDF.</div></div>
            </div>
          </button>

          <div className="card">
            <div className="card-header"><div className="flex items-center gap-2"><Sparkles size={17} className="text-primary-300"/><h2 className="text-sm font-semibold text-dark-200">Resumo da configuração</h2></div></div>
            <div className="card-body space-y-3">
              <div className="text-sm text-dark-200"><span className="text-dark-500">Relatório:</span> {title || 'Relatório personalizado'}</div>
              <div className="text-sm text-dark-200"><span className="text-dark-500">Gráficos:</span> {charts.length}</div>
              {charts.map((chart, index) => <div key={chart.id} className="rounded-xl border border-dark-700/50 p-3"><div className="text-sm text-dark-200">{index + 1}. {chart.title}</div><div className="text-xs text-dark-500 mt-1">{CHARTS.find((type) => type.key === chart.type)?.label} · {chart.metrics.length} informação(ões)</div><div className="flex flex-wrap gap-1.5 mt-2">{chart.metrics.map((key) => <span key={key} className="px-2 py-1 rounded-md bg-dark-800 text-[11px] text-dark-400">{METRICS.find((metric) => metric.key === key)?.label}</span>)}</div></div>)}
              <div className="rounded-xl bg-primary-400/5 border border-primary-400/10 p-3 text-xs text-dark-400">O PDF será montado automaticamente com os dados disponíveis da empresa e a configuração acima.</div>
            </div>
          </div>

          <button type="button" onClick={handleGenerate} disabled={generating} className="btn-primary w-full justify-center py-3.5 disabled:opacity-50 disabled:cursor-not-allowed">
            {generating ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <FileDown size={19}/>}
            {generating ? 'Gerando PDF...' : 'Gerar relatório em PDF'}
          </button>
        </div>

        <div className="card h-fit xl:sticky xl:top-6">
          <div className="card-header"><div className="flex items-center gap-2"><Sparkles size={17} className="text-primary-300"/><h2 className="text-sm font-semibold text-dark-200">Visão do painel</h2></div></div>
          <div className="card-body">
            <div className="rounded-2xl bg-dark-900/60 border border-dark-700/50 p-4 space-y-3">
              <div className="text-xs text-dark-500 mb-2">Estrutura do PDF</div>
              <div className="text-sm text-dark-300">Capa + resumo dos indicadores</div>
              {charts.map((chart, index) => <div key={chart.id} className="flex items-center gap-3"><span className="w-8 h-8 rounded-lg bg-dark-800 text-dark-400 flex items-center justify-center">{chart.type === 'line' ? <LineChart size={15}/> : chart.type === 'pie' ? <PieChart size={15}/> : <BarChart3 size={15}/>}</span><div><div className="text-sm text-dark-300">Gráfico {index + 1}</div><div className="text-xs text-dark-500">{chart.metrics.length} informação(ões)</div></div></div>)}
              {includeTable && <div className="text-sm text-dark-300">+ tabela de detalhamento</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
