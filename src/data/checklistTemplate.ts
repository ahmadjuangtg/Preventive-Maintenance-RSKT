import type {
  ChecklistItem,
  ChecklistReport,
  ChecklistSection,
  ChecklistSubGroup,
  CheckStatus,
  FlattenedItemEntry,
  FlattenedPhotoEntry,
  ShiftType,
  StatusMode,
} from '../types/checklist';
import { formatSlashDate, getTodayIsoDate } from '../utils/dateUtils';

function makeItem(
  id: string,
  code: string,
  label: string,
  options?: {
    statusMode?: StatusMode;
    status?: CheckStatus;
    note?: string;
    notePlaceholder?: string;
  }
): ChecklistItem {
  const statusMode = options?.statusMode ?? 'ok_not_ok';
  const defaultStatus: CheckStatus =
    statusMode === 'aktif_tidak_aktif' ? 'Aktif' : 'OK';
  return {
    id,
    code,
    label,
    statusMode,
    status: options?.status ?? defaultStatus,
    note: options?.note ?? '',
    notePlaceholder: options?.notePlaceholder,
    photos: [],
  };
}

function makeSubGroup(
  id: string,
  code: string,
  title: string,
  items: ChecklistItem[]
): ChecklistSubGroup {
  return {
    id,
    code,
    title,
    note: '',
    photos: [],
    items,
  };
}

function makeStandaloneSection(id: string, code: string, title: string): ChecklistSection {
  return {
    id,
    code,
    title,
    isStandalone: true,
    note: '',
    photos: [],
    items: [makeItem(`${id}-1`, '', title)],
    subGroups: [],
  };
}

