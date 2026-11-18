import { del, get, set } from 'idb-keyval';
import type { ChecklistReport, ChecklistSection } from '../types/checklist';
import { formatSlashDate } from './dateUtils';

const DRAFT_KEY = 'pm_rsud_active_draft_v1';
const HISTORY_KEY = 'pm_rsud_report_history_v1';
const CUSTOM_TEMPLATE_KEY = 'pm_rsud_custom_template_v1';

export interface SharedStateResponse {
  draft: ChecklistReport | null;
  history: ChecklistReport[];
  customTemplate: ChecklistSection[] | null;
  updatedAt: string | null;
  syncedFromServer: boolean;
}

let draftSyncTimer: number | null = null;

export async function loadActiveDraft(): Promise<ChecklistReport | null> {
  try {
    const data = await get<ChecklistReport>(DRAFT_KEY);
    return data ?? null;
  } catch {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as ChecklistReport) : null;
    } catch {
      return null;
    }
  }
}

export async function saveActiveDraft(report: ChecklistReport): Promise<void> {
  try {
    await set(DRAFT_KEY, report);
  } catch {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(report));
    } catch {
      // Ignore storage quota errors in fallback mode
    }
  }

  if (draftSyncTimer) {
    window.clearTimeout(draftSyncTimer);
  }
  draftSyncTimer = window.setTimeout(() => {
    void fetch('/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: report }),
    }).catch(() => {
      // Offline / server unreachable fallback
    });
  }, 700);
}

export async function clearActiveDraft(): Promise<void> {
  try {
    await del(DRAFT_KEY);
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

export async function loadReportHistory(): Promise<ChecklistReport[]> {
  try {
    const res = await fetch('/api/shared', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { history?: ChecklistReport[] };
      if (Array.isArray(data.history)) {
        await set(HISTORY_KEY, data.history).catch(() => {});
        return data.history;
      }
    }
  } catch {
    // Fallback to local IndexedDB
  }

  try {
    const list = await get<ChecklistReport[]>(HISTORY_KEY);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function loadSharedState(): Promise<SharedStateResponse> {
  const [localDraft, localHistory, localTemplate] = await Promise.all([
    loadActiveDraft(),
    get<ChecklistReport[]>(HISTORY_KEY).catch(() => []),
    loadCustomTemplate(),
  ]);

  try {
    const res = await fetch('/api/shared', { cache: 'no-store' });
    if (res.ok) {
      const serverData = (await res.json()) as {
        draft?: ChecklistReport | null;
        history?: ChecklistReport[];
        customTemplate?: ChecklistSection[] | null;
        updatedAt?: string | null;
      };

      let history = Array.isArray(serverData.history) ? serverData.history : [];
      // If server history is empty on first migration but local device has saved reports, push them once
      if (
        history.length === 0 &&
        Array.isArray(localHistory) &&
        localHistory.length > 0
      ) {
        for (const item of [...localHistory].reverse()) {
          const pushRes = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report: item }),
          }).catch(() => null);
          if (pushRes?.ok) {
            const pushed = (await pushRes.json()) as {
              history?: ChecklistReport[];
            };
            if (Array.isArray(pushed.history)) {
              history = pushed.history;
            }
          }
        }
      }

      await set(HISTORY_KEY, history).catch(() => {});

      const draft = serverData.draft ?? localDraft ?? null;
      const customTemplate = serverData.customTemplate ?? localTemplate ?? null;

      return {
        draft,
        history,
        customTemplate,
        updatedAt: serverData.updatedAt ?? null,
        syncedFromServer: true,
      };
    }
  } catch {
    // Offline fallback below
  }

  return {
    draft: localDraft,
    history: Array.isArray(localHistory) ? localHistory : [],
    customTemplate: localTemplate,
    updatedAt: null,
    syncedFromServer: false,
  };
}

export async function saveReportToHistory(
  report: ChecklistReport
): Promise<{ history: ChecklistReport[]; syncedToServer: boolean }> {
  const snapshot: ChecklistReport = {
    ...report,
    id: report.id || `report-${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: snapshot }),
    });
    if (res.ok) {
      const data = (await res.json()) as { history?: ChecklistReport[] };
      if (Array.isArray(data.history)) {
        await set(HISTORY_KEY, data.history).catch(() => {});
        return { history: data.history, syncedToServer: true };
      }
    }
  } catch {
    // Offline fallback below
  }

  const existing = (await get<ChecklistReport[]>(HISTORY_KEY).catch(() => [])) ?? [];
  const filtered = existing.filter((r) => r.id !== snapshot.id);
  const updated = [snapshot, ...filtered].slice(0, 50);
  await set(HISTORY_KEY, updated).catch(() => {});
  return { history: updated, syncedToServer: false };
}

export async function deleteReportFromHistory(
  reportId: string
): Promise<ChecklistReport[]> {
  try {
    const res = await fetch(
      `/api/history/${encodeURIComponent(reportId)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      const data = (await res.json()) as { history?: ChecklistReport[] };
      if (Array.isArray(data.history)) {
        await set(HISTORY_KEY, data.history).catch(() => {});
        return data.history;
      }
    }
  } catch {
    // Offline fallback below
  }

  const existing = (await get<ChecklistReport[]>(HISTORY_KEY).catch(() => [])) ?? [];
  const updated = existing.filter((r) => r.id !== reportId);
  await set(HISTORY_KEY, updated).catch(() => {});
  return updated;
}

export function resetSectionsFromTemplate(
  sections: ChecklistSection[],
  isoDate: string
): ChecklistSection[] {
  const slashDate = formatSlashDate(isoDate);
  const resetItem = (item: ChecklistSection['items'][number]) => ({
    ...item,
    status: (item.statusMode === 'aktif_tidak_aktif' ? 'Aktif' : 'OK') as
      | 'OK'
      | 'Aktif',
    note:
      item.id === 'C-3' || item.notePlaceholder?.startsWith('Last Update :')
        ? `Last Update : ${slashDate}`
        : '',
    photos: [],
  });

  return sections.map((sec) => ({
    ...sec,
    note: '',
    photos: [],
    items: sec.items.map(resetItem),
    subGroups: sec.subGroups.map((sg) => ({
      ...sg,
      note: '',
      photos: [],
      items: sg.items.map(resetItem),
    })),
  }));
}

export async function saveCustomTemplate(
  sections: ChecklistSection[]
): Promise<void> {
  const cleanSections = resetSectionsFromTemplate(sections, '2026-01-01');
  try {
    await set(CUSTOM_TEMPLATE_KEY, cleanSections);
  } catch {
    try {
      localStorage.setItem(CUSTOM_TEMPLATE_KEY, JSON.stringify(cleanSections));
    } catch {
      // Ignore storage error
    }
  }
  void fetch('/api/template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sections: cleanSections }),
  }).catch(() => {});
}

export async function loadCustomTemplate(): Promise<ChecklistSection[] | null> {
  try {
    const data = await get<ChecklistSection[]>(CUSTOM_TEMPLATE_KEY);
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch {
    try {
      const raw = localStorage.getItem(CUSTOM_TEMPLATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }
}

export async function clearCustomTemplate(): Promise<void> {
  try {
    await del(CUSTOM_TEMPLATE_KEY);
  } catch {
    localStorage.removeItem(CUSTOM_TEMPLATE_KEY);
  }
  void fetch('/api/template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sections: null }),
  }).catch(() => {});
}
