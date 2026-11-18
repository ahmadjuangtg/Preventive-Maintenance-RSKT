import type { ChecklistItem, ChecklistReport } from '../types/checklist';
import { formatIndonesianDate } from './dateUtils';

function formatItemStatus(item: ChecklistItem): string {
  const note = item.note.trim();
  return note ? `${item.status}, ${note}` : item.status;
}

export function formatWhatsAppReport(report: ChecklistReport): string {
  const lines: string[] = [];

  lines.push(
    `Berikut Resume Update Checklist ${report.shift} Site ${report.site}`
  );
  lines.push(`Hari/Tanggal : ${formatIndonesianDate(report.date)}`);
  if (report.inspector.trim()) {
    lines.push(`Petugas : ${report.inspector.trim()}`);
  }
  lines.push('');

  for (let i = 0; i < report.sections.length; i++) {
    const section = report.sections[i];
    const prevSection = i > 0 ? report.sections[i - 1] : undefined;

    if (section.isStandalone) {
      if (i > 0 && !prevSection?.isStandalone) {
        lines.push('');
      }
      const item = section.items[0];
      const statusText = item ? formatItemStatus(item) : 'OK';
      lines.push(`${section.code} ${section.title} : ${statusText}`);
      continue;
    }

    // Add spacing before non-standalone sections (except right after header blank line)
    if (i > 0) {
      lines.push('');
    }

    const headerSuffix = section.hasHeaderColon ? ' :' : '';
    lines.push(`${section.code} ${section.title}${headerSuffix}`);
    if (section.note.trim()) {
      lines.push(`   Catatan : ${section.note.trim()}`);
    }

    // Direct items
    for (const item of section.items) {
      const indent = section.unindentedItems ? '' : '   ';
      const prefix = item.code ? `${item.code} ` : '';
      lines.push(`${indent}${prefix}${item.label} : ${formatItemStatus(item)}`);
    }

    // Sub-groups
    for (let sgIdx = 0; sgIdx < section.subGroups.length; sgIdx++) {
      const subGroup = section.subGroups[sgIdx];
      // Add blank line before subgroups in section E, or between subgroups (sgIdx > 0) in F
      if (section.id === 'E' || (section.id === 'F' && sgIdx > 0)) {
        lines.push('');
      }
      lines.push(`   ${subGroup.code} ${subGroup.title}`);
      if (subGroup.note.trim()) {
        lines.push(`       Catatan : ${subGroup.note.trim()}`);
      }
      for (const item of subGroup.items) {
        const prefix = item.code ? `${item.code} ` : '';
        lines.push(`       ${prefix}${item.label} : ${formatItemStatus(item)}`);
      }
    }
  }

  lines.push('');
  lines.push('Terima kasih.');

  return lines.join('\n');
}