export function createDefaultReport(dateIso?: string): ChecklistReport {
  const date = dateIso ?? getTodayIsoDate();
  const slashDate = formatSlashDate(date);

  const switchSegmenNames = [
    'IRJ Lt.1',
    'IRJ Lt.2',
    'IRJ Lt.3',
    'IGD',
    'REHABILITASI MEDIK',
    'RADIOLOGI',
    'HEMODIALISA',
    'RUANG ASTER',
    'RUANG ANGREK',
    'RUANG KEMUNING',
    'LAB PATOLOGI ANATOMI',
    'MCU',
    'GEDUNG KANTOR',
    'EDP',
  ];

  const registrasiItems = (prefix: string): ChecklistItem[] => [
    makeItem(`${prefix}-1`, '1.', 'Kiosk'),
    makeItem(`${prefix}-2`, '2.', 'Printer Antrian'),
    makeItem(`${prefix}-3`, '3.', 'Speaker Antrian'),
    makeItem(`${prefix}-4`, '4.', 'Display Antrian'),
    makeItem(`${prefix}-5`, '5.', 'Kertas Printer'),
  ];

  const poliItems = (prefix: string): ChecklistItem[] => [
    makeItem(`${prefix}-1`, '1.', 'Display Antrian'),
    makeItem(`${prefix}-2`, '2.', 'Speaker Antrian'),
  ];

  const farmasiItems = (prefix: string): ChecklistItem[] => [
    makeItem(`${prefix}-1`, '1.', 'Display Antrian'),
    makeItem(`${prefix}-2`, '2.', 'Speaker Antrian'),
    makeItem(`${prefix}-3`, '3.', 'Printer Antrian'),
    makeItem(`${prefix}-4`, '4.', 'Kertas Antrian'),
  ];

  const apmItems = (prefix: string): ChecklistItem[] => [
    makeItem(`${prefix}-1`, '1.', 'Printer Antrian'),
    makeItem(`${prefix}-2`, '2.', 'Kertas Printer'),
    makeItem(`${prefix}-3`, '3.', 'Buka Aplikasi Label'),
  ];

  const sections: ChecklistSection[] = [
    {
      id: 'A',
      code: 'A.',
      title: 'Monitoring Hardware & Jaringan',
      note: '',
      photos: [],
      items: [makeItem('A-a', 'a).', 'Cek monitoring the Dude')],
      subGroups: [
        makeSubGroup(
          'A-b',
          'b).',
          'Ping Switch Segmen',
          switchSegmenNames.map((name, idx) =>
            makeItem(
              `A-b-${idx + 1}`,
              `${String(idx + 1).padStart(2, '0')}.`,
              name
            )
          )
        ),
      ],
    },
    {
      id: 'B',
      code: 'B.',
      title: 'VPN dan Internet',
      note: '',
      photos: [],
      items: [
        makeItem('B-1', '1.', 'VPN RS Koneksi Ecalyptus'),
        makeItem('B-2', '2.', 'VPN Koneksi Buana'),
        makeItem('B-3', '3.', 'Internet'),
      ],
      subGroups: [],
    },
    {
      id: 'C',
      code: 'C.',
      title: 'BRIDGING',
      note: '',
      photos: [],
      items: [
        makeItem('C-1', '1.', 'Vclaim Monitoring'),
        makeItem('C-2', '2.', 'Aplicares', {
          notePlaceholder:
            'Last Update : DD/MM/YYYY HH:mm:ss (otomatis dari foto)',
        }),
        makeItem('C-3', '3.', 'SIRANAP', {
          note: `Last Update : ${slashDate}`,
          notePlaceholder: `Last Update : ${slashDate}`,
        }),
        makeItem('C-4', '4.', 'Server Eklaim'),
      ],
      subGroups: [],
    },
    {
      id: 'D',
      code: 'D.',
      title: 'HOTLINE',
      note: '',
      photos: [],
      items: [
        makeItem('D-1', '1.', '(Lokal RS) Line 417', {
          statusMode: 'aktif_tidak_aktif',
          status: 'Aktif',
        }),
        makeItem('D-2', '2.', 'Hotline 082310093469', {
          statusMode: 'aktif_tidak_aktif',
          status: 'Aktif',
        }),
      ],
      subGroups: [],
    },
    {
      id: 'E',
      code: 'E.',
      title: 'Antrian',
      note: '',
      photos: [],
      items: [],
      subGroups: [
        makeSubGroup('E-a', 'a).', 'Antrian Registrasi Lt. 1', registrasiItems('E-a')),
        makeSubGroup('E-b', 'b).', 'Antrian Registrasi Lt. 2', registrasiItems('E-b')),
        makeSubGroup('E-c', 'c).', 'Antrian Pelayanan Poli Lt. 1', poliItems('E-c')),
        makeSubGroup('E-d', 'd).', 'Antrian Pelayanan Poli Lt. 2', poliItems('E-d')),
        makeSubGroup('E-e', 'e).', 'Antrian Pelayanan Poli Lt. 3', poliItems('E-e')),
        makeSubGroup('E-f', 'f).', 'Antrian Farmasi Lt.1', farmasiItems('E-f')),
        makeSubGroup('E-g', 'g).', 'Antrian Farmasi Lt.2', farmasiItems('E-g')),
      ],
    },
    {
      id: 'F',
      code: 'F.',
      title: 'ANJUNGAN PENDAFTARAN MANDIRI (APM)',
      note: '',
      photos: [],
      items: [],
      subGroups: [
        makeSubGroup('F-a', 'a).', 'APM 1', apmItems('F-a')),
        makeSubGroup('F-b', 'b).', 'APM 2', apmItems('F-b')),
        makeSubGroup('F-c', 'c).', 'APM 3 Lt. 2', apmItems('F-c')),
      ],
    },
    {
      id: 'G',
      code: 'G.',
      title: 'Dashboard',
      unindentedItems: true,
      note: '',
      photos: [],
      items: [
        makeItem('G-1', '', 'CRM'),
        makeItem('G-2', '', 'Bed Monitoring'),
        makeItem('G-3', '', 'Dashboard Direksi'),
        makeItem('G-4', '', 'Dashboard BO'),
        makeItem('G-5', '', 'Dashboard Antrian Online'),
      ],
      subGroups: [],
    },
    {
      id: 'H',
      code: 'H.',
      title: 'LIS',
      hasHeaderColon: true,
      note: '',
      photos: [],
      items: [
        makeItem('H-1', '1.', 'Ping Server LIS'),
        makeItem('H-2', '2.', 'Cek kiriman hasil alat ke MIRSA'),
      ],
      subGroups: [],
    },
    {
      id: 'I',
      code: 'I.',
      title: 'Ecalyptus',
      note: '',
      photos: [],
      items: [makeItem('I-1', '1.', 'Ecalyptus Service')],
      subGroups: [],
    },
    makeStandaloneSection('J', 'J.', 'MANTIS'),
    makeStandaloneSection('K', 'K.', 'GITLAB'),
    makeStandaloneSection('L', 'L.', 'GLPI'),
    makeStandaloneSection('M', 'M.', 'SIERATU'),
    makeStandaloneSection('N', 'N.', 'SERVER DBFLAT'),
  ];

  return {
    id: `report-${Date.now()}`,
    shift: 'PAGI',
    site: 'RSUD Kabupaten Tangerang',
    date,
    inspector: '',
    updatedAt: new Date().toISOString(),
    sections,
  };
}

