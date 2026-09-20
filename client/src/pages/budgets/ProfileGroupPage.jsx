import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Download, DollarSign } from 'lucide-react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { findProfileGroup } from '../../data/budgetProfiles';
import Modal from '../../components/ui/Modal';
import { formatBRL } from '../../utils/format';
import { useAuth } from '../../context/useAuth';
import { logAudit } from '../../services/firebase/settings';

const DEFAULT_FORM = { profileSlug: '', height: 30, width: 25, length: 10, accordionWidth: 0, quantity: 100, materialWidth: 140, waste: 10, accessoryType: 'cord', handleLength: 60, handleQuantity: 2, cordLength: 140, cordQuantity: 1 };
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

const MATERIAL_PREVIEW = {
  backpack: { label: 'Material da mochila', tone: 'bg-amber-400', softTone: 'bg-amber-400/10', border: 'border-amber-400/40' },
  drawstring: { label: 'Nylon / TNT', tone: 'bg-amber-400', softTone: 'bg-amber-400/10', border: 'border-amber-400/40' },
  bag: { label: 'Tecido ecológico', tone: 'bg-emerald-400', softTone: 'bg-emerald-400/10', border: 'border-emerald-400/40' },
  paper: { label: 'Papel', tone: 'bg-sky-400', softTone: 'bg-sky-400/10', border: 'border-sky-400/40' },
  plastic: { label: 'Plástico', tone: 'bg-fuchsia-400', softTone: 'bg-fuchsia-400/10', border: 'border-fuchsia-400/40' },
};

