import * as XLSX from 'xlsx';
import type { DayStatus } from '../db/types';

export interface ImportedDay {
  date: string;
  status: DayStatus;
  entries: Array<{ fromTime: string; toTime: string }>;
}

const HEADER_SKIP_TOKENS = ['neuzählen', 'für die firma', 'gesamt', 'wochentag', 'von', 'woche'];

export function parseExcelFile(buffer: ArrayBuffer): ImportedDay[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false, raw: true });
  const parsedDays: ImportedDay[] = [];
  console.log('[Import] Starting parse, sheets:', workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;

    const year = extractYear(sheetName);
    const range = XLSX.utils.decode_range(sheet['!ref']);
    console.log('[Import] Sheet:', sheetName, 'year:', year, 'rows:', range.e.r - range.s.r + 1);
    if (year === null) continue;

    let currentDay: ImportedDay | null = null;

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const cellD = readCell(sheet, row, 3);

      // Column D contains Excel date serial numbers for day-header rows
      if (cellD && cellD.t === 'n' && typeof cellD.v === 'number' && cellD.v > 100 && cellD.v < 100_000) {
        const dateStr = serialToDateString(cellD.v);

        // Each day has 3 header rows with the same serial — only start new day when date changes
        if (currentDay === null || currentDay.date !== dateStr) {
          if (currentDay) parsedDays.push(finalizeDay(currentDay));
          currentDay = { date: dateStr, status: 'imported', entries: [] };
          console.log('[Import] Day found:', dateStr);
        }
        continue; // date-header rows never contain Von/Bis
      }

      if (!currentDay) continue;

      const scanText = [0, 1, 2, 3]
        .map((column) => readCellText(sheet, row, column))
        .filter(Boolean)
        .join(' ');
      if (shouldSkipRow(scanText)) continue;

      const statusText = readCellText(sheet, row, 10);
      if (statusText) {
        const mapped = mapStatus(statusText);
        if (currentDay.status === 'imported' || mapped !== 'imported') {
          currentDay.status = mapped;
        }
      }

      const fromTime = parseTimeCell(sheet, row, 4);
      const toTime = parseTimeCell(sheet, row, 5);
      if (fromTime && toTime) {
        console.log('[Import] Block:', fromTime, '-', toTime);
        currentDay.entries.push({ fromTime, toTime });
      }
    }

    if (currentDay) parsedDays.push(finalizeDay(currentDay));
  }

  console.log('[Import] Total days parsed:', parsedDays.length);
  return mergeDuplicateDays(parsedDays).sort((a, b) => a.date.localeCompare(b.date));
}

function serialToDateString(serial: number): string {
  // Excel epoch: Dec 30, 1899 (compensates for Excel's fake Feb 29, 1900 bug)
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  if (typeof cell.h === 'string' && cell.h.trim()) return cell.h.trim();
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
