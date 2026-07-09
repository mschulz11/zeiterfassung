import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { addDays, startOfYear } from 'date-fns';
import { db } from '../db/database';
import type { AppSettings, DayState, DayStatus, Entry } from '../db/types';
import { DayCard } from '../components/DayCard';
import { DayListItem } from '../components/DayListItem';
import { actualMinutesForStatus, deltaMinutesForDay, effectiveTargetMinutes, targetMinutesForDate } from '../lib/dayTotals';
import { hhmmToMinutes, minutesToHHMM, minutesToTime } from '../lib/format';
import { fromIsoDate, toIsoDate, weekdayKey } from '../lib/dates';

const BLOCKING_STATUSES: DayStatus[] = ['free', 'vacation', 'sick', 'halfday', 'imported'];

export function HomePage() {
  const { t } = useTranslation();
  const [periods, setPeriods] = useState(1);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const settings = useLiveQuery(() => db.settings.get('app'), []);
  const today = toIsoDate(new Date());
  const yearStart = toIsoDate(startOfYear(new Date()));

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

  const yearEntries = useLiveQuery(
    () => db.entries.where('date').between(yearStart, today, true, true).toArray(),
    [yearStart, today],
  ) ?? [];

  const yearDayStates = useLiveQuery(
    () => db.dayState.where('date').between(yearStart, today, true, true).toArray(),
    [yearStart, today],
  ) ?? [];

  const balanceStartDate = settings?.balanceStartDate ?? null;

  const balanceEntries = useLiveQuery(
    () => (
      balanceStartDate
        ? db.entries.where('date').between(balanceStartDate, today, true, true).toArray()
        : []
    ),
    [balanceStartDate, today],
  ) ?? [];

  const balanceDayStates = useLiveQuery(
    () => (
      balanceStartDate
        ? db.dayState.where('date').between(balanceStartDate, today, true, true).toArray()
        : []
    ),
    [balanceStartDate, today],
  ) ?? [];

  const dayStateByDate = useMemo(() => new Map((dayStates as DayState[]).map((state) => [state.date, state])), [dayStates]);
  const yearDayStateByDate = useMemo(() => new Map((yearDayStates as DayState[]).map((state) => [state.date, state])), [yearDayStates]);
  const balanceDayStateByDate = useMemo(
    () => new Map((balanceDayStates as DayState[]).map((state) => [state.date, state])),
    [balanceDayStates],
  );

  const entriesByDate = useMemo(() => groupEntriesByDate(entries as Entry[]), [entries]);
  const yearEntriesByDate = useMemo(() => groupEntriesByDate(yearEntries as Entry[]), [yearEntries]);
  const balanceEntriesByDate = useMemo(() => groupEntriesByDate(balanceEntries as Entry[]), [balanceEntries]);

  useEffect(() => {
    if (!settings) return;
    const activeSettings = settings;

    let cancelled = false;
    async function seedDefaults() {
      for (const date of dayDates) {
        if (cancelled) return;
        const day = weekdayKey(fromIsoDate(date));
        const blocks = activeSettings.defaultBlocks[day] ?? [];

        if ((day === 'Sat' || day === 'Sun') && !dayStateByDate.get(date)) {
          await db.dayState.put({ date, status: 'free', updatedAt: Date.now() });
          continue;
        }
        if (blocks.length === 0 || targetMinutesForDate(date, activeSettings) === 0) continue;
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

  const activeSettings = settings ?? null;

  function statusFor(date: string): DayStatus {
    const day = weekdayKey(fromIsoDate(date));
    if (!dayStateByDate.get(date) && (day === 'Sat' || day === 'Sun')) return 'free';
    return dayStateByDate.get(date)?.status ?? 'planned';
  }

  function targetFor(date: string): number {
    return targetMinutesForDate(date, activeSettings!);
  }

  function isVisible(date: string): boolean {
    const day = weekdayKey(fromIsoDate(date));
    const weekend = day === 'Sat' || day === 'Sun';
    return activeSettings!.showWeekend || !weekend || Boolean(entriesByDate.get(date)?.length);
  }

  async function setStatus(date: string, status: DayStatus) {
    await db.dayState.put({ date, status, updatedAt: Date.now() });
  }

  async function setBalanceStart(date: string) {
    const currentGesamtsaldo = cumulativeBalanceByDate.get(today) ?? 0;
    const currentGift = activeSettings!.balanceGiftMinutes ?? 0;
    await db.settings.update('app', {
      balanceStartDate: date,
      balanceGiftMinutes: currentGift + currentGesamtsaldo,
    } satisfies Partial<AppSettings>);
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

  const { cumulativeBalanceByDate, gesamtIst, gesamtSoll } = useMemo(() => {
    const cumulative = new Map<string, number>();
    if (!activeSettings || !balanceStartDate) return { cumulativeBalanceByDate: cumulative, gesamtIst: 0, gesamtSoll: 0 };

    let sum = 0, ist = 0, soll = 0;
    for (let cursor = fromIsoDate(balanceStartDate); toIsoDate(cursor) <= today; cursor = addDays(cursor, 1)) {
      const date = toIsoDate(cursor);
      const status = balanceDayStateByDate.get(date)?.status
        ?? (['Sat', 'Sun'].includes(weekdayKey(fromIsoDate(date))) ? 'free' : 'planned');
      const dayEntries = balanceEntriesByDate.get(date) ?? [];
      ist += actualMinutesForStatus(dayEntries, status);
      soll += effectiveTargetMinutes(date, status, activeSettings);
      sum += deltaMinutesForDay(date, dayEntries, status, activeSettings);
      cumulative.set(date, sum);
    }

    return { cumulativeBalanceByDate: cumulative, gesamtIst: ist, gesamtSoll: soll };
  }, [activeSettings, balanceDayStateByDate, balanceEntriesByDate, balanceStartDate, today]);

  if (!activeSettings) {
    return <div className="p-4 text-[var(--text-muted)]">…</div>;
  }

  function renderCard(date: string, variant: 'today' | 'past') {
    return (
      <DayCard
        key={`${date}-card`}
        date={date}
        entries={entriesByDate.get(date) ?? []}
        status={statusFor(date)}
        targetMinutes={targetFor(date)}
        language={activeSettings!.language}
        variant={variant}
        onAddBlock={() => void addBlock(date)}
        onDeleteBlock={(id) => void deleteBlock(id)}
        onUpdateBlock={(id, changes) => void updateBlock(date, id, changes)}
        onStatusChange={(status) => void setStatus(date, status)}
        onPromote={() => void setStatus(date, 'worked')}
        onSetBalanceStart={() => void setBalanceStart(date)}
        isBalanceStart={date === activeSettings!.balanceStartDate}
      />
    );
  }

  const visibleDates = dayDates.filter(isVisible);
  const pastDates = visibleDates.filter((date) => date !== today);

  const { balance: periodDelta, periodIst, periodSoll } = visibleDates.reduce(
    (acc, date) => {
      const status = statusFor(date);
      const dayEntries = entriesByDate.get(date) ?? [];
      return {
        balance: acc.balance + deltaMinutesForDay(date, dayEntries, status, activeSettings),
        periodIst: acc.periodIst + actualMinutesForStatus(dayEntries, status),
        periodSoll: acc.periodSoll + effectiveTargetMinutes(date, status, activeSettings),
      };
    },
    { balance: 0, periodIst: 0, periodSoll: 0 },
  );

  const { yearBalance, yearIst, yearSoll } = (() => {
    let delta = 0, ist = 0, soll = 0;
    for (let cursor = fromIsoDate(yearStart); toIsoDate(cursor) <= today; cursor = addDays(cursor, 1)) {
      const date = toIsoDate(cursor);
      const state = yearDayStateByDate.get(date)?.status
        ?? (['Sat', 'Sun'].includes(weekdayKey(fromIsoDate(date))) ? 'free' : 'planned');
      const dayEntries = yearEntriesByDate.get(date) ?? [];
      ist += actualMinutesForStatus(dayEntries, state);
      soll += effectiveTargetMinutes(date, state, activeSettings);
      delta += deltaMinutesForDay(date, dayEntries, state, activeSettings);
    }
    return { yearBalance: delta, yearIst: ist, yearSoll: soll };
  })();

  const gesamtDelta = cumulativeBalanceByDate.get(today) ?? 0;

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-page)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-3 py-3">
          <h1 className="text-lg font-semibold shrink-0">{t('appName')}</h1>
          <div className="grid grid-cols-[auto_auto_auto_auto] gap-x-3 gap-y-0 text-right text-xs font-mono overflow-hidden">
            <div className="text-left text-[var(--text-muted)]"></div>
            <div className="text-[var(--text-muted)]">{t('actual')}</div>
            <div className="text-[var(--text-muted)]">{t('target')}</div>
            <div className="text-[var(--text-muted)]">Δ</div>
            <BalanceRow label={t('period')} ist={periodIst} soll={periodSoll} delta={periodDelta} />
            <BalanceRow label={t('year')} ist={yearIst} soll={yearSoll} delta={yearBalance} />
            {balanceStartDate && <>
              <BalanceRow label={t('overallTotal')} ist={gesamtIst} soll={gesamtSoll} delta={gesamtDelta} />
              <div className="text-left text-[var(--text-muted)]">{t('gifted')}</div>
              <div className="col-span-2 text-[var(--text-muted)]">{minutesToHHMM(activeSettings.balanceGiftMinutes)}</div>
              <div></div>
            </>}
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
                  targetMinutes={effectiveTargetMinutes(date, statusFor(date), activeSettings)}
                  actualMinutes={actualMinutesForStatus(entriesByDate.get(date) ?? [], statusFor(date))}
                  deltaMinutes={deltaMinutesForDay(date, entriesByDate.get(date) ?? [], statusFor(date), activeSettings)}
                  cumulativeBalance={cumulativeBalanceByDate.get(date)}
                  isBalanceStart={date === activeSettings.balanceStartDate}
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

        <button
          type="button"
          onClick={() => void db.settings.update('app', { showWeekend: !activeSettings.showWeekend } satisfies Partial<AppSettings>)}
          className="btn btn-ghost w-full border border-dashed border-[var(--border)]"
        >
          {activeSettings.showWeekend ? t('hideWeekend') : `+ ${t('showWeekend')}`}
        </button>

        <button
          type="button"
          onClick={() => setPeriods((value) => value + 1)}
          className="btn btn-ghost w-full border border-[var(--border)]"
        >
          {t('loadOlderDays')}
        </button>

        <button
          type="button"
          onClick={() => setPeriods((value) => Math.max(1, value - 1))}
          disabled={periods === 1}
          className="btn btn-ghost w-full border border-[var(--border)]"
        >
          {t('loadLessDays')}
        </button>
      </div>
    </div>
  );
}

function BalanceRow({ label, ist, soll, delta }: { label: string; ist: number; soll: number; delta: number }) {
  const deltaColor = delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
  return (
    <>
      <div className="text-left text-[var(--text-muted)]">{label}</div>
      <div>{minutesToHHMM(ist)}</div>
      <div>{minutesToHHMM(soll)}</div>
      <div className={deltaColor}>{minutesToHHMM(delta)}</div>
    </>
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
