import React, { useEffect, useMemo, useState } from 'react';
import { Download, DollarSign } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { findProfileGroup } from '../../data/budgetProfiles';
import Modal from '../../components/ui/Modal';
import { formatBRL } from '../../utils/format';
import { useAuth } from '../../context/useAuth';
import { logAudit } from '../../services/firebase/settings';

const DEFAULT_FORM = { profileSlug: '', height: 30, width: 25, length: 10, accordionWidth: 0, quantity: 100, materialWidth: 150, waste: 10, accessoryType: 'cord', handleQuantity: 2, cordQuantity: 1 };
const DEFAULT_BUDGET = { materialCostPerMeter: 0, accessoryCostPerMeter: 0, laborCostPerUnit: 0, unitPrice: 0 };

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value);
}

function calculateCut(materialWidth, pieceWidth, pieceLength, quantity, allowRotation = true) {
  const options = [
    { width: pieceWidth, length: pieceLength },
    { width: pieceLength, length: pieceWidth },
  ].filter((option, index) => option.width > 0 && option.length > 0 && option.width <= materialWidth && (allowRotation || index === 0));
  if (options.length === 0) return { length: 0, piecesPerRow: 0, leftover: materialWidth };

  return options.reduce((best, option) => {
    const piecesPerRow = Math.max(1, Math.floor(materialWidth / option.width));
    const rows = Math.ceil(quantity / piecesPerRow);
    const piecesInLastRow = quantity % piecesPerRow || piecesPerRow;
    const candidate = {
      length: rows * option.length,
      piecesPerRow,
      leftover: materialWidth - (piecesInLastRow * option.width),
      rowLeftover: materialWidth - (piecesPerRow * option.width),
      pieceWidth: option.width,
      pieceLength: option.length,
    };
    return !best || candidate.length < best.length ? candidate : best;
  }, null);
}

// Acomodação física: cada eixo é arredondado para baixo antes de multiplicar.
// Frações e rotações não formam uma nova peça ou fileira válida.
function calculateTablePlan(materialWidth, pieceWidth, pieceHeight, accordionWidth = 0) {
  const usableLength = 262; // 300 cm da mesa, menos 19 cm de cada lateral
  const usableWidth = Math.min(Math.max(0, Number(materialWidth) || 0), 150);
  const mainWidth = Number(pieceWidth) || 0;
  const mainHeight = Number(pieceHeight) || 0;
  const accordion = Math.max(0, Number(accordionWidth) || 0);
  const hasAccordion = accordion > 0;

  // Uma mochila é um conjunto físico: 1 corpo + 2 sanfonas.
  // As duas sanfonas têm a mesma altura do corpo e ocupam a largura
  // de ajuste informada. Para manter o par associado à mochila no
  // plano, as três peças são tratadas como uma única unidade de corte.
  const orientations = [
    { pieceWidth: mainWidth, pieceHeight: mainHeight, rotated: false },
    ...(hasAccordion ? [] : [{ pieceWidth: mainHeight, pieceHeight: mainWidth, rotated: true }]),
  ].filter((option, index, list) =>
    option.pieceWidth > 0 &&
    option.pieceHeight > 0 &&
    option.pieceWidth + (2 * accordion) <= usableLength &&
    option.pieceHeight <= usableWidth &&
    (index === 0 || option.pieceWidth !== list[0].pieceWidth || option.pieceHeight !== list[0].pieceHeight)
  );

  const plans = orientations.map((option) => {
    const groupLength = option.pieceWidth + (2 * accordion);
    const piecesPerRow = Math.floor(usableLength / groupLength);
    const totalRows = Math.floor(usableWidth / option.pieceHeight);
    const capacity = piecesPerRow * totalRows;

    return {
      width: usableWidth,
      usableLength,
      piecesPerRow,
      wholePiecesPerRow: piecesPerRow,
      rows: totalRows,
      verticalRows: totalRows,
      rowLayouts: Array.from({ length: totalRows }, () => ({ piecesPerRow, rotated: option.rotated })),
      capacity,
      lengthLeftover: usableLength - (piecesPerRow * groupLength),
      widthLeftover: usableWidth - (totalRows * option.pieceHeight),
      pieceWidth: option.pieceWidth,
      pieceHeight: option.pieceHeight,
      groupLength,
      groupHeight: option.pieceHeight,
      accordionWidth: accordion,
      accordionCountPerUnit: hasAccordion ? 2 : 0,
      rotated: option.rotated,
      mainRows: totalRows,
      totalOccupiedRows: totalRows,
    };
  });

  return plans.reduce((best, plan) => {
    if (!best) return plan;
    if (plan.capacity !== best.capacity) return plan.capacity > best.capacity ? plan : best;
    const planWaste = plan.lengthLeftover + plan.widthLeftover;
    const bestWaste = best.lengthLeftover + best.widthLeftover;
    return planWaste < bestWaste ? plan : best;
  }, null) || {
    width: usableWidth,
    usableLength,
    piecesPerRow: 0,
    wholePiecesPerRow: 0,
    rows: 0,
    verticalRows: 0,
    rowLayouts: [],
    capacity: 0,
    lengthLeftover: usableLength,
    widthLeftover: usableWidth,
    pieceWidth: mainWidth,
    pieceHeight: mainHeight,
    groupLength: mainWidth + (2 * accordion),
    groupHeight: mainHeight,
    accordionWidth: accordion,
    accordionCountPerUnit: hasAccordion ? 2 : 0,
    rotated: false,
    mainRows: 0,
    totalOccupiedRows: 0,
  };
}

const MATERIAL_PREVIEW = {
  backpack: { label: 'Material da mochila', tone: 'bg-amber-400', softTone: 'bg-amber-400/10', border: 'border-amber-400/40' },
  drawstring: { label: 'Nylon / TNT', tone: 'bg-amber-400', softTone: 'bg-amber-400/10', border: 'border-amber-400/40' },
  bag: { label: 'Tecido ecológico', tone: 'bg-emerald-400', softTone: 'bg-emerald-400/10', border: 'border-emerald-400/40' },
  paper: { label: 'Papel', tone: 'bg-sky-400', softTone: 'bg-sky-400/10', border: 'border-sky-400/40' },
  plastic: { label: 'Plástico', tone: 'bg-fuchsia-400', softTone: 'bg-fuchsia-400/10', border: 'border-fuchsia-400/40' },
};

