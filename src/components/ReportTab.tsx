import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChecklistReport } from '../types/checklist';
import {
  generateCollageImage,
  generatePhotoPages,
  type CollageColumns,
} from '../utils/collageGenerator';
import { generatePdfReport } from '../utils/pdfGenerator';
import { formatWhatsAppReport } from '../utils/whatsappFormatter';
import { LoadingOverlay } from './LoadingOverlay';

interface ReportTabProps {
  report: ChecklistReport;
  totalPhotos: number;
  onNotify: (msg: string) => void;
}

type OutputSubTab = 'image' | 'whatsapp' | 'pdf';
type ImageLayoutMode = 'separate' | 'photos_only' | 'status_only' | 'combined';

interface GeneratedImageSet {
  photoPages: string[];
  statusImage: string;
  combinedImage: string;
}

function minDelay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function ReportTab({ report, totalPhotos, onNotify }: ReportTabProps) {
  const [subTab, setSubTab] = useState<OutputSubTab>('image');
  const [layoutMode, setLayoutMode] = useState<ImageLayoutMode>('separate');
  const [columns, setColumns] = useState<CollageColumns>(() =>
    totalPhotos >= 25 ? 4 : 2
  );
  const [maxPhotosPerPage, setMaxPhotosPerPage] = useState<number>(() =>
    totalPhotos >= 25 ? 35 : 6
  );
  const [format, setFormat] = useState<'image/png' | 'image/jpeg'>('image/png');

  const [images, setImages] = useState<GeneratedImageSet>({
    photoPages: [],
    statusImage: '',
    combinedImage: '',
  });

  const [loadingOverlay, setLoadingOverlay] = useState<{
    visible: boolean;
    title: string;
    subtitle?: string;
  }>({ visible: false, title: '' });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);
  const hasAutoRenderedRef = useRef(false);

  const waText = useMemo(() => formatWhatsAppReport(report), [report]);

  const fileSlug = useMemo(() => {
    const safeSite = (report.site || 'Site')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    return `Checklist_${report.shift}_${safeSite}_${report.date}`;
  }, [report.date, report.shift, report.site]);

  const runGenerateImages = useCallback(
    async (withVisualDelay: boolean) => {
      setLoadingOverlay({
        visible: true,
        title: 'Sedang Meng-generate Gambar...',
        subtitle:
          layoutMode === 'separate'
            ? 'Menyusun laporan foto & list status secara terpisah'
            : 'Menyusun gambar rekapan checklist',
      });

      try {
        const delayPromise = withVisualDelay ? minDelay(450) : Promise.resolve();

        if (layoutMode === 'separate') {
          const [photoPages, statusImage] = await Promise.all([
            generatePhotoPages(report, {
              columns,
              format,
              maxPerPage: maxPhotosPerPage,
            }),
            generateCollageImage(report, {
              columns,
              mode: 'status_only',
              format,
            }),
            delayPromise,
          ]);
          setImages({ photoPages, statusImage, combinedImage: '' });
        } else if (layoutMode === 'photos_only') {
          const [photoPages] = await Promise.all([
            generatePhotoPages(report, {
              columns,
              format,
              maxPerPage: maxPhotosPerPage,
            }),
            delayPromise,
          ]);
          setImages({ photoPages, statusImage: '', combinedImage: '' });
        } else if (layoutMode === 'status_only') {
          const [statusImage] = await Promise.all([
            generateCollageImage(report, {
              columns,
              mode: 'status_only',
              format,
            }),
            delayPromise,
          ]);
          setImages({ photoPages: [], statusImage, combinedImage: '' });
        } else {
          const [combinedImage] = await Promise.all([
            generateCollageImage(report, {
              columns,
              mode: 'combined',
              format,
            }),
            delayPromise,
          ]);
          setImages({ photoPages: [], statusImage: '', combinedImage });
        }
      } catch (err) {
        onNotify(
          err instanceof Error ? err.message : 'Gagal membuat gambar rekap'
        );
      } finally {
        setLoadingOverlay({ visible: false, title: '' });
      }
    },
    [report, layoutMode, columns, format, maxPhotosPerPage, onNotify]
  );

  useEffect(() => {
    if (subTab !== 'image') return;
    const isInitial = !hasAutoRenderedRef.current;
    hasAutoRenderedRef.current = true;
    const timer = window.setTimeout(() => {
      void runGenerateImages(isInitial);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [subTab, runGenerateImages]);

  const ext = format === 'image/jpeg' ? 'jpg' : 'png';

  const triggerDownloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const handleDownloadAll = async () => {
    const list: Array<{ url: string; name: string }> = [];
    images.photoPages.forEach((url, idx) => {
      const suffix =
        images.photoPages.length > 1 ? `_Foto_Bag${idx + 1}` : '_Foto';
      list.push({ url, name: `${fileSlug}${suffix}.${ext}` });
    });
    if (images.statusImage) {
      list.push({ url: images.statusImage, name: `${fileSlug}_List.${ext}` });
    }
    if (images.combinedImage) {
      list.push({
        url: images.combinedImage,
        name: `${fileSlug}_Lengkap.${ext}`,
      });
    }
    if (list.length === 0) return;

    setLoadingOverlay({
      visible: true,
      title: `Mendownload ${list.length} Gambar...`,
      subtitle: 'Menyiapkan file untuk disimpan ke galeri/perangkat',
    });
    await minDelay(350);
    list.forEach((item, i) => {
      window.setTimeout(() => {
        triggerDownloadDataUrl(item.url, item.name);
      }, i * 180);
    });
    setLoadingOverlay({ visible: false, title: '' });
    onNotify(`${list.length} file gambar (${ext.toUpperCase()}) didownload`);
  };

  const dataUrlToPngBlob = async (dataUrl: string): Promise<Blob> => {
    if (dataUrl.startsWith('data:image/png')) {
      const res = await fetch(dataUrl);
      return res.blob();
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        c.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Blob conversion failed'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = dataUrl;
    });
  };

  const shareToWhatsAppWeb = async (
    items: Array<{ url: string; name: string }>
  ) => {
    if (items.length === 0) return;
    setLoadingOverlay({
      visible: true,
      title: 'Membuka WhatsApp Web...',
      subtitle: 'Menyalin gambar & menyiapkan file laporan',
    });

    let copiedToClipboard = false;
    try {
      if (
        typeof ClipboardItem !== 'undefined' &&
        navigator.clipboard &&
        'write' in navigator.clipboard
      ) {
        const pngBlob = await dataUrlToPngBlob(items[0].url);
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob }),
        ]);
        copiedToClipboard = true;
      }
    } catch {
      copiedToClipboard = false;
    }

    items.forEach((item, i) => {
      window.setTimeout(() => {
        triggerDownloadDataUrl(item.url, item.name);
      }, i * 180);
    });

    const summaryText = `Berikut Resume Update Checklist ${report.shift} Site ${report.site} (${report.date})`;
    window.open(
      `https://web.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`,
      '_blank',
      'noopener'
    );

    setLoadingOverlay({ visible: false, title: '' });

    if (copiedToClipboard) {
      onNotify(
        items.length > 1
          ? 'Gambar #1 disalin & semua file didownload! Di WhatsApp Web, pilih chat lalu Paste (Ctrl+V) / lampirkan file.'
          : 'Gambar disalin ke Clipboard & dibuka di WhatsApp Web! Pilih chat lalu tekan Ctrl+V (Paste).'
      );
    } else {
      onNotify(
        'Gambar didownload & WhatsApp Web dibuka! Lampirkan file gambar yang terunduh ke chat WA Web.'
      );
    }
  };

  const handleShareAll = async () => {
    const list: Array<{ url: string; name: string }> = [];
    images.photoPages.forEach((url, idx) => {
      const suffix =
        images.photoPages.length > 1 ? `_Foto_Bag${idx + 1}` : '_Foto';
      list.push({ url, name: `${fileSlug}${suffix}.${ext}` });
    });
    if (images.statusImage) {
      list.push({ url: images.statusImage, name: `${fileSlug}_List.${ext}` });
    }
    if (images.combinedImage) {
      list.push({
        url: images.combinedImage,
        name: `${fileSlug}_Lengkap.${ext}`,
      });
    }
    await shareToWhatsAppWeb(list);
  };

  const handleCopyWa = async () => {
    try {
      await navigator.clipboard.writeText(waText);
      setCopiedWa(true);
      onNotify('Teks laporan WhatsApp tersalin ke clipboard');
      setTimeout(() => setCopiedWa(false), 2000);
    } catch {
      onNotify('Gagal menyalin otomatis, silakan salin manual dari kotak teks');
    }
  };

  const handleOpenWa = () => {
    const encoded = encodeURIComponent(waText);
    window.open(
      `https://web.whatsapp.com/send?text=${encoded}`,
      '_blank',
      'noopener'
    );
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setLoadingOverlay({
      visible: true,
      title: 'Menyusun Dokumen PDF...',
      subtitle: `Memproses tabel status & ${totalPhotos} foto bukti`,
    });
    try {
      const [blob] = await Promise.all([
        generatePdfReport(report),
        minDelay(500),
      ]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileSlug}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      onNotify('Dokumen PDF laporan lengkap berhasil didownload');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal membuat PDF');
    } finally {
      setIsGeneratingPdf(false);
      setLoadingOverlay({ visible: false, title: '' });
    }
  };

  const totalGeneratedCount =
    images.photoPages.length +
    (images.statusImage ? 1 : 0) +
    (images.combinedImage ? 1 : 0);

  return (
    <div className="space-y-4 pb-24">
      <LoadingOverlay
        visible={loadingOverlay.visible}
        title={loadingOverlay.title}
        subtitle={loadingOverlay.subtitle}
      />

      {/* Sub-tab Switcher */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs">
        <button
          type="button"
          onClick={() => setSubTab('image')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
            subTab === 'image'
              ? 'bg-[#3685c0] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          <span>Gambar</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('whatsapp')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
            subTab === 'whatsapp'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquareText className="h-4 w-4" />
          <span>Teks WA</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('pdf')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
            subTab === 'pdf'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Dokumen PDF</span>
        </button>
      </div>

      {/* 1. IMAGE COLLAGE OUTPUT */}
      {subTab === 'image' && (
        <div className="space-y-3">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Generate Rekapan Foto & Status
                </h2>
                <p className="text-xs text-slate-500">
                  Pisahkan laporan foto & list status agar gambar tetap besar
                  dan jelas terbaca saat dikirim ke WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void runGenerateImages(true)}
                disabled={loadingOverlay.visible}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#3685c0] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#2b6ca3] active:scale-95 disabled:opacity-50"
              >
                {loadingOverlay.visible ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span>Generate</span>
              </button>
            </div>

            {/* Mode Pemilihan: Terpisah vs Hanya Foto vs Hanya List vs Gabung */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                <Layers className="h-3.5 w-3.5 text-[#3685c0]" />
                Mode Output Gambar:
              </span>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {(
                  [
                    {
                      id: 'separate',
                      label: 'Pisah Foto & List',
                      sub: '2 gambar jelas',
                    },
                    {
                      id: 'photos_only',
                      label: 'Hanya Foto',
                      sub: `${totalPhotos} foto bukti`,
                    },
                    {
                      id: 'status_only',
                      label: 'Hanya List Status',
                      sub: 'Tabel checklist',
                    },
                    {
                      id: 'combined',
                      label: 'Gabung 1 Gambar',
                      sub: 'Foto + list',
                    },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setLayoutMode(m.id)}
                    className={`rounded-xl border px-2.5 py-2 text-left transition ${
                      layoutMode === m.id
                        ? 'border-[#3685c0] bg-sky-50 text-[#1b4b72] ring-1 ring-[#3685c0]'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-xs font-bold">{m.label}</span>
                    <span className="block text-[10px] text-slate-500">
                      {m.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Smart Quick Preset for Large Photo Counts (e.g. 70 photos) */}
            {totalPhotos >= 25 && layoutMode !== 'status_only' && (
              <div className="space-y-1.5 rounded-xl border border-sky-200 bg-sky-50/70 p-2.5">
                <p className="text-[11px] font-bold text-[#1b4b72]">
                  Preset Rekomendasi ({totalPhotos} Foto):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setColumns(5);
                      setMaxPhotosPerPage(0);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      columns === 5 && maxPhotosPerPage === 0
                        ? 'bg-[#3685c0] text-white'
                        : 'bg-white text-[#1b4b72] ring-1 ring-sky-200'
                    }`}
                  >
                    1 Poster Semua ({totalPhotos} Foto • 5 Kolom)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setColumns(4);
                      setMaxPhotosPerPage(35);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      columns === 4 && maxPhotosPerPage === 35
                        ? 'bg-[#3685c0] text-white'
                        : 'bg-white text-[#1b4b72] ring-1 ring-sky-200'
                    }`}
                  >
                    2 Gambar (35/Hal • 4 Kolom)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setColumns(3);
                      setMaxPhotosPerPage(12);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      columns === 3 && maxPhotosPerPage === 12
                        ? 'bg-[#3685c0] text-white'
                        : 'bg-white text-[#1b4b72] ring-1 ring-sky-200'
                    }`}
                  >
                    Detail WA (12/Hal • 3 Kolom)
                  </button>
                </div>
              </div>
            )}

            {/* Layout options for photos */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5">
              {layoutMode !== 'status_only' && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Kolom:
                  </span>
                  {([1, 2, 3, 4, 5] as const).map((cols) => (
                    <button
                      key={cols}
                      type="button"
                      onClick={() => setColumns(cols)}
                      className={`rounded-lg px-2 py-1 text-xs font-bold ${
                        columns === cols
                          ? 'bg-[#3685c0] text-white'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200'
                      }`}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              )}

              {(layoutMode === 'separate' || layoutMode === 'photos_only') && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Per Hal:
                  </span>
                  {[
                    { val: 6, label: '6' },
                    { val: 12, label: '12' },
                    { val: 24, label: '24' },
                    { val: 35, label: '35' },
                    { val: 0, label: 'Semua' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setMaxPhotosPerPage(opt.val)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                        maxPhotosPerPage === opt.val
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1">
                {(
                  [
                    { mime: 'image/png', label: 'PNG' },
                    { mime: 'image/jpeg', label: 'JPG' },
                  ] as const
                ).map((fmt) => (
                  <button
                    key={fmt.mime}
                    type="button"
                    onClick={() => setFormat(fmt.mime)}
                    className={`rounded-lg px-2 py-1 text-xs font-bold ${
                      format === fmt.mime
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {totalGeneratedCount > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleDownloadAll()}
                  disabled={loadingOverlay.visible}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#3685c0] px-3 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#2b6ca3] active:scale-95 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  <span>
                    Download {totalGeneratedCount > 1 ? `Semua (${totalGeneratedCount})` : 'Gambar'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleShareAll()}
                  disabled={loadingOverlay.visible}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-xs font-bold text-[#256394] transition hover:bg-sky-100 active:scale-95 disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share ke WA Web</span>
                </button>
              </div>
            )}
          </section>

          {/* Preview: Photo Report Pages */}
          {images.photoPages.map((url, idx) => {
            const label =
              images.photoPages.length > 1
                ? `Gambar Dokumentasi Foto — Halaman ${idx + 1}/${images.photoPages.length}`
                : 'Gambar Dokumentasi Foto Bukti';
            const filename =
              images.photoPages.length > 1
                ? `${fileSlug}_Foto_Bag${idx + 1}.${ext}`
                : `${fileSlug}_Foto.${ext}`;

            return (
              <div
                key={`photo-page-${idx}`}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                  <span className="text-xs font-bold text-slate-800">
                    {label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => triggerDownloadDataUrl(url, filename)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#3685c0] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#2b6ca3]"
                    >
                      <Download className="h-3 w-3" />
                      <span>Unduh</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void shareToWhatsAppWeb([{ url, name: filename }])
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-[#256394] hover:bg-sky-100"
                    >
                      <Share2 className="h-3 w-3" />
                      <span>WA Web</span>
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <img
                    src={url}
                    alt={label}
                    className="w-full rounded-xl border border-slate-100"
                  />
                </div>
              </div>
            );
          })}

          {/* Preview: Status List Report */}
          {images.statusImage && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                <span className="text-xs font-bold text-slate-800">
                  Gambar Ringkasan List Status Checklist
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      triggerDownloadDataUrl(
                        images.statusImage,
                        `${fileSlug}_List.${ext}`
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
                  >
                    <Download className="h-3 w-3" />
                    <span>Unduh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void shareToWhatsAppWeb([
                        {
                          url: images.statusImage,
                          name: `${fileSlug}_List.${ext}`,
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-[#256394] hover:bg-sky-100"
                  >
                    <Share2 className="h-3 w-3" />
                    <span>WA Web</span>
                  </button>
                </div>
              </div>
              <div className="p-2">
                <img
                  src={images.statusImage}
                  alt="Gambar List Status Checklist"
                  className="w-full rounded-xl border border-slate-100"
                />
              </div>
            </div>
          )}

          {/* Preview: Combined Report */}
          {images.combinedImage && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
              <img
                src={images.combinedImage}
                alt="Preview Rekap Gabungan"
                className="w-full rounded-xl border border-slate-100"
              />
            </div>
          )}
        </div>
      )}

      {/* 2. WHATSAPP TEXT OUTPUT */}
      {subTab === 'whatsapp' && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Format Laporan Teks WhatsApp
            </h2>
            <p className="text-xs text-slate-500">
              Sudah tersusun otomatis mengikuti format resume harian Anda
              (termasuk item yang ditambah/diubah).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyWa}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95"
            >
              {copiedWa ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Teks WA</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenWa}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-95"
            >
              <Share2 className="h-4 w-4" />
              <span>Kirim via WA Web</span>
            </button>
          </div>

          <textarea
            readOnly
            value={waText}
            rows={22}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11.5px] leading-relaxed text-slate-800 outline-none focus:border-emerald-500"
          />
        </section>
      )}

      {/* 3. PDF DOCUMENT OUTPUT */}
      {subTab === 'pdf' && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Generate Dokumen PDF Lengkap
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Menghasilkan dokumen A4 siap arsip berisi:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              <li>• Header resmi, tanggal, petugas & ringkasan metrik KPI</li>
              <li>• Sorotan khusus jika ada item berstatus Not OK / Tidak Aktif</li>
              <li>• Tabel rincian status seluruh checklist beserta catatan</li>
              <li>
                • Halaman lampiran dokumentasi foto ({totalPhotos} foto bukti
                terlampir)
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={isGeneratingPdf}
            onClick={() => void handleDownloadPdf()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 active:scale-95 disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sedang Menyusun PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Generate & Download PDF ({fileSlug}.pdf)</span>
              </>
            )}
          </button>
        </section>
      )}
    </div>
  );
}