export function normalizeShift(shift?: string): ShiftType {
  const upper = (shift ?? '').trim().toUpperCase();
  if (upper === 'MALAM') return 'MALAM';
  if (upper === 'SORE' || upper === 'SIANG') return 'SORE';
  return 'PAGI';
}

export function isPositiveStatus(status: CheckStatus): boolean {
  return status === 'OK' || status === 'Aktif';
}

export function getToggleTargetStatus(item: ChecklistItem): CheckStatus {
  if (item.statusMode === 'aktif_tidak_aktif') {
    return item.status === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
  }
  return item.status === 'OK' ? 'Not OK' : 'OK';
}

export function flattenItems(report: ChecklistReport): FlattenedItemEntry[] {
  const result: FlattenedItemEntry[] = [];
  for (const section of report.sections) {
    for (const item of section.items) {
      result.push({
        section,
        item,
        breadcrumb: section.isStandalone
          ? `${section.code} ${section.title}`
          : `${section.code} ${section.title} › ${item.code ? `${item.code} ` : ''}${item.label}`,
      });
    }
    for (const subGroup of section.subGroups) {
      for (const item of subGroup.items) {
        result.push({
          section,
          subGroup,
          item,
          breadcrumb: `${section.code} ${section.title} › ${subGroup.code} ${subGroup.title} › ${item.code} ${item.label}`,
        });
      }
    }
  }
  return result;
}

export function flattenPhotos(report: ChecklistReport): FlattenedPhotoEntry[] {
  const photos: FlattenedPhotoEntry[] = [];

  for (const section of report.sections) {
    const secLabel = `${section.code} ${section.title}`;

    // Section-level photos (for non-standalone or standalone section attachments)
    for (const photo of section.photos) {
      photos.push({
        photo,
        sectionId: section.id,
        sectionTitle: secLabel,
        itemLabel: secLabel,
        fullLabel: secLabel,
        status: section.isStandalone ? section.items[0]?.status : undefined,
        note: section.note || (section.isStandalone ? section.items[0]?.note : undefined),
        targetType: 'section',
        targetId: section.id,
      });
    }

    // Direct items
    for (const item of section.items) {
      const itemLabel = section.isStandalone
        ? secLabel
        : `${item.code ? `${item.code} ` : ''}${item.label}`;
      for (const photo of item.photos) {
        photos.push({
          photo,
          sectionId: section.id,
          sectionTitle: secLabel,
          itemLabel,
          fullLabel: section.isStandalone ? secLabel : `${secLabel} — ${itemLabel}`,
          status: item.status,
          note: item.note,
          targetType: 'item',
          targetId: item.id,
        });
      }
    }

    // Sub-groups and their items
    for (const subGroup of section.subGroups) {
      const sgLabel = `${subGroup.code} ${subGroup.title}`;
      for (const photo of subGroup.photos) {
        photos.push({
          photo,
          sectionId: section.id,
          sectionTitle: secLabel,
          subGroupTitle: sgLabel,
          itemLabel: sgLabel,
          fullLabel: `${secLabel} — ${sgLabel}`,
          note: subGroup.note,
          targetType: 'subgroup',
          targetId: subGroup.id,
        });
      }
      for (const item of subGroup.items) {
        const itemLabel = `${item.code ? `${item.code} ` : ''}${item.label}`;
        for (const photo of item.photos) {
          photos.push({
            photo,
            sectionId: section.id,
            sectionTitle: secLabel,
            subGroupTitle: sgLabel,
            itemLabel,
            fullLabel: `${secLabel} › ${sgLabel} — ${itemLabel}`,
            status: item.status,
            note: item.note,
            targetType: 'item',
            targetId: item.id,
          });
        }
      }
    }
  }

  return photos;
}

