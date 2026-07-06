import { useTranslation } from 'react-i18next';
import type { DayStatus } from '../db/types';
import { formatDateLong, fromIsoDate, weekdayKey } from '../lib/dates';
import { StatusBadge } from './StatusBadge';

interface Props {
  date: string;
  status: DayStatus;
  language: 'de' | 'en';
  expanded: boolean;
  onClick: () => void;
}

export function DayListItem({ date, status, language, expanded, onClick }: Props) {
  const { t } = useTranslation();
  const weekday = weekdayKey(fromIsoDate(date));

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-3 text-left"
    >
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase text-[var(--text-muted)]">{t(`day.${weekday}`)}</div>
        <div className="truncate text-sm text-[var(--text-primary)]">{formatDateLong(date, language)}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={status} />
        <span aria-hidden className="text-lg text-[var(--text-muted)]">{expanded ? '⌄' : '›'}</span>
      </div>
    </button>
  );
}
