import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DayStatus } from '../db/types';
import { StatusBadge } from './StatusBadge';

const OPTIONS: DayStatus[] = ['worked', 'halfday', 'free', 'vacation', 'sick'];

interface Props {
  value: DayStatus;
  onChange: (status: DayStatus) => void;
}

export function StatusMenu({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((next) => !next)} className="rounded-lg">
        <StatusBadge status={value} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 min-w-36 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-lg">
          {OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                onChange(status);
                setOpen(false);
              }}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {t(`dayStatus.${status}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
