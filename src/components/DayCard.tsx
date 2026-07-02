import type { Entry, EntryStatus } from '../db/types';
import { useTranslation } from 'react-i18next';
import { db } from '../db/database';
import { EntryForm } from './EntryForm';
import { StatusBadge } from './StatusBadge';
import { hhmmToMinutes, minutesToHHMM } from '../lib/format';
import { useState } from 'react';
import clsx from 'clsx';
import { formatDateLong } from '../lib/dates';
import type { AppSettings } from '../db/types';

interface Props {
  date: string;
  weekdayKey: keyof AppSettings['dayTargets'];
  entries: Entry[];
  targetMinutes: number;
  language: 'de' | 'en';
  onChange: () => void;
}

function dayStatus(entries: Entry[]): EntryStatus {
  if (entries.length === 0) return 'planned';
  // Priorität: explizite Tages-Status-Markierung (sick/vacation/...) wenn vorhanden
  // Wir verwenden hier den Status des ersten Eintrags als Tagesstatus, weil
  // krank/urlaub/frei typischerweise als "der Tag ist X" gesetzt werden.
  return entries[0].status;
}

export function DayCard({ date, weekdayKey, entries, targetMinutes, language, onChange }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const status = dayStatus(entries);
  const isMarked = ['sick', 'vacation', 'free', 'halfday', 'manual'].includes(status);

  const actualMinutes = entries
    .filter((e) => e.status !== 'planned')
    .reduce(
      (sum, e) => sum + (hhmmToMinutes(e.toTime) - hhmmToMinutes(e.fromTime) - (e.breakMinutes || 0)),
      0,
    );

  // Hintergrundfarbe nach Excel-Logik
  const bgClass = clsx({
    'bg-yellow-300':           status === 'planned' && entries.length > 0,
    'bg-white':                status === 'entered',
    'bg-yellow-100':           status === 'halfday',
    'bg-red-200':              status === 'sick',
    'bg-blue-200':             status === 'vacation',
    'bg-slate-200':            status === 'free',
    'bg-violet-200':           status === 'manual',
  });

  return (
    <div className={clsx('rounded-2xl border border-slate-200 shadow-sm overflow-hidden', bgClass)}>
      <div className="flex items-center justify-between px-3 pt-3">
        <div>
          <div className="text-xs uppercase tracking-wide font-semibold text-slate-700">
            {t(`day.${weekdayKey}`)}
          </div>
          <div className="text-sm text-slate-700">
            {formatDateLong(date, language)}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="px-3 py-2 space-y-1">
        {entries.length === 0 && (
          <div className="text-sm text-slate-500 italic">{t('noEntries')}</div>
        )}
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} onChange={onChange} />
        ))}
      </div>

      <div className="px-3 pb-3 pt-1 flex items-end justify-between">
        <div className="text-xs text-slate-600 font-mono space-x-3">
          <span>
            {t('actual')}: <b>{minutesToHHMM(actualMinutes)}</b>
          </span>
          <span>
            {t('target')}: <b>{minutesToHHMM(targetMinutes)}</b>
          </span>
          <span
            className={
              actualMinutes >= targetMinutes ? 'text-emerald-700' : 'text-red-700'
            }
          >
            Δ {minutesToHHMM(actualMinutes - targetMinutes)}
          </span>
        </div>
        {!isMarked && (
          <button onClick={() => setEditing(true)} className="btn btn-primary text-xs px-2 py-1">
            + {t('addEntry')}
          </button>
        )}
      </div>

      {editing && (
        <EntryForm
          date={date}
          existing={entries}
          onClose={() => setEditing(false)}
          onSaved={onChange}
        />
      )}
    </div>
  );
}

function EntryRow({ entry, onChange }: { entry: Entry; onChange: () => void }) {
  const { t } = useTranslation();
  const isPlanned = entry.status === 'planned';

  async function promoteToEntered() {
    await db.entries.update(entry.id!, {
      status: 'entered',
      updatedAt: Date.now(),
    });
    onChange();
  }

  async function remove() {
    if (!confirm(t('msg.confirmDelete'))) return;
    await db.entries.delete(entry.id!);
    onChange();
  }

  return (
    <div className="flex items-center justify-between bg-white/70 rounded-xl px-2 py-1">
      <div className="text-sm font-mono">
        {entry.fromTime}–{entry.toTime}
        {entry.breakMinutes ? (
          <span className="text-slate-500"> · {t('break')} {entry.breakMinutes}m</span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {isPlanned && (
          <button
            onClick={promoteToEntered}
            className="text-xs px-2 py-0.5 rounded-md bg-slate-900 text-white"
            title="als real markieren"
          >
            ✓
          </button>
        )}
        <button
          onClick={remove}
          className="text-xs px-2 py-0.5 rounded-md bg-red-500 text-white"
          title={t('delete')}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
