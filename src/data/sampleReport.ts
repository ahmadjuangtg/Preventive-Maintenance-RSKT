import type { ChecklistItem, ChecklistReport } from '../types/checklist';
import { createDefaultReport, isPositiveStatus } from './checklistTemplate';
import { createMockPhotoDataUrl } from '../utils/imageUtils';

export type SamplePreset = 'full_70' | 'compact_5';

function buildTelemetryLines(
  sectionId: string,
  item: ChecklistItem,
  subGroupTitle: string | undefined,
  index: number
): string[] {
  const positive = isPositiveStatus(item.status);

  if (!positive) {
    return [
      `Target : ${subGroupTitle ? `${subGroupTitle} — ` : ''}${item.label}`,
      `Result : NOT OK / FAIL`,
      `Note   : ${item.note || 'Perlu pengecekan teknisi'}`,
      `Check  : 16/11/2026 07:${String(15 + (index % 40)).padStart(2, '0')} WIB`,
    ];
  }

  switch (sectionId) {
    case 'A':
      return [
        `Host   : SW-${item.label.replace(/\s+/g, '-').toUpperCase()}`,
        `Ping   : Reply 64 bytes time=${1 + (index % 4)}ms TTL=64`,
        `Loss   : 0% packet loss (4/4 received)`,
        `Status : UP / OK via The Dude`,
      ];
    case 'B':
      return [
        `Tunnel : ${item.label}`,
        `Link   : Connected (Uptime 99.98%)`,
        `RTT    : ${8 + (index % 15)}ms | Bandwidth Normal`,
        `Status : OK / Stabil`,
      ];
    case 'C':
      return [
        `Bridge : ${item.label}`,
        `HTTP   : 200 OK (TLS Verified)`,
        item.note ? `Sync   : ${item.note}` : 'Sync   : Real-time OK',
        `Status : Connected & Normal`,
      ];
    case 'D':
      return [
        `Line   : ${item.label}`,
        `Test   : Call Test & Ringtone OK`,
        `Signal : Clear Audio / Ready`,
        `Status : ${item.status}`,
      ];
    case 'E':
    case 'F':
      return [
        `Unit   : ${subGroupTitle ?? sectionId} — ${item.label}`,
        `Check  : Fisik, Power & Output Test`,
        `Media  : Kondisi Baik & Siap Layanan`,
        `Status : OK (Verifikasi Pagi)`,
      ];
    default:
      return [
        `System : ${item.label}`,
        `Health : Service Active / Running`,
        `Port   : Responsive (${2 + (index % 6)}ms)`,
        `Status : OK / Normal`,
      ];
  }
}