function CutPreview({ profile, result, onDownload }) {
  const material = MATERIAL_PREVIEW[profile?.kind] || MATERIAL_PREVIEW.bag;
  const [previewUrl, setPreviewUrl] = useState('');
  const [secondaryPreviewUrl, setSecondaryPreviewUrl] = useState('');
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
    const mainPieceWidth = Number(result.mainCut.pieceWidth) || 50;
    const mainPieceHeight = Number(result.mainCut.pieceLength) || 90;
    const sidePieceWidth = Number(result.sideCut.pieceWidth) || 10;
    const sidePieceHeight = Number(result.sideCut.pieceLength) || 90;
    const mainPiecesPerRow = Math.max(Number(result.mainCut.piecesPerRow) || 7, 1);
    const sidePiecesPerRow = Math.max(Number(result.sideCut.piecesPerRow) || 7, 1);

    if (!result.quantityValid || !result.accordionValid || result.completeUnitsPerRow < 1 || result.quantity > result.completeUnitsPerRow) {
      setPreviewUrl('');
      return undefined;
    }

    const loadTableImage = () => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/mesa.png';
    });

    const drawCardText = (x, y, width, height, title, lines, fill, titleSize = 12, bodySize = 11) => {
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
        const lineY = y + 42 + (index * 16);
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
    context.fillText(`PLANO DE CORTE - ${formatNumber(quantity, 0)} SACOLAS DE TNT (LARGURA DO TNT: ${formatNumber(materialWidth, 0)} cm)`, panelX + 18, panelY + 28);
    context.font = '600 11px Arial';
    context.fillText(`Peça principal: ${formatNumber(mainPieceWidth, 0)} x ${formatNumber(mainPieceHeight, 0)} cm (100 un) | Sanfona: ${formatNumber(sidePieceWidth, 0)} x ${formatNumber(sidePieceHeight, 0)} cm (100 un)`, panelX + 18, panelY + 46);

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
    context.fillStyle = 'rgba(160, 160, 160, 0.28)';
    context.fillRect(wasteBoxX, wasteBoxY, wasteBoxW, wasteBoxH);

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

    context.fillStyle = '#111827';
    context.font = '700 11px Arial';
    context.fillText('Largura', stripX + stripWidth + 8, stripY + 32);
    context.fillText('total do TNT', stripX + stripWidth + 8, stripY + 46);
    context.fillText(`${formatNumber(materialWidth, 0)} cm`, stripX + stripWidth + 8, stripY + 60);

    const cardY = 520;
    const cardGap = 22;
    const cardWidth = (panelWidth - 120 - (cardGap * 2)) / 3;
    const cardHeight = 170;
    const cardStartX = 60;
    const totalFaixas = Math.max(1, Math.ceil(quantity / Math.max(mainPiecesPerRow, 1)));
    const totalComprimentoCm = Math.max(0, (mainPieceWidth + sidePieceWidth) * 2 * quantity);
    const totalComprimentoM = totalComprimentoCm / 100;

    drawCardText(cardStartX, cardY, cardWidth, cardHeight, 'APROVEITAMENTO POR FAIXA DE 300 cm', [
      `Peças principais (${formatNumber(mainPieceWidth, 0)} x ${formatNumber(mainPieceHeight, 0)} cm): ${formatNumber(mainPiecesPerRow, 0)} unidades por faixa`,
      `Sanfona (${formatNumber(sidePieceWidth, 0)} x ${formatNumber(sidePieceHeight, 0)} cm): ${formatNumber(sidePiecesPerRow, 0)} unidades por faixa`,
      `Total por faixa: ${formatNumber(Math.max(1, Math.floor(quantity / totalFaixas)), 0)} sacolas completas`,
      `Para ${formatNumber(quantity, 0)} sacolas: ${formatNumber(totalFaixas, 0)} faixas de 300 cm`,
      `Cálculo para ${formatNumber(quantity, 0)} sacolas`,
    ], '#dfeaf5', 12, 9.5);

    drawCardText(cardStartX + cardWidth + cardGap, cardY, cardWidth, cardHeight, 'CONSUMO DE TNT', [
      `Comprimento total: ${formatNumber(totalComprimentoCm, 0)} cm`,
      `Comprimento total em metros lineares: ${formatNumber(totalComprimentoM, 2)} m`,
      `Largura do rolo: ${formatNumber(materialWidth, 0)} cm`,
      `(com pequena sobra lateral de 19 cm de cada lado)`,
    ], '#f5dfe8', 12, 9.5);

    drawCardText(cardStartX + (cardWidth + cardGap) * 2, cardY, cardWidth, cardHeight, 'DICAS', [
      '• Ajuste a peça principal na maior direção do rolo.',
      '• Aproveite a largura útil do material para reduzir sobras.',
      '• Revise a sanfona antes do corte final para evitar perdas.',
      '• Faça o cálculo por faixa antes de confirmar a produção.',
    ], '#dff2df', 12, 9.5);

    context.fillStyle = '#0a0b0e';
    context.font = '700 14px Arial';
    context.fillText('LAYOUT SIMPLES, RÁPIDO E COM MÍNIMO DE DESPERDÍCIO', panelX + 150, panelY + panelHeight - 18);

    setPreviewUrl(canvas.toDataURL('image/png'));

    if (materialWidth > 150) {
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
      duplicateContext.fillText(`PLANO DE CORTE - 2 SACOLAS DE TNT (LARGURA DO TNT: ${formatNumber(materialWidth, 0)} cm)`, 18, 30);
      duplicateContext.font = '600 11px Arial';
      duplicateContext.fillText(`Peça principal: ${formatNumber(mainPieceWidth, 0)} x ${formatNumber(mainPieceHeight, 0)} cm (100 un) | Sanfona: ${formatNumber(sidePieceWidth, 0)} x ${formatNumber(sidePieceHeight, 0)} cm (100 un)`, 18, 52);
      setSecondaryPreviewUrl(duplicateCanvas.toDataURL('image/png'));
    } else {
      setSecondaryPreviewUrl('');
    }
    });
  }, [material.label, profile, result]);

  const handleDownload = async () => {
    if (!previewUrl || downloading) return;
    setDownloading(true);
    try {
      await onDownload();
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = 'preview-corte.png';
      link.click();
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
            <img src={previewUrl} alt={`Preview de ${profile?.name} com medidas e melhor corte`} className="w-full rounded-xl border border-dark-700 bg-dark-900" />
          </div>
        ) : <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">{!result.quantityValid ? 'Informe uma quantidade maior que zero para gerar o preview.' : !result.accordionValid ? `A sanfona de ${formatNumber(result.accordionWidth)} cm não cabe na largura de material informada (${formatNumber(result.materialWidth)} cm).` : `Preview indisponível: a quantidade desejada (${formatNumber(result.quantity, 0)}) excede a capacidade de ${formatNumber(result.completeUnitsPerRow, 0)} mochila(s) por fileira.`}</div>}
        {secondaryPreviewUrl && (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-dark-400">Parte 2</div>
            <img src={secondaryPreviewUrl} alt="Preview complementar para material acima de 150 cm" className="w-full rounded-xl border border-dark-700 bg-dark-900" />
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={handleDownload} disabled={!previewUrl || downloading} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={16} /> {downloading ? 'Registrando...' : 'Baixar PNG'}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-dark-400">
          <span><strong className="text-dark-200">{formatNumber(result.completeUnitsPerRow, 0)}</strong> mochila(s) completas por fileira</span>
          <span><strong className="text-dark-200">{formatNumber(result.rowsNeeded, 0)}</strong> fileira(s) para a quantidade informada</span>
          <span>As áreas coloridas representam o material aproveitado.</span>
        </div>
      </div>
    </div>
  );
}

function drawAccordionSide(context, x, y, height, accordionWidth, mirrored) {
  const foldWidth = Math.min(55, Math.max(12, accordionWidth * 10));
  const folds = 5;
  const step = height / folds;
  context.beginPath();
  context.moveTo(x, y);
  for (let index = 0; index < folds; index += 1) {
    const direction = (index % 2 === 0 ? 1 : -1) * (mirrored ? -1 : 1);
    context.lineTo(x + (direction * foldWidth), y + step * (index + 0.5));
    context.lineTo(x, y + step * (index + 1));
  }
  context.stroke();
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
    const sideWidth = Math.max(0, length + accordionWidth);
    const quantity = Math.max(0, Math.floor(Number(form.quantity) || 0));
    const wasteFactor = 1 + ((Number(form.waste) || 0) / 100);
    const bodyArea = profile?.kind === 'paper' || profile?.kind === 'plastic'
      ? (2 * height * (width + sideWidth))
      : (2 * height * width) + (2 * height * sideWidth);
    const areaPerUnit = (bodyArea / 10000) * wasteFactor;
    const totalArea = areaPerUnit * quantity;
    const materialWidth = Math.max(Number(form.materialWidth) || 1, 1);
    const quantityValid = quantity > 0;
    const accordionValid = sideWidth > 0 && sideWidth <= materialWidth;
    const usableMaterialWidth = materialWidth;
    const mainCut = calculateCut(usableMaterialWidth, width, height, quantity * 2);
    const sideCut = calculateCut(materialWidth, sideWidth, height, quantity * 2, false);
    const materialPerBackpack = (mainCut.pieceWidth * 2) + (sideCut.pieceWidth * 2);
    const completeUnitsPerRow = materialPerBackpack > 0 ? Math.floor(materialWidth / materialPerBackpack) : 0;
    const sharedLeftover = materialPerBackpack > 0 ? materialWidth - (Math.min(quantity, Math.max(completeUnitsPerRow, 1)) * materialPerBackpack) : materialWidth;
    const linearMaterial = Math.max(mainCut.length, sideCut.length) * wasteFactor;
    const usesCord = profile?.kind === 'drawstring' || (profile?.kind === 'backpack' && form.accessoryType === 'cord');
    const usesHandle = profile?.kind === 'bag' || (profile?.kind === 'backpack' && form.accessoryType === 'handle');
    const handleMaterial = usesHandle ? (Number(form.handleLength) || 0) * (Number(form.handleQuantity) || 0) * quantity / 100 : 0;
    const cordMaterial = usesCord ? (Number(form.cordLength) || 0) * (Number(form.cordQuantity) || 0) * quantity / 100 : 0;
    const validCompleteUnitsPerRow = accordionValid ? completeUnitsPerRow : 0;
    const rowsNeeded = validCompleteUnitsPerRow > 0 ? Math.ceil(quantity / validCompleteUnitsPerRow) : 0;
    const accessoryType = profile?.kind === 'backpack' ? form.accessoryType : profile?.kind === 'drawstring' ? 'cord' : 'handle';
    return { areaPerUnit, totalArea, linearMaterial, handleMaterial, cordMaterial, mainCut, sideCut, materialWidth, usableMaterialWidth, materialPerBackpack, sharedLeftover, completeUnitsPerRow: validCompleteUnitsPerRow, rowsNeeded, quantity, quantityValid, accessoryType, hasAccordion: accordionWidth !== 0, accordionWidth, sideWidth, accordionValid, productHeight: height, productWidth: width, productLength: length, cordLength: form.cordLength, cordQuantity: form.cordQuantity, handleLength: form.handleLength, handleQuantity: form.handleQuantity };
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
    await logAudit(company.id, { user, userName: userData?.name, action: 'export', entity: 'Medição', description: `${userData?.name || 'Usuário'} baixou o preview PNG da medição da mochila.`, details: { format: 'PNG', profile: profile?.name, quantity: result.quantity, dimensions: `${result.productHeight}x${result.productWidth}x${result.productLength}` } });
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
              {profile?.kind === 'backpack' && <label className="label">Ajuste da sanfona lateral (cm)<input type="number" step="0.1" className="input mt-1" value={form.accordionWidth} onChange={(e) => update('accordionWidth', e.target.value)} placeholder="0 = sem ajuste" /></label>}
              {profile?.kind === 'backpack' && <label className="label">Acabamento<select className="input mt-1" value={form.accessoryType} onChange={(e) => update('accessoryType', e.target.value)}><option value="cord">Cordão</option><option value="handle">Alça</option></select></label>}
              {(profile?.kind === 'bag' || (profile?.kind === 'backpack' && form.accessoryType === 'handle')) && <>
                <label className="label">Comprimento da alça (cm)<input type="number" min="0" className="input mt-1" value={form.handleLength} onChange={(e) => update('handleLength', e.target.value)} /></label>
                <label className="label">Quantidade de alças<select className="input mt-1" value={form.handleQuantity} onChange={(e) => update('handleQuantity', e.target.value)}><option value="0">0 alças</option><option value="1">1 alça</option><option value="2">2 alças</option></select></label>
              </>}
              {(profile?.kind === 'drawstring' || (profile?.kind === 'backpack' && form.accessoryType === 'cord')) && <>
                <label className="label">Comprimento do cordão (cm)<input type="number" min="0" className="input mt-1" value={form.cordLength} onChange={(e) => update('cordLength', e.target.value)} /></label>
                <label className="label">Quantidade de cordões<select className="input mt-1" value={form.cordQuantity} onChange={(e) => update('cordQuantity', e.target.value)}><option value="0">0 cordões</option><option value="1">1 cordão</option><option value="2">2 cordões</option></select></label>
              </>}
            </div>
            <div className="px-6 pb-6">
              <button type="button" className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => setBudgetOpen(true)} disabled={!result.quantityValid || !result.accordionValid || result.completeUnitsPerRow < 1 || result.quantity > result.completeUnitsPerRow}>
                <DollarSign size={17} /> Orçamento rápido
              </button>
            </div>
          </div>
          <div className="card border-primary-400/20">
            <div className="card-header flex items-center gap-2"><Calculator size={18} className="text-primary-400" /><h2 className="text-sm font-semibold text-dark-200">Estimativa de materiais</h2></div>
            <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><div className="text-xs text-dark-500">Área por unidade</div><div className="text-xl font-bold text-primary-300">{formatNumber(result.areaPerUnit)} m²</div></div>
              <div><div className="text-xs text-dark-500">Área total</div><div className="text-xl font-bold text-primary-300">{formatNumber(result.totalArea)} m²</div></div>
              <div><div className="text-xs text-dark-500">Material linear</div><div className="text-xl font-bold text-emerald-400">{formatNumber(result.linearMaterial)} cm</div></div>
              <div><div className="text-xs text-dark-500">Alças / cordões</div><div className="text-xl font-bold text-amber-400">{formatNumber(result.handleMaterial + result.cordMaterial)} m</div></div>
              <div><div className="text-xs text-dark-500">Mochilas completas / fileira</div><div className="text-xl font-bold text-blue-400">{formatNumber(result.completeUnitsPerRow, 0)}</div><div className="text-xs text-dark-500">{formatNumber(result.rowsNeeded, 0)} fileira(s) no total</div></div>
            </div>
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-dark-400">
              <div className="rounded-lg bg-dark-800/60 p-3">Encaixe combinado: <strong className="text-dark-200">{formatNumber(result.materialPerBackpack)} cm</strong> por mochila · sobra de {formatNumber(result.sharedLeftover)} cm</div>
              <div className="rounded-lg bg-dark-800/60 p-3">Peças laterais / sanfona: <strong className="text-dark-200">{result.sideCut.piecesPerRow} peça(s)</strong> por fileira</div>
              <div className="rounded-lg bg-primary-400/10 p-3 text-primary-200">Cálculo considera rolo de {formatNumber(result.materialWidth)} cm e compara as duas orientações de corte.</div>
            </div>
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
