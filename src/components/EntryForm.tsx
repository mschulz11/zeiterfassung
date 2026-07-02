import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entry, EntryStatus } from '../db/types';
import { db } from '../db/database';
import { hhmmToMinutes, minutesToHHMM } from '../lib/format';
import { StatusPicker } from './StatusPicker';

interface Props {
  date: string;                 // YYYY-MM-DD
  existing: Entry[];            // bereits vorhandene Einträge des Tages
  onClose: () => void;
  onSaved: () => void;
}

export function EntryForm({ date, existing, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [fromTime, setFromTime] = useState('08:00');
  const [toTime, setToTime] = useState('12:00');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [status, setStatus] = useState<EntryStatus>(
    existing.length === 0 ? 'entered' : 'planned',
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const order = existing.length;
    await db.entries.add({
      date,
      order,
      fromTime,
      toTime,
      breakMinutes: Number(breakMinutes) || 0,
      status,
      updatedAt: Date.now(),
    });
    onSaved();
    onClose();
  }

  return (
    <form
      onSubmit={save}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-slate-900/40 p-2"
      role="dialog"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 space-y-3">
        <h3 className="text-lg font-semibold">{t('addEntry')}</h3>

        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{t('from')}</span>
            <input
              type="time"
              value={fromTime}
              onChange={(e) => setFromTime(e.target.value)}
              className="input"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{t('to')}</span>
            <input
              type="time"
              value={toTime}
              onChange={(e) => setToTime(e.target.value)}
              className="input"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-500">{t('break')}</span>
            <input
              type="number"
              min={0}
              max={240}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Number(e.target.value))}
              className="input"
            />
          </label>
        </div>

        <div className="text-xs text-slate-500">
          {t('actual')}:{' '}
          <span className="font-mono">
            {minutesToHHMM(
              Math.max(
                0,
                hhmmToMinutes(toTime) - hhmmToMinutes(fromTime) - (breakMinutes || 0),
              ),
            )}
          </span>
        </div>

        <div>
          <div className="text-xs text-slate-500 mb-1">{t('status')}</div>
          <StatusPicker value={status} onChange={setStatus} />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary flex-1">
            {t('save')}
          </button>
        </div>
      </div>
    </form>
  );
}
