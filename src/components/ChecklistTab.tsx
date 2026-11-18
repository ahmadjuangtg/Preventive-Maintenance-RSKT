import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderPlus,
  Pencil,
  Plus,
  RotateCcw,
  ScanSearch,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  getToggleTargetStatus,
  isPositiveStatus,
} from '../data/checklistTemplate';
import type {
  ChecklistItem,
  ChecklistReport,
  ChecklistSection,
  ChecklistSubGroup,
  PhotoAttachment,
  PhotoTimestampMode,
  ShiftType,
  StatusMode,
} from '../types/checklist';
import { formatIndonesianDate } from '../utils/dateUtils';
import { PhotoStrip, PhotoUploaderButton } from './PhotoStrip';
import { PhotoTimestampSelector } from './TimestampPromptModal';

type FilterMode = 'all' | 'not_ok' | 'has_photo';

interface ChecklistTabProps {
  report: ChecklistReport;
  notOkCount: number;
  hasCustomTemplate: boolean;
  onUpdateMeta: (
    patch: Partial<Pick<ChecklistReport, 'shift' | 'site' | 'date' | 'inspector'>>
  ) => void;
  onToggleItemStatus: (sectionId: string, itemId: string, subGroupId?: string) => void;
  onUpdateItemNote: (
    sectionId: string,
    itemId: string,
    note: string,
    subGroupId?: string
  ) => void;
  onAddItemPhotos: (
    sectionId: string,
    itemId: string,
    photos: PhotoAttachment[],
    subGroupId?: string,
    rawFiles?: File[]
  ) => void;
  onScanTimestampFromItemPhotos: (
    sectionId: string,
    itemId: string,
    subGroupId?: string
  ) => void;
  onRemoveItemPhoto: (
    sectionId: string,
    itemId: string,
    photoId: string,
    subGroupId?: string
  ) => void;
  onUpdateItemPhotoCaption: (
    sectionId: string,
    itemId: string,
    photoId: string,
    caption: string,
    subGroupId?: string
  ) => void;
  onAddSectionPhotos: (sectionId: string, photos: PhotoAttachment[]) => void;
  onRemoveSectionPhoto: (sectionId: string, photoId: string) => void;
  onUpdateSectionPhotoCaption: (
    sectionId: string,
    photoId: string,
    caption: string
  ) => void;
  onUpdateSectionNote: (sectionId: string, note: string) => void;
  onAddSubGroupPhotos: (
    sectionId: string,
    subGroupId: string,
    photos: PhotoAttachment[]
  ) => void;
  onRemoveSubGroupPhoto: (
    sectionId: string,
    subGroupId: string,
    photoId: string
  ) => void;
  onUpdateSubGroupPhotoCaption: (
    sectionId: string,
    subGroupId: string,
    photoId: string,
    caption: string
  ) => void;
  onUpdateSubGroupNote: (
    sectionId: string,
    subGroupId: string,
    note: string
  ) => void;
  onSetSectionAllOk: (sectionId: string) => void;
  onAddItem: (
    sectionId: string,
    code: string,
    label: string,
    statusMode: StatusMode,
    subGroupId?: string
  ) => void;
  onEditItemLabel: (
    sectionId: string,
    itemId: string,
    code: string,
    label: string,
    subGroupId?: string
  ) => void;
  onDeleteItem: (sectionId: string, itemId: string, subGroupId?: string) => void;
  onMoveItem: (
    sectionId: string,
    itemId: string,
    direction: 'up' | 'down',
    subGroupId?: string
  ) => void;
  onAddSubGroup: (sectionId: string, code: string, title: string) => void;
  onDeleteSubGroup: (sectionId: string, subGroupId: string) => void;
  onAddSection: (codeLetter: string, title: string, isStandalone: boolean) => void;
  onEditSectionTitle: (sectionId: string, newTitle: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onRestoreFactoryTemplate: () => void;
  onPreviewPhoto: (photo: PhotoAttachment, title: string) => void;
  photoTimestampMode: PhotoTimestampMode;
  onChangePhotoTimestampMode: (mode: PhotoTimestampMode) => void;
  onConfirmTimestamp: (files: FileList) => Promise<boolean | null>;
}

const SHIFTS: ShiftType[] = ['PAGI', 'SORE', 'MALAM'];

function suggestNextItemCode(items: ChecklistItem[]): string {
  const numericCodes = items
    .map((i) => parseInt(i.code.replace(/\D/g, ''), 10))
    .filter((n) => !Number.isNaN(n));
  if (numericCodes.length === 0) return `${items.length + 1}.`;
  const maxNum = Math.max(...numericCodes);
  const padZero = items.some((i) => /^0\d\./.test(i.code));
  const next = maxNum + 1;
  return padZero ? `${String(next).padStart(2, '0')}.` : `${next}.`;
}

function suggestNextSubGroupCode(subGroups: ChecklistSubGroup[]): string {
  const idx = subGroups.length;
  const letter = String.fromCharCode(97 + (idx % 26));
  return `${letter}).`;
}

function suggestNextSectionLetter(sections: ChecklistSection[]): string {
  const idx = sections.length;
  if (idx < 26) return String.fromCharCode(65 + idx);
  return `S${idx + 1}`;
}

export function ChecklistTab({
  report,
  notOkCount,
  hasCustomTemplate,
  onUpdateMeta,
  onToggleItemStatus,
  onUpdateItemNote,
  onAddItemPhotos,
  onScanTimestampFromItemPhotos,
  onRemoveItemPhoto,
  onUpdateItemPhotoCaption,
  onAddSectionPhotos,
  onRemoveSectionPhoto,
  onUpdateSectionPhotoCaption,
  onUpdateSectionNote,
  onAddSubGroupPhotos,
  onRemoveSubGroupPhoto,
  onUpdateSubGroupPhotoCaption,
  onUpdateSubGroupNote,
  onSetSectionAllOk,
  onAddItem,
  onEditItemLabel,
  onDeleteItem,
  onMoveItem,
  onAddSubGroup,
  onDeleteSubGroup,
  onAddSection,
  onEditSectionTitle,
  onDeleteSection,
  onRestoreFactoryTemplate,
  onPreviewPhoto,
  photoTimestampMode,
  onChangePhotoTimestampMode,
  onConfirmTimestamp,
}: ChecklistTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [showMetaEditor, setShowMetaEditor] = useState(true);
  const [isManageMode, setIsManageMode] = useState(false);

  // Inline add-item composer state keyed by `${sectionId}` or `${sectionId}:${subGroupId}`
  const [addingItemTarget, setAddingItemTarget] = useState<string | null>(null);
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemStatusMode, setNewItemStatusMode] =
    useState<StatusMode>('ok_not_ok');

