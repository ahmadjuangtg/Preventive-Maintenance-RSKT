import { X } from 'lucide-react';
import type { PhotoAttachment } from '../types/checklist';

interface PhotoLightboxProps {
  photo: PhotoAttachment | null;
  title?: string;
  onClose: () => void;
}

export function PhotoLightbox({ photo, title, onClose }: PhotoLightboxProps) {
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
          <div className="min-w-0 pr-3">
            <p className="truncate text-sm font-semibold">
              {title || 'Preview Foto'}
            </p>
            <p className="text-xs text-slate-400">Diambil {photo.timestamp}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 p-1.5 text-slate-200 hover:bg-white/20"
            aria-label="Tutup preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex max-h-[70vh] items-center justify-center bg-black p-2">
          <img
            src={photo.dataUrl}
            alt={photo.caption || title || 'Foto bukti'}
            className="max-h-[66vh] w-auto rounded-lg object-contain"
          />
        </div>

        {photo.caption && (
          <div className="border-t border-white/10 bg-slate-900 px-4 py-2.5 text-xs text-slate-200">
            {photo.caption}
          </div>
        )}
      </div>
    </div>
  );
}
