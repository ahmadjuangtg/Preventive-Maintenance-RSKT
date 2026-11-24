import {
  Camera,
  ClipboardList,
  FileOutput,
  History as HistoryIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChecklistTab } from './components/ChecklistTab';
import { GalleryTab } from './components/GalleryTab';
import { Header } from './components/Header';
import { HistoryTab } from './components/HistoryTab';
import { LoadingOverlay } from './components/LoadingOverlay';
import { PhotoLightbox } from './components/PhotoLightbox';
import { ReportTab } from './components/ReportTab';
import { TimestampPromptModal } from './components/TimestampPromptModal';
import {
  createDefaultReport,
  getReportStats,
  getToggleTargetStatus,
  normalizeShift,
  resequenceSections,
} from './data/checklistTemplate';
import { createSampleReport } from './data/sampleReport';
import type {
  ChecklistItem,
  ChecklistReport,
  ChecklistSection,
  FlattenedPhotoEntry,
  PhotoAttachment,
  PhotoTimestampMode,
  StatusMode,
} from './types/checklist';
import { formatSlashDate, getTodayIsoDate } from './utils/dateUtils';
import { extractLatestTimestampFromSource } from './utils/ocrTimestampExtractor';
import {
  pickLatestTimestamp,
  type ParsedTimestamp,
} from './utils/timestampParser';
import {
  clearCustomTemplate,
  deleteReportFromHistory,
  loadReportHistory,
  loadSharedState,
  resetSectionsFromTemplate,
  saveActiveDraft,
  saveCustomTemplate,
  saveReportToHistory,
} from './utils/storage';

type ActiveTab = 'checklist' | 'gallery' | 'report' | 'history';

const TIMESTAMP_MODE_STORAGE_KEY = 'pm-rskt-photo-timestamp-mode';

function normalizeReportShift(item: ChecklistReport): ChecklistReport {
  return {
    ...item,
    shift: normalizeShift(item.shift),
  };
}

