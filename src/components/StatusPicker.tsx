import type { EntryStatus } from '../db/types';
import { useTranslation } from 'react-i18next';

const OPTIONS: EntryStatus[] = [
  'planned',
  'entered',
  'halfday',
  'sick',
  'vacation',
  'free',
  'manual',
];

interface Props {
  value: EntryStatus;
  onChange: (s: EntryStatus) => void;
}

export function StatusPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={
            'px-2 py-2 rounded-xl text-xs border ' +
            (value === s
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300')
          }
        >
          {t(`entryStatus.${s}`)}
        </button>
      ))}
    </div>
  );
}