  // Inline edit-item state
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [editItemCode, setEditItemCode] = useState('');
  const [editItemLabel, setEditItemLabel] = useState('');

  // Inline add-subgroup state keyed by sectionId
  const [addingSubGroupSectionId, setAddingSubGroupSectionId] = useState<
    string | null
  >(null);
  const [newSubGroupCode, setNewSubGroupCode] = useState('');
  const [newSubGroupTitle, setNewSubGroupTitle] = useState('');

  // Inline edit standalone section title
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState('');

  // Add new section state
  const [showAddSectionForm, setShowAddSectionForm] = useState(false);
  const [newSectionCode, setNewSectionCode] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionStandalone, setNewSectionStandalone] = useState(true);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const toggleNoteField = (key: string) => {
    setOpenNotes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openAddItemForm = (
    targetKey: string,
    existingItems: ChecklistItem[],
    defaultMode: StatusMode = 'ok_not_ok'
  ) => {
    setAddingItemTarget(targetKey);
    setNewItemCode(suggestNextItemCode(existingItems));
    setNewItemLabel('');
    setNewItemStatusMode(defaultMode);
  };

  const submitAddItem = (sectionId: string, subGroupId?: string) => {
    const trimmed = newItemLabel.trim();
    if (!trimmed) return;
    onAddItem(
      sectionId,
      newItemCode.trim(),
      trimmed,
      newItemStatusMode,
      subGroupId
    );
    setAddingItemTarget(null);
    setNewItemLabel('');
  };

  const openAddSubGroupForm = (section: ChecklistSection) => {
    setAddingSubGroupSectionId(section.id);
    setNewSubGroupCode(suggestNextSubGroupCode(section.subGroups));
    setNewSubGroupTitle('');
  };

  const submitAddSubGroup = (sectionId: string) => {
    const trimmed = newSubGroupTitle.trim();
    if (!trimmed) return;
    onAddSubGroup(sectionId, newSubGroupCode.trim(), trimmed);
    setAddingSubGroupSectionId(null);
    setNewSubGroupTitle('');
  };

  const openAddSectionForm = () => {
    setNewSectionCode(suggestNextSectionLetter(report.sections));
    setNewSectionTitle('');
    setNewSectionStandalone(true);
    setShowAddSectionForm(true);
  };

  const submitAddSection = () => {
    const trimmedTitle = newSectionTitle.trim();
    const trimmedCode = newSectionCode.trim().toUpperCase();
    if (!trimmedTitle || !trimmedCode) return;
    onAddSection(trimmedCode, trimmedTitle, newSectionStandalone);
    setShowAddSectionForm(false);
    setNewSectionTitle('');
  };

  const countSectionMetrics = (section: ChecklistSection) => {
    const items = [
      ...section.items,
      ...section.subGroups.flatMap((sg) => sg.items),
    ];
    const ok = items.filter((i) => isPositiveStatus(i.status)).length;
    const issues = items.length - ok;
    const photoCount =
      section.photos.length +
      section.items.reduce((acc, i) => acc + i.photos.length, 0) +
      section.subGroups.reduce(
        (acc, sg) =>
          acc +
          sg.photos.length +
          sg.items.reduce((sAcc, i) => sAcc + i.photos.length, 0),
        0
      );
    return { total: items.length, ok, issues, photoCount };
  };

  const itemMatchesFilter = (
    item: ChecklistItem,
    section: ChecklistSection,
    subGroup?: ChecklistSubGroup
  ): boolean => {
    if (filterMode === 'not_ok' && isPositiveStatus(item.status)) {
      return false;
    }
    if (filterMode === 'has_photo' && item.photos.length === 0) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      section.code,
      section.title,
      subGroup?.code ?? '',
      subGroup?.title ?? '',
      item.code,
      item.label,
      item.note,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  };

  const photoItemsCount = useMemo(() => {
    let count = 0;
    for (const s of report.sections) {
      if (s.photos.length > 0) count += s.photos.length;
      for (const i of s.items) count += i.photos.length;
      for (const sg of s.subGroups) {
        count += sg.photos.length;
        for (const i of sg.items) count += i.photos.length;
      }
    }
    return count;
  }, [report]);

  const setAllCollapsed = (collapsed: boolean) => {
    const next: Record<string, boolean> = {};
    for (const s of report.sections) {
      if (!s.isStandalone) next[s.id] = collapsed;
    }
    setCollapsedSections(next);
  };

  const renderAddItemComposer = (
    targetKey: string,
    sectionId: string,
    subGroupId?: string
  ) => {
    if (addingItemTarget !== targetKey) return null;

    return (
      <div className="rounded-xl border border-sky-300 bg-sky-50/70 p-2.5">
        <p className="mb-2 text-[11px] font-bold text-[#1b4b72]">
          Tambah Item Checklist Baru (Nomor urut otomatis: {newItemCode})
        </p>
        <div className="flex gap-1.5">
          <span className="inline-flex w-14 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-100/80 px-2 py-1.5 font-mono text-xs font-bold text-[#256394]">
            {newItemCode}
          </span>
          <input
            type="text"
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitAddItem(sectionId, subGroupId);
            }}
            placeholder="Nama item checklist..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#3685c0]"
            autoFocus
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <select
            value={newItemStatusMode}
            onChange={(e) =>
              setNewItemStatusMode(e.target.value as StatusMode)
            }
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
          >
            <option value="ok_not_ok">Status: OK / Not OK</option>
            <option value="aktif_tidak_aktif">
              Status: Aktif / Tidak Aktif
            </option>
          </select>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAddingItemTarget(null)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => submitAddItem(sectionId, subGroupId)}
              disabled={!newItemLabel.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-[#3685c0] px-3 py-1 text-xs font-bold text-white hover:bg-[#2b6ca3] disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Tambah</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderItemRow = (
    section: ChecklistSection,
    item: ChecklistItem,
    itemIndex: number,
    siblingCount: number,
    subGroup?: ChecklistSubGroup
  ) => {
    const positive = isPositiveStatus(item.status);
    const targetStatus = getToggleTargetStatus(item);
    const noteKey = item.id;
    const isTimestampItem =
      item.id === 'C-2' ||
      item.id === 'C-3' ||
      /aplicares|siranap/i.test(item.label);
    const showNoteInput =
      openNotes[noteKey] ||
      item.note.trim().length > 0 ||
      !positive ||
      isTimestampItem;
    const isEditing = editingItemKey === item.id;

    const fullTitle = subGroup
      ? `${section.code} ${section.title} › ${subGroup.title} — ${item.label}`
      : `${section.code} ${section.title} — ${item.label}`;

    return (
      <div
        key={item.id}
        className={`rounded-xl border p-3 transition ${
          positive
            ? 'border-slate-200 bg-white'
            : 'border-red-300 bg-red-50/70'
        }`}
      >
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <span className="inline-flex w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                {editItemCode || '#'}
              </span>
              <input
                type="text"
                value={editItemLabel}
                onChange={(e) => setEditItemLabel(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-[#3685c0] focus:bg-white"
              />
            </div>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setEditingItemKey(null)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editItemLabel.trim()) return;
                  onEditItemLabel(
                    section.id,
                    item.id,
                    editItemCode.trim(),
                    editItemLabel.trim(),
                    subGroup?.id
                  );
                  setEditingItemKey(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#3685c0] px-2.5 py-1 text-xs font-bold text-white"
              >
                <Check className="h-3 w-3" />
                <span>Simpan Nama</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold text-slate-800">
                {item.code && (
                  <span className="mr-1.5 font-mono text-xs text-slate-500">
                    {item.code}
                  </span>
                )}
                {item.label}
              </p>
              {item.photos.length > 0 && (
                <p className="mt-0.5 text-[11px] font-medium text-[#3685c0]">
                  {item.photos.length} foto bukti terlampir
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {isManageMode && (
                <>
                  <button
                    type="button"
                    disabled={itemIndex === 0}
                    onClick={() =>
                      onMoveItem(section.id, item.id, 'up', subGroup?.id)
                    }
                    title="Geser ke atas"
                    className="inline-flex h-8 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-35"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={itemIndex === siblingCount - 1}
                    onClick={() =>
                      onMoveItem(section.id, item.id, 'down', subGroup?.id)
                    }
                    title="Geser ke bawah"
                    className="inline-flex h-8 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-35"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItemKey(item.id);
                      setEditItemCode(item.code);
                      setEditItemLabel(item.label);
                    }}
                    title="Ubah nama item"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Hapus item "${item.code ? `${item.code} ` : ''}${item.label}"?`
                        )
                      ) {
                        onDeleteItem(section.id, item.id, subGroup?.id);
                      }
                    }}
                    title="Hapus item"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => toggleNoteField(noteKey)}
                title="Tambah/ubah catatan"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition active:scale-95 ${
                  item.note.trim()
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
              </button>

              <PhotoUploaderButton
                compact
                label=""
                onConfirmTimestamp={onConfirmTimestamp}
                onAddPhotos={(photos, rawFiles) =>
                  onAddItemPhotos(
                    section.id,
                    item.id,
                    photos,
                    subGroup?.id,
                    rawFiles
                  )
                }
              />

              <button
                type="button"
                onClick={() =>
                  onToggleItemStatus(section.id, item.id, subGroup?.id)
                }
                title={`Ubah ke ${targetStatus}`}
                className={`min-w-[82px] rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-xs transition active:scale-95 ${
                  positive
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {item.status}
              </button>
            </div>
          </div>
        )}

        {showNoteInput && !isEditing && (
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="text"
              value={item.note}
              onChange={(e) =>
                onUpdateItemNote(
                  section.id,
                  item.id,
                  e.target.value,
                  subGroup?.id
                )
              }
              placeholder={
                item.notePlaceholder ??
                (positive
                  ? 'Catatan opsional (mis. Last Update / keterangan)...'
                  : 'Alasan Not OK / tindak lanjut...')
              }
              className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none transition ${
                positive
                  ? 'border-slate-200 bg-slate-50 text-slate-700 focus:border-[#3685c0] focus:bg-white'
                  : 'border-red-200 bg-white text-red-900 placeholder:text-red-400 focus:border-red-500'
              }`}
            />
            {item.photos.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onScanTimestampFromItemPhotos(
                    section.id,
                    item.id,
                    subGroup?.id
                  )
                }
                title="Ambil jam update terakhir paling baru dari foto terlampir"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 text-[11px] font-bold text-[#256394] hover:bg-sky-100 active:scale-95"
              >
                <ScanSearch className="h-3.5 w-3.5" />
                <span>Scan Jam</span>
              </button>
            )}
          </div>
        )}

        <PhotoStrip
          photos={item.photos}
          title={fullTitle}
          onPreview={onPreviewPhoto}
          onRemove={(photoId) =>
            onRemoveItemPhoto(section.id, item.id, photoId, subGroup?.id)
          }
          onUpdateCaption={(photoId, caption) =>
            onUpdateItemPhotoCaption(
              section.id,
              item.id,
              photoId,
              caption,
              subGroup?.id
            )
          }
        />
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-24">
      {/* Info Laporan Card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setShowMetaEditor((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#3685c0]" />
            <span className="text-xs font-bold tracking-wide text-slate-700 uppercase">
              Info Jadwal & Lokasi
            </span>
          </div>
          {showMetaEditor ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>

        {showMetaEditor && (
          <div className="space-y-2.5 border-t border-slate-100 px-4 pt-3 pb-3.5">
            <div className="grid grid-cols-3 gap-1.5">
              {SHIFTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onUpdateMeta({ shift: s })}
                  className={`rounded-lg py-1.5 text-xs font-bold tracking-wide transition ${
                    report.shift === s
                      ? 'bg-[#134b8a] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <Calendar className="h-3 w-3" /> Hari/Tanggal (
                  {formatIndonesianDate(report.date)})
                </span>
                <input
                  type="date"
                  value={report.date}
                  onChange={(e) => onUpdateMeta({ date: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#3685c0] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <User className="h-3 w-3" /> Petugas / PIC (Opsional)
                </span>
                <input
                  type="text"
                  value={report.inspector}
                  onChange={(e) => onUpdateMeta({ inspector: e.target.value })}
                  placeholder="Nama petugas shift..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#3685c0] focus:bg-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                Nama Site / Rumah Sakit
              </span>
              <input
                type="text"
                value={report.site}
                onChange={(e) => onUpdateMeta({ site: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#3685c0] focus:bg-white"
              />
            </label>
          </div>
        )}
      </section>

      {/* Search & Filter + Manage Mode Toggle */}
      <div className="sticky top-[106px] z-20 space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xs backdrop-blur-xs">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari item (Switch IGD, Aplicares, APM 1, LIS...)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-9 pl-9 text-sm text-slate-800 outline-none focus:border-[#3685c0] focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('not_ok')}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                filterMode === 'not_ok'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Not OK ({notOkCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('has_photo')}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                filterMode === 'has_photo'
                  ? 'bg-[#3685c0] text-white'
                  : 'bg-sky-50 text-[#256394] hover:bg-sky-100'
              }`}
            >
              Ada Foto ({photoItemsCount})
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setIsManageMode((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                isManageMode
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Pencil className="h-3 w-3" />
              <span>{isManageMode ? 'Selesai Edit' : 'Edit Daftar'}</span>
            </button>
            <button
              type="button"
              onClick={() => setAllCollapsed(false)}
              className="rounded-lg px-1.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
            >
              Buka
            </button>
            <button
              type="button"
              onClick={() => setAllCollapsed(true)}
              className="rounded-lg px-1.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
            >
              Tutup
            </button>
          </div>
        </div>

        <PhotoTimestampSelector
          mode={photoTimestampMode}
          onChangeMode={onChangePhotoTimestampMode}
          label="Timestamp di Foto Upload:"
        />

        {isManageMode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
            <strong>Mode Edit Daftar Aktif:</strong> Anda bisa menambah, ubah
            nama, atau menghapus item, sub-bagian, dan kategori. Susunan baru
            otomatis tersimpan sebagai template Anda.
          </div>
        )}
      </div>

      {/* Checklist Sections */}
      <div className="space-y-2.5">
        {report.sections.map((section) => {
          const metrics = countSectionMetrics(section);
          const q = searchQuery.trim().toLowerCase();

          // Standalone sections (e.g. J - N)
          if (section.isStandalone) {
            const item = section.items[0];
            if (!item) return null;

            const matchesSectionPhoto =
              filterMode === 'has_photo' &&
              (section.photos.length > 0 || item.photos.length > 0);
            const matchesItem = itemMatchesFilter(item, section);

            if (filterMode === 'has_photo' && !matchesSectionPhoto) return null;
            if (filterMode !== 'has_photo' && !matchesItem) return null;

            const positive = isPositiveStatus(item.status);
            const combinedPhotos = [...section.photos, ...item.photos];
            const isEditingSec = editingSectionId === section.id;

            return (
              <div
                key={section.id}
                className={`rounded-2xl border p-3.5 shadow-xs transition ${
                  positive
                    ? 'border-slate-200 bg-white'
                    : 'border-red-300 bg-red-50/70'
                }`}
              >
                {isEditingSec ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1b4b72] text-xs font-bold text-white">
                      {section.code.replace('.', '')}
                    </span>
                    <input
                      type="text"
                      value={editSectionTitle}
                      onChange={(e) => setEditSectionTitle(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-900 outline-none focus:border-[#3685c0]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editSectionTitle.trim()) {
                          onEditSectionTitle(
                            section.id,
                            editSectionTitle.trim()
                          );
                        }
                        setEditingSectionId(null);
                      }}
                      className="rounded-lg bg-[#3685c0] px-2.5 py-1 text-xs font-bold text-white"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSectionId(null)}
                      className="rounded-lg px-2 py-1 text-xs text-slate-500"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1b4b72] text-xs font-bold text-white">
                        {section.code.replace('.', '')}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-slate-900">
                          {section.title}
                        </h2>
                        {combinedPhotos.length > 0 && (
                          <p className="text-[11px] font-medium text-[#3685c0]">
                            {combinedPhotos.length} foto bukti
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {isManageMode && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSectionId(section.id);
                              setEditSectionTitle(section.title);
                            }}
                            title="Ubah nama bagian"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Hapus bagian "${section.code} ${section.title}"?`
                                )
                              ) {
                                onDeleteSection(section.id);
                              }
                            }}
                            title="Hapus bagian"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleNoteField(item.id)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                          item.note.trim()
                            ? 'border-amber-300 bg-amber-50 text-amber-700'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                      <PhotoUploaderButton
                        compact
                        label=""
                        onConfirmTimestamp={onConfirmTimestamp}
                        onAddPhotos={(photos, rawFiles) =>
                          onAddItemPhotos(
                            section.id,
                            item.id,
                            photos,
                            undefined,
                            rawFiles
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => onToggleItemStatus(section.id, item.id)}
                        className={`min-w-[82px] rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-xs transition active:scale-95 ${
                          positive
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        {item.status}
                      </button>
                    </div>
                  </div>
                )}

                {(openNotes[item.id] || item.note.trim() || !positive) && (
                  <input
                    type="text"
                    value={item.note}
                    onChange={(e) =>
                      onUpdateItemNote(section.id, item.id, e.target.value)
                    }
                    placeholder="Catatan opsional..."
                    className="mt-2.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#3685c0] focus:bg-white"
                  />
                )}

                <PhotoStrip
                  photos={item.photos}
                  title={`${section.code} ${section.title}`}
                  onPreview={onPreviewPhoto}
                  onRemove={(photoId) =>
                    onRemoveItemPhoto(section.id, item.id, photoId)
                  }
                  onUpdateCaption={(photoId, caption) =>
                    onUpdateItemPhotoCaption(section.id, item.id, photoId, caption)
                  }
                />
              </div>
            );
          }

          // Multi-item sections (A - I, or custom multi-item sections)
          const visibleDirectItems = section.items.filter((item) =>
            itemMatchesFilter(item, section)
          );
          const visibleSubGroups = section.subGroups
            .map((sg) => {
              const sgHasDirectPhotoMatch =
                filterMode === 'has_photo' && sg.photos.length > 0;
              const sgHeaderMatchesQuery =
                q.length > 0 &&
                `${sg.code} ${sg.title}`.toLowerCase().includes(q);
              const items = sg.items.filter((item) =>
                sgHeaderMatchesQuery && filterMode === 'all'
                  ? true
                  : itemMatchesFilter(item, section, sg)
              );
              return { sg, items, sgHasDirectPhotoMatch };
            })
            .filter(
              (entry) =>
                entry.items.length > 0 ||
                entry.sgHasDirectPhotoMatch ||
                (isManageMode && filterMode === 'all' && !q)
            );

          const sectionHasDirectPhotoMatch =
            filterMode === 'has_photo' && section.photos.length > 0;

          if (
            visibleDirectItems.length === 0 &&
            visibleSubGroups.length === 0 &&
            !sectionHasDirectPhotoMatch &&
            !(isManageMode && filterMode === 'all' && !q)
          ) {
            return null;
          }

          const isCollapsed = Boolean(collapsedSections[section.id]);

          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
            >
              {/* Section Accordion Header */}
              <div className="flex items-center justify-between gap-2 bg-slate-50/80 px-3.5 py-3">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#3685c0] text-xs font-bold text-white">
                    {section.code.replace('.', '')}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-900">
                      {section.title}
                    </h2>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span
                        className={`font-semibold ${
                          metrics.issues > 0
                            ? 'text-red-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {metrics.ok}/{metrics.total} OK
                      </span>
                      {metrics.issues > 0 && (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          {metrics.issues} Not OK
                        </span>
                      )}
                      {metrics.photoCount > 0 && (
                        <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-[#256394]">
                          {metrics.photoCount} foto
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  {isManageMode && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Hapus seluruh bagian "${section.code} ${section.title}" beserta item di dalamnya?`
                          )
                        ) {
                          onDeleteSection(section.id);
                        }
                      }}
                      title="Hapus bagian ini"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="p-1 text-slate-400"
                    aria-label="Buka atau tutup bagian"
                  >
                    {isCollapsed ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronUp className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Section Body */}
              {!isCollapsed && (
                <div className="space-y-3 border-t border-slate-200/80 p-3">
                  {/* Section-Level Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
                    <PhotoUploaderButton
                      label="Foto Bagian"
                      onConfirmTimestamp={onConfirmTimestamp}
                      onAddPhotos={(photos) =>
                        onAddSectionPhotos(section.id, photos)
                      }
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleNoteField(`sec-${section.id}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Catatan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetSectionAllOk(section.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 active:scale-95"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span>Semua OK</span>
                      </button>
                    </div>
                  </div>

                  {(openNotes[`sec-${section.id}`] || section.note.trim()) && (
                    <input
                      type="text"
                      value={section.note}
                      onChange={(e) =>
                        onUpdateSectionNote(section.id, e.target.value)
                      }
                      placeholder={`Catatan untuk bagian ${section.code} ${section.title}...`}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#3685c0] focus:bg-white"
                    />
                  )}

                  <PhotoStrip
                    photos={section.photos}
                    title={`${section.code} ${section.title}`}
                    onPreview={onPreviewPhoto}
                    onRemove={(photoId) =>
                      onRemoveSectionPhoto(section.id, photoId)
                    }
                    onUpdateCaption={(photoId, caption) =>
                      onUpdateSectionPhotoCaption(section.id, photoId, caption)
                    }
                  />

                  {/* Direct Items */}
                  {visibleDirectItems.length > 0 && (
                    <div className="space-y-2">
                      {visibleDirectItems.map((item, idx) =>
                        renderItemRow(
                          section,
                          item,
                          idx,
                          visibleDirectItems.length
                        )
                      )}
                    </div>
                  )}

                  {renderAddItemComposer(section.id, section.id)}

                  {/* Add direct item / add sub-group buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openAddItemForm(
                          section.id,
                          section.items,
                          section.id === 'D' ? 'aktif_tidak_aktif' : 'ok_not_ok'
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-sky-300 bg-sky-50/60 px-2.5 py-1.5 text-xs font-semibold text-[#256394] hover:bg-sky-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah Item</span>
                    </button>

                    {(isManageMode || section.subGroups.length > 0) && (
                      <button
                        type="button"
                        onClick={() => openAddSubGroupForm(section)}
                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        <span>Tambah Sub-Bagian</span>
                      </button>
                    )}
                  </div>

                  {addingSubGroupSectionId === section.id && (
                    <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5">
                      <p className="mb-2 text-[11px] font-bold text-slate-800">
                        Tambah Sub-Bagian Baru di {section.code} {section.title}
                      </p>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newSubGroupCode}
                          onChange={(e) => setNewSubGroupCode(e.target.value)}
                          placeholder="h)."
                          className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#3685c0]"
                        />
                        <input
                          type="text"
                          value={newSubGroupTitle}
                          onChange={(e) => setNewSubGroupTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitAddSubGroup(section.id);
                          }}
                          placeholder="Nama sub-bagian (mis. Antrian IGD)..."
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#3685c0]"
                          autoFocus
                        />
                      </div>
                      <div className="mt-2 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAddingSubGroupSectionId(null)}
                          className="rounded-lg px-2.5 py-1 text-xs text-slate-600"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => submitAddSubGroup(section.id)}
                          disabled={!newSubGroupTitle.trim()}
                          className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Buat Sub-Bagian
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sub-groups */}
                  {visibleSubGroups.map(({ sg, items }) => (
                    <div
                      key={sg.id}
                      className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        <div>
                          <h3 className="text-xs font-bold text-slate-800">
                            <span className="mr-1 text-[#3685c0]">{sg.code}</span>
                            {sg.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1">
                          {isManageMode && (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Hapus sub-bagian "${sg.code} ${sg.title}" beserta seluruh itemnya?`
                                  )
                                ) {
                                  onDeleteSubGroup(section.id, sg.id);
                                }
                              }}
                              title="Hapus sub-bagian"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleNoteField(`sg-${sg.id}`)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                            title="Catatan sub-bagian"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                          <PhotoUploaderButton
                            compact
                            label="+ Foto"
                            onConfirmTimestamp={onConfirmTimestamp}
                            onAddPhotos={(photos) =>
                              onAddSubGroupPhotos(section.id, sg.id, photos)
                            }
                          />
                        </div>
                      </div>

                      {(openNotes[`sg-${sg.id}`] || sg.note.trim()) && (
                        <input
                          type="text"
                          value={sg.note}
                          onChange={(e) =>
                            onUpdateSubGroupNote(
                              section.id,
                              sg.id,
                              e.target.value
                            )
                          }
                          placeholder={`Catatan untuk ${sg.title}...`}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#3685c0]"
                        />
                      )}

                      <PhotoStrip
                        photos={sg.photos}
                        title={`${section.code} ${section.title} › ${sg.title}`}
                        onPreview={onPreviewPhoto}
                        onRemove={(photoId) =>
                          onRemoveSubGroupPhoto(section.id, sg.id, photoId)
                        }
                        onUpdateCaption={(photoId, caption) =>
                          onUpdateSubGroupPhotoCaption(
                            section.id,
                            sg.id,
                            photoId,
                            caption
                          )
                        }
                      />

                      <div className="space-y-1.5">
                        {items.map((item, idx) =>
                          renderItemRow(section, item, idx, items.length, sg)
                        )}
                      </div>

                      {renderAddItemComposer(
                        `${section.id}:${sg.id}`,
                        section.id,
                        sg.id
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          openAddItemForm(`${section.id}:${sg.id}`, sg.items)
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Tambah Item di {sg.title}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Section & Restore Factory Template Controls */}
      {filterMode === 'all' && !searchQuery && (
        <section className="space-y-2.5 rounded-2xl border border-dashed border-slate-300 bg-white p-3.5">
          {showAddSectionForm ? (
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-900">
                Tambah Bagian / Kategori Checklist Baru
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSectionCode}
                  onChange={(e) => setNewSectionCode(e.target.value)}
                  placeholder="O"
                  className="w-14 rounded-xl border border-slate-300 px-2.5 py-2 text-center text-xs font-bold uppercase outline-none focus:border-[#3685c0]"
                />
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="Nama bagian (mis. SERVER BACKUP / CCTV)..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold outline-none focus:border-[#3685c0]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewSectionStandalone(true)}
                  className={`rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold ${
                    newSectionStandalone
                      ? 'border-[#3685c0] bg-sky-50 text-[#1b4b72]'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  Item Tunggal
                  <span className="block text-[10px] font-normal text-slate-500">
                    Seperti J. MANTIS : OK
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewSectionStandalone(false)}
                  className={`rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold ${
                    !newSectionStandalone
                      ? 'border-[#3685c0] bg-sky-50 text-[#1b4b72]'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  Bagian + Sub-Item
                  <span className="block text-[10px] font-normal text-slate-500">
                    Bisa diisi banyak item
                  </span>
                </button>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSectionForm(false)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={submitAddSection}
                  disabled={!newSectionTitle.trim() || !newSectionCode.trim()}
                  className="rounded-xl bg-[#3685c0] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#2b6ca3] disabled:opacity-50"
                >
                  Tambahkan Bagian
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={openAddSectionForm}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Bagian Baru</span>
              </button>

              {hasCustomTemplate && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Kembalikan daftar checklist ke template awal RSUD (A–N, 70 item)? Foto/catatan pada item kustom akan dihapus.'
                      )
                    ) {
                      onRestoreFactoryTemplate();
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Kembalikan Daftar Awal</span>
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
