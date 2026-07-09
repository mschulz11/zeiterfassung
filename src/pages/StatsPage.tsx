import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getISOWeek,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { db } from '../db/database';
import type { DayState, DayStatus, Entry } from '../db/types';
import { StatusBadge } from '../components/StatusBadge';
import { actualMinutesForStatus, deltaMinutesForDay, effectiveTargetMinutes } from '../lib/dayTotals';
import { fromIsoDate, toIsoDate, weekdayKey } from '../lib/dates';
import { minutesToHHMM } from '../lib/format';

type PeriodType = 'week' | 'month' | 'year';

interface DayRowData {
  date: string;
  status: DayStatus;
  actualMinutes: number;
  targetMinutes: number;
  deltaMinutes: number;
}

interface MonthRowData {
  label: string;
  actualMinutes: number;
  targetMinutes: number;
  deltaMinutes: number;
}

export function StatsPage() {
  const { t } = useTranslation();
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [offset, setOffset] = useState(0);
  const settings = useLiveQuery(() => db.settings.get('app'), []);

  const locale = settings?.language === 'de' ? de : enUS;
  const periodRange = useMemo(() => {
    const now = new Date();
    if (periodType === 'week') {
      const reference = addWeeks(now, -offset);
      const start = startOfWeek(reference, { weekStartsOn: 1 });
      const end = endOfWeek(reference, { weekStartsOn: 1 });
      return {
        start,
        end,
        label: `${t('stats.kw')} ${getISOWeek(start)} · ${format(start, 'dd.MM')} – ${format(end, 'dd.MM.yyyy')}`,
      };
    }

    if (periodType === 'month') {
      const reference = addMonths(now, -offset);
      const start = startOfMonth(reference);
      const end = endOfMonth(reference);
      return {
        start,
        end,
        label: format(start, 'MMMM yyyy', { locale }),
      };
    }

    const reference = addYears(now, -offset);
    const start = startOfYear(reference);
    const end = endOfYear(reference);
    return {
      start,
      end,
      label: format(start, 'yyyy'),
    };
  }, [locale, offset, periodType, t]);

  const startIso = toIsoDate(periodRange.start);
  const endIso = toIsoDate(periodRange.end);

  const entries = useLiveQuery(
    () => db.entries.where('date').between(startIso, endIso, true, true).toArray(),
    [startIso, endIso],
  ) ?? [];

  const dayStates = useLiveQuery(
    () => db.dayState.where('date').between(startIso, endIso, true, true).toArray(),
    [startIso, endIso],
  ) ?? [];

  const entriesByDate = useMemo(() => groupEntriesByDate(entries as Entry[]), [entries]);
  const dayStateByDate = useMemo(() => new Map((dayStates as DayState[]).map((state) => [state.date, state])), [dayStates]);

  if (!settings) {
    return <div className="p-4 text-[var(--text-muted)]">…</div>;
  }

  function statusFor(date: string): DayStatus {
    const weekday = weekdayKey(fromIsoDate(date));
    if (!dayStateByDate.get(date) && (weekday === 'Sat' || weekday === 'Sun')) return 'free';
    return dayStateByDate.get(date)?.status ?? 'planned';
  }

  const dayRows = useMemo(() => {
    if (!settings) return [];

    const rows: DayRowData[] = [];
    for (let cursor = periodRange.start; toIsoDate(cursor) <= endIso; cursor = addDays(cursor, 1)) {
      const date = toIsoDate(cursor);
      const status = statusFor(date);
      rows.push({
        date,
        status,
        actualMinutes: actualMinutesForStatus(entriesByDate.get(date) ?? [], status),
        targetMinutes: effectiveTargetMinutes(date, status, settings),
        deltaMinutes: deltaMinutesForDay(date, entriesByDate.get(date) ?? [], status, settings),
      });
    }
    return rows;
  }, [dayStateByDate, endIso, entriesByDate, periodRange.start, settings]);

  const monthRows = useMemo(() => {
    if (!settings || periodType !== 'year') return [];

    const rows: MonthRowData[] = [];
    for (let index = 0; index < 12; index += 1) {
      const monthStart = startOfMonth(addMonths(periodRange.start, index));
      const monthEnd = endOfMonth(monthStart);
      let actualMinutes = 0;
      let targetMinutes = 0;
      let deltaMinutes = 0;

      for (let cursor = monthStart; toIsoDate(cursor) <= toIsoDate(monthEnd); cursor = addDays(cursor, 1)) {
        const date = toIsoDate(cursor);
        const status = statusFor(date);
        actualMinutes += actualMinutesForStatus(entriesByDate.get(date) ?? [], status);
        targetMinutes += effectiveTargetMinutes(date, status, settings);
        deltaMinutes += deltaMinutesForDay(date, entriesByDate.get(date) ?? [], status, settings);
      }

      rows.push({
        label: format(monthStart, 'MMMM yyyy', { locale }),
        actualMinutes,
        targetMinutes,
        deltaMinutes,
      });
    }
    return rows;
  }, [dayStateByDate, entriesByDate, locale, periodRange.start, periodType, settings]);

  const summary = useMemo(() => {
    const source = periodType === 'year' ? monthRows : dayRows;
    return source.reduce(
      (totals, row) => ({
        actualMinutes: totals.actualMinutes + row.actualMinutes,
        targetMinutes: totals.targetMinutes + row.targetMinutes,
        deltaMinutes: totals.deltaMinutes + row.deltaMinutes,
      }),
      { actualMinutes: 0, targetMinutes: 0, deltaMinutes: 0 },
    );
  }, [dayRows, monthRows, periodType]);

  const canGoNext = offset > 0;

  return (
    <div className="mx-auto max-w-xl space-y-4 p-3">
      <header className="space-y-3">
        <h1 className="text-lg font-semibold">{t('stats')}</h1>
        <div className="grid grid-cols-3 gap-2">
          {(['week', 'month', 'year'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setPeriodType(type);
                setOffset(0);
              }}
              className={`btn ${periodType === type ? 'btn-primary' : 'btn-ghost border border-[var(--border)]'}`}
            >
              {t(`stats.${type}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
          <button type="button" onClick={() => setOffset((value) => value + 1)} className="btn btn-ghost h-9 px-3">
            ‹
          </button>
          <div className="text-center text-sm font-medium text-[var(--text-primary)]">{periodRange.label}</div>
          <button
            type="button"
            onClick={() => setOffset((value) => Math.max(0, value - 1))}
            disabled={!canGoNext}
            className="btn btn-ghost h-9 px-3"
          >
            ›
          </button>
        </div>
      </header>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3 shadow-sm">
        <div className="space-y-1 text-sm font-mono">
          <div>{t('actual')}: {minutesToHHMM(summary.actualMinutes)}</div>
          <div>{t('target')}: {minutesToHHMM(summary.targetMinutes)}</div>
          <div className={summary.deltaMinutes < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}>
            {t('balance')}: {minutesToHHMM(summary.deltaMinutes)}
          </div>
        </div>
      </section>

      {periodType === 'year' ? (
        <div className="space-y-2">
          {monthRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--text-muted)]">
              {t('stats.noData')}
            </div>
          )}
          {monthRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[var(--text-primary)]">{row.label}</div>
              </div>
              <div className="text-right font-mono text-xs text-[var(--text-muted)]">
                <div>{t('actual')} {minutesToHHMM(row.actualMinutes)}</div>
                <div>{t('target')} {minutesToHHMM(row.targetMinutes)}</div>
                <div className={row.deltaMinutes < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}>
                  Δ {minutesToHHMM(row.deltaMinutes)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {dayRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--text-muted)]">
              {t('stats.noData')}
            </div>
          )}
          {dayRows.map((row) => (
            <StatsDayRow key={row.date} row={row} language={settings.language} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatsDayRow({ row, language }: { row: DayRowData; language: 'de' | 'en' }) {
  const { t } = useTranslation();
  const date = fromIsoDate(row.date);
  const weekday = weekdayKey(date);
  const dateLabel = language === 'de' ? format(date, 'dd.MM.yyyy') : format(date, 'MM/dd/yyyy');

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3">
      <div className="min-w-0 space-y-1">
        <div className="text-xs font-semibold uppercase text-[var(--text-muted)]">{t(`day.${weekday}`)}</div>
        <div className="truncate text-sm text-[var(--text-primary)]">{dateLabel}</div>
        <div className="font-mono text-xs text-[var(--text-muted)]">
          {t('actual')} {minutesToHHMM(row.actualMinutes)} · {t('target')} {minutesToHHMM(row.targetMinutes)} ·{' '}
          <span className={row.deltaMinutes < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}>
            Δ {minutesToHHMM(row.deltaMinutes)}
          </span>
        </div>
      </div>
      <StatusBadge status={row.status} />
    </div>
  );
}

function groupEntriesByDate(entries: Entry[]): Map<string, Entry[]> {
  const grouped = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.date) ?? [];
    list.push(entry);
    grouped.set(entry.date, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.order - b.order);
  }
  return grouped;
}
