import { getStore } from '@netlify/blobs';

const STORE_NAME = 'pm-rskt-shared';
const DB_KEY = 'shared-db';

const DEFAULT_DB = {
  draft: null,
  history: [],
  customTemplate: null,
  updatedAt: null,
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function readDb(store) {
  try {
    const data = await store.get(DB_KEY, { type: 'json' });
    if (!data || typeof data !== 'object') {
      return { ...DEFAULT_DB };
    }
    return {
      draft: data.draft ?? null,
      history: Array.isArray(data.history) ? data.history : [],
      customTemplate: Array.isArray(data.customTemplate)
        ? data.customTemplate
        : null,
      updatedAt: data.updatedAt ?? null,
    };
  } catch {
    return { ...DEFAULT_DB };
  }
}

export default async (req) => {
  const url = new URL(req.url);
  const urlPath = url.pathname;
  const method = req.method.toUpperCase();

  try {
    const store = getStore(STORE_NAME);

    if (method === 'GET' && urlPath === '/api/shared') {
      const db = await readDb(store);
      return jsonResponse(db, 200);
    }

    if (method === 'POST' && urlPath === '/api/draft') {
      const body = await req.json().catch(() => ({}));
      const db = await readDb(store);
      db.draft = body?.draft ?? null;
      db.updatedAt = new Date().toISOString();
      await store.setJSON(DB_KEY, db);
      return jsonResponse({ ok: true, updatedAt: db.updatedAt }, 200);
    }

    if (method === 'POST' && urlPath === '/api/history') {
      const body = await req.json().catch(() => ({}));
      const report = body?.report;
      if (!report || typeof report !== 'object') {
        return jsonResponse({ error: 'Invalid report payload' }, 400);
      }
      const db = await readDb(store);
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
      await store.setJSON(DB_KEY, db);
      return jsonResponse(
        { history: db.history, updatedAt: db.updatedAt },
        200
      );
    }

    if (method === 'DELETE' && urlPath.startsWith('/api/history/')) {
      const id = decodeURIComponent(urlPath.replace('/api/history/', ''));
      const db = await readDb(store);
      db.history = db.history.filter((item) => item.id !== id);
      db.updatedAt = new Date().toISOString();
      await store.setJSON(DB_KEY, db);
      return jsonResponse(
        { history: db.history, updatedAt: db.updatedAt },
        200
      );
    }

    if (method === 'POST' && urlPath === '/api/template') {
      const body = await req.json().catch(() => ({}));
      const db = await readDb(store);
      db.customTemplate = Array.isArray(body?.sections) ? body.sections : null;
      db.updatedAt = new Date().toISOString();
      await store.setJSON(DB_KEY, db);
      return jsonResponse({ ok: true, updatedAt: db.updatedAt }, 200);
    }

    // For /api/ocr-timestamp on Netlify, let client-side tesseract.js fallback handle OCR cleanly
    return jsonResponse({ error: 'Not found' }, 404);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Server error' },
      500
    );
  }
};

export const config = {
  path: '/api/*',
};
