import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { hhmmToMinutes, minutesToHHMM, minutesToTime } from '../lib/format';
import { addDays } from 'date-fns';
import { fromIsoDate, toIsoDate, weekdayKey } from '../lib/dates';
import type { AppSettings, DayState, DayStatus, Entry } from '../db/types';
import { DayCard } from '../components/DayCard';
import { DayListItem } from '../components/DayListItem';

const BLOCKING_STATUSES: DayStatus[] = ['free', 'vacation', 'sick', 'halfday'];

export function HomePage() {
  const { t } = useTranslation();
  const [periods, setPeriods] = useState(1);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const settings = useLiveQuery(() => db.settings.get('app'), []);
  const today = toIsoDate(new Date());

  const { startDate, dayDates } = useMemo(() => {
    const lookbackDays = settings?.lookbackDays ?? 14;
    const totalDays = lookbackDays * periods;
    const start = addDays(fromIsoDate(today), -(totalDays - 1));
    const dates: string[] = [];
    for (let i = totalDays - 1; i >= 0; i -= 1) {
      dates.push(toIsoDate(addDays(fromIsoDate(today), -i)));
    }
    return { startDate: toIsoDate(start), dayDates: dates.reverse() };
  }, [periods, settings?.lookbackDays, today]);

  const entries = useLiveQuery(
    () => db.entries.where('date').between(startDate, today, true, true).toArray(),
    [startDate, today],
  ) ?? [];

  const dayStates = useLiveQuery(
    () => db.dayState.where('date').between(startDate, today, true, true).toArray(),
    [startDate, today],
  ) ?? [];

  const dayStateByDate = useMemo(() => {
    return new Map((dayStates as DayState[]).map((state) => [state.date, state]));
  }, [dayStates]);

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, Entry[]>();
    for (const entry of entries as Entry[]) {
      const list = grouped.get(entry.date) ?? [];
      list.push(entry);
      grouped.set(entry.date, list);
    }
    for (const list of grouped.values()) list.sort((a, b) => a.order - b.order);
    return grouped;
  }, [entries]);

  useEffect(() => {
    if (!settings) return;
    const activeSettings = settings;

    let cancelled = false;
    async function seedDefaults() {
      for (const date of dayDates) {
        if (cancelled) return;
        const day = weekdayKey(fromIsoDate(date));
        const blocks = activeSettings.defaultBlocks[day] ?? [];
        if (blocks.length === 0 || (activeSettings.dayTargets[day] ?? 0) === 0) continue;
        if (entriesByDate.get(date)?.length) continue;
        const existingState = dayStateByDate.get(date);
        if (existingState && BLOCKING_STATUSES.includes(existingState.status)) continue;

        const existingCount = await db.entries.where('date').equals(date).count();
        if (existingCount > 0) continue;
        const now = Date.now();
        await db.transaction('rw', db.entries, db.dayState, async () => {
          await db.dayState.put({ date, status: existingState?.status ?? 'planned', updatedAt: now });
          await db.entries.bulkAdd(blocks.map((block, order) => ({
            date,
            order,
            fromTime: block.from,
            toTime: block.to,
            updatedAt: now,
          })));
        });
      }
    }

    void seedDefaults();
    return () => {
      cancelled = true;
    };
  }, [dayDates, dayStateByDate, entriesByDate, settings]);

  if (!settings) {
    return <div className="p-4 text-[var(--text-muted)]">…</div>;
  }
  const activeSettings = settings;

  function statusFor(date: string): DayStatus {
    return dayStateByDate.get(date)?.status ?? 'planned';
  }

  function targetFor(date: string): number {
    return activeSettings.dayTargets[weekdayKey(fromIsoDate(date))] ?? 0;
  }

  function isVisible(date: string): boolean {
    return activeSettings.showWeekend || targetFor(date) > 0 || Boolean(entriesByDate.get(date)?.length);
  }

  async function setStatus(date: string, status: DayStatus) {
    await db.dayState.put({ date, status, updatedAt: Date.now() });
  }

  async function promoteIfPlanned(date: string) {
    if (statusFor(date) === 'planned') await setStatus(date, 'worked');
  }

  async function addBlock(date: string) {
    const dayEntries = entriesByDate.get(date) ?? [];
    const last = dayEntries.at(-1);
    const fromTime = last?.toTime ?? '08:00';
    const toTime = minutesToTime(hhmmToMinutes(fromTime) + 60);
    const now = Date.now();
    await db.transaction('rw', db.entries, db.dayState, async () => {
      await db.entries.add({
        date,
        order: dayEntries.length,
        fromTime,
        toTime,
        updatedAt: now,
      });
      if (statusFor(date) === 'planned') {
        await db.dayState.put({ date, status: 'worked', updatedAt: now });
      }
    });
  }

  async function updateBlock(date: string, id: number, changes: Pick<Entry, 'fromTime'> | Pick<Entry, 'toTime'>) {
    await db.entries.update(id, { ...changes, updatedAt: Date.now() });
    await promoteIfPlanned(date);
  }

  async function deleteBlock(id: number) {
    await db.entries.delete(id);
  }

  function renderCard(date: string, variant: 'today' | 'past') {
    return (
      <DayCard
        key={`${date}-card`}
        date={date}
        entries={entriesByDate.get(date) ?? []}
        status={statusFor(date)}
        targetMinutes={targetFor(date)}
        language={activeSettings.language}
        variant={variant}
        onAddBlock={() => void addBlock(date)}
        onDeleteBlock={(id) => void deleteBlock(id)}
        onUpdateBlock={(id, changes) => void updateBlock(date, id, changes)}
        onStatusChange={(status) => void setStatus(date, status)}
        onPromote={() => void setStatus(date, 'worked')}
      />
    );
  }

  const visibleDates = dayDates.filter(isVisible);
  const pastDates = visibleDates.filter((date) => date !== today);
  const balance = activeSettings.overtimeBalanceMinutes;

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-page)]/95 backdrop-blur">
        <div className="max-w-xl mx-auto px-3 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t('appName')}</h1>
          <div className={balance < 0 ? 'text-xs font-mono text-red-600 dark:text-red-300' : 'text-xs font-mono text-[var(--text-muted)]'}>
            {t('balance')}: {minutesToHHMM(balance)}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-3 p-3">
        {renderCard(today, 'today')}

        <div className="space-y-2">
          {pastDates.map((date) => {
            const expanded = expandedDates.has(date);
            return (
              <div key={date} className="space-y-2">
                <DayListItem
                  date={date}
                  status={statusFor(date)}
                  language={activeSettings.language}
                  expanded={expanded}
                  onClick={() => {
                    setExpandedDates((current) => {
                      const next = new Set(current);
                      if (next.has(date)) next.delete(date);
                      else next.add(date);
                      return next;
                    });
                  }}
                />
                {expanded && renderCard(date, 'past')}
              </div>
            );
          })}
        </div>

        {!activeSettings.showWeekend && (
          <button
            type="button"
            onClick={() => void db.settings.update('app', { showWeekend: true } satisfies Partial<AppSettings>)}
            className="btn btn-ghost w-full border border-dashed border-[var(--border)]"
          >
            + {t('showWeekend')}
          </button>
        )}

        <button
          type="button"
          onClick={() => setPeriods((value) => value + 1)}
          className="btn btn-ghost w-full border border-[var(--border)]"
        >
          {t('loadOlderDays')}
        </button>
      </div>
    </div>
  );
}
