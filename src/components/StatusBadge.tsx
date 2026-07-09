import type { DayStatus } from '../db/types';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

const COLORS: Record<DayStatus, string> = {
  planned: 'bg-[var(--status-planned)] text-yellow-950',
  worked: 'bg-[var(--status-worked)] text-slate-800 dark:text-slate-100 border border-[var(--border)]',
  imported: 'bg-purple-100 text-purple-900 border border-purple-300',
  halfday: 'bg-[var(--status-halfday)] text-yellow-950',
  sick: 'bg-[var(--status-sick)] text-white',
  vacation: 'bg-[var(--status-vacation)] text-white dark:text-blue-50',
  free: 'bg-[var(--status-free)] text-slate-800 dark:text-slate-50',
};

export function StatusBadge({ status }: { status: DayStatus }) {
  const { t } = useTranslation();
  return (
    <span className={clsx('badge', COLORS[status])}>{t(`dayStatus.${status}`)}</span>
  );
}
