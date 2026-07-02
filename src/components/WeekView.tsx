import { db } from '../db/database';
import type { Entry, AppSettings } from '../db/types';
import { weekRange, weekdayKey } from '../lib/dates';
import { DayCard } from './DayCard';
import { useTranslation } from 'react-i18next';
import { minutesToHHMM } from '../lib/format';
import { addDays } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';

interface Props {
  reference: Date;
  onReferenceChange: (d: Date) => void;
}

export function WeekView({ reference, onReferenceChange }: Props) {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('app'), []);
  const range = weekRange(reference);

  // Entries der Woche
  const entries = useLiveQuery(
    async () => {
      const start = range.days[0];
      const end = addDays(range.days[range.days.length - 1], 1);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      return db.entries.where('date').between(startStr, endStr, false, true).toArray();
    },
    [reference],
  ) ?? [];

  if (!settings) {
    return <div className="p-4 text-slate-500">…</div>;
  }

  // Gruppe pro Tag
  const days = range.days.map((d) => {
    const dateStr = d.toISOString().slice(0, 10);
    const dayEntries = (entries as Entry[])
      .filter((e) => e.date === dateStr)
      .sort((a, b) => a.order - b.order);
    return {
      date: dateStr,
      weekday: weekdayKey(d),
      entries: dayEntries,
    };
  });

  const weekActual = days.reduce((sum, d) => {
    return (
      sum +
      d.entries
        .filter((e) => e.status !== 'planned')
        .reduce(
          (a, e) =>
            a +
            ((parseInt(e.toTime.split(':')[0]) * 60 + parseInt(e.toTime.split(':')[1])) -
              (parseInt(e.fromTime.split(':')[0]) * 60 + parseInt(e.fromTime.split(':')[1])) -
              (e.breakMinutes || 0)),
          0,
        )
    );
  }, 0);

  const weekTarget = days.reduce(
    (sum, d) => sum + (settings.dayTargets[d.weekday] ?? 0),
    0,
  );

  async function applyDefaults() {
    const defaultsByDay: Record<string, Array<{ fromTime: string; toTime: string; breakMinutes: number }>> = {
      Mon: [
        { fromTime: '08:00', toTime: '11:50', breakMinutes: 30 },
        { fromTime: '12:20', toTime: '17:00', breakMinutes: 0 },
      ],
      Tue: [
        { fromTime: '08:00', toTime: '11:50', breakMinutes: 30 },
        { fromTime: '12:20', toTime: '17:00', breakMinutes: 0 },
      ],
      Wed: [
        { fromTime: '08:00', toTime: '11:50', breakMinutes: 30 },
        { fromTime: '12:20', toTime: '17:00', breakMinutes: 0 },
      ],
      Thu: [
        { fromTime: '08:00', toTime: '11:50', breakMinutes: 30 },
        { fromTime: '12:20', toTime: '17:00', breakMinutes: 0 },
      ],
      Fri: [
        { fromTime: '08:00', toTime: '14:00', breakMinutes: 0 },
      ],
      Sat: [],
      Sun: [],
    };

    const now = Date.now();
    const toAdd: Entry[] = [];
    days.forEach((d) => {
      if (d.entries.length > 0) return;
      const blocks = defaultsByDay[d.weekday as string] ?? [];
      blocks.forEach((b, order) =>
        toAdd.push({
          date: d.date,
          order,
          fromTime: b.fromTime,
          toTime: b.toTime,
          breakMinutes: b.breakMinutes,
          status: 'planned',
          updatedAt: now,
        }),
      );
    });

    if (toAdd.length > 0) await db.entries.bulkAdd(toAdd);
  }

  return (
    <div className="space-y-3 p-3 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onReferenceChange(addDays(reference, -7))}
          className="btn btn-ghost"
        >
          ‹ {t('previousWeek')}
        </button>
        <button
          onClick={() => onReferenceChange(new Date())}
          className="btn btn-ghost"
        >
          {t('today')}
        </button>
        <button
          onClick={() => onReferenceChange(addDays(reference, 7))}
          className="btn btn-ghost"
        >
          {t('nextWeek')} ›
        </button>
      </div>

      <div className="text-center text-sm text-slate-500 font-mono">
        {range.iso} · Soll {minutesToHHMM(weekTarget)} · Ist{' '}
        <span className={weekActual >= weekTarget ? 'text-emerald-700' : 'text-red-700'}>
          {minutesToHHMM(weekActual)}
        </span>{' '}
        · Δ {minutesToHHMM(weekActual - weekTarget)}
      </div>

      <div className="space-y-2">
        {days.map((d) => (
          <DayCard
            key={d.date}
            date={d.date}
            weekdayKey={d.weekday as keyof AppSettings['dayTargets']}
            entries={d.entries}
            targetMinutes={settings.dayTargets[d.weekday as keyof AppSettings['dayTargets']] ?? 0}
            language={settings.language}
            onChange={() => void 0}
          />
        ))}
      </div>

      <button onClick={applyDefaults} className="btn btn-ghost w-full border border-dashed">
        {t('applyDefaults')}
      </button>
    </div>
  );
}