export function createSampleReport(
  preset: SamplePreset = 'full_70'
): ChecklistReport {
  const report = createDefaultReport('2026-11-16');
  report.shift = 'PAGI';
  report.site = 'RSUD Kabupaten Tangerang';
  report.inspector = 'Tim IT Support';

  const nowTime = '07:45';

  // Apply realistic sample issues & SIRANAP date
  const secC = report.sections.find((s) => s.id === 'C');
  if (secC) {
    const aplicares = secC.items.find((i) => i.id === 'C-2');
    if (aplicares) {
      aplicares.status = 'Not OK';
      aplicares.note = 'Response timeout API BPJS Aplicares';
    }
    const siranap = secC.items.find((i) => i.id === 'C-3');
    if (siranap) {
      siranap.status = 'OK';
      siranap.note = 'Last Update : 16/11/2026';
    }
  }

  if (preset === 'compact_5') {
    const secA = report.sections.find((s) => s.id === 'A');
    const dudeItem = secA?.items.find((i) => i.id === 'A-a');
    if (dudeItem) {
      dudeItem.photos.push({
        id: 'sample-photo-dude',
        dataUrl: createMockPhotoDataUrl(
          'THE DUDE NETWORK MONITOR',
          'RSUD Kab. Tangerang — Core & Distribution Nodes',
          [
            'Gateway Core Router : UP (1ms)',
            'Switch Segmen 01-14 : ALL REACHABLE',
            'Packet Loss : 0.0% | Latency Avg : 2ms',
            'Checked at 07:30 WIB',
          ],
          true
        ),
        caption: 'Semua node monitoring hijau di The Dude',
        timestamp: nowTime,
      });
    }

    const switchSg = secA?.subGroups.find((sg) => sg.id === 'A-b');
    if (switchSg) {
      switchSg.photos.push({
        id: 'sample-photo-switch',
        dataUrl: createMockPhotoDataUrl(
          'PING SWITCH SEGMEN 01 - 14',
          'Batch ICMP Verification Report',
          [
            '01-05 (IRJ Lt.1-3, IGD, Rehab) : 0% loss',
            '06-10 (Rad, HD, Aster, Angrek, Kemuning) : 0% loss',
            '11-14 (Lab PA, MCU, Kantor, EDP) : 0% loss',
            'Total 14/14 Segmen : OK',
          ],
          true
        ),
        caption: 'Hasil ping switch 14 segmen normal',
        timestamp: nowTime,
      });
    }

    const aplicares = secC?.items.find((i) => i.id === 'C-2');
    if (aplicares) {
      aplicares.photos.push({
        id: 'sample-photo-aplicares',
        dataUrl: createMockPhotoDataUrl(
          'BRIDGING BPJS — APLICARES',
          'Endpoint Bed Availability Sync Monitor',
          [
            'Target : https://new-api.bpjs-kesehatan.go.id',
            'HTTP Status : 504 GATEWAY TIMEOUT',
            'Last Sync Attempt : 16/11/2026 07:38 WIB',
            'Action : FAIL / Eskalasi ke tim bridging',
          ],
          false
        ),
        caption: 'Timeout saat sync kamar ke BPJS Aplicares',
        timestamp: nowTime,
      });
    }

    const siranap = secC?.items.find((i) => i.id === 'C-3');
    if (siranap) {
      siranap.photos.push({
        id: 'sample-photo-siranap',
        dataUrl: createMockPhotoDataUrl(
          'KEMENKES SIRANAP MONITOR',
          'Sinkronisasi Tempat Tidur Harian',
          [
            'Kode RS : 3603010 (RSUD Kab. Tangerang)',
            'Status Bridging : CONNECTED / OK',
            'Last Update : 16/11/2026 07:35 WIB',
            'Kapasitas Terkirim : 100% Sinkron',
          ],
          true
        ),
        caption: 'Update SIRANAP 16/11/2026 berhasil',
        timestamp: nowTime,
      });
    }

    const secE = report.sections.find((s) => s.id === 'E');
    const reg1 = secE?.subGroups.find((sg) => sg.id === 'E-a');
    if (reg1) {
      reg1.photos.push({
        id: 'sample-photo-antrian1',
        dataUrl: createMockPhotoDataUrl(
          'ANTRIAN REGISTRASI LT. 1',
          'Kiosk, Printer Thermal, Audio & Display TV',
          [
            'Kiosk Touchscreen : READY / OK',
            'Printer Antrian & Kertas : OK (Roll baru)',
            'Display TV & Speaker Panggilan : OK',
            'Verifikasi Lapangan Pagi : Normal',
          ],
          true
        ),
        caption: 'Kondisi loket antrian Lt.1 siap pelayanan',
        timestamp: nowTime,
      });
    }

    const secF = report.sections.find((s) => s.id === 'F');
    const apm1 = secF?.subGroups.find((sg) => sg.id === 'F-a');
    if (apm1) {
      apm1.photos.push({
        id: 'sample-photo-apm1',
        dataUrl: createMockPhotoDataUrl(
          'ANJUNGAN PENDAFTARAN MANDIRI (APM 1)',
          'Cek Printer, Kertas & Aplikasi Label',
          [
            'Printer Antrian APM 1 : ONLINE / OK',
            'Stok Kertas Printer : CUKUP / OK',
            'Aplikasi Cetak Label SEP : RUNNING / OK',
            'Test Print Pagi : Sukses',
          ],
          true
        ),
        caption: 'Test cetak label APM 1 berhasil',
        timestamp: nowTime,
      });
    }
    return report;
  }

  // FULL 70 PHOTOS MODE: every single one of the 70 items gets a unique photo
  const secE = report.sections.find((s) => s.id === 'E');
  const reg2Kertas = secE?.subGroups
    .find((sg) => sg.id === 'E-b')
    ?.items.find((i) => i.id === 'E-b-5');
  if (reg2Kertas) {
    reg2Kertas.status = 'Not OK';
    reg2Kertas.note = 'Kertas thermal habis, sedang diisi ulang';
  }

  let counter = 0;
  for (const section of report.sections) {
    for (const item of section.items) {
      counter++;
      const positive = isPositiveStatus(item.status);
      const timeStr = `07:${String(15 + (counter % 45)).padStart(2, '0')}`;
      const heading = section.isStandalone
        ? `${section.code} ${section.title}`
        : `${section.code} ${item.code ? `${item.code} ` : ''}${item.label}`;

      item.photos.push({
        id: `sample-70-${item.id}`,
        dataUrl: createMockPhotoDataUrl(
          heading.toUpperCase(),
          `${section.code} ${section.title} — Item #${counter}`,
          buildTelemetryLines(section.id, item, undefined, counter),
          positive,
          true
        ),
        caption: positive
          ? `Bukti cek ${item.label}`
          : item.note || `Temuan pada ${item.label}`,
        timestamp: timeStr,
      });
    }

    for (const sg of section.subGroups) {
      for (const item of sg.items) {
        counter++;
        const positive = isPositiveStatus(item.status);
        const timeStr = `07:${String(15 + (counter % 45)).padStart(2, '0')}`;
        const heading = `${sg.title} — ${item.code} ${item.label}`;

        item.photos.push({
          id: `sample-70-${item.id}`,
          dataUrl: createMockPhotoDataUrl(
            heading.toUpperCase(),
            `${section.code} ${section.title} › ${sg.code} ${sg.title}`,
            buildTelemetryLines(section.id, item, sg.title, counter),
            positive,
            true
          ),
          caption: positive
            ? `Cek ${sg.title} (${item.label})`
            : item.note || `Kendala di ${sg.title}`,
          timestamp: timeStr,
        });
      }
    }
  }

  return report;
}
