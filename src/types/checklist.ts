export type CheckStatus = 'OK' | 'Not OK' | 'Aktif' | 'Tidak Aktif';
export type StatusMode = 'ok_not_ok' | 'aktif_tidak_aktif';

export interface PhotoAttachment {
  id: string;
  dataUrl: string;
  caption: string;
  timestamp: string;
}

export interface ChecklistItem {
  id: string;
  code: string;
  label: string;
  statusMode: StatusMode;
  status: CheckStatus;
  note: string;
  notePlaceholder?: string;
  photos: PhotoAttachment[];
}

export interface ChecklistSubGroup {
  id: string;
  code: string;
  title: string;
  note: string;
  photos: PhotoAttachment[];
  items: ChecklistItem[];
}

export interface ChecklistSection {
  id: string;
  code: string;
  title: string;
  isStandalone?: boolean;
  hasHeaderColon?: boolean;
  unindentedItems?: boolean;
  note: string;
  photos: PhotoAttachment[];
  items: ChecklistItem[];
  subGroups: ChecklistSubGroup[];
}

export type ShiftType = 'PAGI' | 'SORE' | 'MALAM';

export type PhotoTimestampMode = 'ask' | 'on' | 'off';

export interface ChecklistReport {
  id: string;
  shift: ShiftType;
  site: string;
  date: string; // YYYY-MM-DD
  inspector: string;
  updatedAt: string;
  sections: ChecklistSection[];
}

export interface FlattenedPhotoEntry {
  photo: PhotoAttachment;
  sectionId: string;
  sectionTitle: string;
  subGroupTitle?: string;
  itemLabel: string;
  fullLabel: string;
  status?: CheckStatus;
  note?: string;
  targetType: 'section' | 'subgroup' | 'item';
  targetId: string;
}

export interface FlattenedItemEntry {
  section: ChecklistSection;
  subGroup?: ChecklistSubGroup;
  item: ChecklistItem;
  breadcrumb: string;
}
