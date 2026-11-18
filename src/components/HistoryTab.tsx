import {
  Calendar,
  Camera,
  Cloud,
  FolderOpen,
  History,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { getReportStats } from '../data/checklistTemplate';
import type { ChecklistReport } from '../types/checklist';
import { formatIndonesianDate } from '../utils/dateUtils';

interface HistoryTabProps {
  history: ChecklistReport[];
  isRefreshing?: boolean;
  onRefreshHistory: () => void;
  onLoadReport: (report: ChecklistReport) => void;
  onDeleteReport: (reportId: string) => void;
}

export function HistoryTab({
  history,
  isRefreshing = false,
  onRefreshHistory,
  onLoadReport,
  onDeleteReport,
}: HistoryTabProps) {
  return (
    <div className="space-y-3 pb-24">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#3685c0]" />
            <h2 className="text-sm font-bold text-slate-900">
              Riwayat Laporan Bersama ({history.length})
            </h2>
          </div>

          <button
            type="button"
            disabled={isRefreshing}
            onClick={onRefreshHistory}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-[#256394] hover:bg-sky-100 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
        </div>

        <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
          <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3685c0]" />
          <span>
            Tersimpan di server laptop Anda (<code>data/shared-db.json</code>),
            sehingga riwayat ini bisa dilihat dan dimuat oleh setiap orang yang
            membuka link aplikasi.
          </span>
        </p>
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sky-200 bg-white/95 p-8 text-center">
          <History className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">
            Belum ada riwayat tersimpan
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tekan tombol "Simpan" di bagian atas agar laporan tersimpan ke
            server dan muncul untuk semua pengguna.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {history.map((item) => {
            const stats = getReportStats(item);
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-[#256394]">
                        {item.shift}
                      </span>
                      <span className="truncate text-sm font-bold text-slate-900">
                        {item.site}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatIndonesianDate(item.date)}
                      {item.inspector ? ` • ${item.inspector}` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteReport(item.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Hapus riwayat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-emerald-700">
                      OK: {stats.okCount}/{stats.totalItems}
                    </span>
                    {stats.notOkCount > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                        {stats.notOkCount} Not OK
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Camera className="h-3.5 w-3.5" />
                      {stats.totalPhotos}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLoadReport(item)}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#3685c0] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2b6ca3] active:scale-95"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>Muat</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
