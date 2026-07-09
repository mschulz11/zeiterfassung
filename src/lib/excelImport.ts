import * as XLSX from 'xlsx';
import type { DayStatus } from '../db/types';

export interface ImportedDay {
  date: string;
  status: DayStatus;
  entries: Array<{ fromTime: string; toTime: string }>;
}

const WEEKDAY_PATTERN = /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\b/i;
const HEADER_SKIP_TOKENS = ['neuzählen', 'für die firma', 'gesamt', 'wochentag', 'von', 'woche'];
const MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  marz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

export function parseExcelFile(buffer: ArrayBuffer): ImportedDay[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const parsedDays: ImportedDay[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const year = extractYear(sheetName);
    if (!sheet || !sheet['!ref'] || year === null) continue;

    const range = XLSX.utils.decode_range(sheet['!ref']);
    let currentDay: ImportedDay | null = null;

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const scanText = [0, 1, 2, 3]
        .map((column) => readCellText(sheet, row, column))
        .filter(Boolean)
        .join(' ');
      if (shouldSkipRow(scanText)) continue;

      const headerText = readCellText(sheet, row, 3);
      const dayDate = parseDateHeader(headerText, year);
      if (dayDate) {
        if (currentDay) parsedDays.push(finalizeDay(currentDay));
        currentDay = { date: dayDate, status: 'imported', entries: [] };
      }

      if (!currentDay) continue;

      const mappedStatus = mapStatus(readCellText(sheet, row, 10));
      if (currentDay.status === 'imported' || mappedStatus !== 'imported') {
        currentDay.status = mappedStatus;
      }

      const fromTime = parseTimeCell(sheet, row, 4);
      const toTime = parseTimeCell(sheet, row, 5);
      if (fromTime && toTime) {
        currentDay.entries.push({ fromTime, toTime });
      }
    }

    if (currentDay) parsedDays.push(finalizeDay(currentDay));
  }

  return mergeDuplicateDays(parsedDays).sort((a, b) => a.date.localeCompare(b.date));
}

function extractYear(sheetName: string): number | null {
  const match = sheetName.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function readCell(sheet: XLSX.WorkSheet, row: number, column: number): XLSX.CellObject | undefined {
  return sheet[XLSX.utils.encode_cell({ r: row, c: column })];
}

function readCellText(sheet: XLSX.WorkSheet, row: number, column: number): string {
  const cell = readCell(sheet, row, column);
  if (!cell) return '';
  if (typeof cell.w === 'string' && cell.w.trim()) return cell.w.trim();
  if (typeof cell.v === 'string' && cell.v.trim()) return cell.v.trim();
  if (typeof cell.v === 'number') return String(cell.v);
  return '';
}

function parseTimeCell(sheet: XLSX.WorkSheet, row: number, column: number): string | null {
  const cell = readCell(sheet, row, column);
  if (!cell) return null;

  const fromFormatted = normalizeTimeString(typeof cell.w === 'string' ? cell.w : '');
  if (fromFormatted) return fromFormatted;

  const fromRaw = normalizeTimeString(typeof cell.v === 'string' ? cell.v : '');
  if (fromRaw) return fromRaw;

  if (typeof cell.v === 'number') return excelNumberToTime(cell.v);
  return null;
}

function normalizeTimeString(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function excelNumberToTime(value: number): string {
  const fraction = ((value % 1) + 1) % 1;
  const totalMinutes = Math.round(fraction * 24 * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseDateHeader(value: string, year: number): string | null {
  if (!WEEKDAY_PATTERN.test(value)) return null;
  const match = value.match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = MONTHS[normalizeToken(match[2])];
  if (!month || Number.isNaN(day)) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shouldSkipRow(value: string): boolean {
  const normalized = normalizeToken(value);
  return HEADER_SKIP_TOKENS.some((token) => normalized.includes(normalizeToken(token)));
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function mapStatus(value: string): DayStatus {
  const normalized = normalizeToken(value);
  if (!normalized || normalized.includes('manuel')) return 'imported';
  if (normalized.startsWith('gepl')) return 'planned';
  if (normalized.includes('halbtags')) return 'halfday';
  if (normalized.includes('frei')) return 'free';
  if (normalized.includes('urlaub')) return 'vacation';
  if (normalized.includes('krank')) return 'sick';
  return 'imported';
}

function finalizeDay(day: ImportedDay): ImportedDay {
  return {
    ...day,
    entries: day.entries.filter((entry) => entry.fromTime !== entry.toTime),
  };
}

function mergeDuplicateDays(days: ImportedDay[]): ImportedDay[] {
  const merged = new Map<string, ImportedDay>();

  for (const day of days) {
    const existing = merged.get(day.date);
    if (!existing) {
      merged.set(day.date, { ...day, entries: [...day.entries] });
      continue;
    }

    existing.entries.push(...day.entries);
    if (existing.status === 'imported' && day.status !== 'imported') {
      existing.status = day.status;
    }
  }

  return Array.from(merged.values()).map((day) => finalizeDay(day));
}