function PhysicalCalculationPreview({ profile, result, onDownload }) {
  const material = MATERIAL_PREVIEW[profile?.kind] || MATERIAL_PREVIEW.bag;
  const [previewUrls, setPreviewUrls] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const plans = result.cutPlans || [];

  useEffect(() => {
    if (!result.quantityValid || !result.materialHeightValid || !plans.length) {
      setPreviewUrls([]);
      return undefined;
    }

    const urls = plans.map((plan, planIndex) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 760;
      const context = canvas.getContext('2d');
      const table = { x: 70, y: 110, width: 1060, height: 500 };
      const scaleX = table.width / 300;
      const scaleY = table.height / 159;
      const cutX = table.x + (19 * scaleX);
      const cutY = table.y + ((159 - plan.width) * scaleY);
      const cutWidth = 262 * scaleX;
      const cutHeight = plan.width * scaleY;
      const pieceWidth = result.productWidth * scaleX;
      const pieceHeight = result.productHeight * scaleY;
      const piecesBefore = plans.slice(0, planIndex).reduce((sum, item) => sum + item.capacity, 0);
      const piecesThisPlan = Math.min(Math.max(0, result.quantity - piecesBefore), plan.capacity);

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#111827';
      context.font = '700 22px Arial';
      context.fillText(`PLANO DE CORTE ${planIndex + 1} — ${formatNumber(piecesThisPlan, 0)} unidade(s)`, 48, 42);
      context.font = '500 14px Arial';
      context.fillStyle = '#374151';
      context.fillText(`Mesa: 300 × 159 cm | área útil: 262 × ${formatNumber(plan.width, 0)} cm | material: ${material.label}`, 48, 68);

      context.fillStyle = '#e5e7eb';
      context.fillRect(table.x, table.y, table.width, table.height);
      context.strokeStyle = '#111827';
      context.lineWidth = 3;
      context.strokeRect(table.x, table.y, table.width, table.height);
      context.fillStyle = 'rgba(107, 114, 128, 0.42)';
      context.fillRect(table.x, table.y, 19 * scaleX, table.height);
      context.fillRect(table.x + table.width - (19 * scaleX), table.y, 19 * scaleX, table.height);
      context.fillStyle = '#f8fafc';
      context.fillRect(cutX, cutY, cutWidth, cutHeight);

      for (let index = 0; index < piecesThisPlan; index += 1) {
        const row = Math.floor(index / plan.piecesPerRow);
        const column = index % plan.piecesPerRow;
        const x = cutX + (column * pieceWidth);
        const y = cutY + (row * pieceHeight);
        context.fillStyle = '#8fd4f6';
        context.fillRect(x, y, pieceWidth, pieceHeight);
        context.strokeStyle = '#27506a';
        context.lineWidth = 1.5;
        context.strokeRect(x, y, pieceWidth, pieceHeight);
        drawResponsivePieceLabel(context, x, y, pieceWidth, pieceHeight, `${formatNumber(result.productWidth, 0)} × ${formatNumber(result.productHeight, 0)} cm`, '#143b52');
      }

      context.fillStyle = '#111827';
      context.font = '700 14px Arial';
      context.fillText('300 cm', table.x + (table.width / 2) - 24, table.y - 18);
      context.save();
      context.translate(table.x - 28, table.y + (table.height / 2));
      context.rotate(-Math.PI / 2);
      context.fillText('159 cm', -26, 0);
      context.restore();
      context.font = '600 13px Arial';
      context.fillText(`Por fileira: ⌊262 ÷ ${formatNumber(result.productWidth, 0)}⌋ = ${plan.piecesPerRow}`, 70, 655);
      context.fillText(`Por coluna: ⌊${formatNumber(plan.width, 0)} ÷ ${formatNumber(result.productHeight, 0)}⌋ = ${plan.rows}`, 70, 680);
      context.fillText(`Capacidade: ${plan.piecesPerRow} × ${plan.rows} = ${plan.capacity} | sobras: ${formatNumber(plan.lengthLeftover, 0)} cm no comprimento e ${formatNumber(plan.widthLeftover, 0)} cm na largura`, 70, 705);

      return canvas.toDataURL('image/png');
    });

    setPreviewUrls(urls);
    return undefined;
  }, [material.label, plans, result]);

  const handleDownload = async () => {
    const previewUrls = [previewUrl, ...secondaryPreviewUrls].filter(Boolean);
    if (!previewUrls.length || downloading) return;
    setDownloading(true);
    try {
      await onDownload();

      const plans = result.plansToCut || result.cutPlans || [];
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2);
      const files = [];

      const addSection = (title, lines, fillColor) => {
        const lineHeight = 4.5;
        const padding = 4;
        const titleHeight = 7;
        const wrappedLines = lines.flatMap((line) => pdf.splitTextToSize(String(line), contentWidth - padding * 2));
        const sectionHeight = padding + titleHeight + wrappedLines.length * lineHeight + padding;

        if (reportY + sectionHeight > pageHeight - 14) {
          pdf.addPage();
          reportY = 14;
        }

        pdf.setFillColor(...fillColor);
        pdf.setDrawColor(210, 214, 220);
        pdf.roundedRect(margin, reportY, contentWidth, sectionHeight, 2, 2, 'FD');
        pdf.setTextColor(17, 24, 39);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(title, margin + padding, reportY + padding + 3.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        let lineY = reportY + padding + titleHeight;
        wrappedLines.forEach((line) => {
          pdf.text(line, margin + padding, lineY);
          lineY += lineHeight;
        });
        reportY += sectionHeight + 5;
      };

      previewUrls.forEach((url, index) => {
        const plan = plans[index] || result.tablePlan || {};
        const piecesBefore = plans.slice(0, index).reduce((sum, item) => sum + (Number(item.capacity) || 0), 0);
        const planQuantity = Math.min(Number(plan.capacity) || 0, Math.max(0, (Number(result.quantity) || 0) - piecesBefore));
        const pieceWidth = Number(plan.pieceWidth) || Number(result.productWidth) || 0;
        const pieceHeight = Number(plan.pieceHeight) || Number(result.productHeight) || 0;
        const rows = Number(plan.rows) || Number(plan.verticalRows) || 0;
        const piecesPerRow = Number(plan.piecesPerRow) || Number(plan.wholePiecesPerRow) || 0;
        const lengthLeftover = Number(plan.lengthLeftover) || 0;
        const widthLeftover = Number(plan.widthLeftover) || 0;
        const capacity = Number(plan.capacity) || 0;
        const emptyPositions = Number(plan.emptyPositions) || Math.max(0, capacity - planQuantity);
        const hasAccordionReport = Boolean(Number(result.accordionWidth) > 0 && Number(result.accordionCountPerUnit || 2) > 0);
        const accordionCount = Number(result.accordionCountPerUnit) || 2;
        const accordionAreaPerUnit = hasAccordionReport
          ? Number(result.accordionWidth || 0) * Number(result.originalProductHeight || pieceHeight || 0) * accordionCount
          : 0;
        const pieceArea = pieceWidth * pieceHeight;
        const totalPlanArea = (Number(plan.usableLength) || 262) * (Number(plan.width) || Number(result.materialWidth) || 0);
        const completeUnitArea = pieceArea + accordionAreaPerUnit;
        const emptyArea = emptyPositions * completeUnitArea;
        const residualEdgeArea = Math.max(0, totalPlanArea - (capacity * completeUnitArea));
        const placedAreaLeftover = Math.max(0, totalPlanArea - (planQuantity * completeUnitArea));
        const usedLengthCm = Math.min(
          Number(plan.usableLength) || 262,
          (Number(plan.wholePiecesPerRow) || piecesPerRow) *
            (Number(plan.groupLength) || (pieceWidth + (Number(result.accordionWidth) || 0) * 2))
        );
        const usedWidthCm = Math.min(Number(plan.width) || 0, rows * pieceHeight);
        const lengthUtilization = (Number(plan.usableLength) || 262) > 0
          ? (usedLengthCm / (Number(plan.usableLength) || 262)) * 100
          : 0;
        const widthUtilization = (Number(plan.width) || 0) > 0
          ? (usedWidthCm / (Number(plan.width) || 0)) * 100
          : 0;
        const lengthLeftoverForTip = Math.max(0, Number(plan?.lengthLeftover) || 0);
        const widthLeftoverForTip = Math.max(0, Number(plan?.widthLeftover) || 0);
        const utilization = widthLeftoverForTip <= lengthLeftoverForTip ? widthUtilization : lengthUtilization;
        const utilizationAxis = widthLeftoverForTip <= lengthLeftoverForTip ? 'largura' : 'comprimento';

        const accessoryLines = result.accessoryType === 'handle'
          ? [
              `Alça: ${formatNumber((Number(result.handleLength) || 0) / Math.max(1, Number(result.handleQuantity) || 0), 1)} cm por alça`,
              `Quantidade de alças: ${formatNumber(result.handleQuantity || 0, 0)} por mochila`,
              `Total de alças no plano: ${formatNumber((Number(result.handleQuantity) || 0) * planQuantity, 0)} unidade(s)`,
              `Comprimento total de alça: ${formatNumber((Number(result.handleLength) || 0) * planQuantity, 1)} cm`,
            ]
          : [
              `Cordão: ${formatNumber((Number(result.cordLength) || 0) / Math.max(1, Number(result.cordQuantity) || 0), 1)} cm por cordão`,
              `Quantidade de cordões: ${formatNumber(result.cordQuantity || 0, 0)} por mochila`,
              `Total de cordões no plano: ${formatNumber((Number(result.cordQuantity) || 0) * planQuantity, 0)} unidade(s)`,
              `Comprimento total de cordão: ${formatNumber((Number(result.cordLength) || 0) * planQuantity, 1)} cm`,
            ];

        const tipsReport = [
          `Corte as ${formatNumber(planQuantity, 0)} peças principais primeiro.`,
          ...(hasAccordionReport ? [`Depois corte as ${formatNumber(planQuantity * accordionCount, 0)} sanfonas.`] : []),
          'Use régua longa e cortador circular ou faca bem afiada.',
          'Mantenha as folhas bem alinhadas e use pregos/grampos.',
          `Esse plano gera ${formatNumber(planQuantity, 0)} peças (${formatNumber(emptyPositions, 0)} de sobra).`,
          `Aproveitamento de praticamente ${formatNumber(utilization, 0)}% da ${utilizationAxis}.`,
        ];

        if (index > 0) pdf.addPage();
        pdf.setTextColor(17, 24, 39);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(17);
        pdf.text(`Plano de corte ${index + 1}`, margin, 17);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`Perfil: ${profile?.name || 'Medição'} | Material: ${material.label}`, margin, 23);
        pdf.setFontSize(8);
        pdf.text(`Plano ${index + 1} de ${previewUrls.length} | ${formatNumber(planQuantity, 0)} unidade(s) neste corte`, margin, 28);

        let reportY = 35;

        addSection('APROVEITAMENTO — PLANO INDIVIDUAL', [
          `Grade máxima: ${formatNumber(plan?.wholePiecesPerRow || 0, 0)} × ${formatNumber(plan?.verticalRows || 0, 0)} = ${formatNumber(capacity, 0)} mochilas`,
          `Cada mochila: 1 corpo + ${formatNumber(accordionCount, 0)} sanfonas${hasAccordionReport ? ` de ${formatNumber(result.accordionWidth, 1)} cm × ${formatNumber(result.originalProductHeight || pieceHeight, 1)} cm` : ''}`,
          `Acomodadas neste plano: ${formatNumber(planQuantity, 0)} mochila(s)`,
          `Espaço vago útil: ${formatNumber(emptyPositions, 0)} posição(ões) (${formatNumber(emptyArea, 0)} cm²)`,
          `Faixa residual: ${formatNumber(lengthLeftover, 0)} cm no comprimento`,
          `Área residual das bordas: ${formatNumber(residualEdgeArea, 0)} cm²`,
          ...(hasAccordionReport ? [
            `Sanfonas: ${formatNumber(accordionCount, 0)} por mochila × ${formatNumber(result.accordionWidth, 1)} cm × ${formatNumber(result.originalProductHeight || pieceHeight, 1)} cm`,
            `Área das sanfonas: ${formatNumber(accordionAreaPerUnit, 0)} cm² por mochila`,
            `Área total das sanfonas: ${formatNumber(accordionAreaPerUnit * planQuantity, 0)} cm²`,
          ] : []),
          `Área total de sobra: ${formatNumber(placedAreaLeftover, 0)} cm²`,
        ], [223, 234, 245]);

        addSection('CONSUMO E ACESSÓRIO — PLANO', [
          `Comprimento do plano: ${formatNumber((Number(plan.usableLength) || 262), 0)} cm`,
          `Comprimento em metros lineares: ${formatNumber((Number(plan.usableLength) || 262) / 100, 2)} m`,
          `Largura do material: ${formatNumber(plan?.width || result.materialWidth || 0, 0)} cm`,
          `Quantidade neste plano: ${formatNumber(planQuantity, 0)} unidade(s)`,
          ...(hasAccordionReport ? [
            `Sanfonas: ${formatNumber(accordionCount, 0)} por mochila × ${formatNumber(result.accordionWidth, 1)} cm`,
            `Consumo das sanfonas: ${formatNumber(accordionAreaPerUnit * planQuantity / 10000, 2)} m²`,
            `Área total das sanfonas: ${formatNumber(accordionAreaPerUnit * planQuantity, 0)} cm²`,
          ] : []),
          ...accessoryLines,
        ], [245, 223, 232]);

        addSection('DICAS — PLANO', tipsReport, [223, 242, 223]);

        addSection('ESPECIFICAÇÕES', [
          `Quantidade neste corte: ${formatNumber(planQuantity, 0)} unidade(s)`,
          `Capacidade física: ${formatNumber(capacity, 0)} unidade(s)`,
          `Peça posicionada: ${formatNumber(pieceWidth, 0)} × ${formatNumber(pieceHeight, 0)} cm`,
          `Orientação: ${plan.rotated ? 'Rotacionada em 90°' : 'Original'}`,
          `Por fileira: ${formatNumber(piecesPerRow, 0)} unidade(s)`,
          `Fileiras: ${formatNumber(rows, 0)}`,
          `Área útil: 262 × ${formatNumber(plan.width || 0, 0)} cm`,
          `Material informado: ${formatNumber(result.materialWidth || 0, 0)} cm`,
          `Sobra no comprimento: ${formatNumber(lengthLeftover, 0)} cm`,
          `Sobra na largura: ${formatNumber(widthLeftover, 0)} cm`,
        ], [245, 247, 250]);

        pdf.setFontSize(7);
        pdf.setTextColor(90, 90, 90);
        pdf.text('Mesa física: 300 × 159 cm | laterais sem corte: 19 cm de cada lado | área útil: 262 × até 150 cm', margin, pageHeight - 7);

        files.push({
          name: `cortes/plano-${String(index + 1).padStart(2, '0')}.png`,
          data: dataUrlToUint8Array(url),
        });
      });

      files.push({
        name: 'relatorio/relatorio-de-cortes.pdf',
        data: new Uint8Array(pdf.output('arraybuffer')),
      });

      const zipBlob = createZipBlob(files);
      downloadBlob(zipBlob, `plano-de-corte-${profile?.slug || 'medicao'}.zip`);
    } catch (error) {
      console.error('Erro ao gerar pacote de corte:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card border-dark-700">
      <div className="card-header flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-dark-200">Preview do plano de corte</h2><p className="mt-1 text-xs text-dark-500">Cada faixa de até 150 cm de material gera um plano separado. A faixa restante só aparece se comportar pelo menos uma mochila.</p></div><span className={`rounded-full border px-3 py-1 text-xs font-medium ${material.border} ${material.softTone}`}>{material.label}</span></div>
      <div className="card-body space-y-4">
        {previewUrls.length ? previewUrls.map((previewUrl, index) => <img key={previewUrl} src={previewUrl} alt={`Plano de corte ${index + 1} de ${profile?.name}`} className="w-full rounded-xl border border-dark-700 bg-dark-900" />) : <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">{message}</div>}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-dark-400"><span><strong className="text-dark-200">{formatNumber(result.plansNeeded, 0)}</strong> plano(s) para a quantidade solicitada</span><span><strong className="text-dark-200">{formatNumber(result.totalCapacity || 0, 0)}</strong> unidade(s) de capacidade no material</span></div>
        <div className="flex justify-end"><button type="button" onClick={handleDownload} disabled={!previewUrls.length || downloading} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"><Download size={16} /> {downloading ? 'Gerando ZIP...' : 'Baixar ZIP'}</button></div>
      </div>
    </div>
  );
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeZipUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeZipUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;

  files.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const content = data instanceof Uint8Array ? data : new Uint8Array(data);
    const crc = crc32(content);
    const localHeader = new ArrayBuffer(30 + nameBytes.length);
    const localView = new DataView(localHeader);
    writeZipUint32(localView, 0, 0x04034b50);
    writeZipUint16(localView, 4, 20);
    writeZipUint16(localView, 6, 0x0800);
    writeZipUint16(localView, 8, 0);
    writeZipUint16(localView, 10, 0);
    writeZipUint16(localView, 12, 0);
    writeZipUint32(localView, 14, crc);
    writeZipUint32(localView, 18, content.length);
    writeZipUint32(localView, 22, content.length);
    writeZipUint16(localView, 26, nameBytes.length);
    writeZipUint16(localView, 28, 0);
    new Uint8Array(localHeader, 30).set(nameBytes);

    chunks.push(new Uint8Array(localHeader), content);

    const centralHeader = new ArrayBuffer(46 + nameBytes.length);
    const centralView = new DataView(centralHeader);
    writeZipUint32(centralView, 0, 0x02014b50);
    writeZipUint16(centralView, 4, 20);
    writeZipUint16(centralView, 6, 20);
    writeZipUint16(centralView, 8, 0x0800);
    writeZipUint16(centralView, 10, 0);
    writeZipUint16(centralView, 12, 0);
    writeZipUint16(centralView, 14, 0);
    writeZipUint32(centralView, 16, crc);
    writeZipUint32(centralView, 20, content.length);
    writeZipUint32(centralView, 24, content.length);
    writeZipUint16(centralView, 28, nameBytes.length);
    writeZipUint16(centralView, 30, 0);
    writeZipUint16(centralView, 32, 0);
    writeZipUint16(centralView, 34, 0);
    writeZipUint16(centralView, 36, 0);
    writeZipUint32(centralView, 38, 0);
    writeZipUint32(centralView, 42, offset);
    new Uint8Array(centralHeader, 46).set(nameBytes);
    centralDirectory.push(new Uint8Array(centralHeader));

    offset += localHeader.byteLength + content.length;
  });

  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0);
  const endRecord = new ArrayBuffer(22);
  const endView = new DataView(endRecord);
  writeZipUint32(endView, 0, 0x06054b50);
  writeZipUint16(endView, 4, 0);
  writeZipUint16(endView, 6, 0);
  writeZipUint16(endView, 8, files.length);
  writeZipUint16(endView, 10, files.length);
  writeZipUint32(endView, 12, centralSize);
  writeZipUint32(endView, 16, offset);
  writeZipUint16(endView, 20, 0);

  return new Blob([...chunks, ...centralDirectory, new Uint8Array(endRecord)], { type: 'application/zip' });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CutPreview({ profile, result, onDownload }) {
  const material = MATERIAL_PREVIEW[profile?.kind] || MATERIAL_PREVIEW.bag;
  const [previewUrl, setPreviewUrl] = useState('');
  const [secondaryPreviewUrls, setSecondaryPreviewUrls] = useState([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 760;
    const context = canvas.getContext('2d');
    const colors = {
      backpack: { fill: '#8fd4f6', dark: '#143b52' },
      drawstring: { fill: '#8fd4f6', dark: '#143b52' },
      bag: { fill: '#8fd4f6', dark: '#143b52' },
      paper: { fill: '#8fd4f6', dark: '#143b52' },
      plastic: { fill: '#8fd4f6', dark: '#143b52' },
    };
    const color = colors[profile?.kind] || colors.bag;
    const quantity = Number(result.quantity) || 100;
    const materialWidth = Number(result.materialWidth) || 140;

    // Resolva o plano antes de qualquer leitura de previewPlan.
    const fallbackPlan = result.tablePlan && Number(result.tablePlan.capacity) > 0 ? result.tablePlan : null;
    const previewPlan = fallbackPlan || result.cutPlans?.find((plan) => Number(plan?.capacity) > 0) || null;
    const hasPhysicalPlan = Boolean(previewPlan);
    const physicalCapacity = Number(result.totalCapacity) > 0
      ? Number(result.totalCapacity)
      : Number(previewPlan?.capacity) || 0;
    const quantityWithinCapacity = Number(result.quantity) > 0 && Number(result.quantity) <= physicalCapacity;

    if (!result.quantityValid || !result.materialHeightValid || !hasPhysicalPlan || !quantityWithinCapacity) {
      setPreviewUrl('');
      setSecondaryPreviewUrls([]);
      return undefined;
    }

    const mainPieceWidth = Number(previewPlan?.pieceWidth) || Number(result.mainCut?.pieceWidth) || 50;
    const mainPieceHeight = Number(previewPlan?.pieceHeight) || Number(result.mainCut.pieceLength) || 90;
    const accordionWidth = Number(result.accordionWidth) || 0;
    const hasAccordion = profile?.kind === 'backpack' && accordionWidth > 0;
    const sidePieceWidth = Number(result.sideCut.pieceWidth) || 10;
    const sidePieceHeight = Number(result.sideCut.pieceLength) || 90;

    setSecondaryPreviewUrls([]);


    const loadTableImage = () => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/mesa.png';
    });

    const drawCardText = (x, y, width, height, title, lines, fill, titleSize = 11, bodySize = 10) => {
      context.fillStyle = fill;
      context.fillRect(x, y, width, height);
      context.strokeStyle = '#111827';
      context.lineWidth = 2;
      context.strokeRect(x, y, width, height);
      context.fillStyle = '#111827';
      context.font = `700 ${titleSize}px Arial`;
      context.fillText(title, x + 12, y + 20);
      context.font = `400 ${bodySize}px Arial`;
      lines.forEach((line, index) => {
        const lineY = y + 38 + (index * 15);
        context.fillText(line, x + 12, lineY);
      });
    };

    const drawDimensionArrow = (startX, startY, endX, endY, label) => {
      context.strokeStyle = '#111827';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      context.stroke();
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(startX - 5, startY - 7);
      context.moveTo(startX, startY);
      context.lineTo(startX + 5, startY - 7);
      context.moveTo(endX, endY);
      context.lineTo(endX - 5, endY + 7);
      context.moveTo(endX, endY);
      context.lineTo(endX + 5, endY + 7);
      context.stroke();
      context.fillStyle = '#111827';
      context.font = '700 13px Arial';
      const labelWidth = context.measureText(label).width;
      context.fillText(label, ((startX + endX) / 2) - (labelWidth / 2), startY - 10);
    };

    const drawVerticalText = (x, y, text, lines = 2) => {
      context.fillStyle = '#111827';
      context.font = '700 11px Arial';
      const words = text.split(' ');
      if (lines === 2) {
        const mid = Math.ceil(words.length / 2);
        context.fillText(words.slice(0, mid).join(' '), x, y);
        context.fillText(words.slice(mid).join(' '), x, y + 14);
      } else {
        context.fillText(text, x, y);
      }
    };

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 1200, 760);

    const panelX = 0;
    const panelY = 0;
    const panelWidth = 1200;
    const panelHeight = 760;

    context.fillStyle = '#111827';
    context.font = '700 18px Arial';
    const firstPlan = result.cutPlans?.[0];
    const previewQuantity = Math.min(quantity, firstPlan?.capacity || 0);
    context.fillText(`PLANO DE CORTE 1 - ${formatNumber(previewQuantity, 0)} SACOLAS (LARGURA: ${formatNumber(firstPlan?.width || materialWidth, 0)} cm)`, panelX + 18, panelY + 28);
    if (firstPlan?.rotated) {
      context.font = '700 10px Arial';
      context.fillStyle = '#0f766e';
      context.fillText('ORIENTAÇÃO ROTACIONADA — melhor aproveitamento da mesa', panelX + 18, panelY + 60);
    }
    context.font = '600 11px Arial';
    context.fillText(`Peça principal: ${formatNumber(mainPieceWidth, 0)} x ${formatNumber(mainPieceHeight, 0)} cm (${formatNumber(previewQuantity, 0)} un)`, panelX + 18, panelY + 46);

    const wasteBlockOffset = 74 + 10;
    const pieceSpacingOffset = 14;
    const stripX = 130 + wasteBlockOffset + pieceSpacingOffset;
    const stripY = 90;
    const stripWidth = 940;
    const stripHeight = 150;
    const sweep = stripWidth / 7;

    const tableLeft = 40;
    const tableTop = 0;
    const tableRight = 1160;
    const tableBottom = 590;

    loadTableImage().then((tableImage) => {
      if (tableImage) {
        const tableWidth = tableRight - tableLeft;
        const tableHeight = tableBottom - tableTop;
        context.drawImage(tableImage, tableLeft, tableTop, tableWidth, tableHeight);
      } else {
        context.strokeStyle = '#111827';
        context.lineWidth = 2;
        context.strokeRect(tableLeft, tableTop, tableRight - tableLeft, tableBottom - tableTop);
        context.beginPath();
        context.moveTo(tableLeft + 10, tableTop + 10);
        context.lineTo(tableRight - 10, tableTop + 10);
        context.moveTo(tableLeft + 10, tableTop + 10);
        context.lineTo(tableLeft + 10, tableBottom - 10);
        context.moveTo(tableRight - 10, tableTop + 10);
        context.lineTo(tableRight - 10, tableBottom - 10);
        context.stroke();
      }

      const lengthLineOffset = 90;
      const lengthLineStartX = stripX + -5 - lengthLineOffset;
      const lengthLineEndX = stripX + stripWidth - 10 - lengthLineOffset;

      context.strokeStyle = '#111827';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(lengthLineStartX, stripY - 26);
      context.lineTo(lengthLineEndX, stripY - 26);
      context.stroke();

      context.fillStyle = '#111827';
      context.font = '700 13px Arial';
      const labelWidth = context.measureText('300 cm (comprimento da mesa)').width;
      context.fillText('300 cm (comprimento da mesa)', ((lengthLineStartX + lengthLineEndX) / 2) - (labelWidth / 2), stripY - 36);

      const widthLabel = '159 cm (largura da mesa)';
      const widthMeasureX = tableLeft + 34;
      const widthMeasureY = tableTop + (tableBottom - tableTop) / 2;
      const widthMeasureGap = 0;
      context.save();
      context.translate(widthMeasureX, widthMeasureY);
      context.rotate(-Math.PI / 2);
      context.font = '700 13px Arial';
      const widthLabelWidth = context.measureText(widthLabel).width;
      context.fillText(widthLabel, -(widthLabelWidth / 2), 4);
      context.restore();

      context.strokeStyle = '#111827';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(widthMeasureX + widthMeasureGap + 16, widthMeasureY - 188);
      context.lineTo(widthMeasureX + widthMeasureGap + 16, widthMeasureY + 188);
      context.stroke();

    const wasteBoxX = tableLeft - 86 + 183;
    const wasteBoxY = stripY + 18;
    const wasteBoxW = 74;
    const wasteBoxH = 365;
    const materialBoxX = tableRight - (wasteBoxX - tableLeft) - wasteBoxW;
    const materialBoxY = wasteBoxY;
    const materialBoxW = wasteBoxW;
    const materialBoxH = wasteBoxH;
    context.fillStyle = 'rgba(160, 160, 160, 0.28)';
    context.fillRect(wasteBoxX, wasteBoxY, wasteBoxW, wasteBoxH);
    context.fillRect(materialBoxX, materialBoxY, materialBoxW, materialBoxH);

    const wasteLabel = 'Sobra lateral';
    const wasteValue = '19 cm';
    const wasteNote = '(em cada lado)';
    const wasteTextColor = '#111827';
    const wasteFontBase = Math.min(10, Math.max(7, Math.floor(Math.min(wasteBoxW / 7, wasteBoxH / 9))));
    const wasteCenterY = wasteBoxY + wasteBoxH / 2;

    context.fillStyle = wasteTextColor;
    context.font = `700 ${wasteFontBase}px Arial`;
    const wasteLabelWidth = context.measureText(wasteLabel).width;
    if (wasteLabelWidth <= wasteBoxW - 12) {
      context.fillText(wasteLabel, wasteBoxX + (wasteBoxW - wasteLabelWidth) / 2, wasteCenterY - 24);
    } else {
      context.font = `700 ${Math.max(7, wasteFontBase - 1)}px Arial`;
      context.fillText(wasteLabel, wasteBoxX + 6, wasteCenterY - 24);
    }

    context.font = `700 ${Math.max(9, wasteFontBase + 2)}px Arial`;
    const wasteValueWidth = context.measureText(wasteValue).width;
    context.fillText(wasteValue, wasteBoxX + (wasteBoxW - wasteValueWidth) / 2, wasteCenterY + 4);

    context.font = `700 ${Math.max(7, wasteFontBase - 1)}px Arial`;
    const wasteNoteWidth = context.measureText(wasteNote).width;
    if (wasteNoteWidth <= wasteBoxW - 10) {
      context.fillText(wasteNote, wasteBoxX + (wasteBoxW - wasteNoteWidth) / 2, wasteCenterY + 30);
    } else {
      context.fillText(wasteNote, wasteBoxX + 6, wasteCenterY + 30);
    }

    const materialLabel = 'Largura total';
    const materialNote = 'do TNT';
    const materialValue = `${formatNumber(firstPlan?.width || materialWidth, 0)} cm`;
    const materialCenterY = materialBoxY + materialBoxH / 2;
    context.fillStyle = wasteTextColor;
    context.font = `700 ${wasteFontBase}px Arial`;
    [materialLabel, materialNote].forEach((line, index) => {
      const lineWidth = context.measureText(line).width;
      context.fillText(line, materialBoxX + ((materialBoxW - lineWidth) / 2), materialCenterY - 24 + (index * 14));
    });
    context.font = `700 ${Math.max(9, wasteFontBase + 2)}px Arial`;
    const materialValueWidth = context.measureText(materialValue).width;
    context.fillText(materialValue, materialBoxX + ((materialBoxW - materialValueWidth) / 2), materialCenterY + 22);

    // Peças de corte dentro da mesa: seguem o mesmo arranjo da referência,
    // mas usam as dimensões e a quantidade de peças do cálculo atual.
    const cutAreaX = wasteBoxX + wasteBoxW + 10;
    const cutAreaRight = materialBoxX - 10;
    const cutAreaWidth = cutAreaRight - cutAreaX;
    const tableLengthCm = 300;
    const lateralWasteCm = 19;
    const usableTableLengthCm = tableLengthCm - (lateralWasteCm * 2);
    const tableWidthCm = 159;
    const maxMaterialHeightCm = 150;
    const materialPlanDrawHeight = wasteBoxH * (maxMaterialHeightCm / tableWidthCm);
    const mainAreaY = wasteBoxY + (wasteBoxH - materialPlanDrawHeight);
    const verticalCentimeterScale = materialPlanDrawHeight / maxMaterialHeightCm;
    const firstCutPlan = previewPlan || result.tablePlan || result.cutPlans?.[0];
    const cutWidthCm = Number(firstCutPlan?.pieceWidth) || Number(result.productWidth) || mainPieceWidth;
    const cutHeightCm = Number(firstCutPlan?.pieceHeight) || Number(result.productHeight) || mainPieceHeight;
    const mainAreaHeight = Math.min(cutHeightCm * verticalCentimeterScale, materialPlanDrawHeight);
    const materialPlanBottom = mainAreaY + materialPlanDrawHeight;
    const mainGap = 0;
    const centimeterScale = cutAreaWidth / usableTableLengthCm;
    const mainStartX = cutAreaX;
    const mainPieceDrawWidth = cutWidthCm * centimeterScale;
    const accordionDrawWidth = hasAccordion && accordionWidth > 0 ? accordionWidth * centimeterScale : 0;
    const groupDrawWidth = mainPieceDrawWidth + (accordionDrawWidth * 2);
    const mainPiecesToDraw = previewQuantity;
    const mainLabel = `${formatNumber(cutWidthCm, 0)} x ${formatNumber(cutHeightCm, 0)} cm`;
    const rowsToDraw = firstCutPlan?.rowLayouts || [];
    let currentRowY = mainAreaY;
    let remainingPiecesToDraw = mainPiecesToDraw;
    rowsToDraw.forEach((layout) => {
      const pieceWidthCm = cutWidthCm;
      const pieceHeightCm = cutHeightCm;
      const pieceDrawWidth = pieceWidthCm * centimeterScale;
      const pieceDrawHeight = pieceHeightCm * verticalCentimeterScale;
      const accordionDrawWidth = hasAccordion ? accordionWidth * centimeterScale : 0;
      const label = layout.rotated ? `${mainLabel} (girada)` : mainLabel;
      const piecesThisRow = Math.min(remainingPiecesToDraw, layout.piecesPerRow);
      if (piecesThisRow <= 0) return;
      for (let column = 0; column < piecesThisRow; column += 1) {
        const groupX = mainStartX + (column * (pieceDrawWidth + (accordionDrawWidth * 2) + mainGap));
        const accordionLabel = `Sanfona ${formatNumber(accordionWidth, 1)} cm`;

        if (hasAccordion) {
          [0, 1].forEach((accordionIndex) => {
            const accordionX = groupX + (accordionIndex === 0 ? 0 : pieceDrawWidth + accordionDrawWidth);
            context.fillStyle = '#22c55e';
            context.fillRect(accordionX, currentRowY, accordionDrawWidth, pieceDrawHeight);
            context.strokeStyle = '#15803d';
            context.lineWidth = 1.5;
            context.strokeRect(accordionX, currentRowY, accordionDrawWidth, pieceDrawHeight);
            drawResponsivePieceLabel(context, accordionX, currentRowY, accordionDrawWidth, pieceDrawHeight, accordionLabel, '#111827');
          });
        }

        const mainX = groupX + accordionDrawWidth;
        context.fillStyle = color.fill;
        context.fillRect(mainX, currentRowY, pieceDrawWidth, pieceDrawHeight);
        context.strokeStyle = '#27506a';
        context.lineWidth = 1.5;
        context.strokeRect(mainX, currentRowY, pieceDrawWidth, pieceDrawHeight);
        drawResponsivePieceLabel(context, mainX, currentRowY, pieceDrawWidth, pieceDrawHeight, label, color.dark);
      }
      remainingPiecesToDraw -= piecesThisRow;
      currentRowY += pieceDrawHeight;
      if (remainingPiecesToDraw <= 0) return;
    });

    // Marca no próprio tampo as duas sobras resultantes da grade completa.
    // Elas são calculadas depois de acomodar somente peças inteiras em cada eixo.
    const gridDrawWidth = (firstCutPlan.placedColumns * groupDrawWidth) + (Math.max(0, firstCutPlan.placedColumns - 1) * mainGap);
    const gridDrawHeight = firstCutPlan.placedRows * mainAreaHeight;
    const lengthWasteX = mainStartX + gridDrawWidth;
    const lengthWasteWidth = Math.max(0, cutAreaRight - lengthWasteX);
    const widthWasteY = mainAreaY + gridDrawHeight;
    const widthWasteHeight = Math.max(0, materialPlanBottom - widthWasteY);
    if (lengthWasteWidth > 0 && gridDrawHeight > 0) {
      const wasteLineY = mainAreaY + (gridDrawHeight / 2);
      const lengthWasteLabel = `Sobra: ${formatNumber(firstCutPlan.placedLengthLeftover, 0)} cm`;
      const arrowSize = 8;
      const arrowHalf = 4;
      context.save();
      context.strokeStyle = '#dc2626';
      context.fillStyle = '#dc2626';
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(lengthWasteX, wasteLineY);
      context.lineTo(cutAreaRight, wasteLineY);
      context.stroke();
      context.beginPath();
      context.moveTo(lengthWasteX, wasteLineY);
      context.lineTo(lengthWasteX + arrowSize, wasteLineY - arrowHalf);
      context.lineTo(lengthWasteX + arrowSize, wasteLineY + arrowHalf);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(cutAreaRight, wasteLineY);
      context.lineTo(cutAreaRight - arrowSize, wasteLineY - arrowHalf);
      context.lineTo(cutAreaRight - arrowSize, wasteLineY + arrowHalf);
      context.closePath();
      context.fill();
      context.restore();
      let lengthWasteFontSize = 10;
      context.font = `700 ${lengthWasteFontSize}px Arial`;
      while (lengthWasteFontSize > 5 && context.measureText(lengthWasteLabel).width > Math.max(lengthWasteWidth - 4, 1)) {
        lengthWasteFontSize -= 1;
        context.font = `700 ${lengthWasteFontSize}px Arial`;
      }
      const lengthLabelWidth = context.measureText(lengthWasteLabel).width;
      context.fillText(lengthWasteLabel, ((lengthWasteX + cutAreaRight) / 2) - (lengthLabelWidth / 2), wasteLineY - 6);
    }
    if (widthWasteHeight > 0) {
      const wasteLineX = mainStartX + 18;
      const arrowSize = 8;
      const arrowHalf = 4;
      context.save();
      context.strokeStyle = '#dc2626';
      context.fillStyle = '#dc2626';
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(wasteLineX, widthWasteY);
      context.lineTo(wasteLineX, materialPlanBottom);
      context.stroke();
      context.beginPath();
      context.moveTo(wasteLineX, widthWasteY);
      context.lineTo(wasteLineX - arrowHalf, widthWasteY + arrowSize);
      context.lineTo(wasteLineX + arrowHalf, widthWasteY + arrowSize);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(wasteLineX, materialPlanBottom);
      context.lineTo(wasteLineX - arrowHalf, materialPlanBottom - arrowSize);
      context.lineTo(wasteLineX + arrowHalf, materialPlanBottom - arrowSize);
      context.closePath();
      context.fill();
      context.restore();
      const widthWasteLabel = `Sobra: ${formatNumber(firstCutPlan.placedWidthLeftover, 0)} cm`;
      context.save();
      context.translate(wasteLineX + 12, widthWasteY + (widthWasteHeight / 2));
      context.rotate(-Math.PI / 2);
      let widthWasteFontSize = 10;
      context.font = `700 ${widthWasteFontSize}px Arial`;
      while (widthWasteFontSize > 5 && context.measureText(widthWasteLabel).width > Math.max(widthWasteHeight - 4, 1)) {
        widthWasteFontSize -= 1;
        context.font = `700 ${widthWasteFontSize}px Arial`;
      }
      context.fillText(widthWasteLabel, -(context.measureText(widthWasteLabel).width / 2), 0);
      context.restore();
    }

    // Cotas por peça: cada seta usa exatamente a largura do retângulo
    // que está sendo medido. Para mochilas com sanfona, corpo e sanfonas
    // recebem cotas independentes, todas alinhadas às suas bordas reais.
    const drawHorizontalDimension = (targetContext, startX, endX, y, label, color = '#111827') => {
      if (endX <= startX) return;
      const arrowSize = Math.min(6, Math.max(3, (endX - startX) / 8));
      targetContext.save();
      targetContext.strokeStyle = color;
      targetContext.fillStyle = color;
      targetContext.lineWidth = 1.5;
      targetContext.beginPath();
      targetContext.moveTo(startX, y);
      targetContext.lineTo(endX, y);
      targetContext.moveTo(startX, y - 4);
      targetContext.lineTo(startX, y + 4);
      targetContext.moveTo(endX, y - 4);
      targetContext.lineTo(endX, y + 4);
      targetContext.stroke();
      targetContext.beginPath();
      targetContext.moveTo(startX, y);
      targetContext.lineTo(startX + arrowSize, y - 3);
      targetContext.lineTo(startX + arrowSize, y + 3);
      targetContext.closePath();
      targetContext.fill();
      targetContext.beginPath();
      targetContext.moveTo(endX, y);
      targetContext.lineTo(endX - arrowSize, y - 3);
      targetContext.lineTo(endX - arrowSize, y + 3);
      targetContext.closePath();
      targetContext.fill();
      targetContext.font = '700 8px Arial';
      const labelWidth = targetContext.measureText(label).width;
      targetContext.fillText(label, ((startX + endX) / 2) - (labelWidth / 2), y - 5);
      targetContext.restore();
    };

    const drawVerticalDimension = (targetContext, x, startY, endY, label, color = '#111827') => {
      if (endY <= startY) return;
      const arrowSize = Math.min(6, Math.max(3, (endY - startY) / 8));
      targetContext.save();
      targetContext.strokeStyle = color;
      targetContext.fillStyle = color;
      targetContext.lineWidth = 1.5;
      targetContext.beginPath();
      targetContext.moveTo(x, startY);
      targetContext.lineTo(x, endY);
      targetContext.moveTo(x - 4, startY);
      targetContext.lineTo(x + 4, startY);
      targetContext.moveTo(x - 4, endY);
      targetContext.lineTo(x + 4, endY);
      targetContext.stroke();
      targetContext.beginPath();
      targetContext.moveTo(x, startY);
      targetContext.lineTo(x - 3, startY + arrowSize);
      targetContext.lineTo(x + 3, startY + arrowSize);
      targetContext.closePath();
      targetContext.fill();
      targetContext.beginPath();
      targetContext.moveTo(x, endY);
      targetContext.lineTo(x - 3, endY - arrowSize);
      targetContext.lineTo(x + 3, endY - arrowSize);
      targetContext.closePath();
      targetContext.fill();
      targetContext.translate(x + 10, (startY + endY) / 2);
      targetContext.rotate(-Math.PI / 2);
      targetContext.font = '700 8px Arial';
      const labelWidth = targetContext.measureText(label).width;
      targetContext.fillText(label, -labelWidth / 2, 0);
      targetContext.restore();
    };

    if (mainPiecesToDraw > 0) {
      const dimensionY = mainAreaY - 10;
      const drawnPiecesInFirstRow = Math.min(firstCutPlan.wholePiecesPerRow, mainPiecesToDraw, quantity);
      for (let column = 0; column < drawnPiecesInFirstRow; column += 1) {
        const groupX = mainStartX + (column * groupDrawWidth);
        const accordionDrawWidthForDimension = hasAccordion ? accordionWidth * centimeterScale : 0;
        const mainStart = groupX + accordionDrawWidthForDimension;
        const mainEnd = mainStart + mainPieceDrawWidth;
        drawHorizontalDimension(context, mainStart, mainEnd, dimensionY, `${formatNumber(cutWidthCm, 0)} cm`);
        if (hasAccordion && accordionDrawWidthForDimension > 0) {
          const leftAccordionStart = groupX;
          const leftAccordionEnd = groupX + accordionDrawWidthForDimension;
          const rightAccordionStart = mainEnd;
          const rightAccordionEnd = rightAccordionStart + accordionDrawWidthForDimension;
          const accordionPairStart = leftAccordionStart;
          const accordionPairEnd = rightAccordionEnd;
          drawHorizontalDimension(context, accordionPairStart, accordionPairEnd, dimensionY - 14, `${formatNumber(accordionWidth, 1)} cm cada sanfona`, '#111827');
        }
      }

      // A cota vertical fica alinhada à primeira mochila/sanfona,
      // usando a altura real do retângulo desenhado.
      const firstPieceX = mainStartX + mainPieceDrawWidth + (hasAccordion ? accordionDrawWidth : 0);
      const firstPieceY = mainAreaY;
      // A altura da mochila é identificada pelo próprio retângulo; não exibimos seta vertical.
    }
    const cardY = 515;
    const cardGap = 22;
    const cardWidth = (panelWidth - 120 - (cardGap * 2)) / 3;
    const cardHeight = 205;
    const cardStartX = 60;

    const drawPlanCards = (plan, planQuantity, targetContext = context, accumulatedLeftoverArea = null) => {
      const capacity = Number(plan?.capacity) || 0;
      const placedPieces = Math.min(Math.max(0, Number(planQuantity) || 0), capacity);
      const emptyPositions = Math.max(0, capacity - placedPieces);
      const pieceArea = (Number(plan?.pieceWidth) || 0) * (Number(plan?.pieceHeight) || 0);
      const totalPlanArea = (Number(plan?.usableLength) || 262) * (Number(plan?.width) || 0);
      const accordionAreaPerUnit = hasAccordion ? (result.accordionWidth * result.originalProductHeight * 2) : 0;
      const completeUnitArea = pieceArea + accordionAreaPerUnit;
      const emptyArea = emptyPositions * completeUnitArea;
      const placedAreaLeftover = Math.max(0, totalPlanArea - (placedPieces * completeUnitArea));
      const residualEdgeArea = Math.max(0, totalPlanArea - (capacity * completeUnitArea));
      const totalComprimentoCm = Math.max(0, (mainPieceWidth + (result.accordionWidth * 2)) * placedPieces);
      const totalComprimentoM = totalComprimentoCm / 100;
      const drawCardTextForContext = (x, y, width, height, title, lines, fill, titleSize = 12, bodySize = 11) => {
        targetContext.fillStyle = fill;
        targetContext.fillRect(x, y, width, height);
        targetContext.strokeStyle = '#111827';
        targetContext.lineWidth = 2;
        targetContext.strokeRect(x, y, width, height);
        targetContext.fillStyle = '#111827';
        targetContext.font = `700 ${titleSize}px Arial`;
        targetContext.fillText(title, x + 12, y + 20);
        targetContext.font = `400 ${bodySize}px Arial`;
        lines.forEach((line, index) => targetContext.fillText(line, x + 12, y + 42 + (index * 16)));
      };

      drawCardTextForContext(cardStartX, cardY, cardWidth, cardHeight, `APROVEITAMENTO — PLANO INDIVIDUAL`, [
        `Grade máxima: ${formatNumber(plan?.wholePiecesPerRow || 0, 0)} × ${formatNumber(plan?.verticalRows || 0, 0)} = ${formatNumber(capacity, 0)} mochilas`,
        `Cada mochila: 1 corpo + ${formatNumber(result.accordionCountPerUnit || 0, 0)} sanfonas${hasAccordion ? ` de ${formatNumber(result.accordionWidth, 1)} cm × ${formatNumber(result.originalProductHeight, 1)} cm` : ''}`,
        `Acomodadas neste plano: ${formatNumber(placedPieces, 0)} mochila(s)`,
        `Espaço vago útil: ${formatNumber(emptyPositions, 0)} posição(ões) (${formatNumber(emptyArea, 0)} cm²)`,
        `Faixa residual: ${formatNumber(plan?.lengthLeftover || 0, 0)} cm no comprimento`,
        `Área residual das bordas: ${formatNumber(residualEdgeArea, 0)} cm²`,
        ...(hasAccordion ? [
          `Sanfonas: 2 por mochila × ${formatNumber(result.accordionWidth, 1)} cm × ${formatNumber(result.originalProductHeight, 1)} cm`,
          `Área das sanfonas: ${formatNumber(accordionAreaPerUnit, 0)} cm² por mochila`,
          `Área total das sanfonas: ${formatNumber(accordionAreaPerUnit * placedPieces, 0)} cm²`,
        ] : []),
        `Área total de sobra: ${formatNumber(placedAreaLeftover, 0)} cm²`,
        ...(accumulatedLeftoverArea !== null ? [`Sobra acumulada dos cortes: ${formatNumber(accumulatedLeftoverArea, 0)} cm²`] : []),
      ], '#dfeaf5');

      const accessoryLines = result.accessoryType === 'handle'
        ? [
            `Alça: ${formatNumber((Number(result.handleLength) || 0) / Math.max(1, Number(result.handleQuantity) || 0), 1)} cm por alça`,
            `Quantidade de alças: ${formatNumber(result.handleQuantity || 0, 0)} por mochila`,
            `Total de alças no plano: ${formatNumber((Number(result.handleQuantity) || 0) * placedPieces, 0)} unidade(s)`,
            `Comprimento total de alça: ${formatNumber((Number(result.handleLength) || 0) * placedPieces, 1)} cm`,
          ]
        : [
            `Cordão: ${formatNumber((Number(result.cordLength) || 0) / Math.max(1, Number(result.cordQuantity) || 0), 1)} cm por cordão`,
            `Quantidade de cordões: ${formatNumber(result.cordQuantity || 0, 0)} por mochila`,
            `Total de cordões no plano: ${formatNumber((Number(result.cordQuantity) || 0) * placedPieces, 0)} unidade(s)`,
            `Comprimento total de cordão: ${formatNumber((Number(result.cordLength) || 0) * placedPieces, 1)} cm`,
          ];

      drawCardTextForContext(cardStartX + cardWidth + cardGap, cardY, cardWidth, cardHeight, 'CONSUMO E ACESSÓRIO — PLANO', [
        `Comprimento do plano: ${formatNumber(totalComprimentoCm, 0)} cm`,
        `Comprimento em metros lineares: ${formatNumber(totalComprimentoM, 2)} m`,
        `Largura do material: ${formatNumber(plan?.width || materialWidth, 0)} cm`,
        `Quantidade neste plano: ${formatNumber(placedPieces, 0)} unidade(s)`,
        ...(hasAccordion ? [
          `Sanfonas: 2 por mochila × ${formatNumber(result.accordionWidth, 1)} cm`,
          `Consumo das sanfonas: ${formatNumber(accordionAreaPerUnit * placedPieces / 10000, 2)} m²`,
          `Área total das sanfonas: ${formatNumber(accordionAreaPerUnit * placedPieces, 0)} cm²`,
        ] : []),
        ...accessoryLines,
      ], '#f5dfe8');

      const usedLengthCm = Math.min(Number(plan?.usableLength) || 262, (Number(plan?.wholePiecesPerRow) || 0) * (Number(plan?.groupLength) || ((Number(plan?.pieceWidth) || 0) + (Number(result.accordionWidth) || 0) * 2)));
      const usedWidthCm = Math.min(Number(plan?.width) || 0, (Number(plan?.verticalRows) || 0) * (Number(plan?.pieceHeight) || 0));
      const lengthUtilization = (Number(plan?.usableLength) || 262) > 0 ? (usedLengthCm / (Number(plan?.usableLength) || 262)) * 100 : 0;
      const widthUtilization = (Number(plan?.width) || 0) > 0 ? (usedWidthCm / (Number(plan?.width) || 0)) * 100 : 0;
      const utilization = Math.max(lengthUtilization, widthUtilization);
      const utilizationAxis = widthUtilization >= lengthUtilization ? 'largura' : 'comprimento';
      const tips = [
        `Corte as ${formatNumber(placedPieces, 0)} peças principais primeiro.`,
        ...(hasAccordion ? [`Depois corte as ${formatNumber(placedPieces * (Number(result.accordionCountPerUnit) || 2), 0)} sanfonas.`] : []),
        'Use régua longa e cortador circular ou faca bem afiada.',
        'Mantenha as folhas bem alinhadas e use pregos/grampos.',
        `Esse plano gera ${formatNumber(placedPieces, 0)} peças (${formatNumber(emptyPositions, 0)} de sobra).`,
        `Aproveitamento de praticamente ${formatNumber(utilization, 0)}% da ${utilizationAxis}.`,
      ];
      drawCardTextForContext(cardStartX + (cardWidth + cardGap) * 2, cardY, cardWidth, cardHeight, 'DICAS — PLANO', tips, '#dff2df');
    };

    drawPlanCards(firstCutPlan, previewQuantity);


    setPreviewUrl(canvas.toDataURL('image/png'));

    if (result.plansToCut?.length > 1) {
      const generatedSecondaryUrls = [];
      let quantityAlreadyAssigned = firstPlan?.capacity || 0;
      let accumulatedLeftoverArea = Math.max(0, ((Number(firstPlan?.usableLength) || 262) * (Number(firstPlan?.width) || 0)) - (previewQuantity * (Number(firstPlan?.pieceWidth) || 0) * (Number(firstPlan?.pieceHeight) || 0)));
      result.plansToCut.slice(1).forEach((secondPlan, secondPlanIndex) => {
      const duplicateCanvas = document.createElement('canvas');
      duplicateCanvas.width = canvas.width;
      duplicateCanvas.height = canvas.height;
      const duplicateContext = duplicateCanvas.getContext('2d');
      duplicateContext.drawImage(canvas, 0, 0);
      duplicateContext.clearRect(0, 0, 1200, 70);
      duplicateContext.fillStyle = '#ffffff';
      duplicateContext.fillRect(0, 0, 1200, 70);
      duplicateContext.fillStyle = '#111827';
      duplicateContext.font = '700 18px Arial';
      const secondPlanQuantity = Math.min(secondPlan.capacity, Math.max(0, quantity - quantityAlreadyAssigned));
      const secondPlanLeftoverArea = Math.max(0, ((Number(secondPlan?.usableLength) || 262) * (Number(secondPlan?.width) || 0)) - (secondPlanQuantity * (Number(secondPlan?.pieceWidth) || 0) * (Number(secondPlan?.pieceHeight) || 0)));
      const planAccumulatedLeftoverArea = accumulatedLeftoverArea + secondPlanLeftoverArea;
      duplicateContext.fillText(`PLANO DE CORTE ${secondPlanIndex + 2} - ${formatNumber(secondPlanQuantity, 0)} MOCHILAS (LARGURA: ${formatNumber(secondPlan.width, 0)} cm)`, 18, 30);
      duplicateContext.font = '600 11px Arial';
      duplicateContext.fillText(`Peça principal: ${formatNumber(mainPieceWidth, 0)} x ${formatNumber(mainPieceHeight, 0)} cm (${formatNumber(secondPlanQuantity, 0)} un)`, 18, 52);

      // O segundo plano não é uma cópia do primeiro: limpa o desenho anterior
      // e posiciona somente as fileiras que cabem na largura restante.
      duplicateContext.fillStyle = '#eef2f7';
      duplicateContext.fillRect(cutAreaX, mainAreaY, cutAreaWidth, materialPlanDrawHeight);

      // Os cards inferiores também pertencem ao plano atual; nunca reutilize
      // os valores calculados para o primeiro plano.
      duplicateContext.clearRect(0, cardY, panelWidth, panelHeight - cardY);
      duplicateContext.fillStyle = '#ffffff';
      duplicateContext.fillRect(0, cardY, panelWidth, panelHeight - cardY);
      const secondPlanCardsQuantity = secondPlanQuantity;
      drawPlanCards(secondPlan, secondPlanCardsQuantity, duplicateContext, planAccumulatedLeftoverArea);
      const secondRows = Math.max(0, secondPlan.mainRows || secondPlan.verticalRows);
      const secondPiecesPerRow = Math.max(0, secondPlan.piecesPerRow || secondPlan.wholePiecesPerRow);
      const secondPieceWidthCm = Number(secondPlan?.pieceWidth) || cutWidthCm;
      const secondPieceHeightCm = Number(secondPlan?.pieceHeight) || cutHeightCm;
      const secondMainPieceDrawWidth = secondPieceWidthCm * centimeterScale;
      const secondMainAreaHeight = Math.min(secondPieceHeightCm * verticalCentimeterScale, materialPlanDrawHeight);
      const secondMainLabel = `${formatNumber(secondPieceWidthCm, 0)} x ${formatNumber(secondPieceHeightCm, 0)} cm`;
      const secondAccordionDrawWidth = hasAccordion ? accordionWidth * centimeterScale : 0;
      const secondGroupDrawWidth = secondMainPieceDrawWidth + (secondAccordionDrawWidth * 2);
      const secondPiecesToDraw = Math.min(secondPlanQuantity, secondRows * secondPiecesPerRow);
      let secondLastPieceEndX = mainStartX;
      let secondLastPieceRowY = mainAreaY;
      for (let index = 0; index < secondPiecesToDraw; index += 1) {
        const row = secondPiecesPerRow > 0 ? Math.floor(index / secondPiecesPerRow) : 0;
        const column = secondPiecesPerRow > 0 ? index % secondPiecesPerRow : 0;
        const groupX = mainStartX + (column * (secondGroupDrawWidth + mainGap));
        const pieceY = mainAreaY + (row * secondMainAreaHeight);
        if (hasAccordion && secondAccordionDrawWidth > 0) {
          [0, 1].forEach((accordionIndex) => {
            const accordionX = groupX + (accordionIndex === 0 ? 0 : secondMainPieceDrawWidth + secondAccordionDrawWidth);
            duplicateContext.fillStyle = '#22c55e';
            duplicateContext.fillRect(accordionX, pieceY, secondAccordionDrawWidth, secondMainAreaHeight);
            duplicateContext.strokeStyle = '#15803d';
            duplicateContext.lineWidth = 1.5;
            duplicateContext.strokeRect(accordionX, pieceY, secondAccordionDrawWidth, secondMainAreaHeight);
            drawResponsivePieceLabel(duplicateContext, accordionX, pieceY, secondAccordionDrawWidth, secondMainAreaHeight, `Sanfona ${formatNumber(accordionWidth, 1)} cm`, '#111827');
          });
        }
        const pieceX = groupX + secondAccordionDrawWidth;
        duplicateContext.fillStyle = color.fill;
        duplicateContext.fillRect(pieceX, pieceY, secondMainPieceDrawWidth, secondMainAreaHeight);
        duplicateContext.strokeStyle = '#27506a';
        duplicateContext.lineWidth = 1.5;
        duplicateContext.strokeRect(pieceX, pieceY, secondMainPieceDrawWidth, secondMainAreaHeight);
        drawResponsivePieceLabel(duplicateContext, pieceX, pieceY, secondMainPieceDrawWidth, secondMainAreaHeight, secondMainLabel, color.dark);
        secondLastPieceEndX = groupX + secondGroupDrawWidth + mainGap;
        secondLastPieceRowY = pieceY;
      }

      if (secondPiecesToDraw > 0) {
        const dimensionY = mainAreaY - 10;
        const firstGroupX = mainStartX;
        const secondMainStart = firstGroupX + secondAccordionDrawWidth;
        const secondMainEnd = secondMainStart + secondMainPieceDrawWidth;
        drawHorizontalDimension(duplicateContext, secondMainStart, secondMainEnd, dimensionY, `${formatNumber(secondPieceWidthCm, 0)} cm`);
        if (hasAccordion && secondAccordionDrawWidth > 0) {
          drawHorizontalDimension(duplicateContext, firstGroupX, secondMainStart, dimensionY - 14, `${formatNumber(accordionWidth, 1)} cm`, '#15803d');
          drawHorizontalDimension(duplicateContext, secondMainEnd, secondMainEnd + secondAccordionDrawWidth, dimensionY - 14, `${formatNumber(accordionWidth, 1)} cm`, '#15803d');
        }
        // A altura da mochila é identificada pelo próprio retângulo; não exibimos seta vertical.
      }

      const unusedHeight = Math.max(0, materialPlanDrawHeight - (secondRows * (Number(secondPlan?.pieceHeight) || cutHeightCm) * verticalCentimeterScale));
      if (unusedHeight > 0) {
        duplicateContext.fillStyle = 'rgba(156, 163, 175, 0.5)';
        duplicateContext.fillRect(cutAreaX, mainAreaY + (secondRows * mainAreaHeight), cutAreaWidth, unusedHeight);
        drawResponsivePieceLabel(duplicateContext, cutAreaX, mainAreaY + (secondRows * mainAreaHeight), cutAreaWidth, unusedHeight, `${formatNumber(150 - secondPlan.width, 0)} cm fora do plano`, '#374151');
      }

      // Indicação visual das sobras do Plano 2, calculada exclusivamente
      // com a grade e a quantidade efetivamente cortada neste plano.
      const secondPlacedPieces = Math.min(secondPlanQuantity, secondPlan.capacity);
      const secondPlacedColumns = secondPlacedPieces > 0 ? Math.min(secondPlan.wholePiecesPerRow, secondPlacedPieces) : 0;
      const secondPlacedRows = secondPlan.wholePiecesPerRow > 0 ? Math.ceil(secondPlacedPieces / secondPlan.wholePiecesPerRow) : 0;
      const secondPieceDrawWidth = secondPieceWidthCm * centimeterScale;
      const secondPieceDrawHeight = secondPieceHeightCm * verticalCentimeterScale;
      const secondGridDrawWidth = secondPlacedColumns * secondGroupDrawWidth;
      const secondGridDrawHeight = secondPlacedRows * secondPieceDrawHeight;
      const secondLengthWasteX = mainStartX + secondGridDrawWidth;
      const secondLengthWasteWidth = Math.max(0, cutAreaRight - secondLengthWasteX);
      const secondWidthWasteY = mainAreaY + secondGridDrawHeight;
      const secondWidthWasteHeight = Math.max(0, materialPlanBottom - secondWidthWasteY);

      if (secondLengthWasteWidth > 0 && secondGridDrawHeight > 0) {
        const wasteLineY = mainAreaY + (secondGridDrawHeight / 2);
        const wasteLabel = 'Sobra: ' + formatNumber(Math.max(0, secondPlan.usableLength - (secondPlacedColumns * (secondPieceWidthCm + (accordionWidth * 2)))), 0) + ' cm';
        const arrowSize = Math.min(8, Math.max(4, secondLengthWasteWidth / 3));
        const arrowHalf = arrowSize / 2;
        duplicateContext.save();
        duplicateContext.strokeStyle = '#dc2626';
        duplicateContext.fillStyle = '#dc2626';
        duplicateContext.lineWidth = 2.5;
        duplicateContext.beginPath();
        duplicateContext.moveTo(secondLengthWasteX, wasteLineY);
        duplicateContext.lineTo(cutAreaRight, wasteLineY);
        duplicateContext.stroke();
        duplicateContext.beginPath();
        duplicateContext.moveTo(secondLengthWasteX, wasteLineY);
        duplicateContext.lineTo(secondLengthWasteX + arrowSize, wasteLineY - arrowHalf);
        duplicateContext.lineTo(secondLengthWasteX + arrowSize, wasteLineY + arrowHalf);
        duplicateContext.closePath();
        duplicateContext.fill();
        duplicateContext.beginPath();
        duplicateContext.moveTo(cutAreaRight, wasteLineY);
        duplicateContext.lineTo(cutAreaRight - arrowSize, wasteLineY - arrowHalf);
        duplicateContext.lineTo(cutAreaRight - arrowSize, wasteLineY + arrowHalf);
        duplicateContext.closePath();
        duplicateContext.fill();
        duplicateContext.restore();
        let wasteFontSize = 10;
        duplicateContext.font = '700 ' + wasteFontSize + 'px Arial';
        while (wasteFontSize > 5 && duplicateContext.measureText(wasteLabel).width > Math.max(secondLengthWasteWidth - 4, 1)) {
          wasteFontSize -= 1;
          duplicateContext.font = '700 ' + wasteFontSize + 'px Arial';
        }
        duplicateContext.fillStyle = '#dc2626';
        const labelWidth = duplicateContext.measureText(wasteLabel).width;
        duplicateContext.fillText(wasteLabel, ((secondLengthWasteX + cutAreaRight) / 2) - (labelWidth / 2), wasteLineY - 6);
      }

      if (secondWidthWasteHeight > 0) {
        const wasteLineX = mainStartX + 18;
        const arrowSize = Math.min(8, Math.max(4, secondWidthWasteHeight / 3));
        const arrowHalf = arrowSize / 2;
        duplicateContext.save();
        duplicateContext.strokeStyle = '#dc2626';
        duplicateContext.fillStyle = '#dc2626';
        duplicateContext.lineWidth = 2.5;
        duplicateContext.beginPath();
        duplicateContext.moveTo(wasteLineX, secondWidthWasteY);
        duplicateContext.lineTo(wasteLineX, materialPlanBottom);
        duplicateContext.stroke();
        duplicateContext.beginPath();
        duplicateContext.moveTo(wasteLineX, secondWidthWasteY);
        duplicateContext.lineTo(wasteLineX - arrowHalf, secondWidthWasteY + arrowSize);
        duplicateContext.lineTo(wasteLineX + arrowHalf, secondWidthWasteY + arrowSize);
        duplicateContext.closePath();
        duplicateContext.fill();
        duplicateContext.beginPath();
        duplicateContext.moveTo(wasteLineX, materialPlanBottom);
        duplicateContext.lineTo(wasteLineX - arrowHalf, materialPlanBottom - arrowSize);
        duplicateContext.lineTo(wasteLineX + arrowHalf, materialPlanBottom - arrowSize);
        duplicateContext.closePath();
        duplicateContext.fill();
        duplicateContext.restore();
        const wasteLabel = 'Sobra: ' + formatNumber(Math.max(0, secondPlan.width - (secondPlacedRows * secondPieceHeightCm)), 0) + ' cm';
        duplicateContext.save();
        duplicateContext.translate(wasteLineX + 12, secondWidthWasteY + (secondWidthWasteHeight / 2));
        duplicateContext.rotate(-Math.PI / 2);
        let wasteFontSize = 10;
        duplicateContext.font = '700 ' + wasteFontSize + 'px Arial';
        while (wasteFontSize > 5 && duplicateContext.measureText(wasteLabel).width > Math.max(secondWidthWasteHeight - 4, 1)) {
          wasteFontSize -= 1;
          duplicateContext.font = '700 ' + wasteFontSize + 'px Arial';
        }
        duplicateContext.fillStyle = '#dc2626';
        duplicateContext.fillText(wasteLabel, -(duplicateContext.measureText(wasteLabel).width / 2), 0);
        duplicateContext.restore();
      }
      // Reconstroi a faixa inferior no final do desenho para garantir que
      // o fundo atras dos cards do Plano 2 nunca fique transparente/preto.
      duplicateContext.fillStyle = '#ffffff';
      duplicateContext.fillRect(0, cardY, panelWidth, panelHeight - cardY);
      drawPlanCards(secondPlan, secondPlanCardsQuantity, duplicateContext, planAccumulatedLeftoverArea);

      if (secondPlanQuantity > 0) generatedSecondaryUrls.push(duplicateCanvas.toDataURL('image/png'));
      quantityAlreadyAssigned += secondPlanQuantity;
      accumulatedLeftoverArea = planAccumulatedLeftoverArea;
      });
      setSecondaryPreviewUrls(generatedSecondaryUrls);
    } else {
      setSecondaryPreviewUrls([]);
    }
    });
  }, [material.label, profile, result]);

  const handleDownload = async () => {
    const previewUrls = [previewUrl, ...secondaryPreviewUrls].filter(Boolean);
    if (!previewUrls.length || downloading) return;
    setDownloading(true);
    try {
      await onDownload();

      const plans = result.plansToCut || result.cutPlans || [];
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 14;
      const imageWidth = pageWidth - (margin * 2);
      const imageHeight = imageWidth * (760 / 1200);
      const files = [];

      previewUrls.forEach((url, index) => {
        const plan = plans[index] || result.tablePlan || {};
        const piecesBefore = plans.slice(0, index).reduce((sum, item) => sum + (Number(item.capacity) || 0), 0);
        const planQuantity = Math.min(Number(plan.capacity) || 0, Math.max(0, (Number(result.quantity) || 0) - piecesBefore));
        const pieceWidth = Number(plan.pieceWidth) || Number(result.productWidth) || 0;
        const pieceHeight = Number(plan.pieceHeight) || Number(result.productHeight) || 0;
        const rows = Number(plan.rows) || Number(plan.verticalRows) || 0;
        const piecesPerRow = Number(plan.piecesPerRow) || Number(plan.wholePiecesPerRow) || 0;
        const lengthLeftover = Number(plan.lengthLeftover) || 0;
        const widthLeftover = Number(plan.widthLeftover) || 0;

        if (index > 0) pdf.addPage();
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(17);
        pdf.text(`Especificação do corte — Plano ${index + 1}`, margin, 16);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`Perfil: ${profile?.name || 'Medição'} | Material: ${material.label}`, margin, 22);
        pdf.addImage(url, 'PNG', margin, 27, imageWidth, imageHeight);

        let y = 27 + imageHeight + 10;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('Especificações', margin, y);
        y += 7;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        [
          [`Quantidade neste corte: ${formatNumber(planQuantity, 0)} unidade(s)`, `Capacidade física: ${formatNumber(plan.capacity || 0, 0)} unidade(s)`],
          [`Peça posicionada: ${formatNumber(pieceWidth, 0)} × ${formatNumber(pieceHeight, 0)} cm`, `Orientação: ${plan.rotated ? 'rotacionada em 90°' : 'original'}`],
          [`Por fileira: ${formatNumber(piecesPerRow, 0)} unidade(s)`, `Fileiras: ${formatNumber(rows, 0)}`],
          [`Área útil: 262 × ${formatNumber(plan.width || 0, 0)} cm`, `Material informado: ${formatNumber(result.materialWidth || 0, 0)} cm`],
          [`Sobra no comprimento: ${formatNumber(lengthLeftover, 0)} cm`, `Sobra na largura: ${formatNumber(widthLeftover, 0)} cm`],
        ].forEach(([left, right]) => {
          pdf.text(left, margin, y);
          pdf.text(right, 108, y);
          y += 6;
        });


        pdf.setFontSize(8);
        pdf.setTextColor(90, 90, 90);
        pdf.text('Mesa física: 300 × 159 cm | laterais sem corte: 19 cm de cada lado | área útil: 262 × até 150 cm', margin, pageHeight - 10);

        files.push({
          name: `cortes/plano-${String(index + 1).padStart(2, '0')}.png`,
          data: dataUrlToUint8Array(url),
        });
      });

      files.push({
        name: 'relatorio/relatorio-de-cortes.pdf',
        data: new Uint8Array(pdf.output('arraybuffer')),
      });

      const zipBlob = createZipBlob(files);
      downloadBlob(zipBlob, `plano-de-corte-${profile?.slug || 'medicao'}.zip`);
    } catch (error) {
      console.error('Erro ao gerar pacote de corte:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="card border-dark-700">
      <div className="card-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-dark-200">Preview do melhor corte</h2>
          <p className="mt-1 text-xs text-dark-500">Encaixe calculado para {material.label.toLowerCase()} com largura de {formatNumber(result.materialWidth)} cm.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${material.border} ${material.softTone}`}>{material.label}</span>
      </div>
      <div className="card-body space-y-5">
        {previewUrl ? (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-dark-400">Parte 1</div>
            <div className="relative w-full overflow-hidden rounded-xl border border-dark-700 bg-dark-900">
              <img src={previewUrl} alt={`Preview de ${profile?.name} com medidas e melhor corte`} className="block w-full" />
              {(() => {
                const firstPlan = result.tablePlan || result.cutPlans?.[0];
                const previewQuantity = Math.min(Number(result.quantity) || 0, Number(firstPlan?.capacity) || 0);
                const piecesPerRow = Math.max(1, Number(firstPlan?.piecesPerRow) || 1);
                const lastPieceIndex = Math.max(0, previewQuantity - 1);
                const lastRow = Math.floor(lastPieceIndex / piecesPerRow);
                const lastColumn = lastPieceIndex % piecesPerRow;
                const cutWidthCm = Number(firstPlan?.pieceWidth) || Number(result.productWidth) || 0;
                const cutHeightCm = Number(firstPlan?.pieceHeight) || Number(result.productHeight) || 0;
                const cutAreaX = 221;
                const mainAreaY = 108 + (365 - (365 * (150 / 159)));
                const cutAreaWidth = 758;
                const materialPlanDrawHeight = 344.34;
                const accordionWidth = Number(result.accordionWidth) || 0;
                const accordionDrawWidth = accordionWidth > 0 ? accordionWidth * (cutAreaWidth / 262) : 0;
                const mainPieceDrawWidth = cutWidthCm * (cutAreaWidth / 262);
                const pieceWidth = mainPieceDrawWidth + (accordionDrawWidth * 2);
                const pieceHeight = cutHeightCm * (materialPlanDrawHeight / 150);
                const pieceX = cutAreaX + (lastColumn * pieceWidth);
                const pieceY = mainAreaY + (lastRow * pieceHeight);
                return null;
              })()}
            </div>
          </div>
        ) : <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">{!result.quantityValid ? 'Informe uma quantidade maior que zero para gerar o preview.' : !result.materialHeightValid ? `A altura de ${formatNumber(result.productHeight)} cm excede o limite vertical de ${formatNumber(result.maxMaterialHeight)} cm do material.` : `Preview indisponível: não há capacidade física disponível para gerar o plano de corte.`}</div>}
        {secondaryPreviewUrls.map((url, index) => (
          <div className="space-y-2" key={`secondary-preview-${index}`}>
            <div className="text-xs font-medium uppercase tracking-wide text-dark-400">Parte {index + 2}</div>
            <img src={url} alt={`Preview do plano de corte ${index + 2}`} className="w-full rounded-xl border border-dark-700 bg-dark-900" />
          </div>
        ))}
        <div className="flex justify-end">
          <button type="button" onClick={handleDownload} disabled={!previewUrl || downloading} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={16} /> {downloading ? 'Gerando ZIP...' : 'Baixar ZIP'}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-dark-400">
          <span><strong className="text-dark-200">{formatNumber(result.completeUnitsPerRow, 0)}</strong> mochila(s) por conjunto de plano(s)</span>
          <span><strong className="text-dark-200">{formatNumber(result.rowsNeeded, 0)}</strong> conjunto(s) para a quantidade informada</span>
          <span>As áreas coloridas representam o material aproveitado.</span>
        </div>
      </div>
    </div>
  );
}

function drawDimension(context, startX, startY, endX, endY, label, direction) {
  context.strokeStyle = '#d1d5db';
  context.fillStyle = '#d1d5db';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.font = '500 18px sans-serif';
  if (direction === 'horizontal') context.fillText(label, (startX + endX) / 2 - 30, startY + 28);
  else context.fillText(label, startX - 65, (startY + endY) / 2);
}

function drawCutStrip(context, x, y, width, height, cut, color, label, materialWidth, pieceCount, measurementLabel) {
  context.fillStyle = '#d1d5db';
  context.font = '600 20px sans-serif';
  const piecesPerRow = Math.max(cut.piecesPerRow, 1);
  const totalPieces = Math.max(pieceCount, 0);
  const rows = Math.max(Math.ceil(totalPieces / piecesPerRow), 1);
  context.fillText(`${label} (${formatNumber(totalPieces, 0)} peças / ${formatNumber(rows, 0)} fileira(s))`, x, y - 18);
  context.fillStyle = '#1f2937';
  context.fillRect(x, y, width, height);
  const visibleRows = Math.min(rows, 4);
  const rowHeight = height / visibleRows;
  const pieceWidth = cut.pieceWidth > 0 && materialWidth > 0 ? Math.min(width / piecesPerRow, (cut.pieceWidth / materialWidth) * width) : 0;
  for (let row = 0; row < visibleRows; row += 1) {
    const rowPieceCount = rows > visibleRows || row < rows - 1
      ? piecesPerRow
      : Math.max(totalPieces - (row * piecesPerRow), 1);
    for (let index = 0; index < rowPieceCount; index += 1) {
      context.fillStyle = color;
      const pieceX = x + (index * pieceWidth);
      const pieceY = y + (row * rowHeight);
      const boxWidth = Math.max(0, pieceWidth - 2);
      const boxHeight = Math.max(0, rowHeight - 2);
      context.fillRect(pieceX, pieceY, boxWidth, boxHeight);
    }
    const rowUsedWidth = pieceWidth * rowPieceCount;
    context.fillStyle = '#374151';
    const leftoverX = x + rowUsedWidth;
    const leftoverWidth = Math.max(0, width - rowUsedWidth);
    const leftoverY = y + (row * rowHeight);
    context.fillRect(leftoverX, leftoverY, leftoverWidth, rowHeight);
    const rowUsedMaterialWidth = cut.pieceWidth * rowPieceCount;
    const leftoverText = measurementLabel || `${formatNumber(rowUsedMaterialWidth, 0)} cm`;
    drawResponsivePieceLabel(context, leftoverX, leftoverY, leftoverWidth, rowHeight, leftoverText, '#d1d5db');
  }
}

function drawResponsivePieceLabel(context, x, y, width, height, label, textColor = '#111827') {
  if (width < 28 || height < 20) return;
  let fontSize = Math.min(16, Math.max(8, Math.floor(Math.min(width / 7, height / 2.4))));
  context.font = `600 ${fontSize}px sans-serif`;
  while (fontSize > 8 && context.measureText(label).width > width - 6) {
    fontSize -= 1;
    context.font = `600 ${fontSize}px sans-serif`;
  }
  if (context.measureText(label).width > width - 6) return;
  context.fillStyle = textColor;
  context.textAlign = 'center';
  context.fillText(label, x + (width / 2), y + (height / 2) + (fontSize / 3));
  context.textAlign = 'left';
}

function drawCombinedCutStrip(context, x, y, width, height, result, color) {
  const mainWidth = result.mainCut.pieceWidth * 2 * result.quantity;
  const sideWidth = result.sideCut.pieceWidth * 2 * result.quantity;
  const scale = result.materialWidth > 0 ? width / result.materialWidth : 0;
  const mainDrawWidth = mainWidth * scale;
  const sideDrawWidth = sideWidth * scale;
  const leftoverDrawWidth = Math.max(0, width - ((mainWidth + sideWidth) * scale));

  context.fillStyle = '#d1d5db';
  context.font = '600 20px sans-serif';
  context.fillText('As duas partes na mesma faixa de material', x, y - 12);
  context.fillStyle = '#1f2937';
  context.fillRect(x, y, width, height);
  context.fillStyle = color;
  context.fillRect(x, y, mainDrawWidth, height);
  context.fillStyle = '#f59e0b';
  context.fillRect(x + mainDrawWidth, y, sideDrawWidth, height);
  context.fillStyle = '#374151';
  context.fillRect(x + mainDrawWidth + sideDrawWidth, y, leftoverDrawWidth, height);
  drawResponsivePieceLabel(context, x, y, mainDrawWidth, height, `principal ${formatNumber(mainWidth)} cm`);
  drawResponsivePieceLabel(context, x + mainDrawWidth, y, sideDrawWidth, height, `lateral ${formatNumber(sideWidth)} cm`);
  drawResponsivePieceLabel(context, x + mainDrawWidth + sideDrawWidth, y, leftoverDrawWidth, height, `sobra ${formatNumber(result.sharedLeftover)} cm`, '#d1d5db');
}

export default function ProfileGroupPage() {
  const { groupSlug } = useParams();
  const { company, user, userData } = useAuth();
  const group = findProfileGroup(groupSlug || 'mochilas');
  const firstProfile = group?.items[0];
  const [form, setForm] = useState({ ...DEFAULT_FORM, profileSlug: firstProfile?.slug || '', cordQuantity: firstProfile?.cordQuantity ?? DEFAULT_FORM.cordQuantity, handleQuantity: firstProfile?.handleQuantity ?? DEFAULT_FORM.handleQuantity });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const profile = group?.items.find((item) => item.slug === form.profileSlug) || group?.items[0];
  const result = useMemo(() => {
    const height = Number(form.height) || 0;
    const width = Number(form.width) || 0;
    const length = Number(form.length) || 0;
    const accordionWidth = profile?.kind === 'backpack' ? (Number(form.accordionWidth) || 0) : 0;
    const sideWidth = Math.max(0, length);
    const quantity = Math.max(0, Math.floor(Number(form.quantity) || 0));
    const wasteFactor = 1 + ((Number(form.waste) || 0) / 100);
    // Cada unidade corresponde a um único corte de material.
    const accordionMaterialWidth = accordionWidth > 0 ? (accordionWidth * 2) : 0;
    const bodyArea = height * (width + length + accordionMaterialWidth);
    const accordionCountPerUnit = profile?.kind === 'backpack' && accordionWidth > 0 ? 2 : 0;
    const accordionPieceWidth = accordionWidth;
    const accordionPieceHeight = height;
    const areaPerUnit = (bodyArea / 10000) * wasteFactor;
    const totalArea = areaPerUnit * quantity;
    const materialWidth = Math.max(Number(form.materialWidth) || 1, 1);
    const tableLengthCm = 300;
    const lateralWasteCm = 19;
    const usableCutLength = tableLengthCm - (lateralWasteCm * 2);
    const maxMaterialHeight = 150;
    const quantityValid = quantity > 0;
    const materialWidthValid = materialWidth > 0;
    const materialHeightValid = height > 0 && width > 0 && (height <= materialWidth || width <= materialWidth);
    const productWidthValid = width > 0 && height > 0 && (width <= usableCutLength || height <= usableCutLength);
    const accordionValid = length > 0 && accordionWidth >= 0;
    const usableMaterialWidth = usableCutLength;
    const mainCut = calculateCut(usableCutLength, width, height, quantity, false);
    const sideCut = calculateCut(usableCutLength, sideWidth, height, quantity * 2, false);
    const materialPerBackpack = mainCut.pieceWidth || 0;
    const materialPlans = [];
    let remainingMaterialWidth = materialWidth;
    while (remainingMaterialWidth > 0) {
      const segmentWidth = Math.min(150, remainingMaterialWidth);
      const plan = calculateTablePlan(segmentWidth, width, height, accordionWidth);
      if (plan.capacity > 0) materialPlans.push(plan);
      remainingMaterialWidth -= segmentWidth;
    }
    const totalCapacity = materialPlans.reduce((sum, plan) => sum + plan.capacity, 0);
    const baseTablePlan = materialPlans[0] || calculateTablePlan(Math.min(materialWidth, 150), width, height, accordionWidth);
    const placedPieces = Math.min(quantity, totalCapacity);
    const placedInFirstPlan = Math.min(placedPieces, baseTablePlan.capacity);
    const placedRows = baseTablePlan.piecesPerRow > 0 ? Math.ceil(placedInFirstPlan / baseTablePlan.piecesPerRow) : 0;
    const placedColumns = placedInFirstPlan > 0 ? Math.min(baseTablePlan.piecesPerRow, placedInFirstPlan) : 0;
    const tablePlan = {
      ...baseTablePlan,
      placedPieces: placedInFirstPlan,
      placedRows,
      placedColumns,
      placedLengthLeftover: baseTablePlan.usableLength - (placedColumns * (baseTablePlan.groupLength || baseTablePlan.pieceWidth)),
      placedWidthLeftover: baseTablePlan.width - (placedRows * baseTablePlan.pieceHeight),
      placedAreaLeftover: (baseTablePlan.usableLength * baseTablePlan.width) - (placedInFirstPlan * ((baseTablePlan.pieceWidth * baseTablePlan.pieceHeight) + ((baseTablePlan.accordionWidth || 0) * baseTablePlan.pieceHeight * (baseTablePlan.accordionCountPerUnit || 0)))),
      emptyPositions: Math.max(0, baseTablePlan.capacity - placedInFirstPlan),
      emptyPositionArea: Math.max(0, baseTablePlan.capacity - placedInFirstPlan) * ((baseTablePlan.pieceWidth * baseTablePlan.pieceHeight) + ((baseTablePlan.accordionWidth || 0) * baseTablePlan.pieceHeight * (baseTablePlan.accordionCountPerUnit || 0))),
      residualEdgeArea: (baseTablePlan.usableLength * baseTablePlan.width) - (baseTablePlan.capacity * ((baseTablePlan.pieceWidth * baseTablePlan.pieceHeight) + ((baseTablePlan.accordionWidth || 0) * baseTablePlan.pieceHeight * (baseTablePlan.accordionCountPerUnit || 0)))),
    };
    const completeUnitsPerRow = totalCapacity;
    const plansNeeded = materialPlans.length;
    const remainingBackpacks = completeUnitsPerRow > 0 ? quantity % completeUnitsPerRow : quantity;
    const sharedLeftover = tablePlan.lengthLeftover;
    const linearMaterial = plansNeeded * tableLengthCm * wasteFactor;
    const accordionUnitsRequired = accordionCountPerUnit * quantity;
    const accordionMaterialArea = accordionUnitsRequired * accordionPieceWidth * accordionPieceHeight;

    const usesCord = profile?.kind === 'drawstring' || (profile?.kind === 'backpack' && form.accessoryType === 'cord');
    const usesHandle = profile?.kind === 'bag' || (profile?.kind === 'backpack' && form.accessoryType === 'handle');
    // Medidas de referência para uma sacola 30 × 20 × 10 cm.
    // O comprimento do acessório acompanha proporcionalmente a altura da sacola.
    const accessoryScale = height > 0 ? height / 30 : 0;
    const handleLengthPerUnit = 35 * accessoryScale;
    const cordLengthPerUnit = 60 * accessoryScale;
    const handleLength = (Number(form.handleQuantity) || 0) * handleLengthPerUnit;
    const cordLength = (Number(form.cordQuantity) || 0) * cordLengthPerUnit;
    const handleMaterial = usesHandle ? handleLength * quantity / 100 : 0;
    const cordMaterial = usesCord ? cordLength * quantity / 100 : 0;
    const accordionFits = profile?.kind !== 'backpack' || accordionWidth <= 0 || (
      accordionWidth > 0 &&
      baseTablePlan.pieceWidth + (accordionWidth * 2) <= usableCutLength &&
      height <= Math.min(materialWidth, maxMaterialHeight)
    );
    const quantityWithinCapacity = quantity <= totalCapacity;
    const canCut = quantityValid && materialWidthValid && materialHeightValid && productWidthValid && totalCapacity > 0;
    const validCompleteUnitsPerRow = completeUnitsPerRow;
    const rowsNeeded = canCut ? plansNeeded : 0;
    const accessoryType = profile?.kind === 'backpack' ? form.accessoryType : profile?.kind === 'drawstring' ? 'cord' : 'handle';
    return { areaPerUnit, totalArea, linearMaterial, accordionMaterialArea, accordionUnitsRequired, accordionCountPerUnit, accordionPieceWidth, accordionPieceHeight, handleMaterial, cordMaterial, mainCut, sideCut, tablePlan, cutPlans: materialPlans, plansToCut: materialPlans, totalCapacity, materialWidth, usableMaterialWidth, materialPerBackpack, sharedLeftover, completeUnitsPerRow: validCompleteUnitsPerRow, remainingBackpacks, plansNeeded, rowsNeeded, quantity, quantityValid, quantityWithinCapacity, accessoryType, hasAccordion: accordionWidth > 0, accordionWidth, sideWidth, accordionValid, accordionFits, materialWidthValid, materialHeightValid, productWidthValid, canCut, maxMaterialHeight, productHeight: baseTablePlan.pieceHeight, productWidth: baseTablePlan.pieceWidth, productLength: length,
      originalProductHeight: height, originalProductWidth: width, cordLength, cordQuantity: form.cordQuantity, handleLength, handleQuantity: form.handleQuantity };
  }, [form, profile]);

  const budgetResult = useMemo(() => {
    const quantity = Math.max(0, Math.floor(Number(form.quantity) || 0));
    const material = (result.linearMaterial / 100) * (Number(budget.materialCostPerMeter) || 0);
    const accessories = (result.handleMaterial + result.cordMaterial) * (Number(budget.accessoryCostPerMeter) || 0);
    const labor = quantity * (Number(budget.laborCostPerUnit) || 0);
    const productsTotal = quantity * (Number(budget.unitPrice) || 0);
    const productionTotal = material + accessories + labor;
    const productionPerUnit = quantity > 0 ? productionTotal / quantity : 0;
    const profitPerUnit = (Number(budget.unitPrice) || 0) - productionPerUnit;
    const profitTotal = productsTotal - productionTotal;
    return { material, accessories, labor, productsTotal, productionTotal, productionPerUnit, profitPerUnit, profitTotal, total: productionTotal };
  }, [budget, form.quantity, result]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const handleDownloadPreview = async () => {
    if (!company?.id) return;
    await logAudit(company.id, { user, userName: userData?.name, action: 'export', entity: 'Medição', description: `${userData?.name || 'Usuário'} exportou o pacote ZIP da medição, com os previews PNG e o relatório PDF.`, details: { format: 'ZIP+PDF', profile: profile?.name, quantity: result.quantity, dimensions: `${result.productHeight}x${result.productWidth}x${result.productLength}` } });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Medição" subtitle="Informe as medidas da mochila e calcule o melhor aproveitamento do material." />
      <div className="space-y-6">
          <div className="card">
            <div className="card-header"><h2 className="text-lg font-semibold text-dark-100">{profile?.name}</h2><p className="text-sm text-dark-500 mt-1">{profile?.notes}</p></div>
            <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-4">
              {[['height', 'Altura (cm)'], ['width', 'Largura (cm)'], ['length', 'Comprimento (cm)'], ['quantity', 'Quantidade']].map(([field, label]) => <label key={field} className="label">{label}<input type="number" min="0" className="input mt-1" value={form[field]} onChange={(e) => update(field, e.target.value)} /></label>)}
              <label className="label">Largura do material (cm)<input type="number" min="1" className="input mt-1" value={form.materialWidth} onChange={(e) => update('materialWidth', e.target.value)} /></label>
              <label className="label">Desperdício (%)<input type="number" min="0" className="input mt-1" value={form.waste} onChange={(e) => update('waste', e.target.value)} /></label>
              {profile?.kind === 'backpack' && <label className="label">Ajuste da sanfona lateral (cm)<input type="number" min="0" step="0.1" className="input mt-1" value={form.accordionWidth} onChange={(e) => update('accordionWidth', e.target.value)} placeholder="0 = sem ajuste" /></label>}
              {profile?.kind === 'backpack' && <label className="label">Acabamento<select className="input mt-1" value={form.accessoryType} onChange={(e) => update('accessoryType', e.target.value)}><option value="cord">Cordão</option><option value="handle">Alça</option></select></label>}
              {(profile?.kind === 'bag' || (profile?.kind === 'backpack' && form.accessoryType === 'handle')) && <>
                <div className="col-span-2 md:col-span-4 rounded-xl border border-primary-400/20 bg-primary-400/5 px-4 py-3 text-sm text-dark-300">
                  <strong className="text-dark-100">Alça automática:</strong> {formatNumber(result.handleLength || 0, 1)} cm por alça
                  <span className="ml-1 text-dark-500">(referência: 35 cm para 30 × 20 × 10 cm, ajustada pela altura informada)</span>
                </div>
                <label className="label">Quantidade de alças<select className="input mt-1" value={form.handleQuantity} onChange={(e) => update('handleQuantity', e.target.value)}><option value="0">0 alças</option><option value="1">1 alça</option><option value="2">2 alças</option></select></label>              </>}
              {(profile?.kind === 'drawstring' || (profile?.kind === 'backpack' && form.accessoryType === 'cord')) && <>
                <div className="col-span-2 md:col-span-4 rounded-xl border border-primary-400/20 bg-primary-400/5 px-4 py-3 text-sm text-dark-300">
                  <strong className="text-dark-100">Cordão automático:</strong> {formatNumber((Number(result.cordLength) || 0) / Math.max(1, Number(result.cordQuantity) || 0), 1)} cm por cordão
                  <span className="ml-1 text-dark-500">(referência: 60 cm para 30 × 20 × 10 cm, ajustada pela altura informada)</span>
                  <span className="ml-1 text-dark-300">· Total para {formatNumber(result.quantity || 0, 0)} mochila(s): {formatNumber((Number(result.cordLength) || 0) * (Number(result.quantity) || 0), 1)} cm</span>
                </div>
                <label className="label">Quantidade de cordões<select className="input mt-1" value={form.cordQuantity} onChange={(e) => update('cordQuantity', e.target.value)}><option value="0">0 cordões</option><option value="1">1 cordão</option><option value="2">2 cordões</option></select></label>
              </>}
            </div>
            <div className="px-6 pb-6">
              <button type="button" className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => setBudgetOpen(true)} disabled={!result.canCut}>
                <DollarSign size={17} /> Orçamento rápido
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-primary-400/30 bg-gradient-to-br from-primary-400/10 via-dark-900/30 to-dark-900 px-5 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-300">Capacidade de corte</div>
                <h2 className="mt-1 text-2xl font-bold text-dark-100">Quantas unidades cabem em um plano</h2>
                <p className="mt-1 text-sm text-dark-400">O preview testa as duas orientações possíveis e usa automaticamente a que acomoda mais unidades.</p>
              </div>
              <div className="rounded-xl border border-primary-400/30 bg-primary-400/10 px-5 py-3 text-center md:min-w-[190px]">
                <div className="text-xs font-medium text-primary-200">Capacidade máxima</div>
                <div className="mt-0.5 text-3xl font-bold text-primary-300">{formatNumber(result.completeUnitsPerRow, 0)}</div>
                <div className="text-xs text-dark-400">unidades por plano</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-dark-700 bg-dark-800/60 p-4">
                <div className="text-xs font-medium text-dark-500">Por fileira</div>
                <div className="mt-1 text-xl font-bold text-dark-100">{formatNumber(result.tablePlan?.piecesPerRow || 0, 0)}</div>
                <div className="text-xs text-dark-400">unidades no comprimento</div>
              </div>
              <div className="rounded-xl border border-dark-700 bg-dark-800/60 p-4">
                <div className="text-xs font-medium text-dark-500">Fileiras</div>
                <div className="mt-1 text-xl font-bold text-dark-100">{formatNumber(result.tablePlan?.rows || 0, 0)}</div>
                <div className="text-xs text-dark-400">na largura útil</div>
              </div>
              <div className="rounded-xl border border-dark-700 bg-dark-800/60 p-4">
                <div className="text-xs font-medium text-dark-500">Mesa útil</div>
                <div className="mt-1 text-xl font-bold text-dark-100">262 × {formatNumber(result.tablePlan?.width || 0, 0)}</div>
                <div className="text-xs text-dark-400">cm de área de corte</div>
              </div>
              <div className="rounded-xl border border-dark-700 bg-dark-800/60 p-4">
                <div className="text-xs font-medium text-dark-500">Quantidade informada</div>
                <div className="mt-1 text-xl font-bold text-dark-100">{formatNumber(result.quantity, 0)}</div>
                <div className={`text-xs ${result.quantityWithinCapacity ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {result.quantityWithinCapacity ? 'cabe neste plano' : 'acima da capacidade'}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-dark-700 bg-dark-950/40 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-dark-500">Como o limite é calculado</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-dark-300">
                    <span className="rounded-lg bg-dark-800 px-3 py-2">{formatNumber(result.tablePlan?.piecesPerRow || 0, 0)} por fileira</span>
                    <span className="text-dark-600">×</span>
                    <span className="rounded-lg bg-dark-800 px-3 py-2">{formatNumber(result.tablePlan?.rows || 0, 0)} fileiras</span>
                    <span className="text-dark-600">=</span>
                    <strong className="rounded-lg border border-primary-400/30 bg-primary-400/10 px-3 py-2 text-primary-300">{formatNumber(result.completeUnitsPerRow, 0)} unidades</strong>
                  </div>
                </div>
                <div className="text-sm text-dark-400 md:max-w-sm md:text-right">
                  Cada unidade ocupa <strong className="text-dark-200">{formatNumber(result.productWidth, 0)} × {formatNumber(result.productHeight, 0)} cm</strong> nesta orientação.
                  {result.tablePlan?.rotated && <span className="block mt-1 text-primary-300">✓ Rotação de 90° escolhida para aumentar o aproveitamento.</span>}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-dark-700 bg-dark-800/40 p-4">
                <div className="text-sm font-semibold text-dark-200">Sobras do plano</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-dark-500">Comprimento</div>
                    <div className="mt-1 font-semibold text-dark-100">{formatNumber(result.tablePlan?.lengthLeftover || 0, 0)} cm</div>
                  </div>
                  <div>
                    <div className="text-xs text-dark-500">Largura</div>
                    <div className="mt-1 font-semibold text-dark-100">{formatNumber(result.tablePlan?.widthLeftover || 0, 0)} cm</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-dark-400">Essas são as sobras depois de preencher a capacidade máxima do plano.</div>
              </div>

              <div className="rounded-xl border border-dark-700 bg-dark-800/40 p-4">
                <div className="text-sm font-semibold text-dark-200">Para a quantidade informada</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-dark-500">Espaços vazios</div>
                    <div className="mt-1 font-semibold text-dark-100">{formatNumber(result.tablePlan?.emptyPositions || 0, 0)} posição(ões)</div>
                  </div>
                  <div>
                    <div className="text-xs text-dark-500">Área livre</div>
                    <div className="mt-1 font-semibold text-dark-100">{formatNumber(result.tablePlan?.placedAreaLeftover || 0, 0)} cm²</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-dark-400">Mostra o espaço que permanece livre após acomodar a quantidade solicitada.</div>
              </div>
            </div>

            {result.hasAccordion && (
              <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${result.accordionFits ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                <strong>Sanfona lateral:</strong> {result.accordionFits ? `os ${formatNumber(result.accordionWidth, 0)} cm cabem na sobra disponível do plano.` : `os ${formatNumber(result.accordionWidth, 0)} cm não cabem na sobra disponível do plano.`}
              </div>
            )}

            {result.remainingBackpacks > 0 && (
              <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <strong>Próximo corte:</strong> {formatNumber(result.remainingBackpacks, 0)} unidade(s) ficarão para o próximo plano.
              </div>
            )}
          </div>
          <CutPreview profile={profile} result={result} onDownload={handleDownloadPreview} />
      </div>
      <Modal open={budgetOpen} onClose={() => setBudgetOpen(false)} title="Orçamento rápido" size="md">
        <div className="space-y-5">
          <div className="rounded-xl bg-dark-800/60 border border-dark-700 p-4">
            <div className="text-sm font-semibold text-dark-100">{profile?.name}</div>
            <div className="text-xs text-dark-500 mt-1">Quantidade: {formatNumber(form.quantity, 0)} unidade(s)</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="label flex flex-col"><span className="min-h-[2.5rem] flex items-end">Valor por mochila</span><input type="number" min="0" step="0.01" className="input mt-1" value={budget.unitPrice} onChange={(e) => setBudget({ ...budget, unitPrice: e.target.value })} placeholder="R$ 0,00" /></label>
            <label className="label flex flex-col"><span className="min-h-[2.5rem] flex items-end">Material / metro</span><input type="number" min="0" step="0.01" className="input mt-1" value={budget.materialCostPerMeter} onChange={(e) => setBudget({ ...budget, materialCostPerMeter: e.target.value })} placeholder="R$ 0,00" /></label>
            <label className="label flex flex-col"><span className="min-h-[2.5rem] flex items-end">Alças / cordões / metro</span><input type="number" min="0" step="0.01" className="input mt-1" value={budget.accessoryCostPerMeter} onChange={(e) => setBudget({ ...budget, accessoryCostPerMeter: e.target.value })} placeholder="R$ 0,00" /></label>
            <label className="label flex flex-col"><span className="min-h-[2.5rem] flex items-end">Mão de obra / unidade</span><input type="number" min="0" step="0.01" className="input mt-1" value={budget.laborCostPerUnit} onChange={(e) => setBudget({ ...budget, laborCostPerUnit: e.target.value })} placeholder="R$ 0,00" /></label>
          </div>
          <div className="rounded-xl border border-primary-400/20 bg-primary-400/5 p-4 space-y-3">
            <div className="flex justify-between text-sm text-dark-300"><span>Material ({formatNumber(result.linearMaterial / 100)} m)</span><span>{formatBRL(budgetResult.material)}</span></div>
            <div className="flex justify-between text-sm text-dark-300"><span>Alças / cordões ({formatNumber(result.handleMaterial + result.cordMaterial)} m)</span><span>{formatBRL(budgetResult.accessories)}</span></div>
            <div className="flex justify-between text-sm text-dark-300"><span>Mão de obra</span><span>{formatBRL(budgetResult.labor)}</span></div>
            <div className="flex justify-between text-sm font-medium text-dark-200"><span>{formatNumber(form.quantity, 0)} mochila(s) × {formatBRL(budget.unitPrice || 0)}</span><span>{formatBRL(budgetResult.productsTotal)}</span></div>
            <div className="border-t border-dark-700 pt-3 flex justify-between font-bold text-dark-100"><span>Custo estimado de produção</span><span className="text-lg text-amber-300">{formatBRL(budgetResult.total)}</span></div>
            <div className="flex justify-between font-bold text-dark-100"><span>Total das mochilas</span><span className="text-xl text-primary-300">{formatBRL(budgetResult.productsTotal)}</span></div>
            <div className={`rounded-lg border p-3 ${budgetResult.profitPerUnit > 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
              <div className={`font-semibold ${budgetResult.profitPerUnit > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {budgetResult.profitPerUnit > 0 ? 'Com lucro' : 'Sem lucro'}
              </div>
              <div className="text-xs text-dark-300 mt-1">Custo por mochila: {formatBRL(budgetResult.productionPerUnit)} · Lucro por mochila: {formatBRL(budgetResult.profitPerUnit)}</div>
              <div className="text-xs text-dark-400 mt-1">Resultado total: {formatBRL(budgetResult.profitTotal)}</div>
            </div>
            <div className="text-xs text-dark-500">Custo estimado para {formatNumber(form.quantity, 0)} unidade(s), com base nos valores informados.</div>
            </div>
          </div>
      </Modal>
    </div>
  );
}