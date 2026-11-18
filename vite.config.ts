import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createWorker, type Worker } from 'tesseract.js';
import { defineConfig, type Plugin } from 'vite';
import {
  extractTimestampsFromText,
  pickLatestTimestamp,
  type ParsedTimestamp,
} from './src/utils/timestampParser.ts';

interface SharedDb {
  draft: unknown | null;
  history: Array<{ id: string; updatedAt?: string }>;
  customTemplate: unknown[] | null;
  updatedAt: string | null;
}

let ocrWorkerPromise: Promise<Worker> | null = null;
let ocrQueue: Promise<unknown> = Promise.resolve();

function getOcrWorker(): Promise<Worker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('eng');
  }
  return ocrWorkerPromise;
}

function runOcrSequential(dataUrls: string[]): Promise<{
  latest: ParsedTimestamp | null;
  candidates: ParsedTimestamp[];
}> {
  const job = ocrQueue.then(async () => {
    const worker = await getOcrWorker();
    const allCandidates: ParsedTimestamp[] = [];

    for (const dataUrl of dataUrls.slice(0, 3)) {
      const commaIdx = dataUrl.indexOf(',');
      const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      const buf = Buffer.from(b64, 'base64');
      const result = await worker.recognize(buf);
      const found = extractTimestampsFromText(result.data.text);
      allCandidates.push(...found);
    }

    const latest = pickLatestTimestamp(allCandidates);
    return { latest, candidates: allCandidates };
  });

  ocrQueue = job.catch(() => undefined);
  return job;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'shared-db.json');
const MAX_BODY_BYTES = 50 * 1024 * 1024; // 50 MB for 70-photo reports

function ensureDbFile(): SharedDb {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial: SharedDb = {
      draft: null,
      history: [],
      customTemplate: null,
      updatedAt: null,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SharedDb>;
    return {
      draft: parsed.draft ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      customTemplate: Array.isArray(parsed.customTemplate)
        ? parsed.customTemplate
        : null,
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return {
      draft: null,
      history: [],
      customTemplate: null,
      updatedAt: null,
    };
  }
}

function writeDbFile(db: SharedDb) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function attachSharedApi(
  middlewares: {
    use: (
      handler: (
        req: IncomingMessage,
        res: ServerResponse,
        next: () => void
      ) => void
    ) => void;
  }
) {
  ensureDbFile();

  middlewares.use(async (req, res, next) => {
    const reqUrl = req.url ?? '';
    if (!reqUrl.startsWith('/api/')) {
      next();
      return;
    }

    const urlPath = reqUrl.split('?')[0];

    try {
      if (req.method === 'GET' && urlPath === '/api/shared') {
        const db = ensureDbFile();
        sendJson(res, 200, db);
        return;
      }

      if (req.method === 'POST' && urlPath === '/api/draft') {
        const body = (await readJsonBody(req)) as { draft?: unknown };
        const db = ensureDbFile();
        db.draft = body.draft ?? null;
        db.updatedAt = new Date().toISOString();
        writeDbFile(db);
        sendJson(res, 200, { ok: true, updatedAt: db.updatedAt });
        return;
      }

      if (req.method === 'POST' && urlPath === '/api/history') {
        const body = (await readJsonBody(req)) as {
          report?: { id?: string; updatedAt?: string };
        };
        const report = body.report;
        if (!report || typeof report !== 'object') {
          sendJson(res, 400, { error: 'Invalid report payload' });
          return;
        }
        const db = ensureDbFile();
        const snapshot = {
          ...report,
          id: report.id || `report-${Date.now()}`,
          updatedAt: new Date().toISOString(),
        };
        db.history = [
          snapshot,
          ...db.history.filter((item) => item.id !== snapshot.id),
        ].slice(0, 50);
        db.updatedAt = snapshot.updatedAt;
        writeDbFile(db);
        sendJson(res, 200, { history: db.history, updatedAt: db.updatedAt });
        return;
      }

      if (req.method === 'DELETE' && urlPath.startsWith('/api/history/')) {
        const id = decodeURIComponent(urlPath.replace('/api/history/', ''));
        const db = ensureDbFile();
        db.history = db.history.filter((item) => item.id !== id);
        db.updatedAt = new Date().toISOString();
        writeDbFile(db);
        sendJson(res, 200, { history: db.history, updatedAt: db.updatedAt });
        return;
      }

      if (req.method === 'POST' && urlPath === '/api/template') {
        const body = (await readJsonBody(req)) as {
          sections?: unknown[] | null;
        };
        const db = ensureDbFile();
        db.customTemplate = Array.isArray(body.sections) ? body.sections : null;
        db.updatedAt = new Date().toISOString();
        writeDbFile(db);
        sendJson(res, 200, { ok: true, updatedAt: db.updatedAt });
        return;
      }

      if (req.method === 'POST' && urlPath === '/api/ocr-timestamp') {
        const body = (await readJsonBody(req)) as {
          images?: unknown;
        };
        const images = Array.isArray(body.images)
          ? body.images.filter((v): v is string => typeof v === 'string')
          : [];
        if (images.length === 0) {
          sendJson(res, 400, { error: 'No images provided' });
          return;
        }
        const ocrResult = await runOcrSequential(images);
        sendJson(res, 200, ocrResult);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Server error',
      });
    }
  });
}

function sharedDbPlugin(): Plugin {
  return {
    name: 'shared-pm-db',
    configureServer(server) {
      attachSharedApi(server.middlewares);
    },
    configurePreviewServer(server) {
      attachSharedApi(server.middlewares);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), sharedDbPlugin()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    watch: {
      ignored: ['**/data/**'],
    },
  },
});
