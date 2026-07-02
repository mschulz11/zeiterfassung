import type { EntryStatus } from '../db/types';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

const COLORS: Record<EntryStatus, string> = {
  planned:   'bg-yellow-300 text-yellow-900',
  entered:   'bg-white text-slate-700 border border-slate-300',
  halfday:   'bg-yellow-100 text-yellow-800',
  sick:      'bg-red-200 text-red-900',
  vacation:  'bg-blue-200 text-blue-900',
  free:      'bg-slate-200 text-slate-700',
  manual:    'bg-violet-200 text-violet-900',
};

export function StatusBadge({ status }: { status: EntryStatus }) {
  const { t } = useTranslation();
  return (
    <span className={clsx('badge', COLORS[status])}>{t(`entryStatus.${status}`)}</span>
  );
}
