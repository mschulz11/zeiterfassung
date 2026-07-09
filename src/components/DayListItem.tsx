import { useTranslation } from 'react-i18next';
import type { DayStatus } from '../db/types';
import { minutesToHHMM } from '../lib/format';
import { formatDateLong, fromIsoDate, weekdayKey } from '../lib/dates';
import { StatusBadge } from './StatusBadge';

interface Props {
  date: string;
  status: DayStatus;
  language: 'de' | 'en';
  expanded: boolean;
  actualMinutes: number;
  targetMinutes: number;
  deltaMinutes: number;
  cumulativeBalance?: number;
  isBalanceStart?: boolean;
  onClick: () => void;
}

export function DayListItem({
  date,
  status,
  language,
  expanded,
  actualMinutes,
  targetMinutes,
  deltaMinutes,
  cumulativeBalance,
  isBalanceStart,
  onClick,
}: Props) {
  const { t } = useTranslation();
  const weekday = weekdayKey(fromIsoDate(date));

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3 text-left"
    >
      <div className="min-w-0 space-y-1">
        <div className="text-xs font-semibold uppercase text-[var(--text-muted)]">{t(`day.${weekday}`)}</div>
        <div className="flex items-center gap-2 truncate text-sm text-[var(--text-primary)]">
          {isBalanceStart && <span aria-hidden className="shrink-0 text-xs text-indigo-600 dark:text-indigo-300">⟳</span>}
          <span className="truncate">{formatDateLong(date, language)}</span>
        </div>
        <div className="font-mono text-xs text-[var(--text-muted)]">
          {t('target')} {minutesToHHMM(targetMinutes)} · {t('actual')} {minutesToHHMM(actualMinutes)} ·{' '}
          <span className={deltaMinutes < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}>
            Δ {minutesToHHMM(deltaMinutes)}
          </span>
          {cumulativeBalance !== undefined && (
            <>
              {' '}| {t('totalBalance')}: <span className={cumulativeBalance < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}>
                {minutesToHHMM(cumulativeBalance)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={status} />
        <span aria-hidden className="text-lg text-[var(--text-muted)]">{expanded ? '⌄' : '›'}</span>
      </div>
    </button>
  );
}
