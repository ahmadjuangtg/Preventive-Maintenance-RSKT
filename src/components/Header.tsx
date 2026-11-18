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
    <header className="sticky top-0 z-30 bg-gradient-to-r from-[#1b4b72] via-[#28689c] to-[#3685c0] text-white shadow-md">
      <div className="mx-auto max-w-2xl px-3.5 pt-3 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-sky-200 uppercase">
              <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Preventive Maintenance Mobile</span>
            </div>
            <h1 className="truncate text-base font-bold text-white sm:text-lg">
              {report.site || 'RSUD Kabupaten Tangerang'}
            </h1>
            <p className="truncate text-xs text-sky-100/90">
              Checklist {report.shift} • {formatIndonesianDate(report.date)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={isLoadingSample}
              onClick={onLoadSample}
              title="Muat contoh 70 checklist beserta 70 foto simulasi"
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-white/25 active:scale-95 disabled:opacity-70"
            >
              {isLoadingSample ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>Contoh 70</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={onSaveHistory}
              title="Simpan ke riwayat bersama"
              className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-400 active:scale-95 disabled:opacity-70"
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
              className="inline-flex items-center justify-center rounded-lg bg-white/10 p-1.5 text-slate-200 transition hover:bg-red-500/80 hover:text-white active:scale-95"
              aria-label="Reset checklist"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Live Status Strip */}
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1 ring-1 ring-emerald-400/30">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            <span className="truncate text-xs font-semibold text-emerald-100">
              OK: {okCount}/{totalItems}
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 ring-1 ${
              notOkCount > 0
                ? 'bg-red-500/30 ring-red-400/60'
                : 'bg-white/10 ring-white/15'
            }`}
          >
            <XCircle
              className={`h-3.5 w-3.5 shrink-0 ${
                notOkCount > 0 ? 'text-red-300' : 'text-slate-300'
              }`}
            />
            <span
              className={`truncate text-xs font-semibold ${
                notOkCount > 0 ? 'text-red-100' : 'text-slate-200'
              }`}
            >
              Not OK: {notOkCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-2.5 py-1 ring-1 ring-sky-400/30">
            <Camera className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            <span className="truncate text-xs font-semibold text-sky-100">
              Foto: {totalPhotos}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
