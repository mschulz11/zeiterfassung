import { useTranslation } from 'react-i18next';
import type { DayStatus, Entry } from '../db/types';
import { blockMinutes, computeBreakMinutes, entriesDurationMinutes, minutesToHHMM } from '../lib/format';
import clsx from 'clsx';
import { formatDateLong } from '../lib/dates';
import { StatusMenu } from './StatusMenu';
import { TimeInput } from './TimeInput';

interface Props {
  date: string;
  entries: Entry[];
  status: DayStatus;
  targetMinutes: number;
  language: 'de' | 'en';
  variant: 'today' | 'past';
  onAddBlock: () => void;
  onDeleteBlock: (id: number) => void;
  onUpdateBlock: (id: number, changes: Pick<Entry, 'fromTime'> | Pick<Entry, 'toTime'>) => void;
  onStatusChange: (status: DayStatus) => void;
  onPromote: () => void;
}

export function DayCard({
  date,
  entries,
  status,
  targetMinutes,
  language,
  variant,
  onAddBlock,
  onDeleteBlock,
  onUpdateBlock,
  onStatusChange,
  onPromote,
}: Props) {
  const { t } = useTranslation();
  const inactive = ['free', 'vacation', 'sick'].includes(status);
  const effectiveTarget = status === 'halfday' ? Math.round(targetMinutes / 2) : inactive ? 0 : targetMinutes;
  const actualMinutes = inactive || status === 'planned' ? 0 : entriesDurationMinutes(entries);
  const pauseMinutes = inactive ? 0 : computeBreakMinutes(entries);

  return (
    <div className="overflow-visible rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
      <div className="flex items-start justify-between gap-3 rounded-t-lg border-b border-[var(--border)] bg-[var(--bg-soft)] px-3 py-3">
        <div>
          <div className="text-xs font-semibold uppercase text-[var(--text-muted)]">
            {variant === 'today' ? t('today') : t('dayLabel')}
          </div>
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {formatDateLong(date, language)}
          </div>
        </div>
        <StatusMenu value={status} onChange={onStatusChange} />
      </div>

      <div className={clsx('space-y-2 bg-[var(--bg-edit)] px-3 py-3', inactive && 'opacity-55')}>
        {entries.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--text-muted)]">
            {t('noEntries')}
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
            <TimeInput
              value={e.fromTime}
              disabled={inactive}
              onCommit={(value) => onUpdateBlock(e.id!, { fromTime: value })}
            />
            <span className="text-[var(--text-muted)]">-</span>
            <TimeInput
              value={e.toTime}
              disabled={inactive}
              invalid={blockMinutes(e) === 0 && !inactive}
              onCommit={(value) => onUpdateBlock(e.id!, { toTime: value })}
            />
            <button
              type="button"
              disabled={inactive}
              onClick={() => onDeleteBlock(e.id!)}
              className="btn btn-ghost h-10 w-10 px-0"
              title={t('deleteEntry')}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border)] px-3 pb-3 pt-3">
        <div className="space-y-1 text-xs font-mono text-[var(--text-muted)]">
          <div>{t('break')}: {minutesToHHMM(pauseMinutes)}</div>
          <div>
            {t('actual')} {minutesToHHMM(actualMinutes)} · {t('target')} {minutesToHHMM(effectiveTarget)} ·{' '}
            <span className={actualMinutes >= effectiveTarget ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>
              Δ {minutesToHHMM(actualMinutes - effectiveTarget)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={inactive}
            onClick={onAddBlock}
            className="btn btn-ghost flex-1 border border-[var(--border)]"
          >
            + {t('addEntry')}
          </button>
          {variant === 'today' && (
            <button type="button" onClick={onPromote} className="btn btn-primary flex-1">
              ✓ {t('enterDay')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
