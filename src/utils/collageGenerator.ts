import {
  flattenPhotos,
  getReportStats,
  isPositiveStatus,
} from '../data/checklistTemplate';
import type {
  ChecklistReport,
  ChecklistSection,
  FlattenedPhotoEntry,
} from '../types/checklist';
import { formatIndonesianDate } from './dateUtils';
import { loadImageElement } from './imageUtils';

export type CollageSectionMode = 'photos_only' | 'status_only' | 'combined';
export type CollageColumns = 1 | 2 | 3 | 4 | 5;

export interface CollageOptions {
  columns: CollageColumns;
  mode: CollageSectionMode;
  format: 'image/png' | 'image/jpeg';
  photosSlice?: FlattenedPhotoEntry[];
  pageIndex?: number;
  pageCount?: number;
  globalStartIndex?: number;
}

interface PhotoCardLayout {
  entry: FlattenedPhotoEntry;
  globalNumber: number;
  badgeText: string;
  badgePositive: boolean | null;
  x: number;
  y: number;
  w: number;
  h: number;
  titleLines: string[];
  noteLines: string[];
}

interface SectionBlockLayout {
  section: ChecklistSection;
  lines: Array<{
    text: string;
    status: string;
    positive: boolean;
    isGroupHeader?: boolean;
  }>;
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  if (!text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) {
          const lastIdx = lines.length - 1;
          lines[lastIdx] = truncateText(ctx, lines[lastIdx] + '...', maxWidth);
          return lines;
        }
      }
      current = word;
    }
  }
  if (current) {
    lines.push(truncateText(ctx, current, maxWidth));
  }
  return lines.slice(0, maxLines);
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 3 && ctx.measureText(trimmed + '...').width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed + '...';
}

function resolveGroupBadge(
  report: ChecklistReport,
  entry: FlattenedPhotoEntry
): { text: string; positive: boolean | null } {
  if (entry.status) {
    return {
      text: entry.status.toUpperCase(),
      positive: isPositiveStatus(entry.status),
    };
  }

  const section = report.sections.find((s) => s.id === entry.sectionId);
  if (!section) return { text: 'FOTO', positive: null };

  if (entry.targetType === 'subgroup') {
    const sg = section.subGroups.find((g) => g.id === entry.targetId);
    if (sg && sg.items.length > 0) {
      const issues = sg.items.filter((i) => !isPositiveStatus(i.status)).length;
      if (issues === 0) {
        return { text: `OK (${sg.items.length}/${sg.items.length})`, positive: true };
      }
      return { text: `${issues} NOT OK`, positive: false };
    }
  }

  if (entry.targetType === 'section') {
    const allSectionItems = [
      ...section.items,
      ...section.subGroups.flatMap((g) => g.items),
    ];
    if (allSectionItems.length > 0) {
      const issues = allSectionItems.filter(
        (i) => !isPositiveStatus(i.status)
      ).length;
      if (issues === 0) {
        return {
          text: `OK (${allSectionItems.length}/${allSectionItems.length})`,
          positive: true,
        };
      }
      return { text: `${issues} NOT OK`, positive: false };
    }
  }

  return { text: 'DOKUMENTASI', positive: null };
}

export async function generatePhotoPages(
  report: ChecklistReport,
  options: {
    columns: CollageColumns;
    format: 'image/png' | 'image/jpeg';
    maxPerPage: number;
  }
): Promise<string[]> {
  const allPhotos = flattenPhotos(report);
  if (allPhotos.length === 0 || options.maxPerPage <= 0) {
    const single = await generateCollageImage(report, {
      columns: options.columns,
      mode: 'photos_only',
      format: options.format,
      photosSlice: allPhotos,
      pageIndex: 0,
      pageCount: 1,
      globalStartIndex: 0,
    });
    return [single];
  }

  const pageCount = Math.ceil(allPhotos.length / options.maxPerPage);
  const pages: string[] = [];
  for (let p = 0; p < pageCount; p++) {
    const start = p * options.maxPerPage;
    const slice = allPhotos.slice(start, start + options.maxPerPage);
    const img = await generateCollageImage(report, {
      columns: options.columns,
      mode: 'photos_only',
      format: options.format,
      photosSlice: slice,
      pageIndex: p,
      pageCount,
      globalStartIndex: start,
    });
    pages.push(img);
  }
  return pages;
}