export function getReportStats(report: ChecklistReport) {
  const allItems = flattenItems(report);
  const okCount = allItems.filter((entry) => isPositiveStatus(entry.item.status)).length;
  const issueItems = allItems.filter((entry) => !isPositiveStatus(entry.item.status));
  const allPhotos = flattenPhotos(report);

  return {
    totalItems: allItems.length,
    okCount,
    notOkCount: issueItems.length,
    issueItems,
    totalPhotos: allPhotos.length,
  };
}

function indexToUpperLetter(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  const first = String.fromCharCode(65 + Math.floor(index / 26) - 1);
  const second = String.fromCharCode(65 + (index % 26));
  return `${first}${second}`;
}

function indexToLowerParen(index: number): string {
  const letter = String.fromCharCode(97 + (index % 26));
  return `${letter}).`;
}

function resequenceItemList(
  items: ChecklistItem[],
  padZero: boolean
): ChecklistItem[] {
  return items.map((item, idx) => ({
    ...item,
    code: padZero
      ? `${String(idx + 1).padStart(2, '0')}.`
      : `${idx + 1}.`,
  }));
}

export function resequenceSections(
  sections: ChecklistSection[]
): ChecklistSection[] {
  return sections.map((section, secIdx) => {
    const secLetter = indexToUpperLetter(secIdx);
    const secCode = `${secLetter}.`;

    if (section.isStandalone) {
      return {
        ...section,
        code: secCode,
        items: section.items.map((item) => ({ ...item, code: '' })),
      };
    }

    const hasSubGroups = section.subGroups.length > 0;
    const usesLetterDirectItems =
      hasSubGroups &&
      (section.id === 'A' ||
        section.items.some((item) => /^[a-z]\)\.?$/i.test(item.code.trim())));

    let nextItems: ChecklistItem[];
    let letterOffset = 0;

    if (section.unindentedItems) {
      nextItems = section.items.map((item) => ({ ...item, code: '' }));
    } else if (usesLetterDirectItems) {
      nextItems = section.items.map((item, idx) => ({
        ...item,
        code: indexToLowerParen(idx),
      }));
      letterOffset = section.items.length;
    } else {
      const padDirect =
        section.items.some((i) => /^0\d\./.test(i.code)) ||
        section.items.length >= 10;
      nextItems = resequenceItemList(section.items, padDirect);
    }

    const nextSubGroups = section.subGroups.map((sg, sgIdx) => {
      const padSg =
        sg.id === 'A-b' ||
        sg.items.some((i) => /^0\d\./.test(i.code)) ||
        sg.items.length >= 10;
      return {
        ...sg,
        code: indexToLowerParen(letterOffset + sgIdx),
        items: resequenceItemList(sg.items, padSg),
      };
    });

    return {
      ...section,
      code: secCode,
      items: nextItems,
      subGroups: nextSubGroups,
    };
  });
}
