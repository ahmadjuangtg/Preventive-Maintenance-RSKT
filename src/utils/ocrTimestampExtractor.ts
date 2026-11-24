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
        2.2,
        1100
      );
      const bodyCrop = renderCropToPngDataUrl(
        img,
        0,
        Math.round(h * 0.12),
        w,
        Math.round(h * 0.78),
        1.8,
        1400
      );
      return [rightColCrop, bodyCrop].filter(Boolean);
    }

    // Portrait or cropped table screenshot
    const scale = w < 600 ? 2.5 : 2;
    const fullCrop = renderCropToPngDataUrl(img, 0, 0, w, h, scale, 1200);
    return fullCrop ? [fullCrop] : [];
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

let serverOcrAvailable: boolean | null = null;
let cachedWorkerPromise: Promise<
  import('tesseract.js').Worker
> | null = null;

async function getOcrWorker(): Promise<import('tesseract.js').Worker> {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789/: -',
      });
      return worker;
    })().catch((err) => {
      cachedWorkerPromise = null;
      throw err;
    });
  }
  return cachedWorkerPromise;
}

export async function extractLatestTimestampFromSource(
  source: File | string
): Promise<OcrExtractResult> {
  const crops = await prepareOcrCrops(source);
  if (crops.length === 0) {
    return { latest: null, candidates: [] };
  }

  // Prefer server-side Tesseract worker if available, but skip immediately after a 404 (e.g. on Netlify)
  if (serverOcrAvailable !== false) {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 2000);
      const res = await fetch('/api/ocr-timestamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [crops[0]] }),
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timer));

      if (res.ok) {
        serverOcrAvailable = true;
        const data = (await res.json()) as OcrExtractResult;
        if (data.latest || crops.length === 1) {
          return {
            latest: data.latest ?? null,
            candidates: Array.isArray(data.candidates) ? data.candidates : [],
          };
        }
      } else if (res.status === 404) {
        serverOcrAvailable = false;
      }
    } catch {
      // Fallback to client-side OCR below
    }
  }

  // Browser fallback via cached tesseract.js worker with early-exit on first matching crop
  try {
    const worker = await getOcrWorker();
    const allCandidates: ParsedTimestamp[] = [];
    for (const crop of crops) {
      const result = await worker.recognize(crop);
      const found = extractTimestampsFromText(result.data.text);
      if (found.length > 0) {
        allCandidates.push(...found);
        break;
      }
    }
    return {
      latest: pickLatestTimestamp(allCandidates),
      candidates: allCandidates,
    };
  } catch {
    return { latest: null, candidates: [] };
  }
}