export function App() {
  const [report, setReport] = useState<ChecklistReport>(() =>
    createDefaultReport()
  );
  const [history, setHistory] = useState<ChecklistReport[]>([]);
  const [customTemplate, setCustomTemplate] = useState<
    ChecklistSection[] | null
  >(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('checklist');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [reportKey, setReportKey] = useState(0);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [photoTimestampMode, setPhotoTimestampMode] =
    useState<PhotoTimestampMode>(() => {
      try {
        const saved = window.localStorage.getItem(TIMESTAMP_MODE_STORAGE_KEY);
        if (saved === 'ask' || saved === 'on' || saved === 'off') return saved;
      } catch {
        // Ignore localStorage restrictions
      }
      return 'ask';
    });
  const [timestampPrompt, setTimestampPrompt] = useState<{
    fileCount: number;
    previewUrl: string;
    resolve: (result: boolean | null) => void;
  } | null>(null);
  const [lightboxState, setLightboxState] = useState<{
    photo: PhotoAttachment;
    title: string;
  } | null>(null);

  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  const handleChangePhotoTimestampMode = useCallback(
    (mode: PhotoTimestampMode) => {
      setPhotoTimestampMode(mode);
      try {
        window.localStorage.setItem(TIMESTAMP_MODE_STORAGE_KEY, mode);
      } catch {
        // Ignore localStorage restrictions
      }
      const modeLabel =
        mode === 'ask'
          ? 'Tanya tiap tambah foto'
          : mode === 'on'
          ? 'Selalu tambah timestamp di foto'
          : 'Foto tanpa timestamp';
      notify(`Pengaturan timestamp foto: ${modeLabel}`);
    },
    [notify]
  );

  const requestPhotoTimestamp = useCallback(
    (files: FileList): Promise<boolean | null> => {
      if (photoTimestampMode === 'on') return Promise.resolve(true);
      if (photoTimestampMode === 'off') return Promise.resolve(false);
      const firstFile = files[0];
      if (!firstFile) return Promise.resolve(null);
      const previewUrl = URL.createObjectURL(firstFile);
      return new Promise<boolean | null>((resolve) => {
        setTimestampPrompt({
          fileCount: files.length,
          previewUrl,
          resolve,
        });
      });
    },
    [photoTimestampMode]
  );

  const handleConfirmTimestampPrompt = useCallback(
    (stampTimestamp: boolean, remember: boolean) => {
      if (!timestampPrompt) return;
      URL.revokeObjectURL(timestampPrompt.previewUrl);
      if (remember) {
        handleChangePhotoTimestampMode(stampTimestamp ? 'on' : 'off');
      }
      timestampPrompt.resolve(stampTimestamp);
      setTimestampPrompt(null);
    },
    [handleChangePhotoTimestampMode, timestampPrompt]
  );

  const handleCancelTimestampPrompt = useCallback(() => {
    if (!timestampPrompt) return;
    URL.revokeObjectURL(timestampPrompt.previewUrl);
    timestampPrompt.resolve(null);
    setTimestampPrompt(null);
  }, [timestampPrompt]);

  useEffect(() => {
    let active = true;
    loadSharedState().then((shared) => {
      if (!active) return;
      if (shared.customTemplate) {
        setCustomTemplate(resequenceSections(shared.customTemplate));
      }
      if (shared.draft && Array.isArray(shared.draft.sections)) {
        setReport({
          ...shared.draft,
          shift: normalizeShift(shared.draft.shift),
          sections: resequenceSections(shared.draft.sections),
        });
      } else if (shared.customTemplate) {
        const base = createDefaultReport();
        setReport({
          ...base,
          sections: resequenceSections(
            resetSectionsFromTemplate(shared.customTemplate, base.date)
          ),
        });
      }
      setHistory(shared.history.map(normalizeReportShift));
      setIsHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void saveActiveDraft(report);
  }, [report, isHydrated]);

  const stats = useMemo(() => getReportStats(report), [report]);

  const mutateSection = useCallback(
    (
      sectionId: string,
      updater: (section: ChecklistSection) => ChecklistSection
    ) => {
      setReport((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        sections: prev.sections.map((sec) =>
          sec.id === sectionId ? updater(sec) : sec
        ),
      }));
    },
    []
  );

  const mutateItem = useCallback(
    (
      sectionId: string,
      itemId: string,
      updater: (item: ChecklistItem) => ChecklistItem,
      subGroupId?: string
    ) => {
      mutateSection(sectionId, (sec) => {
        if (!subGroupId) {
          return {
            ...sec,
            items: sec.items.map((item) =>
              item.id === itemId ? updater(item) : item
            ),
          };
        }
        return {
          ...sec,
          subGroups: sec.subGroups.map((sg) =>
            sg.id === subGroupId
              ? {
                  ...sg,
                  items: sg.items.map((item) =>
                    item.id === itemId ? updater(item) : item
                  ),
                }
              : sg
          ),
        };
      });
    },
    [mutateSection]
  );

  const handleUpdateMeta = useCallback(
    (
      patch: Partial<
        Pick<ChecklistReport, 'shift' | 'site' | 'date' | 'inspector'>
      >
    ) => {
      setReport((prev) => {
        let nextSections = prev.sections;
        if (patch.date && patch.date !== prev.date) {
          const newSlash = formatSlashDate(patch.date);
          nextSections = prev.sections.map((sec) => {
            if (sec.id !== 'C') return sec;
            return {
              ...sec,
              items: sec.items.map((item) => {
                if (item.id !== 'C-3') return item;
                if (
                  !item.note.trim() ||
                  item.note.trim().startsWith('Last Update :')
                ) {
                  return {
                    ...item,
                    note: `Last Update : ${newSlash}`,
                    notePlaceholder: `Last Update : ${newSlash}`,
                  };
                }
                return item;
              }),
            };
          });
        }

        return {
          ...prev,
          ...patch,
          updatedAt: new Date().toISOString(),
          sections: nextSections,
        };
      });
    },
    []
  );

  const handleToggleItemStatus = useCallback(
    (sectionId: string, itemId: string, subGroupId?: string) => {
      mutateItem(
        sectionId,
        itemId,
        (item) => ({
          ...item,
          status: getToggleTargetStatus(item),
        }),
        subGroupId
      );
    },
    [mutateItem]
  );

  const handleUpdateItemNote = useCallback(
    (sectionId: string, itemId: string, note: string, subGroupId?: string) => {
      mutateItem(
        sectionId,
        itemId,
        (item) => ({ ...item, note }),
        subGroupId
      );
    },
    [mutateItem]
  );

  const runTimestampScan = useCallback(
    async (
      sectionId: string,
      itemId: string,
      sources: Array<File | string>,
      subGroupId?: string,
      silentIfEmpty = false
    ) => {
      if (sources.length === 0) return;
      setIsScanningOcr(true);
      try {
        const allCandidates: ParsedTimestamp[] = [];
        for (const src of sources) {
          const res = await extractLatestTimestampFromSource(src);
          allCandidates.push(...res.candidates);
        }
        const latest = pickLatestTimestamp(allCandidates);
        if (latest) {
          mutateItem(
            sectionId,
            itemId,
            (item) => ({ ...item, note: latest.noteValue }),
            subGroupId
          );
          notify(`Jam Update Terakhir ditemukan: ${latest.formatted}`);
        } else if (!silentIfEmpty) {
          notify(
            'Tidak ditemukan tanggal/jam pada gambar — silakan isi catatan manual.'
          );
        }
      } finally {
        setIsScanningOcr(false);
      }
    },
    [mutateItem, notify]
  );

  const handleAddItemPhotos = useCallback(
    (
      sectionId: string,
      itemId: string,
      photos: PhotoAttachment[],
      subGroupId?: string,
      rawFiles?: File[]
    ) => {
      mutateItem(
        sectionId,
        itemId,
        (item) => ({ ...item, photos: [...item.photos, ...photos] }),
        subGroupId
      );
      notify(`${photos.length} foto ditambahkan ke item`);

      // Find item label to check if it's Aplicares or SIRANAP (auto timestamp scan)
      const sec = report.sections.find((s) => s.id === sectionId);
      const targetItem = subGroupId
        ? sec?.subGroups
            .find((g) => g.id === subGroupId)
            ?.items.find((i) => i.id === itemId)
        : sec?.items.find((i) => i.id === itemId);

      const shouldAutoScan =
        itemId === 'C-2' ||
        itemId === 'C-3' ||
        (targetItem ? /aplicares|siranap/i.test(targetItem.label) : false);

      if (shouldAutoScan) {
        const sources: Array<File | string> =
          rawFiles && rawFiles.length > 0
            ? rawFiles
            : photos.map((p) => p.dataUrl);
        void runTimestampScan(sectionId, itemId, sources, subGroupId, false);
      }
    },
    [mutateItem, notify, report.sections, runTimestampScan]
  );

  const handleScanTimestampFromItemPhotos = useCallback(
    (sectionId: string, itemId: string, subGroupId?: string) => {
      const sec = report.sections.find((s) => s.id === sectionId);
      const targetItem = subGroupId
        ? sec?.subGroups
            .find((g) => g.id === subGroupId)
            ?.items.find((i) => i.id === itemId)
        : sec?.items.find((i) => i.id === itemId);

      if (!targetItem || targetItem.photos.length === 0) {
        notify('Belum ada foto terlampir pada item ini');
        return;
      }
      void runTimestampScan(
        sectionId,
        itemId,
        targetItem.photos.map((p) => p.dataUrl),
        subGroupId,
        false
      );
    },
    [notify, report.sections, runTimestampScan]
  );

  const handleRemoveItemPhoto = useCallback(
    (
      sectionId: string,
      itemId: string,
      photoId: string,
      subGroupId?: string
    ) => {
      mutateItem(
        sectionId,
        itemId,
        (item) => ({
          ...item,
          photos: item.photos.filter((p) => p.id !== photoId),
        }),
        subGroupId
      );
    },
    [mutateItem]
  );

  const handleUpdateItemPhotoCaption = useCallback(
    (
      sectionId: string,
      itemId: string,
      photoId: string,
      caption: string,
      subGroupId?: string
    ) => {
      mutateItem(
        sectionId,
        itemId,
        (item) => ({
          ...item,
          photos: item.photos.map((p) =>
            p.id === photoId ? { ...p, caption } : p
          ),
        }),
        subGroupId
      );
    },
    [mutateItem]
  );

  const handleAddSectionPhotos = useCallback(
    (sectionId: string, photos: PhotoAttachment[]) => {
      mutateSection(sectionId, (sec) => ({
        ...sec,
        photos: [...sec.photos, ...photos],
      }));
      notify(`${photos.length} foto ditambahkan ke bagian ${sectionId}`);
    },
    [mutateSection, notify]
  );

  const handleRemoveSectionPhoto = useCallback(
    (sectionId: string, photoId: string) => {
      mutateSection(sectionId, (sec) => ({
        ...sec,
        photos: sec.photos.filter((p) => p.id !== photoId),
      }));
    },
    [mutateSection]
  );

  const handleUpdateSectionPhotoCaption = useCallback(
    (sectionId: string, photoId: string, caption: string) => {
      mutateSection(sectionId, (sec) => ({
        ...sec,
        photos: sec.photos.map((p) =>
          p.id === photoId ? { ...p, caption } : p
        ),
      }));
    },
    [mutateSection]
  );

  const handleUpdateSectionNote = useCallback(
    (sectionId: string, note: string) => {
      mutateSection(sectionId, (sec) => ({ ...sec, note }));
    },
    [mutateSection]
  );

  const handleAddSubGroupPhotos = useCallback(
    (sectionId: string, subGroupId: string, photos: PhotoAttachment[]) => {
      mutateSection(sectionId, (sec) => ({
        ...sec,
        subGroups: sec.subGroups.map((sg) =>
          sg.id === subGroupId
            ? { ...sg, photos: [...sg.photos, ...photos] }
            : sg
        ),
      }));
      notify(`${photos.length} foto ditambahkan ke sub-bagian`);
    },
    [mutateSection, notify]
  );

  const handleRemoveSubGroupPhoto = useCallback(
    (sectionId: string, subGroupId: string, photoId: string) => {
      mutateSection(sectionId, (sec) => ({
        ...sec,
        subGroups: sec.subGroups.map((sg) =>
          sg.id === subGroupId
            ? { ...sg, photos: sg.photos.filter((p) => p.id !== photoId) }
            : sg
        ),
      }));
    },
    [mutateSection]
  );

  const handleUpdateSubGroupPhotoCaption = useCallback(
    (
      sectionId: string,
      subGroupId: string,
      photoId: string,
      caption: string
    ) => {
      mutateSection(sectionId, (sec) => ({
        ...sec,
        subGroups: sec.subGroups.map((sg) =>
          sg.id === subGroupId
            ? {
                ...sg,
                photos: sg.photos.map((p) =>
                  p.id === photoId ? { ...p, caption } : p
                ),
              }
            : sg
        ),
      }));
    },
    [mutateSection]
  );

  const handleUpdateSubGroupNote = useCallback(
    (sectionId: string, subGroupId: string, note: string) => {
      mutateSection(sectionId, (sec) => ({
        ...sec,
        subGroups: sec.subGroups.map((sg) =>
          sg.id === subGroupId ? { ...sg, note } : sg
        ),
      }));
    },
    [mutateSection]
  );

  const handleSetSectionAllOk = useCallback(
    (sectionId: string) => {
      const toPositive = (item: ChecklistItem): ChecklistItem => ({
        ...item,
        status: item.statusMode === 'aktif_tidak_aktif' ? 'Aktif' : 'OK',
      });
      mutateSection(sectionId, (sec) => ({
        ...sec,
        items: sec.items.map(toPositive),
        subGroups: sec.subGroups.map((sg) => ({
          ...sg,
          items: sg.items.map(toPositive),
        })),
      }));
      notify(`Seluruh item Bagian ${sectionId} diset OK / Aktif`);
    },
    [mutateSection, notify]
  );

  const handleAssignPhotoToTarget = useCallback(
    (targetValue: string, photo: PhotoAttachment, rawFile?: File) => {
      const parts = targetValue.split(':');
      const kind = parts[0];
      if (kind === 'section' && parts[1]) {
        handleAddSectionPhotos(parts[1], [photo]);
      } else if (kind === 'subgroup' && parts[1] && parts[2]) {
        handleAddSubGroupPhotos(parts[1], parts[2], [photo]);
      } else if (kind === 'item' && parts[1] && parts[2]) {
        handleAddItemPhotos(
          parts[1],
          parts[2],
          [photo],
          parts[3],
          rawFile ? [rawFile] : undefined
        );
      }
    },
    [handleAddItemPhotos, handleAddSectionPhotos, handleAddSubGroupPhotos]
  );

  const handleRemovePhotoEntry = useCallback(
    (entry: FlattenedPhotoEntry) => {
      if (entry.targetType === 'section') {
        handleRemoveSectionPhoto(entry.sectionId, entry.photo.id);
      } else if (entry.targetType === 'subgroup') {
        handleRemoveSubGroupPhoto(
          entry.sectionId,
          entry.targetId,
          entry.photo.id
        );
      } else {
        // Find parent subGroupId if item lives inside a subGroup
        const sec = report.sections.find((s) => s.id === entry.sectionId);
        const parentSg = sec?.subGroups.find((sg) =>
          sg.items.some((i) => i.id === entry.targetId)
        );
        handleRemoveItemPhoto(
          entry.sectionId,
          entry.targetId,
          entry.photo.id,
          parentSg?.id
        );
      }
      notify('Foto dihapus');
    },
    [
      handleRemoveItemPhoto,
      handleRemoveSectionPhoto,
      handleRemoveSubGroupPhoto,
      notify,
      report.sections,
    ]
  );

  const persistStructureUpdate = useCallback(
    (updater: (sections: ChecklistSection[]) => ChecklistSection[]) => {
      setReport((prev) => {
        const nextSections = resequenceSections(updater(prev.sections));
        setCustomTemplate(nextSections);
        void saveCustomTemplate(nextSections);
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          sections: nextSections,
        };
      });
    },
    []
  );

  const handleAddItem = useCallback(
    (
      sectionId: string,
      code: string,
      label: string,
      statusMode: StatusMode,
      subGroupId?: string
    ) => {
      const newItem: ChecklistItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        code,
        label,
        statusMode,
        status: statusMode === 'aktif_tidak_aktif' ? 'Aktif' : 'OK',
        note: '',
        photos: [],
      };
      persistStructureUpdate((sections) =>
        sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          if (!subGroupId) {
            return { ...sec, items: [...sec.items, newItem] };
          }
          return {
            ...sec,
            subGroups: sec.subGroups.map((sg) =>
              sg.id === subGroupId
                ? { ...sg, items: [...sg.items, newItem] }
                : sg
            ),
          };
        })
      );
      notify(`Item "${label}" ditambahkan`);
    },
    [notify, persistStructureUpdate]
  );

  const handleEditItemLabel = useCallback(
    (
      sectionId: string,
      itemId: string,
      code: string,
      label: string,
      subGroupId?: string
    ) => {
      persistStructureUpdate((sections) =>
        sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          if (!subGroupId) {
            return {
              ...sec,
              items: sec.items.map((item) =>
                item.id === itemId ? { ...item, code, label } : item
              ),
            };
          }
          return {
            ...sec,
            subGroups: sec.subGroups.map((sg) =>
              sg.id === subGroupId
                ? {
                    ...sg,
                    items: sg.items.map((item) =>
                      item.id === itemId ? { ...item, code, label } : item
                    ),
                  }
                : sg
            ),
          };
        })
      );
      notify('Nama item diperbarui');
    },
    [notify, persistStructureUpdate]
  );

  const handleDeleteItem = useCallback(
    (sectionId: string, itemId: string, subGroupId?: string) => {
      persistStructureUpdate((sections) =>
        sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          if (!subGroupId) {
            return {
              ...sec,
              items: sec.items.filter((item) => item.id !== itemId),
            };
          }
          return {
            ...sec,
            subGroups: sec.subGroups.map((sg) =>
              sg.id === subGroupId
                ? {
                    ...sg,
                    items: sg.items.filter((item) => item.id !== itemId),
                  }
                : sg
            ),
          };
        })
      );
      notify('Item checklist dihapus');
    },
    [notify, persistStructureUpdate]
  );

  const handleMoveItem = useCallback(
    (
      sectionId: string,
      itemId: string,
      direction: 'up' | 'down',
      subGroupId?: string
    ) => {
      const swapInList = (list: ChecklistItem[]): ChecklistItem[] => {
        const idx = list.findIndex((i) => i.id === itemId);
        if (idx === -1) return list;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= list.length) return list;
        const copy = [...list];
        const [moved] = copy.splice(idx, 1);
        copy.splice(targetIdx, 0, moved);
        return copy;
      };

      persistStructureUpdate((sections) =>
        sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          if (!subGroupId) {
            return { ...sec, items: swapInList(sec.items) };
          }
          return {
            ...sec,
            subGroups: sec.subGroups.map((sg) =>
              sg.id === subGroupId ? { ...sg, items: swapInList(sg.items) } : sg
            ),
          };
        })
      );
    },
    [persistStructureUpdate]
  );

  const handleAddSubGroup = useCallback(
    (sectionId: string, code: string, title: string) => {
      const sgId = `sg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      persistStructureUpdate((sections) =>
        sections.map((sec) =>
          sec.id === sectionId
            ? {
                ...sec,
                subGroups: [
                  ...sec.subGroups,
                  {
                    id: sgId,
                    code,
                    title,
                    note: '',
                    photos: [],
                    items: [
                      {
                        id: `${sgId}-1`,
                        code: '1.',
                        label: 'Cek Perangkat',
                        statusMode: 'ok_not_ok',
                        status: 'OK',
                        note: '',
                        photos: [],
                      },
                    ],
                  },
                ],
              }
            : sec
        )
      );
      notify(`Sub-bagian "${title}" ditambahkan`);
    },
    [notify, persistStructureUpdate]
  );

  const handleDeleteSubGroup = useCallback(
    (sectionId: string, subGroupId: string) => {
      persistStructureUpdate((sections) =>
        sections.map((sec) =>
          sec.id === sectionId
            ? {
                ...sec,
                subGroups: sec.subGroups.filter((sg) => sg.id !== subGroupId),
              }
            : sec
        )
      );
      notify('Sub-bagian dihapus');
    },
    [notify, persistStructureUpdate]
  );

  const handleAddSection = useCallback(
    (codeLetter: string, title: string, isStandalone: boolean) => {
      const cleanId = codeLetter.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || `S${Date.now()}`;
      const existingConflict = report.sections.some((s) => s.id === cleanId);
      const secId = existingConflict ? `${cleanId}-${Date.now().toString().slice(-3)}` : cleanId;
      const secCode = `${cleanId}.`;

      const newSection: ChecklistSection = {
        id: secId,
        code: secCode,
        title,
        isStandalone,
        note: '',
        photos: [],
        items: [
          {
            id: `${secId}-1`,
            code: isStandalone ? '' : '1.',
            label: isStandalone ? title : 'Cek Status',
            statusMode: 'ok_not_ok',
            status: 'OK',
            note: '',
            photos: [],
          },
        ],
        subGroups: [],
      };

      persistStructureUpdate((sections) => [...sections, newSection]);
      notify(`Bagian "${secCode} ${title}" ditambahkan`);
    },
    [notify, persistStructureUpdate, report.sections]
  );

  const handleEditSectionTitle = useCallback(
    (sectionId: string, newTitle: string) => {
      persistStructureUpdate((sections) =>
        sections.map((sec) =>
          sec.id === sectionId
            ? {
                ...sec,
                title: newTitle,
                items: sec.isStandalone
                  ? sec.items.map((item, idx) =>
                      idx === 0 ? { ...item, label: newTitle } : item
                    )
                  : sec.items,
              }
            : sec
        )
      );
      notify('Nama bagian diperbarui');
    },
    [notify, persistStructureUpdate]
  );

  const handleDeleteSection = useCallback(
    (sectionId: string) => {
      persistStructureUpdate((sections) =>
        sections.filter((sec) => sec.id !== sectionId)
      );
      notify(`Bagian ${sectionId} dihapus`);
    },
    [notify, persistStructureUpdate]
  );

  const handleRestoreFactoryTemplate = useCallback(async () => {
    await clearCustomTemplate();
    setCustomTemplate(null);
    setReport((prev) => {
      const fresh = createDefaultReport(prev.date);
      return {
        ...fresh,
        shift: prev.shift,
        site: prev.site,
        inspector: prev.inspector,
      };
    });
    notify('Daftar checklist dikembalikan ke template awal RSUD (70 item)');
  }, [notify]);

  const handleLoadSample = useCallback(() => {
    setIsLoadingSample(true);
    window.setTimeout(() => {
      const sample = createSampleReport('full_70');
      setEditingHistoryId(null);
      setReport(sample);
      setReportKey((k) => k + 1);
      setIsLoadingSample(false);
      setActiveTab('report');
      notify('Simulasi 70 item & 70 foto bukti siap! Lihat hasil di tab Generate.');
    }, 350);
  }, [notify]);

  const handleReset = useCallback(() => {
    if (
      stats.totalPhotos > 0 ||
      stats.notOkCount > 0 ||
      report.inspector.trim()
    ) {
      const confirmed = window.confirm(
        'Reset checklist ke template baru untuk hari ini? Foto & catatan saat ini yang belum disimpan ke riwayat akan dihapus.'
      );
      if (!confirmed) return;
    }
    const today = getTodayIsoDate();
    setEditingHistoryId(null);
    if (customTemplate && customTemplate.length > 0) {
      const fresh = createDefaultReport(today);
      setReport({
        ...fresh,
        sections: resetSectionsFromTemplate(customTemplate, today),
      });
    } else {
      setReport(createDefaultReport(today));
    }
    notify('Checklist direset ke template baru');
  }, [customTemplate, notify, report.inspector, stats.notOkCount, stats.totalPhotos]);

  const handleSaveHistory = useCallback(async () => {
    setIsSaving(true);
    try {
      const reportToSave: ChecklistReport = editingHistoryId
        ? { ...report, id: editingHistoryId }
        : {
            ...report,
            id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          };
      const [result] = await Promise.all([
        saveReportToHistory(reportToSave),
        new Promise<void>((resolve) => window.setTimeout(resolve, 550)),
      ]);
      setHistory(result.history.map(normalizeReportShift));
      notify(
        result.syncedToServer
          ? editingHistoryId
            ? 'Riwayat lama diperbarui & tersimpan ke server bersama!'
            : 'Laporan baru tersimpan ke server bersama (bisa diakses semua orang)!'
          : editingHistoryId
          ? 'Riwayat lama diperbarui di penyimpanan lokal perangkat!'
          : 'Laporan baru tersimpan di penyimpanan lokal perangkat!'
      );
    } finally {
      setIsSaving(false);
    }
  }, [editingHistoryId, notify, report]);

  const handleRefreshHistory = useCallback(async () => {
    setIsRefreshingHistory(true);
    try {
      const list = await loadReportHistory();
      setHistory(list.map(normalizeReportShift));
      notify(`Riwayat disinkronkan (${list.length} laporan)`);
    } finally {
      setIsRefreshingHistory(false);
    }
  }, [notify]);

  const handleOpenHistoryTab = useCallback(() => {
    setActiveTab('history');
    setIsRefreshingHistory(true);
    void loadReportHistory()
      .then((list) => {
        setHistory(list.map(normalizeReportShift));
      })
      .finally(() => {
        setIsRefreshingHistory(false);
      });
  }, []);

  const handleLoadFromHistory = useCallback(
    (saved: ChecklistReport) => {
      const normalized = normalizeReportShift(saved);
      setEditingHistoryId(normalized.id);
      setReport(normalized);
      setActiveTab('checklist');
      notify(`Laporan ${normalized.shift} (${normalized.date}) dimuat`);
    },
    [notify]
  );

  const handleDeleteFromHistory = useCallback(
    async (reportId: string) => {
      const updated = await deleteReportFromHistory(reportId);
      setHistory(updated);
      notify('Riwayat laporan dihapus');
    },
    [notify]
  );

  return (
    <div className="min-h-screen bg-[#3685c0] text-slate-900">
      <LoadingOverlay
        visible={isSaving || isLoadingSample || isScanningOcr}
        title={
          isScanningOcr
            ? 'Membaca Jam Update Terakhir...'
            : isLoadingSample
            ? 'Membuat Contoh 70 Foto...'
            : 'Menyimpan Laporan...'
        }
        subtitle={
          isScanningOcr
            ? 'Mendeteksi waktu paling baru dari foto yang diupload'
            : isLoadingSample
            ? 'Mengisi 70 item checklist (A–N) beserta 70 gambar simulasi'
            : 'Menyimpan status checklist & lampiran foto ke Riwayat'
        }
      />

      <Header
        report={report}
        okCount={stats.okCount}
        notOkCount={stats.notOkCount}
        totalItems={stats.totalItems}
        totalPhotos={stats.totalPhotos}
        isSaving={isSaving}
        isLoadingSample={isLoadingSample}
        onLoadSample={handleLoadSample}
        onSaveHistory={handleSaveHistory}
        onReset={handleReset}
      />

      <main className="mx-auto max-w-2xl px-3 pt-3">
        {activeTab === 'checklist' && (
          <ChecklistTab
            report={report}
            notOkCount={stats.notOkCount}
            hasCustomTemplate={Boolean(customTemplate)}
            onUpdateMeta={handleUpdateMeta}
            onToggleItemStatus={handleToggleItemStatus}
            onUpdateItemNote={handleUpdateItemNote}
            onAddItemPhotos={handleAddItemPhotos}
            onScanTimestampFromItemPhotos={handleScanTimestampFromItemPhotos}
            onRemoveItemPhoto={handleRemoveItemPhoto}
            onUpdateItemPhotoCaption={handleUpdateItemPhotoCaption}
            onAddSectionPhotos={handleAddSectionPhotos}
            onRemoveSectionPhoto={handleRemoveSectionPhoto}
            onUpdateSectionPhotoCaption={handleUpdateSectionPhotoCaption}
            onUpdateSectionNote={handleUpdateSectionNote}
            onAddSubGroupPhotos={handleAddSubGroupPhotos}
            onRemoveSubGroupPhoto={handleRemoveSubGroupPhoto}
            onUpdateSubGroupPhotoCaption={handleUpdateSubGroupPhotoCaption}
            onUpdateSubGroupNote={handleUpdateSubGroupNote}
            onSetSectionAllOk={handleSetSectionAllOk}
            onAddItem={handleAddItem}
            onEditItemLabel={handleEditItemLabel}
            onDeleteItem={handleDeleteItem}
            onMoveItem={handleMoveItem}
            onAddSubGroup={handleAddSubGroup}
            onDeleteSubGroup={handleDeleteSubGroup}
            onAddSection={handleAddSection}
            onEditSectionTitle={handleEditSectionTitle}
            onDeleteSection={handleDeleteSection}
            onRestoreFactoryTemplate={handleRestoreFactoryTemplate}
            onPreviewPhoto={(photo, title) =>
              setLightboxState({ photo, title })
            }
            photoTimestampMode={photoTimestampMode}
            onChangePhotoTimestampMode={handleChangePhotoTimestampMode}
            onConfirmTimestamp={requestPhotoTimestamp}
          />
        )}

        {activeTab === 'gallery' && (
          <GalleryTab
            report={report}
            onAssignPhotoToTarget={handleAssignPhotoToTarget}
            onRemovePhotoEntry={handleRemovePhotoEntry}
            onPreviewPhoto={(photo, title) =>
              setLightboxState({ photo, title })
            }
            photoTimestampMode={photoTimestampMode}
            onChangePhotoTimestampMode={handleChangePhotoTimestampMode}
            onConfirmTimestamp={requestPhotoTimestamp}
          />
        )}

        {activeTab === 'report' && (
          <ReportTab
            key={reportKey}
            report={report}
            totalPhotos={stats.totalPhotos}
            onNotify={notify}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            history={history}
            isRefreshing={isRefreshingHistory}
            onRefreshHistory={() => void handleRefreshHistory()}
            onLoadReport={handleLoadFromHistory}
            onDeleteReport={handleDeleteFromHistory}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed right-0 bottom-20 left-0 z-40 mx-auto flex max-w-md justify-center px-4">
          <div className="rounded-full bg-slate-900/95 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg ring-1 ring-white/15 backdrop-blur-xs">
            {toast}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur-md">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              activeTab === 'checklist'
                ? 'text-[#3685c0]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="h-5 w-5" />
            <span>Checklist</span>
            {stats.notOkCount > 0 && (
              <span className="absolute top-1.5 right-[22%] rounded-full bg-red-600 px-1.5 text-[9px] font-bold text-white">
                {stats.notOkCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              activeTab === 'gallery'
                ? 'text-[#3685c0]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="h-5 w-5" />
            <span>Foto</span>
            {stats.totalPhotos > 0 && (
              <span className="absolute top-1.5 right-[22%] rounded-full bg-[#3685c0] px-1.5 text-[9px] font-bold text-white">
                {stats.totalPhotos}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              activeTab === 'report'
                ? 'text-[#3685c0]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileOutput className="h-5 w-5" />
            <span>Generate</span>
          </button>

          <button
            type="button"
            onClick={handleOpenHistoryTab}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              activeTab === 'history'
                ? 'text-[#3685c0]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <HistoryIcon className="h-5 w-5" />
            <span>Riwayat</span>
            {history.length > 0 && (
              <span className="absolute top-1.5 right-[22%] rounded-full bg-slate-700 px-1.5 text-[9px] font-bold text-white">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Photo Preview Lightbox */}
      <PhotoLightbox
        photo={lightboxState?.photo ?? null}
        title={lightboxState?.title}
        onClose={() => setLightboxState(null)}
      />

      {/* Photo Timestamp Choice Modal */}
      {timestampPrompt && (
        <TimestampPromptModal
          fileCount={timestampPrompt.fileCount}
          previewUrl={timestampPrompt.previewUrl}
          onConfirm={handleConfirmTimestampPrompt}
          onCancel={handleCancelTimestampPrompt}
        />
      )}
    </div>
  );
}

export default App;
