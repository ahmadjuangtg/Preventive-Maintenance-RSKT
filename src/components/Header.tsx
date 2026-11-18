import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { ChecklistReport } from '../types/checklist';
import { formatIndonesianDate } from '../utils/dateUtils';

interface HeaderProps {
  report: ChecklistReport;
  okCount: number;
  notOkCount: number;
  totalItems: number;
  totalPhotos: number;
  isSaving?: boolean;
  isLoadingSample?: boolean;
  onLoadSample: () => void;
  onSaveHistory: () => void;
  onReset: () => void;
}

export function Header({
  report,
  okCount,
  notOkCount,
  totalItems,
  totalPhotos,
  isSaving = false,
  isLoadingSample = false,
  onLoadSample,
  onSaveHistory,
  onReset,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-sky-300/25 bg-gradient-to-br from-[#08203e] via-[#134b8a] to-[#1e78e8] text-white shadow-lg shadow-slate-950/20">
      <div className="mx-auto max-w-2xl px-3.5 pt-3 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-cyan-200 uppercase">
              <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
              <span className="truncate">Preventive Maintenance Mobile</span>
            </div>
            <h1 className="truncate text-base font-extrabold tracking-tight text-white drop-shadow-xs sm:text-lg">
              {report.site || 'RSUD Kabupaten Tangerang'}
            </h1>
            <p className="truncate text-xs font-medium text-sky-100/95">
              Checklist {report.shift} • {formatIndonesianDate(report.date)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={isLoadingSample}
              onClick={onLoadSample}
              title="Muat contoh 70 checklist beserta 70 foto simulasi"
              className="inline-flex items-center gap-1 rounded-lg border border-white/25 bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/25 active:scale-95 disabled:opacity-70"
            >
              {isLoadingSample ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              )}
              <span>Contoh 70</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={onSaveHistory}
              title="Simpan ke riwayat bersama"
              className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-400 to-sky-400 px-2.5 py-1.5 text-xs font-bold text-slate-950 shadow-sm transition hover:from-cyan-300 hover:to-sky-300 active:scale-95 disabled:opacity-70"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
            </button>
            <button
              type="button"
              onClick={onReset}
              title="Reset checklist baru"
              className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 p-1.5 text-sky-100 transition hover:bg-red-500 hover:text-white active:scale-95"
              aria-label="Reset checklist"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Live Status Strip — High-Contrast OK & NOT OK */}
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-white shadow-sm shadow-emerald-950/30 ring-1 ring-emerald-200/80">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
            <span className="truncate text-xs font-extrabold tracking-wide">
              OK: {okCount}/{totalItems}
            </span>
          </div>

          <div
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-white shadow-sm ${
              notOkCount > 0
                ? 'bg-red-600 shadow-red-950/45 ring-2 ring-amber-200'
                : 'bg-rose-600 shadow-rose-950/30 ring-1 ring-rose-200/80'
            }`}
          >
            <XCircle className="h-4 w-4 shrink-0 text-white" />
            <span className="truncate text-xs font-extrabold tracking-wide">
              Not OK: {notOkCount}
            </span>
          </div>

          <div className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-200/35 bg-white/15 px-2.5 py-1.5 text-white backdrop-blur-xs">
            <Camera className="h-4 w-4 shrink-0 text-cyan-200" />
            <span className="truncate text-xs font-bold">
              Foto: {totalPhotos}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
