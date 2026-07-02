import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  parseISO,
  getISOWeek,
  getYear,
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';

export function toIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromIsoDate(iso: string): Date {
  return parseISO(iso);
}

export interface WeekRange {
  start: Date;
  end: Date;
  iso: string;
  days: Date[]; // Mo–Fr
}

export function weekRange(reference: Date): WeekRange {
  const start = startOfWeek(reference, { weekStartsOn: 1 });
  const end = endOfWeek(reference, { weekStartsOn: 1 });
  const iso = `${getYear(start)}-W${String(getISOWeek(start)).padStart(2, '0')}`;
  const days: Date[] = [];
  for (let i = 0; i < 5; i++) days.push(addDays(start, i));
  return { start, end, iso, days };
}

export function formatDateLong(date: Date | string, lang: 'de' | 'en'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (lang === 'de') return format(d, 'EEE, dd. MMM yyyy', { locale: de });
  return format(d, 'EEE, MMM dd, yyyy', { locale: enUS });
}

export function formatWeekHeader(start: Date, lang: 'de' | 'en'): string {
  const end = addDays(start, 4);
  if (lang === 'de') {
    return `${format(start, 'dd. MMM', { locale: de })} – ${format(end, 'dd. MMM yyyy', { locale: de })}`;
  }
  return `${format(start, 'MMM dd', { locale: enUS })} – ${format(end, 'MMM dd, yyyy', { locale: enUS })}`;
}

export function weekdayKey(date: Date): keyof import('../db/types').DayTargets {
  // date-fns: 0 = Sunday, 1 = Monday, …
  const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  return map[date.getDay()];
}
