import { jsPDF } from 'jspdf';
import {
  flattenPhotos,
  getReportStats,
  isPositiveStatus,
} from '../data/checklistTemplate';
import type { ChecklistReport } from '../types/checklist';
import { formatIndonesianDate } from './dateUtils';
import { loadImageElement } from './imageUtils';

export async function generatePdfReport(
  report: ChecklistReport
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth(); // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const stats = getReportStats(report);
  const photos = flattenPhotos(report);

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 16) {
      doc.addPage();
      y = margin;
    }
  };

  // Header Banner — Modern Deep Blue
  doc.setFillColor(19, 75, 138); // #134b8a
  doc.roundedRect(margin, y, contentW, 28, 3, 3, 'F');

  doc.setTextColor(165, 243, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('LAPORAN PREVENTIVE MAINTENANCE HARIAN', margin + 5, y + 7);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(
    `Checklist ${report.shift} — ${report.site}`,
    margin + 5,
    y + 14.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const inspectorInfo = report.inspector.trim()
    ? `   |   Petugas: ${report.inspector.trim()}`
    : '';
  doc.text(
    `Hari/Tanggal : ${formatIndonesianDate(report.date)}${inspectorInfo}`,
    margin + 5,
    y + 22
  );
  y += 33;

  // Summary Stats Row — Clear Green OK & Red Not OK
  const boxW = (contentW - 9) / 4;
  const kpis = [
    { label: 'Total Item', value: String(stats.totalItems), r: 241, g: 245, b: 249, lr: 71, lg: 85, lb: 105, tr: 15, tg: 23, tb: 42 },
    { label: 'OK / Aktif', value: String(stats.okCount), r: 5, g: 150, b: 105, lr: 236, lg: 253, lb: 245, tr: 255, tg: 255, tb: 255 },
    {
      label: 'Not OK',
      value: String(stats.notOkCount),
      r: stats.notOkCount > 0 ? 220 : 225,
      g: stats.notOkCount > 0 ? 38 : 29,
      b: stats.notOkCount > 0 ? 38 : 72,
      lr: 255,
      lg: 241,
      lb: 242,
      tr: 255,
      tg: 255,
      tb: 255,
    },
    { label: 'Foto Bukti', value: String(stats.totalPhotos), r: 224, g: 242, b: 254, lr: 3, lg: 105, lb: 161, tr: 3, tg: 105, tb: 161 },
  ];

  kpis.forEach((kpi, idx) => {
    const bx = margin + idx * (boxW + 3);
    doc.setFillColor(kpi.r, kpi.g, kpi.b);
    doc.roundedRect(bx, y, boxW, 15, 2, 2, 'F');
    doc.setTextColor(kpi.lr, kpi.lg, kpi.lb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(kpi.label.toUpperCase(), bx + 3.5, y + 5.5);
    doc.setTextColor(kpi.tr, kpi.tg, kpi.tb);
    doc.setFontSize(12);
    doc.text(kpi.value, bx + 3.5, y + 12);
  });
  y += 21;

  // Issues Alert Box if any
  if (stats.issueItems.length > 0) {
    const boxH = 10 + stats.issueItems.length * 5.5;
    ensureSpace(boxH + 4);
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(252, 165, 165);
    doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'FD');

    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      `TEMUAN / ITEM NOT OK (${stats.issueItems.length}):`,
      margin + 4,
      y + 6
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    stats.issueItems.forEach((issue, idx) => {
      const noteText = issue.item.note.trim() ? ` — ${issue.item.note.trim()}` : '';
      const line = doc.splitTextToSize(
        `• ${issue.breadcrumb}: ${issue.item.status}${noteText}`,
        contentW - 8
      )[0];
      doc.text(line, margin + 4, y + 11.5 + idx * 5.2);
    });
    y += boxH + 6;
  }

  // Section-by-section checklist table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RINCIAN STATUS CHECKLIST (A – N)', margin, y);
  y += 5;

  const drawItemRow = (
    label: string,
    status: string,
    positive: boolean,
    note: string,
    indentMm = 0
  ) => {
    ensureSpace(6.8);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentW, 6.4, 'FD');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const fullText = note.trim() ? `${label}  (${note.trim()})` : label;
    const truncated = doc.splitTextToSize(
      fullText,
      contentW - 34 - indentMm
    )[0];
    doc.text(truncated, margin + 3 + indentMm, y + 4.3);

    // Status pill
    const pillX = margin + contentW - 24;
    if (positive) {
      doc.setFillColor(220, 252, 231);
      doc.setTextColor(21, 128, 61);
    } else {
      doc.setFillColor(254, 226, 226);
      doc.setTextColor(185, 28, 28);
    }
    doc.roundedRect(pillX, y + 1, 21, 4.4, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(status, pillX + 10.5, y + 4, { align: 'center' });

    y += 6.4;
  };

  for (const section of report.sections) {
    if (section.isStandalone) {
      const item = section.items[0];
      drawItemRow(
        `${section.code} ${section.title}`,
        item?.status ?? 'OK',
        item ? isPositiveStatus(item.status) : true,
        item?.note ?? '',
        0
      );
      continue;
    }

    ensureSpace(14);
    doc.setFillColor(224, 242, 254);
    doc.setDrawColor(186, 230, 253);
    doc.rect(margin, y, contentW, 7, 'FD');
    doc.setTextColor(37, 99, 148);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${section.code} ${section.title}`, margin + 3, y + 4.8);
    y += 7;

    for (const item of section.items) {
      const prefix = item.code ? `${item.code} ` : '';
      drawItemRow(
        `${prefix}${item.label}`,
        item.status,
        isPositiveStatus(item.status),
        item.note,
        3
      );
    }

    for (const sg of section.subGroups) {
      ensureSpace(12);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentW, 6.2, 'FD');
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`${sg.code} ${sg.title}`, margin + 5, y + 4.3);
      y += 6.2;

      for (const item of sg.items) {
        const prefix = item.code ? `${item.code} ` : '';
        drawItemRow(
          `${prefix}${item.label}`,
          item.status,
          isPositiveStatus(item.status),
          item.note,
          8
        );
      }
    }
    y += 2.5;
  }

  // Photo Evidence Appendix
  if (photos.length > 0) {
    doc.addPage();
    y = margin;

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(
      `LAMPIRAN DOKUMENTASI FOTO (${photos.length} FOTO)`,
      margin,
      y + 4
    );
    y += 10;

    const colGap = 6;
    const cardW = (contentW - colGap) / 2;
    const imgBoxH = 54;
    const cardH = 78;

    const loadedImgs = await Promise.all(
      photos.map((p) => loadImageElement(p.photo.dataUrl).catch(() => null))
    );

    for (let i = 0; i < photos.length; i += 2) {
      ensureSpace(cardH + 4);

      for (let col = 0; col < 2; col++) {
        const idx = i + col;
        if (idx >= photos.length) break;
        const entry = photos[idx];
        const img = loadedImgs[idx];
        const cx = margin + col * (cardW + colGap);
        const cy = y;

        // Card border
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD');

        // Dark image box
        doc.setFillColor(15, 23, 42);
        doc.rect(cx + 1.5, cy + 1.5, cardW - 3, imgBoxH, 'F');

        if (img) {
          const maxW = cardW - 3;
          const maxH = imgBoxH;
          const scale = Math.min(maxW / img.width, maxH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const ox = cx + 1.5 + (maxW - drawW) / 2;
          const oy = cy + 1.5 + (maxH - drawH) / 2;
          doc.addImage(entry.photo.dataUrl, 'JPEG', ox, oy, drawW, drawH);
        }

        // Metadata
        const breadcrumb = entry.subGroupTitle
          ? `${entry.sectionTitle} › ${entry.subGroupTitle}`
          : entry.sectionTitle;

        doc.setTextColor(37, 99, 148);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        const bcText = doc.splitTextToSize(breadcrumb, cardW - 6)[0];
        doc.text(bcText, cx + 3, cy + imgBoxH + 6);

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        const titleText = doc.splitTextToSize(
          `#${idx + 1} ${entry.itemLabel}`,
          cardW - 26
        )[0];
        doc.text(titleText, cx + 3, cy + imgBoxH + 11);

        if (entry.status) {
          const pos = isPositiveStatus(entry.status);
          doc.setFillColor(pos ? 220 : 254, pos ? 252 : 226, pos ? 231 : 226);
          doc.setTextColor(pos ? 21 : 185, pos ? 128 : 28, pos ? 61 : 28);
          doc.roundedRect(cx + cardW - 21, cy + imgBoxH + 7, 18, 4.8, 1, 1, 'F');
          doc.setFontSize(7);
          doc.text(entry.status, cx + cardW - 12, cy + imgBoxH + 10.4, {
            align: 'center',
          });
        }

        const noteStr = [entry.note?.trim(), entry.photo.caption?.trim()]
          .filter((v, pos, arr) => Boolean(v) && arr.indexOf(v) === pos)
          .join(' • ');
        if (noteStr) {
          doc.setTextColor(71, 85, 105);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          const noteLine = doc.splitTextToSize(noteStr, cardW - 6)[0];
          doc.text(noteLine, cx + 3, cy + imgBoxH + 17);
        }
      }

      y += cardH + 5;
    }
  }

  // Page numbers footer
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Preventive Maintenance • ${report.site} • Halaman ${p} dari ${pageCount}`,
      pageW / 2,
      pageH - 7,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}
