import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PhotoAttachment } from '../types/checklist';
import { formatTimeNow } from '../utils/dateUtils';
import { compressImage } from '../utils/imageUtils';

interface PhotoUploaderButtonProps {
  onAddPhotos: (newPhotos: PhotoAttachment[], rawFiles?: File[]) => void;
  onConfirmTimestamp?: (files: FileList) => Promise<boolean | null>;
  compact?: boolean;
  label?: string;
  stampTimestamp?: boolean;
}

export function PhotoUploaderButton({
  onAddPhotos,
  onConfirmTimestamp,
  compact = false,
  label = 'Foto',
  stampTimestamp = true,
}: PhotoUploaderButtonProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    try {
      const shouldStamp = onConfirmTimestamp
        ? await onConfirmTimestamp(files)
        : stampTimestamp;
      if (shouldStamp === null) return;

      setIsProcessing(true);
      const processed: PhotoAttachment[] = [];
      for (const file of fileArr) {
        const dataUrl = await compressImage(file, 1280, 0.82, {
          stampTimestamp: shouldStamp,
        });
        processed.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dataUrl,
          caption: '',
          timestamp: formatTimeNow(),
        });
      }
      if (processed.length > 0) {
        onAddPhotos(processed, fileArr);
      }
    } finally {
      setIsProcessing(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => cameraInputRef.current?.click()}
        title="Ambil foto dari kamera"
        className={
          compact
            ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#3685c0] hover:text-[#3685c0] active:scale-95 disabled:opacity-50'
            : 'inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-[#256394] transition hover:bg-sky-100 active:scale-95 disabled:opacity-50'
        }
      >
        <Camera className="h-3.5 w-3.5" />
        {!compact && <span>Kamera</span>}
      </button>
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => galleryInputRef.current?.click()}
        title="Pilih foto dari galeri"
        className={
          compact
            ? 'inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 transition hover:border-[#3685c0] hover:text-[#3685c0] active:scale-95 disabled:opacity-50'
            : 'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50'
        }
      >
        <ImagePlus className="h-3.5 w-3.5" />
        <span>{isProcessing ? '...' : label}</span>
      </button>
    </div>
  );
}

interface PhotoStripProps {
  photos: PhotoAttachment[];
  title: string;
  onPreview: (photo: PhotoAttachment, title: string) => void;
  onRemove: (photoId: string) => void;
  onUpdateCaption?: (photoId: string, caption: string) => void;
}

export function PhotoStrip({
  photos,
  title,
  onPreview,
  onRemove,
  onUpdateCaption,
}: PhotoStripProps) {
  if (photos.length === 0) return null;

  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative flex w-28 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        >
          <button
            type="button"
            onClick={() => onPreview(photo, title)}
            className="relative h-20 w-full overflow-hidden bg-slate-900"
          >
            <img
              src={photo.dataUrl}
              alt={photo.caption || title}
              className="h-full w-full object-cover"
            />
          </button>
          <button
            type="button"
            onClick={() => onRemove(photo.id)}
            aria-label="Hapus foto"
            className="absolute top-1 right-1 rounded-full bg-slate-900/75 p-1 text-white shadow hover:bg-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          {onUpdateCaption ? (
            <input
              type="text"
              value={photo.caption}
              onChange={(e) => onUpdateCaption(photo.id, e.target.value)}
              placeholder="Ket. foto..."
              className="w-full border-t border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-700 outline-none focus:bg-teal-50/40"
            />
          ) : (
            <span className="truncate px-1.5 py-0.5 text-[10px] text-slate-500">
              {photo.timestamp}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