export async function generateCollageImage(
  report: ChecklistReport,
  options: CollageOptions
): Promise<string> {
  const effectiveCols =
    (options.photosSlice ?? flattenPhotos(report)).length <= 1
      ? 1
      : options.columns;
  const isDenseGrid = effectiveCols >= 4;
  const canvasWidth = isDenseGrid ? 1480 : 1240;
  const padX = isDenseGrid ? 32 : 36;
  const contentW = canvasWidth - padX * 2;
  const stats = getReportStats(report);
  const allPhotos = flattenPhotos(report);
  const photos = options.photosSlice ?? allPhotos;

  const showPhotos =
    options.mode === 'photos_only' || options.mode === 'combined';
  const showTable =
    options.mode === 'status_only' || options.mode === 'combined';

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = 1000;
  const measureCtx = canvas.getContext('2d');
  if (!measureCtx) {
    throw new Error('Canvas 2D context tidak tersedia');
  }

  // 1. Header height
  const headerH = 142;
  let cursorY = headerH + 24;

  // 2. Issues alert box height (show on first page or status-only/combined)
  const isFirstPhotoPage = (options.pageIndex ?? 0) === 0;
  const issueLines: string[] = [];
  if (stats.issueItems.length > 0 && (isFirstPhotoPage || !showPhotos)) {
    measureCtx.font = '600 15px system-ui, -apple-system, sans-serif';
    for (const issue of stats.issueItems) {
      const notePart = issue.item.note.trim() ? ` — ${issue.item.note.trim()}` : '';
      const text = `• ${issue.breadcrumb}: ${issue.item.status}${notePart}`;
      issueLines.push(truncateText(measureCtx, text, contentW - 44));
    }
  }
  const issueBoxH =
    issueLines.length > 0 ? 54 + issueLines.length * 24 + 14 : 0;
  if (issueBoxH > 0) {
    cursorY += issueBoxH + 20;
  }

  // 3. Photo grid layout calculation
  const photoLayouts: PhotoCardLayout[] = [];
  const imgH =
    effectiveCols === 1
      ? 520
      : effectiveCols === 2
      ? 350
      : effectiveCols === 3
      ? 245
      : effectiveCols === 4
      ? 190
      : 160;
  const cardPad = isDenseGrid ? 10 : 20;
  const titleFontSize = isDenseGrid ? 18 : effectiveCols === 1 ? 36 : 28;
  const titleLineHeight = isDenseGrid ? 23 : effectiveCols === 1 ? 46 : 36;
  const noteFontSize = isDenseGrid ? 14 : effectiveCols === 1 ? 24 : 19;
  const noteLineHeight = isDenseGrid ? 18 : effectiveCols === 1 ? 32 : 25;

  if (showPhotos) {
    if (photos.length > 0) {
      cursorY += 40; // Section header height
      const gap = isDenseGrid ? 14 : 20;
      const cardW = Math.floor(
        (contentW - gap * (effectiveCols - 1)) / effectiveCols
      );
      const startIndex = options.globalStartIndex ?? 0;

      for (let idx = 0; idx < photos.length; idx++) {
        const entry = photos[idx];
        const col = idx % effectiveCols;
        const row = Math.floor(idx / effectiveCols);
        const x = padX + col * (cardW + gap);

        measureCtx.font = `bold ${titleFontSize}px system-ui, -apple-system, sans-serif`;
        const titleLines = wrapText(
          measureCtx,
          entry.itemLabel,
          cardW - cardPad * 2,
          2
        );

        const noteText = [entry.note?.trim(), entry.photo.caption?.trim()]
          .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i)
          .join(' • ');
        measureCtx.font = `${noteFontSize}px system-ui, -apple-system, sans-serif`;
        const noteLines =
          noteText && !isDenseGrid
            ? wrapText(measureCtx, noteText, cardW - cardPad * 2, 2)
            : noteText
            ? wrapText(measureCtx, noteText, cardW - cardPad * 2, 1)
            : [];

        const textAreaH =
          (isDenseGrid ? 22 : 30) +
          titleLines.length * titleLineHeight +
          (noteLines.length > 0 ? 4 + noteLines.length * noteLineHeight : 0) +
          (isDenseGrid ? 12 : 22);

        const cardH = imgH + textAreaH;
        const badge = resolveGroupBadge(report, entry);

        photoLayouts.push({
          entry,
          globalNumber: startIndex + idx + 1,
          badgeText: badge.text,
          badgePositive: badge.positive,
          x,
          y: row,
          w: cardW,
          h: cardH,
          titleLines,
          noteLines,
        });
      }

      const totalRows = Math.ceil(photos.length / effectiveCols);
      for (let r = 0; r < totalRows; r++) {
        const rowCards = photoLayouts.filter((c) => c.y === r);
        const maxRowH = Math.max(...rowCards.map((c) => c.h));
        for (const card of rowCards) {
          card.y = cursorY;
          card.h = maxRowH;
        }
        cursorY += maxRowH + gap;
      }
      cursorY += 8;
    } else {
      cursorY += 84 + 20;
    }
  }

  // 4. Status Table layout calculation (2 columns of sections)
  const sectionLayouts: SectionBlockLayout[] = [];
  if (showTable) {
    cursorY += 44; // Table section title
    const tableCols = 2;
    const colGap = 18;
    const blockW = Math.floor((contentW - colGap) / tableCols);

    const preparedBlocks: Omit<SectionBlockLayout, 'x' | 'y'>[] = [];
    measureCtx.font = '14px system-ui, -apple-system, sans-serif';

    for (const section of report.sections) {
      const lines: SectionBlockLayout['lines'] = [];

      if (section.isStandalone) {
        const item = section.items[0];
        const noteSuffix = item?.note.trim() ? ` (${item.note.trim()})` : '';
        lines.push({
          text: truncateText(
            measureCtx,
            `${section.code} ${section.title}${noteSuffix}`,
            blockW - 110
          ),
          status: item?.status ?? 'OK',
          positive: item ? isPositiveStatus(item.status) : true,
        });
      } else {
        for (const item of section.items) {
          const prefix = item.code ? `${item.code} ` : '';
          const noteSuffix = item.note.trim() ? ` (${item.note.trim()})` : '';
          lines.push({
            text: truncateText(
              measureCtx,
              `${prefix}${item.label}${noteSuffix}`,
              blockW - 110
            ),
            status: item.status,
            positive: isPositiveStatus(item.status),
          });
        }
        for (const sg of section.subGroups) {
          lines.push({
            text: `${sg.code} ${sg.title}`,
            status: '',
            positive: true,
            isGroupHeader: true,
          });
          for (const item of sg.items) {
            const prefix = item.code ? `${item.code} ` : '';
            const noteSuffix = item.note.trim() ? ` (${item.note.trim()})` : '';
            lines.push({
              text: truncateText(
                measureCtx,
                `  ${prefix}${item.label}${noteSuffix}`,
                blockW - 110
              ),
              status: item.status,
              positive: isPositiveStatus(item.status),
            });
          }
        }
      }

      const blockH = section.isStandalone
        ? 46
        : 42 + lines.length * 23 + 12;

      preparedBlocks.push({
        section,
        lines,
        w: blockW,
        h: blockH,
      });
    }

    let col0Y = cursorY;
    let col1Y = cursorY;
    for (const block of preparedBlocks) {
      const targetCol = col0Y <= col1Y ? 0 : 1;
      const x = padX + targetCol * (blockW + colGap);
      const y = targetCol === 0 ? col0Y : col1Y;
      sectionLayouts.push({ ...block, x, y });
      if (targetCol === 0) {
        col0Y += block.h + 12;
      } else {
        col1Y += block.h + 12;
      }
    }
    cursorY = Math.max(col0Y, col1Y) + 12;
  }

  // 5. Footer
  const footerH = 54;
  const totalHeight = cursorY + footerH;
  const exportScale = Math.min(1, 12000 / totalHeight);

  canvas.width = Math.round(canvasWidth * exportScale);
  canvas.height = Math.round(totalHeight * exportScale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context tidak tersedia');
  }
  if (exportScale < 1) {
    ctx.scale(exportScale, exportScale);
  }

  // Background
  ctx.fillStyle = '#3685c0';
  ctx.fillRect(0, 0, canvasWidth, totalHeight);

  // Header Banner — Modern Deep Blue
  const headerGrad = ctx.createLinearGradient(0, 0, canvasWidth, headerH);
  headerGrad.addColorStop(0, '#08203e');
  headerGrad.addColorStop(0.55, '#134b8a');
  headerGrad.addColorStop(1, '#1e78e8');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, canvasWidth, headerH);

  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, 0, canvasWidth, 6);

  const headerTag =
    options.mode === 'photos_only'
      ? `PREVENTIVE MAINTENANCE • DOKUMENTASI FOTO${
          (options.pageCount ?? 1) > 1
            ? ` (HALAMAN ${(options.pageIndex ?? 0) + 1} DARI ${options.pageCount})`
            : ''
        }`
      : options.mode === 'status_only'
      ? 'PREVENTIVE MAINTENANCE • RINGKASAN LIST STATUS CHECKLIST'
      : 'PREVENTIVE MAINTENANCE • RESUME CHECKLIST HARIAN';

  ctx.fillStyle = '#a5f3fc';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText(headerTag, padX, 42);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    truncateText(
      ctx,
      `Checklist ${report.shift} — ${report.site}`,
      contentW - 60
    ),
    padX,
    82
  );

  ctx.fillStyle = '#e0f2fe';
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  const inspectorText = report.inspector.trim()
    ? `   •   Petugas: ${report.inspector.trim()}`
    : '';
  ctx.fillText(
    `Hari/Tanggal : ${formatIndonesianDate(report.date)}${inspectorText}`,
    padX,
    116
  );

  // Issues Box
  let drawY = headerH + 24;
  if (issueLines.length > 0) {
    drawRoundedRect(ctx, padX, drawY, contentW, issueBoxH, 14);
    ctx.fillStyle = '#fef2f2';
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `PERHATIAN — ${issueLines.length} ITEM BERSTATUS NOT OK / TIDAK AKTIF`,
      padX + 20,
      drawY + 30
    );

    ctx.fillStyle = '#7f1d1d';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    issueLines.forEach((line, i) => {
      ctx.fillText(line, padX + 20, drawY + 58 + i * 24);
    });
    drawY += issueBoxH + 20;
  }

  // Photo Cards Section
  if (showPhotos) {
    if (photoLayouts.length > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      const photoHeading =
        (options.pageCount ?? 1) > 1
          ? `DOKUMENTASI FOTO BUKTI — BAGIAN ${(options.pageIndex ?? 0) + 1}/${options.pageCount} (${photoLayouts.length} DARI ${allPhotos.length} FOTO)`
          : `DOKUMENTASI FOTO BUKTI (${photoLayouts.length} FOTO TERLAMPIR)`;
      ctx.fillText(photoHeading, padX, drawY + 22);

      const loadedImages = await Promise.all(
        photoLayouts.map((card) =>
          loadImageElement(card.entry.photo.dataUrl).catch(() => null)
        )
      );

      photoLayouts.forEach((card, idx) => {
        const img = loadedImages[idx];

        drawRoundedRect(ctx, card.x, card.y, card.w, card.h, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle =
          card.badgePositive === false ? '#fca5a5' : '#cbd5e1';
        ctx.lineWidth = card.badgePositive === false ? 2.5 : 1.5;
        ctx.stroke();

        ctx.save();
        drawRoundedRect(ctx, card.x, card.y, card.w, imgH, 14);
        ctx.clip();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(card.x, card.y, card.w, imgH);

        if (img) {
          const scale = Math.min(card.w / img.width, imgH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const offsetX = card.x + (card.w - drawW) / 2;
          const offsetY = card.y + (imgH - drawH) / 2;
          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        }
        ctx.restore();

        // Status Badge
        ctx.font = `bold ${isDenseGrid ? 11 : 14}px system-ui, -apple-system, sans-serif`;
        const badgeW = Math.max(
          isDenseGrid ? 58 : 82,
          ctx.measureText(card.badgeText).width + (isDenseGrid ? 18 : 26)
        );
        const badgeX = card.x + card.w - badgeW - (isDenseGrid ? 8 : 14);
        const badgeY = card.y + (isDenseGrid ? 8 : 14);
        const badgeH = isDenseGrid ? 22 : 30;
        drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
        ctx.fillStyle =
          card.badgePositive === true
            ? '#10b981'
            : card.badgePositive === false
            ? '#ef4444'
            : '#0284c7';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(
          card.badgeText,
          badgeX + (isDenseGrid ? 9 : 13),
          badgeY + (isDenseGrid ? 15 : 20)
        );

        // Card index pill
        const numLabel = `#${card.globalNumber}`;
        ctx.font = `bold ${isDenseGrid ? 11 : 14}px system-ui, -apple-system, sans-serif`;
        const numW = Math.max(
          isDenseGrid ? 34 : 46,
          ctx.measureText(numLabel).width + (isDenseGrid ? 14 : 20)
        );
        drawRoundedRect(
          ctx,
          card.x + (isDenseGrid ? 8 : 14),
          card.y + (isDenseGrid ? 8 : 14),
          numW,
          isDenseGrid ? 22 : 28,
          7
        );
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(
          numLabel,
          card.x + (isDenseGrid ? 15 : 24),
          card.y + (isDenseGrid ? 23 : 33)
        );

        let textY =
          card.y +
          imgH +
          (isDenseGrid ? 24 : effectiveCols === 1 ? 44 : 34);

        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${titleFontSize}px system-ui, -apple-system, sans-serif`;
        for (const line of card.titleLines) {
          ctx.fillText(line, card.x + cardPad, textY);
          textY += titleLineHeight;
        }

        if (card.noteLines.length > 0) {
          textY += 2;
          ctx.fillStyle = '#475569';
          ctx.font = `${noteFontSize}px system-ui, -apple-system, sans-serif`;
          for (const nLine of card.noteLines) {
            ctx.fillText(nLine, card.x + cardPad, textY);
            textY += noteLineHeight;
          }
        }
      });
    } else {
      drawRoundedRect(ctx, padX, drawY, contentW, 84, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.font = '600 17px system-ui, -apple-system, sans-serif';
      ctx.fillText(
        'Belum ada foto bukti yang diupload pada checklist ini.',
        padX + 24,
        drawY + 48
      );
    }
  }

  // Status Summary Table
  if (showTable && sectionLayouts.length > 0) {
    const firstBlockY = Math.min(...sectionLayouts.map((b) => b.y));
    const firstId = (report.sections[0]?.code ?? 'A').replace('.', '');
    const lastId = (
      report.sections[report.sections.length - 1]?.code ?? 'N'
    ).replace('.', '');
    const rangeLabel = firstId === lastId ? firstId : `${firstId} – ${lastId}`;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `RINGKASAN STATUS CHECKLIST (${rangeLabel})`,
      padX,
      firstBlockY - 16
    );

    for (const block of sectionLayouts) {
      drawRoundedRect(ctx, block.x, block.y, block.w, block.h, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (block.section.isStandalone) {
        const line = block.lines[0];
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
        ctx.fillText(line.text, block.x + 16, block.y + 28);

        const badgeColor = line.positive ? '#dcfce7' : '#fee2e2';
        const badgeTextColor = line.positive ? '#15803d' : '#b91c1c';
        drawRoundedRect(ctx, block.x + block.w - 94, block.y + 10, 78, 25, 6);
        ctx.fillStyle = badgeColor;
        ctx.fill();
        ctx.fillStyle = badgeTextColor;
        ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(line.status, block.x + block.w - 82, block.y + 27);
        continue;
      }

      ctx.save();
      drawRoundedRect(ctx, block.x, block.y, block.w, 36, 12);
      ctx.clip();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(block.x, block.y, block.w, 36);
      ctx.restore();

      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(block.x, block.y + 36);
      ctx.lineTo(block.x + block.w, block.y + 36);
      ctx.stroke();

      ctx.fillStyle = '#256394';
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.fillText(
        `${block.section.code} ${block.section.title}`,
        block.x + 14,
        block.y + 24
      );

      let lineY = block.y + 58;
      for (const line of block.lines) {
        if (line.isGroupHeader) {
          ctx.fillStyle = '#334155';
          ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
          ctx.fillText(line.text, block.x + 14, lineY);
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.font = '14px system-ui, -apple-system, sans-serif';
          ctx.fillText(line.text, block.x + 14, lineY);

          const pillBg = line.positive ? '#dcfce7' : '#fee2e2';
          const pillFg = line.positive ? '#15803d' : '#b91c1c';
          drawRoundedRect(ctx, block.x + block.w - 88, lineY - 14, 74, 20, 5);
          ctx.fillStyle = pillBg;
          ctx.fill();
          ctx.fillStyle = pillFg;
          ctx.font = 'bold 11.5px system-ui, -apple-system, sans-serif';
          ctx.fillText(line.status, block.x + block.w - 79, lineY);
        }
        lineY += 23;
      }
    }
  }

  // Footer
  const footerY = totalHeight - footerH;
  ctx.fillStyle = '#1b4b72';
  ctx.fillRect(0, footerY, canvasWidth, footerH);
  ctx.fillStyle = '#e0f2fe';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Laporan Preventive Maintenance • ${report.site} • Dicetak pada ${new Date().toLocaleString('id-ID')}`,
    padX,
    footerY + 32
  );

  return canvas.toDataURL(
    options.format,
    options.format === 'image/jpeg' ? 0.92 : undefined
  );
}
