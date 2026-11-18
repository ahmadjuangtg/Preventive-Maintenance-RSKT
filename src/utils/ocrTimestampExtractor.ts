import { loadImageElement } from './imageUtils';
import {
  extractTimestampsFromText,
  pickLatestTimestamp,
  type ParsedTimestamp,
} from './timestampParser';

export interface OcrExtractResult {
  latest: ParsedTimestamp | null;
  candidates: ParsedTimestamp[];
}

function renderCropToPngDataUrl(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetScale: number,
  maxDimension: number
): string {
  const rawW = Math.max(1, Math.round(sw * targetScale));
  const rawH = Math.max(1, Math.round(sh * targetScale));
  const capScale = Math.min(1, maxDimension / Math.max(rawW, rawH));
  const outW = Math.max(1, Math.round(rawW * capScale));
  const outH = Math.max(1, Math.round(rawH * capScale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

  return canvas.toDataURL('image/png');
}

async function prepareOcrCrops(source: File | string): Promise<string[]> {
  let objectUrl: string | null = null;
  try {
    const src =
      typeof source === 'string'
        ? source
        : ((objectUrl = URL.createObjectURL(source)), objectUrl);
    const img = await loadImageElement(src);
    const w = img.width;
    const h = img.height;

    if (w > h * 1.25) {
      // Wide desktop screenshot: prioritize right-hand "Update Terakhir" table column
      // and exclude top browser tabs & bottom Windows taskbar clock.
      const rightColCrop = renderCropToPngDataUrl(
        img,
        Math.round(w * 0.64),
        Math.round(h * 0.16),
        Math.round(w * 0.35),
        Math.round(h * 0.74),
        3.5,
        1600
      );
      const bodyCrop = renderCropToPngDataUrl(
        img,
        0,
        Math.round(h * 0.12),
        w,
        Math.round(h * 0.78),
        2.5,
        2200
      );
      return [rightColCrop, bodyCrop].filter(Boolean);
    }

    // Portrait or cropped table screenshot
    const scale = w < 600 ? 4 : 3;
    const fullCrop = renderCropToPngDataUrl(img, 0, 0, w, h, scale, 1800);
    return fullCrop ? [fullCrop] : [];
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export async function extractLatestTimestampFromSource(
  source: File | string
): Promise<OcrExtractResult> {
  const crops = await prepareOcrCrops(source);
  if (crops.length === 0) {
    return { latest: null, candidates: [] };
  }

  // Prefer server-side Tesseract worker so phones don't need to download traineddata over mobile data
  try {
    const res = await fetch('/api/ocr-timestamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: crops }),
    });
    if (res.ok) {
      const data = (await res.json()) as OcrExtractResult;
      return {
        latest: data.latest ?? null,
        candidates: Array.isArray(data.candidates) ? data.candidates : [],
      };
    }
  } catch {
    // Fallback to client-side OCR below
  }

  // Browser fallback via tesseract.js
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    try {
      const allCandidates: ParsedTimestamp[] = [];
      for (const crop of crops) {
        const result = await worker.recognize(crop);
        allCandidates.push(...extractTimestampsFromText(result.data.text));
      }
      return {
        latest: pickLatestTimestamp(allCandidates),
        candidates: allCandidates,
      };
    } finally {
      await worker.terminate();
    }
  } catch {
    return { latest: null, candidates: [] };
  }
}
