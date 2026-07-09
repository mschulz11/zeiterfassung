import type { AppSettings, DayStatus, Entry, TimeBlock } from '../db/types';
import { entriesDurationMinutes, hhmmToMinutes } from './format';
import { fromIsoDate, weekdayKey } from './dates';

export function targetMinutesForDate(date: string, settings: AppSettings): number {
  const day = weekdayKey(fromIsoDate(date));
  if (day === 'Sat' || day === 'Sun') return 0;
  return Math.round(settings.weeklyTargetMinutes / 5);
}

export function effectiveTargetMinutes(date: string, status: DayStatus, settings: AppSettings): number {
  if (status === 'halfday') return Math.round(targetMinutesForDate(date, settings) / 2);
  if (status === 'free' || status === 'vacation' || status === 'sick') return 0;
  return targetMinutesForDate(date, settings);
}

export function actualMinutesForStatus(entries: Entry[], status: DayStatus): number {
  if (status === 'planned' || status === 'free' || status === 'vacation' || status === 'sick') return 0;
  return entriesDurationMinutes(entries);
}

export function deltaMinutesForDay(date: string, entries: Entry[], status: DayStatus, settings: AppSettings): number {
  return actualMinutesForStatus(entries, status) - effectiveTargetMinutes(date, status, settings);
}

export function defaultBlocksMinutes(blocks: TimeBlock[]): number {
  return blocks.reduce((sum, block) => sum + Math.max(0, hhmmToMinutes(block.to) - hhmmToMinutes(block.from)), 0);
}
