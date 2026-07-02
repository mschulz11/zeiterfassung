import { useTranslation } from 'react-i18next';

export function StatsPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-xl mx-auto p-4 space-y-3">
      <h1 className="text-lg font-semibold">{t('stats')}</h1>
      <div className="card">
        <p className="text-sm text-slate-600">
          Charts kommen in der nächsten Iteration — Überstunden-Verlauf,
          Monatssummen, Krank-/Urlaubsstatistik.
        </p>
      </div>
    </div>
  );
}
