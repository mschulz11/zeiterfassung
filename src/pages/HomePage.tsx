import { useState } from 'react';
import { WeekView } from '../components/WeekView';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { minutesToHHMM } from '../lib/format';

export function HomePage() {
  const { t } = useTranslation();
  const [reference, setReference] = useState(new Date());
  const settings = useLiveQuery(() => db.settings.get('app'), []);

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-xl mx-auto px-3 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t('appName')}</h1>
          <div className="text-xs text-slate-500 font-mono">
            {t('balance')} {settings ? minutesToHHMM(settings.overtimeBalanceMinutes) : '—'}
          </div>
        </div>
      </header>

      <WeekView reference={reference} onReferenceChange={setReference} />
    </div>
  );
}
