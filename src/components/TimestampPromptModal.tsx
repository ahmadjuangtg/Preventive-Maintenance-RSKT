import { Clock, ImageOff, X } from 'lucide-react';
import { useState } from 'react';
import type { PhotoTimestampMode } from '../types/checklist';

interface PhotoTimestampSelectorProps {
  mode: PhotoTimestampMode;
  onChangeMode: (mode: PhotoTimestampMode) => void;
  label?: string;
}

const TIMESTAMP_MODE_OPTIONS: ReadonlyArray<{
  value: PhotoTimestampMode;
  label: string;
}> = [
  { value: 'ask', label: 'Tanya Tiap Foto' },
  { value: 'on', label: 'Pakai' },
  { value: 'off', label: 'Tanpa' },
];

export function PhotoTimestampSelector({
  mode,
  onChangeMode,
  label = 'Timestamp di Foto:',
}: PhotoTimestampSelectorProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-100 bg-sky-50/75 px-2.5 py-1.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
        <Clock className="h-3.5 w-3.5 text-[#134b8a]" />
        <span>{label}</span>
      </span>
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
        {TIMESTAMP_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChangeMode(opt.value)}
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
              mode === opt.value
                ? 'bg-[#134b8a] text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TimestampPromptModalProps {
  fileCount: number;
  previewUrl: string;
  onConfirm: (stampTimestamp: boolean, remember: boolean) => void;
  onCancel: () => void;
}

function getPreviewTimestampText(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())} WIB`;
}

export function TimestampPromptModal({
  fileCount,
  previewUrl,
  onConfirm,
  onCancel,
}: TimestampPromptModalProps) {
  const [remember, setRemember] = useState(false);
  const sampleStamp = getPreviewTimestampText();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-xs sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="timestamp-modal-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-[#08203e] via-[#134b8a] to-[#1e78e8] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-200" />
            <h3 id="timestamp-modal-title" className="text-sm font-bold">
              Tambahkan Timestamp di Foto?
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-sky-100 transition hover:bg-white/15"
            aria-label="Batal upload foto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-xs text-slate-600">
            Anda memilih <strong>{fileCount} foto</strong>. Mau tempelkan jam
            & tanggal otomatis di pojok kanan bawah foto?
          </p>

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            <img
              src={previewUrl}
              alt="Preview foto upload"
              className="h-44 w-full object-contain"
            />
            <div className="pointer-events-none absolute right-2.5 bottom-2.5 rounded-md border border-white/25 bg-[#0a192f]/80 px-2 py-1 font-mono text-[10px] font-bold text-yellow-300 shadow-sm">
              {sampleStamp}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#134b8a] focus:ring-[#134b8a]"
            />
            <span>
              Ingat pilihan ini (bisa diubah lagi di toolbar &apos;Timestamp
              Foto&apos;)
            </span>
          </label>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => onConfirm(false, remember)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              <ImageOff className="h-4 w-4 text-slate-500" />
              <span>Tanpa Timestamp</span>
            </button>
            <button
              type="button"
              onClick={() => onConfirm(true, remember)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#134b8a] to-[#1e78e8] px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110 active:scale-95"
            >
              <Clock className="h-4 w-4 text-cyan-200" />
              <span>Pakai Timestamp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
