import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  visible: boolean;
  title: string;
  subtitle?: string;
}

export function LoadingOverlay({
  visible,
  title,
  subtitle,
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-xs flex-col items-center rounded-2xl bg-white px-6 py-6 text-center shadow-2xl ring-1 ring-slate-200">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-[#3685c0]">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
        <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
