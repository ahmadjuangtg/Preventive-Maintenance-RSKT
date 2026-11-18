import { Camera, Check, ImagePlus, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { flattenPhotos, isPositiveStatus } from '../data/checklistTemplate';
import type {
  ChecklistReport,
  FlattenedPhotoEntry,
  PhotoAttachment,
} from '../types/checklist';
import { formatTimeNow } from '../utils/dateUtils';
import { compressImage } from '../utils/imageUtils';

export interface UploadTargetOption {
  value: string; // "section:A" | "subgroup:A:A-b" | "item:A:A-a" | "item:A:A-b:A-b-1"
  label: string;
  group: string;
}

interface PendingBatchPhoto {
  id: string;
  dataUrl: string;
  rawFile?: File;
  targetValue: string;
  caption: string;
  timestamp: string;
}

interface GalleryTabProps {
  report: ChecklistReport;
  onAssignPhotoToTarget: (
    targetValue: string,
    photo: PhotoAttachment,
    rawFile?: File
  ) => void;
  onRemovePhotoEntry: (entry: FlattenedPhotoEntry) => void;
  onPreviewPhoto: (photo: PhotoAttachment, title: string) => void;
}

function buildTargetOptions(
  report: ChecklistReport
): UploadTargetOption[] {
  const options: UploadTargetOption[] = [];
  for (const section of report.sections) {
    const groupName = `${section.code} ${section.title}`;

    if (section.isStandalone) {
      const item = section.items[0];
      if (item) {
        options.push({
          value: `item:${section.id}:${item.id}`,
          label: `${section.code} ${section.title}`,
          group: 'Aplikasi & Server (J–N)',
        });
      }
      continue;
    }

    options.push({
      value: `section:${section.id}`,
      label: `[Seluruh Bagian] ${section.code} ${section.title}`,
      group: groupName,
    });

    for (const item of section.items) {
      options.push({
        value: `item:${section.id}:${item.id}`,
        label: `${item.code ? `${item.code} ` : ''}${item.label}`,
        group: groupName,
      });
    }

    for (const sg of section.subGroups) {
      options.push({
        value: `subgroup:${section.id}:${sg.id}`,
        label: `[Sub-Bagian] ${sg.code} ${sg.title}`,
        group: groupName,
      });
      for (const item of sg.items) {
        options.push({
          value: `item:${section.id}:${item.id}:${sg.id}`,
          label: `${sg.code} ${sg.title} › ${item.code} ${item.label}`,
          group: groupName,
        });
      }
    }
  }
  return options;
}

export function GalleryTab({
  report,
  onAssignPhotoToTarget,
  onRemovePhotoEntry,
  onPreviewPhoto,
}: GalleryTabProps) {
  const photos = useMemo(() => flattenPhotos(report), [report]);
  const targetOptions = useMemo(() => buildTargetOptions(report), [report]);
  const [selectedTarget, setSelectedTarget] = useState(
    () => targetOptions[0]?.value ?? ''
  );
  const [pendingBatch, setPendingBatch] = useState<PendingBatchPhoto[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const multiInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const groupedOptions = useMemo(() => {
    const map = new Map<string, UploadTargetOption[]>();
    for (const opt of targetOptions) {
      const list = map.get(opt.group) ?? [];
      list.push(opt);
      map.set(opt.group, list);
    }
    return Array.from(map.entries());
  }, [targetOptions]);

  const handleFilesSelected = async (
    files: FileList | null,
    mode: 'direct' | 'batch'
  ) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    try {
      const time = formatTimeNow();
      if (mode === 'direct') {
        for (const file of Array.from(files)) {
          const dataUrl = await compressImage(file);
          onAssignPhotoToTarget(
            selectedTarget,
            {
              id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              dataUrl,
              caption: '',
              timestamp: time,
            },
            file
          );
        }
      } else {
        const nextPending: PendingBatchPhoto[] = [];
        for (const file of Array.from(files)) {
          const dataUrl = await compressImage(file);
          nextPending.push({
            id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            dataUrl,
            rawFile: file,
            targetValue: selectedTarget || (targetOptions[0]?.value ?? ''),
            caption: '',
            timestamp: time,
          });
        }
        setPendingBatch((prev) => [...prev, ...nextPending]);
      }
    } finally {
      setIsProcessing(false);
      if (multiInputRef.current) multiInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const commitBatchItem = (pending: PendingBatchPhoto) => {
    onAssignPhotoToTarget(
      pending.targetValue,
      {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dataUrl: pending.dataUrl,
        caption: pending.caption,
        timestamp: pending.timestamp,
      },
      pending.rawFile
    );
    setPendingBatch((prev) => prev.filter((p) => p.id !== pending.id));
  };

  const commitAllBatch = () => {
    for (const pending of pendingBatch) {
      onAssignPhotoToTarget(
        pending.targetValue,
        {
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dataUrl: pending.dataUrl,
          caption: pending.caption,
          timestamp: pending.timestamp,
        },
        pending.rawFile
      );
    }
    setPendingBatch([]);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Quick Upload Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">
          Upload Foto Bukti ke Checklist
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Pilih item/bagian lalu ambil foto langsung, atau upload banyak foto
          sekaligus untuk dipetakan satu per satu.
        </p>

        <div className="mt-3 space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
              Target Item / Bagian Default
            </span>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#3685c0] focus:bg-white"
            >
              {groupedOptions.map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files, 'direct')}
          />
          <input
            ref={multiInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files, 'batch')}
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#3685c0] px-3 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#2b6ca3] active:scale-95 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              <span>Ambil Kamera</span>
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => multiInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-xs font-bold text-[#256394] transition hover:bg-sky-100 active:scale-95 disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              <span>{isProcessing ? 'Memproses...' : 'Pilih Multi-Foto'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pending Batch Assignment Queue */}
      {pendingBatch.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Antrean Pemetaan Foto ({pendingBatch.length})
              </h3>
              <p className="text-xs text-amber-800">
                Pilih lokasi item checklist untuk masing-masing foto di bawah:
              </p>
            </div>
            <button
              type="button"
              onClick={commitAllBatch}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#3685c0] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#2b6ca3]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Pasang Semua</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {pendingBatch.map((pending) => (
              <div
                key={pending.id}
                className="flex gap-3 rounded-xl border border-amber-200 bg-white p-2.5"
              >
                <img
                  src={pending.dataUrl}
                  alt="Antrean upload"
                  className="h-20 w-20 shrink-0 rounded-lg bg-slate-900 object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <select
                    value={pending.targetValue}
                    onChange={(e) =>
                      setPendingBatch((prev) =>
                        prev.map((p) =>
                          p.id === pending.id
                            ? { ...p, targetValue: e.target.value }
                            : p
                        )
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500"
                  >
                    {groupedOptions.map(([group, opts]) => (
                      <optgroup key={group} label={group}>
                        {opts.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={pending.caption}
                    onChange={(e) =>
                      setPendingBatch((prev) =>
                        prev.map((p) =>
                          p.id === pending.id
                            ? { ...p, caption: e.target.value }
                            : p
                        )
                      )
                    }
                    placeholder="Keterangan foto (opsional)..."
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-teal-500"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPendingBatch((prev) =>
                          prev.filter((p) => p.id !== pending.id)
                        )
                      }
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => commitBatchItem(pending)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3 w-3" />
                      <span>Pasang</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Existing Photos Grid */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-slate-900">
            Foto Terlampir Saat Ini ({photos.length})
          </h3>
        </div>

        {photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Camera className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Belum ada foto terlampir
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Upload foto di atas atau langsung dari tiap item di tab Checklist.
              Rekap gambar akan otomatis menyesuaikan foto yang tersedia.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {photos.map((entry, idx) => {
              const positive = entry.status
                ? isPositiveStatus(entry.status)
                : null;
              return (
                <div
                  key={`${entry.photo.id}-${idx}`}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
                >
                  <div className="relative h-36 bg-slate-900">
                    <button
                      type="button"
                      onClick={() =>
                        onPreviewPhoto(entry.photo, entry.fullLabel)
                      }
                      className="h-full w-full"
                    >
                      <img
                        src={entry.photo.dataUrl}
                        alt={entry.itemLabel}
                        className="h-full w-full object-contain"
                      />
                    </button>
                    {entry.status && (
                      <span
                        className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow ${
                          positive ? 'bg-emerald-600' : 'bg-red-600'
                        }`}
                      >
                        {entry.status}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemovePhotoEntry(entry)}
                      className="absolute top-2 right-2 rounded-full bg-slate-900/75 p-1.5 text-white hover:bg-red-600"
                      aria-label="Hapus foto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[10px] font-bold text-[#3685c0] uppercase">
                      {entry.subGroupTitle
                        ? `${entry.sectionTitle} › ${entry.subGroupTitle}`
                        : entry.sectionTitle}
                    </p>
                    <p className="line-clamp-2 text-xs font-bold text-slate-900">
                      {entry.itemLabel}
                    </p>
                    {(entry.photo.caption || entry.note) && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                        {entry.photo.caption || entry.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
