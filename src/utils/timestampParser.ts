export interface ParsedTimestamp {
  formatted: string;
  noteValue: string;
  epochMs: number;
  precision: 1 | 2 | 3; // 3 = DD/MM/YYYY HH:mm:ss, 2 = DD/MM/YYYY HH:mm, 1 = DD/MM/YYYY
}

function isValidDateParts(day: number, month: number, year: number): boolean {
  if (year < 2020 || year > 2035) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return false;
  }
  // Ignore far-future contract/expiry dates such as "Mitra BPJS hingga 31-12-2026"
  const maxAllowedMs = Date.now() + 36 * 60 * 60 * 1000;
  return dt.getTime() <= maxAllowedMs;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function extractTimestampsFromText(rawText: string): ParsedTimestamp[] {
  const results: ParsedTimestamp[] = [];
  const seen = new Set<string>();

  const addCandidate = (
    day: number,
    month: number,
    year: number,
    hour?: number,
    minute?: number,
    second?: number
  ) => {
    if (!isValidDateParts(day, month, year)) return;

    const dd = pad2(day);
    const mm = pad2(month);

    if (
      hour !== undefined &&
      minute !== undefined &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      const hh = pad2(hour);
      const mi = pad2(minute);
      if (second !== undefined && second >= 0 && second <= 59) {
        const ss = pad2(second);
        const formatted = `${dd}/${mm}/${year} ${hh}:${mi}:${ss}`;
        if (!seen.has(formatted)) {
          seen.add(formatted);
          results.push({
            formatted,
            noteValue: `Last Update : ${formatted}`,
            epochMs: Date.UTC(year, month - 1, day, hour, minute, second),
            precision: 3,
          });
        }
        return;
      }

      const formatted = `${dd}/${mm}/${year} ${hh}:${mi}`;
      if (!seen.has(formatted)) {
        seen.add(formatted);
        results.push({
          formatted,
          noteValue: `Last Update : ${formatted}`,
          epochMs: Date.UTC(year, month - 1, day, hour, minute, 0),
          precision: 2,
        });
      }
      return;
    }

    const formatted = `${dd}/${mm}/${year}`;
    if (!seen.has(formatted)) {
      seen.add(formatted);
      results.push({
        formatted,
        noteValue: `Last Update : ${formatted}`,
        epochMs: Date.UTC(year, month - 1, day, 0, 0, 0),
        precision: 1,
      });
    }
  };

  // 1. DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm (allowing : or . separators)
  const dateTimeRegex =
    /\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})\s+(\d{1,2})[:.](\d{2})(?:[:.\s](\d{2}))?\b/g;
  for (const match of rawText.matchAll(dateTimeRegex)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = match[6] !== undefined ? Number(match[6]) : undefined;
    addCandidate(day, month, year, hour, minute, second);
  }

  // 2. DD/MM/YYYY HHmmss (6 digits when colons were dropped by low-res JPEG OCR)
  const compactTimeRegex =
    /\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})\s+(\d{2})(\d{2})(\d{2})\b/g;
  for (const match of rawText.matchAll(compactTimeRegex)) {
    addCandidate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    );
  }

  // 3. Date-only fallback (DD/MM/YYYY)
  const dateOnlyRegex = /\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})\b/g;
  for (const match of rawText.matchAll(dateOnlyRegex)) {
    addCandidate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  return results;
}

export function pickLatestTimestamp(
  candidates: ParsedTimestamp[]
): ParsedTimestamp | null {
  if (candidates.length === 0) return null;

  // Prefer entries that include time (precision >= 2) over date-only entries
  const withTime = candidates.filter((c) => c.precision >= 2);
  const pool = withTime.length > 0 ? withTime : candidates;

  const sorted = [...pool].sort((a, b) => {
    if (b.epochMs !== a.epochMs) return b.epochMs - a.epochMs;
    return b.precision - a.precision;
  });

  return sorted[0] ?? null;
}
