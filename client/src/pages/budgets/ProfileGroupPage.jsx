import React, { useEffect, useMemo, useState } from 'react';
import { Download, DollarSign } from 'lucide-react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { findProfileGroup } from '../../data/budgetProfiles';
import Modal from '../../components/ui/Modal';
import { formatBRL } from '../../utils/format';
import { useAuth } from '../../context/useAuth';
import { logAudit } from '../../services/firebase/settings';

const DEFAULT_FORM = { profileSlug: '', height: 30, width: 25, length: 10, accordionWidth: 0, quantity: 100, materialWidth: 150, waste: 10, accessoryType: 'cord', handleLength: 60, handleQuantity: 2, cordLength: 140, cordQuantity: 1 };
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
  const usableWidth = Math.min(Math.max(0, materialWidth), 150);
  const piecesPerRow = pieceWidth > 0 ? Math.floor(usableLength / pieceWidth) : 0;
  const rows = pieceHeight > 0 ? Math.floor(usableWidth / pieceHeight) : 0;
  const lengthLeftover = usableLength - (piecesPerRow * pieceWidth);
  const widthLeftover = usableWidth - (rows * pieceHeight);

  return {
    width: usableWidth,
    usableLength,
    piecesPerRow,
    wholePiecesPerRow: piecesPerRow,
    rows,
    verticalRows: rows,
    rowLayouts: Array.from({ length: rows }, () => ({ piecesPerRow })),
    capacity: piecesPerRow * rows,
    lengthLeftover,
    widthLeftover,
    accordionFits: accordionWidth <= 0 || accordionWidth <= Math.max(lengthLeftover, widthLeftover),
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
  const [previewUrl, setPreviewUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const plan = result.tablePlan;

  useEffect(() => {
    if (!result.canCut || !plan?.capacity) {
      setPreviewUrl('');
      return undefined;
    }

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
    const piecesThisPlan = Math.min(result.quantity, plan.capacity);

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111827';
    context.font = '700 22px Arial';
    context.fillText(`PLANO DE CORTE — ${formatNumber(piecesThisPlan, 0)} unidade(s)`, 48, 42);
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
    if (result.hasAccordion) context.fillText(`Sanfona de ${formatNumber(result.accordionWidth, 0)} cm: ${result.accordionFits ? 'acomodada na sobra disponível.' : 'não cabe na sobra disponível.'}`, 70, 730);
    setPreviewUrl(canvas.toDataURL('image/png'));
    return undefined;
  }, [material.label, plan, result]);

  const handleDownload = async () => {
    if (!previewUrl || downloading) return;
    setDownloading(true);
    try {
      await onDownload();
      const link = document.createElement('a');
      link.href = previewUrl;
      link.download = 'plano-de-corte.png';
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const message = !result.quantityValid ? 'Informe uma quantidade maior que zero.'
    : !result.materialWidthValid ? 'A largura do material deve estar entre 1 e 150 cm.'
      : !result.materialHeightValid ? `A altura de ${formatNumber(result.productHeight)} cm não cabe na largura útil do material.`
        : !result.productWidthValid ? `A largura de ${formatNumber(result.productWidth)} cm excede os 262 cm úteis da mesa.`
          : !result.accordionFits ? `A sanfona de ${formatNumber(result.accordionWidth)} cm não cabe na sobra física deste encaixe.`
            : 'Não há peças inteiras que caibam neste plano.';

  return (
    <div className="card border-dark-700">
      <div className="card-header flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-dark-200">Preview do plano de corte</h2><p className="mt-1 text-xs text-dark-500">Cada eixo é arredondado para baixo antes da multiplicação.</p></div><span className={`rounded-full border px-3 py-1 text-xs font-medium ${material.border} ${material.softTone}`}>{material.label}</span></div>
      <div className="card-body space-y-4">
        {previewUrl ? <img src={previewUrl} alt={`Plano de corte de ${profile?.name}`} className="w-full rounded-xl border border-dark-700 bg-dark-900" /> : <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">{message}</div>}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-dark-400"><span><strong className="text-dark-200">{formatNumber(result.plansNeeded, 0)}</strong> plano(s) para a quantidade solicitada</span><span><strong className="text-dark-200">{formatNumber(result.tablePlan?.capacity || 0, 0)}</strong> unidade(s) por plano</span></div>
        <div className="flex justify-end"><button type="button" onClick={handleDownload} disabled={!previewUrl || downloading} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"><Download size={16} /> {downloading ? 'Registrando...' : 'Baixar PNG'}</button></div>
      </div>
    </div>
  );
}

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

    if (!result.quantityValid || !result.accordionValid || !result.accordionFits || !result.materialHeightValid || result.completeUnitsPerRow < 1) {
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
    const firstPlan = result.cutPlans?.[0];
    const previewQuantity = Math.min(quantity, firstPlan?.capacity || 0);
    context.fillText(`PLANO DE CORTE 1 - ${formatNumber(previewQuantity, 0)} SACOLAS (LARGURA: ${formatNumber(firstPlan?.width || materialWidth, 0)} cm)`, panelX + 18, panelY + 28);
    context.font = '600 11px Arial';
    context.fillText(`Peça principal: ${formatNumber(mainPieceWidth, 0)} x ${formatNumber(mainPieceHeight, 0)} cm (${formatNumber(previewQuantity, 0)} un)${result.hasAccordion ? ` | Sanfona: ${formatNumber(sidePieceWidth, 0)} x ${formatNumber(sidePieceHeight, 0)} cm (${formatNumber(previewQuantity, 0)} un)` : ''}`, panelX + 18, panelY + 46);

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
    const cutHeightCm = Number(result.productHeight) || mainPieceHeight;
    const mainAreaHeight = Math.min(cutHeightCm * verticalCentimeterScale, materialPlanDrawHeight);
    const materialPlanBottom = mainAreaY + materialPlanDrawHeight;
    const cutWidthCm = Number(result.productWidth) || mainPieceWidth;
    const firstCutPlan = result.cutPlans?.[0];
    const mainGap = 0;
    const centimeterScale = cutAreaWidth / usableTableLengthCm;
    const mainStartX = cutAreaX;
    const mainPieceDrawWidth = cutWidthCm * centimeterScale;
    const mainPiecesToDraw = previewQuantity;
    const mainLabel = `${formatNumber(mainPieceWidth, 0)} x ${formatNumber(mainPieceHeight, 0)} cm`;
    const rowsToDraw = firstCutPlan?.rowLayouts || [];
    let currentRowY = mainAreaY;
    let remainingPiecesToDraw = mainPiecesToDraw;
    rowsToDraw.forEach((layout) => {
      const pieceWidthCm = layout.rotated ? cutHeightCm : cutWidthCm;
      const pieceHeightCm = layout.rotated ? cutWidthCm : cutHeightCm;
      const pieceDrawWidth = pieceWidthCm * centimeterScale;
      const pieceDrawHeight = pieceHeightCm * verticalCentimeterScale;
      const label = layout.rotated ? `${mainLabel} (girada)` : mainLabel;
      const piecesThisRow = Math.min(remainingPiecesToDraw, layout.piecesPerRow);
      for (let column = 0; column < piecesThisRow; column += 1) {
        const pieceX = mainStartX + (column * (pieceDrawWidth + mainGap));
        context.fillStyle = color.fill;
        context.fillRect(pieceX, currentRowY, pieceDrawWidth, pieceDrawHeight);
        context.strokeStyle = '#27506a';
        context.lineWidth = 1.5;
        context.strokeRect(pieceX, currentRowY, pieceDrawWidth, pieceDrawHeight);
        drawResponsivePieceLabel(context, pieceX, currentRowY, pieceDrawWidth, pieceDrawHeight, label, color.dark);
      }
      remainingPiecesToDraw -= piecesThisRow;
      currentRowY += pieceDrawHeight;
    });

    // Marca no próprio tampo as duas sobras resultantes da grade completa.
    // Elas são calculadas depois de acomodar somente peças inteiras em cada eixo.
    const gridDrawWidth = (firstCutPlan.placedColumns * mainPieceDrawWidth) + (Math.max(0, firstCutPlan.placedColumns - 1) * mainGap);
    const gridDrawHeight = firstCutPlan.placedRows * mainAreaHeight;
    const lengthWasteX = mainStartX + gridDrawWidth;
    const lengthWasteWidth = Math.max(0, cutAreaRight - lengthWasteX);
    const widthWasteY = mainAreaY + gridDrawHeight;
    const widthWasteHeight = Math.max(0, materialPlanBottom - widthWasteY);
    if (lengthWasteWidth > 0 && gridDrawHeight > 0) {
      const wasteLineY = mainAreaY + (gridDrawHeight / 2);
      const lengthWasteLabel = `Sobra: ${formatNumber(firstCutPlan.placedLengthLeftover, 0)} cm`;
      context.strokeStyle = '#111827';
      context.fillStyle = '#111827';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(lengthWasteX, wasteLineY);
      context.lineTo(cutAreaRight, wasteLineY);
      context.moveTo(lengthWasteX, wasteLineY);
      context.lineTo(lengthWasteX + 5, wasteLineY - 3);
      context.moveTo(lengthWasteX, wasteLineY);
      context.lineTo(lengthWasteX + 5, wasteLineY + 3);
      context.moveTo(cutAreaRight, wasteLineY);
      context.lineTo(cutAreaRight - 5, wasteLineY - 3);
      context.moveTo(cutAreaRight, wasteLineY);
      context.lineTo(cutAreaRight - 5, wasteLineY + 3);
      context.stroke();
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
      context.strokeStyle = '#111827';
      context.fillStyle = '#111827';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(wasteLineX, widthWasteY);
      context.lineTo(wasteLineX, materialPlanBottom);
      context.moveTo(wasteLineX, widthWasteY);
      context.lineTo(wasteLineX - 3, widthWasteY + 5);
      context.moveTo(wasteLineX, widthWasteY);
      context.lineTo(wasteLineX + 3, widthWasteY + 5);
      context.moveTo(wasteLineX, materialPlanBottom);
      context.lineTo(wasteLineX - 3, materialPlanBottom - 5);
      context.moveTo(wasteLineX, materialPlanBottom);
      context.lineTo(wasteLineX + 3, materialPlanBottom - 5);
      context.stroke();
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

    // Cotas por peça, como na referência: uma linha de dimensão acima de
    // cada coluna, com setas/ticks nas extremidades e o valor centralizado.
    if (mainPiecesToDraw > 0) {
      const dimensionY = mainAreaY - 10;
      context.strokeStyle = '#111827';
      context.fillStyle = '#111827';
      context.lineWidth = 1;
      context.font = '700 8px Arial';
      const drawnPiecesInFirstRow = Math.min(firstCutPlan.wholePiecesPerRow, mainPiecesToDraw, quantity);
      for (let column = 0; column < drawnPiecesInFirstRow; column += 1) {
        const startX = mainStartX + (column * (mainPieceDrawWidth + mainGap));
        const endX = startX + mainPieceDrawWidth;
        context.beginPath();
        context.moveTo(startX, dimensionY);
        context.lineTo(endX, dimensionY);
        context.moveTo(startX, dimensionY - 4);
        context.lineTo(startX, dimensionY + 4);
        context.moveTo(endX, dimensionY - 4);
        context.lineTo(endX, dimensionY + 4);
        context.moveTo(startX, dimensionY);
        context.lineTo(startX + 4, dimensionY - 3);
        context.moveTo(startX, dimensionY);
        context.lineTo(startX + 4, dimensionY + 3);
        context.moveTo(endX, dimensionY);
        context.lineTo(endX - 4, dimensionY - 3);
        context.moveTo(endX, dimensionY);
        context.lineTo(endX - 4, dimensionY + 3);
        context.stroke();
        const label = `${formatNumber(cutWidthCm, 0)} cm`;
        const labelWidth = context.measureText(label).width;
        context.fillText(label, startX + ((mainPieceDrawWidth - labelWidth) / 2), dimensionY - 4);
      }
    }
    const mainPiecesDrawnWidth = cutAreaWidth;

    const sideStartX = mainStartX + mainPiecesDrawnWidth + mainGap;
    const availableSideWidth = cutAreaRight - sideStartX;
    let sidePiecesToDraw = 0;
    if (result.hasAccordion && availableSideWidth > 0) {
      const sideGap = 3;
      const sidePieceDrawWidth = sidePieceWidth * centimeterScale;
      const sidePieceDrawHeight = Math.min(sidePieceHeight * verticalCentimeterScale, materialPlanBottom - mainAreaY);
      const maxSidePiecesInPlan = Math.floor((availableSideWidth + sideGap) / (sidePieceDrawWidth + sideGap));
      sidePiecesToDraw = Math.max(0, Math.min(quantity, maxSidePiecesInPlan));
      const sideLabel = `${formatNumber(sidePieceWidth, 0)} x ${formatNumber(sidePieceHeight, 0)} cm`;
      for (let index = 0; index < sidePiecesToDraw; index += 1) {
        const pieceX = sideStartX + (index * (sidePieceDrawWidth + sideGap));
        context.fillStyle = '#8edb91';
        context.fillRect(pieceX, mainAreaY, sidePieceDrawWidth, sidePieceDrawHeight);
        context.strokeStyle = '#3b7c45';
        context.lineWidth = 1;
        context.strokeRect(pieceX, mainAreaY, sidePieceDrawWidth, sidePieceDrawHeight);
        context.save();
        context.translate(pieceX + (sidePieceDrawWidth / 2), mainAreaY + (sidePieceDrawHeight / 2));
        context.rotate(-Math.PI / 2);
        context.fillStyle = '#16371c';
        context.font = '700 9px Arial';
        const sideLabelWidth = context.measureText(sideLabel).width;
        context.fillText(sideLabel, -(sideLabelWidth / 2), 3);
        context.restore();

        const sideMeasureY = mainAreaY - 9;
        const sideMeasureLabel = `${formatNumber(sidePieceWidth, 0)} cm`;
        context.strokeStyle = '#111827';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(pieceX, sideMeasureY);
        context.lineTo(pieceX + sidePieceDrawWidth, sideMeasureY);
        context.moveTo(pieceX, sideMeasureY - 3);
        context.lineTo(pieceX, sideMeasureY + 3);
        context.moveTo(pieceX + sidePieceDrawWidth, sideMeasureY - 3);
        context.lineTo(pieceX + sidePieceDrawWidth, sideMeasureY + 3);
        context.stroke();
        context.fillStyle = '#111827';
        context.font = '700 8px Arial';
        const sideMeasureLabelWidth = context.measureText(sideMeasureLabel).width;
        context.fillText(sideMeasureLabel, pieceX + ((sidePieceDrawWidth - sideMeasureLabelWidth) / 2), sideMeasureY - 4);

        context.strokeStyle = '#3b7c45';
        context.setLineDash([3, 3]);
        context.beginPath();
        context.moveTo(pieceX + (sidePieceDrawWidth / 2), mainAreaY);
        context.lineTo(pieceX + (sidePieceDrawWidth / 2), mainAreaY + sidePieceDrawHeight);
        context.stroke();
        context.setLineDash([]);
      }
    }

    const cardY = 520;
    const cardGap = 22;
    const cardWidth = (panelWidth - 120 - (cardGap * 2)) / 3;
    const cardHeight = 170;
    const cardStartX = 60;
    const totalFaixas = quantity;
    const totalComprimentoCm = Math.max(0, (mainPieceWidth + (result.hasAccordion ? sidePieceWidth : 0)) * quantity);
    const totalComprimentoM = totalComprimentoCm / 100;

    drawCardText(cardStartX, cardY, cardWidth, cardHeight, 'APROVEITAMENTO POR FAIXA DE 300 cm', [
      `Grade máxima: ${formatNumber(firstCutPlan.wholePiecesPerRow, 0)} × ${formatNumber(firstCutPlan.verticalRows, 0)} = ${formatNumber(firstCutPlan.capacity, 0)} mochilas`,
      `Acomodadas neste tampo: ${formatNumber(firstCutPlan.placedPieces, 0)} mochila(s)`,
      `Espaço vago útil: ${formatNumber(firstCutPlan.emptyPositions, 0)} posição(ões) (${formatNumber(firstCutPlan.emptyPositionArea, 0)} cm²)`,
      `Faixa residual: ${formatNumber(firstCutPlan.lengthLeftover, 0)} cm no comprimento`,
      `Área residual das bordas: ${formatNumber(firstCutPlan.residualEdgeArea, 0)} cm²`,
      `Área total de sobra: ${formatNumber(firstCutPlan.placedAreaLeftover || 0, 0)} cm²`,
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

    if (result.plansToCut?.length > 1) {
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
      const secondPlan = result.plansToCut[1];
      duplicateContext.fillText(`PLANO DE CORTE 2 - ${formatNumber(secondPlan.capacity, 0)} MOCHILAS (LARGURA: ${formatNumber(secondPlan.width, 0)} cm)`, 18, 30);
      duplicateContext.font = '600 11px Arial';
      duplicateContext.fillText(`Peça principal: ${formatNumber(mainPieceWidth, 0)} x ${formatNumber(mainPieceHeight, 0)} cm (${formatNumber(secondPlan.capacity, 0)} un)${result.hasAccordion ? ` | Sanfona: ${formatNumber(sidePieceWidth, 0)} x ${formatNumber(sidePieceHeight, 0)} cm (${formatNumber(secondPlan.capacity, 0)} un)` : ''}`, 18, 52);

      // O segundo plano não é uma cópia do primeiro: limpa o desenho anterior
      // e posiciona somente as fileiras que cabem na largura restante.
      duplicateContext.fillStyle = '#eef2f7';
      duplicateContext.fillRect(cutAreaX, mainAreaY, cutAreaWidth, materialPlanDrawHeight);
      const secondRows = Math.max(0, secondPlan.verticalRows);
      const secondPiecesPerRow = Math.max(0, secondPlan.wholePiecesPerRow);
      const secondPiecesToDraw = Math.min(secondPlan.capacity, Math.max(0, quantity - (firstPlan?.capacity || 0)), secondRows * secondPiecesPerRow);
      for (let index = 0; index < secondPiecesToDraw; index += 1) {
        const row = Math.floor(index / secondPiecesPerRow);
        const column = index % secondPiecesPerRow;
        const pieceX = mainStartX + (column * (mainPieceDrawWidth + mainGap));
        const pieceY = mainAreaY + (row * mainAreaHeight);
        duplicateContext.fillStyle = color.fill;
        duplicateContext.fillRect(pieceX, pieceY, mainPieceDrawWidth, mainAreaHeight);
        duplicateContext.strokeStyle = '#27506a';
        duplicateContext.lineWidth = 1.5;
        duplicateContext.strokeRect(pieceX, pieceY, mainPieceDrawWidth, mainAreaHeight);
        drawResponsivePieceLabel(duplicateContext, pieceX, pieceY, mainPieceDrawWidth, mainAreaHeight, mainLabel, color.dark);
      }
      const unusedHeight = Math.max(0, materialPlanDrawHeight - (secondRows * mainAreaHeight));
      if (unusedHeight > 0) {
        duplicateContext.fillStyle = 'rgba(156, 163, 175, 0.5)';
        duplicateContext.fillRect(cutAreaX, mainAreaY + (secondRows * mainAreaHeight), cutAreaWidth, unusedHeight);
        drawResponsivePieceLabel(duplicateContext, cutAreaX, mainAreaY + (secondRows * mainAreaHeight), cutAreaWidth, unusedHeight, `${formatNumber(150 - secondPlan.width, 0)} cm fora do plano`, '#374151');
      }
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
        ) : <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">{!result.quantityValid ? 'Informe uma quantidade maior que zero para gerar o preview.' : !result.materialHeightValid ? `A altura de ${formatNumber(result.productHeight)} cm excede o limite vertical de ${formatNumber(result.maxMaterialHeight)} cm do material.` : !result.accordionValid ? `A sanfona de ${formatNumber(result.accordionWidth)} cm não cabe no comprimento útil de 262 cm.` : !result.accordionFits ? `A sanfona de ${formatNumber(result.accordionWidth)} cm não cabe em nenhuma sobra física do plano.` : `Preview indisponível: a quantidade desejada (${formatNumber(result.quantity, 0)}) excede a capacidade de ${formatNumber(result.completeUnitsPerRow, 0)} mochila(s) por conjunto de planos.`}</div>}
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
          <span><strong className="text-dark-200">{formatNumber(result.completeUnitsPerRow, 0)}</strong> mochila(s) por conjunto de plano(s)</span>
          <span><strong className="text-dark-200">{formatNumber(result.rowsNeeded, 0)}</strong> conjunto(s) para a quantidade informada</span>
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
    // Cada unidade corresponde a um único corte de material.
    const bodyArea = height * (width + sideWidth);
    const areaPerUnit = (bodyArea / 10000) * wasteFactor;
    const totalArea = areaPerUnit * quantity;
    const materialWidth = Math.max(Number(form.materialWidth) || 1, 1);
    const tableLengthCm = 300;
    const lateralWasteCm = 19;
    const usableCutLength = tableLengthCm - (lateralWasteCm * 2);
    const maxMaterialHeight = 150;
    const quantityValid = quantity > 0;
    const materialWidthValid = materialWidth > 0 && materialWidth <= maxMaterialHeight;
    const materialHeightValid = height > 0 && height <= materialWidth;
    const productWidthValid = width > 0 && width <= usableCutLength;
    const accordionValid = length > 0;
    const usableMaterialWidth = usableCutLength;
    const mainCut = calculateCut(usableCutLength, width, height, quantity, false);
    const sideCut = calculateCut(usableCutLength, sideWidth, height, quantity, false);
    const materialPerBackpack = mainCut.pieceWidth || 0;
    const baseTablePlan = calculateTablePlan(materialWidth, width, height, accordionWidth);
    const placedPieces = Math.min(quantity, baseTablePlan.capacity);
    const placedRows = baseTablePlan.piecesPerRow > 0 ? Math.ceil(placedPieces / baseTablePlan.piecesPerRow) : 0;
    const placedColumns = placedPieces > 0 ? Math.min(baseTablePlan.piecesPerRow, placedPieces) : 0;
    const tablePlan = {
      ...baseTablePlan,
      placedPieces,
      placedRows,
      placedColumns,
      placedLengthLeftover: baseTablePlan.usableLength - (placedColumns * width),
      placedWidthLeftover: baseTablePlan.width - (placedRows * height),
      placedAreaLeftover: (baseTablePlan.usableLength * baseTablePlan.width) - (placedPieces * width * height),
      emptyPositions: Math.max(0, baseTablePlan.capacity - placedPieces),
      emptyPositionArea: Math.max(0, baseTablePlan.capacity - placedPieces) * width * height,
      residualEdgeArea: (baseTablePlan.usableLength * baseTablePlan.width) - (baseTablePlan.capacity * width * height),
    };
    const completeUnitsPerRow = tablePlan.capacity;
    const plansNeeded = completeUnitsPerRow > 0 ? Math.ceil(quantity / completeUnitsPerRow) : 0;
    const remainingBackpacks = completeUnitsPerRow > 0 ? quantity % completeUnitsPerRow : quantity;
    const sharedLeftover = tablePlan.lengthLeftover;
    const linearMaterial = plansNeeded * tableLengthCm * wasteFactor;
    const usesCord = profile?.kind === 'drawstring' || (profile?.kind === 'backpack' && form.accessoryType === 'cord');
    const usesHandle = profile?.kind === 'bag' || (profile?.kind === 'backpack' && form.accessoryType === 'handle');
    const handleMaterial = usesHandle ? (Number(form.handleLength) || 0) * (Number(form.handleQuantity) || 0) * quantity / 100 : 0;
    const cordMaterial = usesCord ? (Number(form.cordLength) || 0) * (Number(form.cordQuantity) || 0) * quantity / 100 : 0;
    const accordionFits = tablePlan.accordionFits;
    const canCut = quantityValid && materialWidthValid && materialHeightValid && productWidthValid && accordionValid && accordionFits && completeUnitsPerRow > 0;
    const validCompleteUnitsPerRow = canCut ? completeUnitsPerRow : 0;
    const rowsNeeded = canCut ? plansNeeded : 0;
    const accessoryType = profile?.kind === 'backpack' ? form.accessoryType : profile?.kind === 'drawstring' ? 'cord' : 'handle';
    return { areaPerUnit, totalArea, linearMaterial, handleMaterial, cordMaterial, mainCut, sideCut, tablePlan, cutPlans: [tablePlan], plansToCut: [tablePlan], materialWidth, usableMaterialWidth, materialPerBackpack, sharedLeftover, completeUnitsPerRow: validCompleteUnitsPerRow, remainingBackpacks, plansNeeded, rowsNeeded, quantity, quantityValid, accessoryType, hasAccordion: accordionWidth !== 0, accordionWidth, sideWidth, accordionValid, accordionFits, materialWidthValid, materialHeightValid, productWidthValid, canCut, maxMaterialHeight, productHeight: height, productWidth: width, productLength: length, cordLength: form.cordLength, cordQuantity: form.cordQuantity, handleLength: form.handleLength, handleQuantity: form.handleQuantity };
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
              <button type="button" className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => setBudgetOpen(true)} disabled={!result.canCut}>
                <DollarSign size={17} /> Orçamento rápido
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-primary-400/30 bg-primary-400/10 px-6 py-5 text-center">
            <div className="text-sm font-medium text-primary-200">Capacidade máxima de corte</div>
            <div className="mt-1 text-3xl font-bold text-primary-300">{formatNumber(result.completeUnitsPerRow, 0)} mochilas</div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-left text-sm md:grid-cols-2">
              <div className="rounded-lg bg-dark-800/60 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-dark-500">Total acomodado</div>
                <div className="mt-1 font-semibold text-dark-100">{formatNumber(result.completeUnitsPerRow, 0)} mochila(s) inteira(s) por tampo</div>
                <div className="mt-2 text-xs text-dark-400">Arranjo para a quantidade informada: {formatNumber(result.tablePlan?.placedColumns || 0, 0)} mochila(s) no comprimento × {formatNumber(result.tablePlan?.placedRows || 0, 0)} mochila(s) na largura.</div>
              </div>
              <div className="rounded-lg bg-dark-800/60 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-dark-500">Sobras físicas</div>
                <div className="mt-1 text-xs text-dark-300">Comprimento: 262 − ({formatNumber(result.tablePlan?.placedColumns || 0, 0)} × {formatNumber(result.productWidth, 0)}) = <strong className="text-dark-100">{formatNumber(result.tablePlan?.placedLengthLeftover || 0, 0)} cm</strong></div>
                <div className="mt-1 text-xs text-dark-300">Largura: {formatNumber(result.tablePlan?.width || 0, 0)} − ({formatNumber(result.tablePlan?.placedRows || 0, 0)} × {formatNumber(result.productHeight, 0)}) = <strong className="text-dark-100">{formatNumber(result.tablePlan?.placedWidthLeftover || 0, 0)} cm</strong></div>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm text-dark-300">
              <div>Sobram {formatNumber(result.tablePlan?.placedLengthLeftover || 0, 0)} cm no comprimento útil da mesa — espaço insuficiente para mais uma mochila de {formatNumber(result.productWidth, 0)} cm.</div>
              <div>Sobram {formatNumber(result.tablePlan?.placedWidthLeftover || 0, 0)} cm na largura da mesa — espaço insuficiente para mais uma mochila de {formatNumber(result.productHeight, 0)} cm.</div>
            </div>
            <div className="mt-3 text-sm text-dark-300">Sobra física para a quantidade informada: {formatNumber(result.tablePlan?.placedLengthLeftover || 0, 0)} cm no comprimento e {formatNumber(result.tablePlan?.placedWidthLeftover || 0, 0)} cm na largura.</div>
            <div className="mt-1 text-sm font-medium text-dark-200">Área total de sobra: {formatNumber(result.tablePlan?.placedAreaLeftover || 0, 0)} cm².</div>
            <div className="mt-1 text-sm text-dark-300">Espaço vago útil: {formatNumber(result.tablePlan?.emptyPositions || 0, 0)} posição(ões) para mochila(s), equivalente a {formatNumber(result.tablePlan?.emptyPositionArea || 0, 0)} cm².</div>
            <div className="mt-1 text-sm text-dark-300">Sobra residual das bordas: {formatNumber(result.tablePlan?.residualEdgeArea || 0, 0)} cm².</div>
            {result.hasAccordion && <div className={`mt-2 text-sm font-medium ${result.accordionFits ? 'text-emerald-300' : 'text-amber-200'}`}>{result.accordionFits ? `A sanfona de ${formatNumber(result.accordionWidth, 0)} cm será acomodada na sobra disponível.` : `A sanfona de ${formatNumber(result.accordionWidth, 0)} cm não cabe na sobra disponível.`}</div>}
            {result.remainingBackpacks > 0 && <div className="mt-3 text-sm font-semibold text-amber-200">Sobram {formatNumber(result.remainingBackpacks, 0)} mochila(s) para o próximo conjunto de corte.</div>}
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
