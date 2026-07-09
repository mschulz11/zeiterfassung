import { useMemo, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/database';
import { parseExcelFile, type ImportedDay } from '../lib/excelImport';

interface ImportResult {
  imported: number;
  skipped: number;
}

export function ImportPage() {
  const { t } = useTranslation();
  const [parsedDays, setParsedDays] = useState<ImportedDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  const parsedDates = useMemo(() => parsedDays?.map((day) => day.date) ?? [], [parsedDays]);
  const existingDayStates = useLiveQuery(
    () => (parsedDates.length > 0 ? db.dayState.where('date').anyOf(parsedDates).toArray() : []),
    [parsedDates],
  ) ?? [];

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);

    if (!file) {
      setParsedDays(null);
      setSelectedFileName('');
      setError(t('import.noFile'));
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const importedDays = parseExcelFile(buffer);

      if (importedDays.length === 0) {
        setParsedDays(null);
        setSelectedFileName(file.name);
        setError(t('import.noData'));
        return;
      }

      setParsedDays(importedDays);
      setSelectedFileName(file.name);
      setError(null);
    } catch {
      setParsedDays(null);
      setSelectedFileName(file.name);
      setError(t('import.error'));
    }
  }

  async function runImport(overwrite: boolean) {
    if (!parsedDays || parsedDays.length === 0) {
      setError(t('import.noData'));
      return;
    }

    setIsImporting(true);
    setError(null);

    let imported = 0;
    let skipped = 0;

    try {
      for (const day of parsedDays) {
        const existing = await db.dayState.get(day.date);
        if (existing && !overwrite) {
          skipped += 1;
          continue;
        }

        await db.transaction('rw', db.entries, db.dayState, async () => {
          const now = Date.now();
          if (overwrite) {
            await db.entries.where('date').equals(day.date).delete();
          }

          await db.dayState.put({ date: day.date, status: day.status, updatedAt: now });
          if (day.entries.length > 0) {
            await db.entries.bulkAdd(day.entries.map((block, order) => ({
              date: day.date,
              order,
              fromTime: block.fromTime,
              toTime: block.toTime,
              updatedAt: now,
            })));
          }
        });
        imported += 1;
      }

      setResult({ imported, skipped });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-3">
      <h1 className="text-lg font-semibold">{t('import.title')}</h1>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-sm">
        <label className="space-y-2">
          <span className="block text-sm font-medium">{t('import.chooseFile')}</span>
          <p className="text-xs text-[var(--text-muted)]">{t('import.closeHint')}</p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => void handleFileSelection(event)}
            className="file-input file-input-bordered w-full"
          />
        </label>
        {selectedFileName && (
          <div className="mt-2 text-xs text-[var(--text-muted)]">{selectedFileName}</div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {parsedDays && (
        <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-sm">
          <h2 className="text-sm font-semibold">{t('import.preview')}</h2>
          <div className="space-y-1 text-sm text-[var(--text-primary)]">
            <div>{t('import.daysFound')}: <span className="font-mono">{parsedDays.length}</span></div>
            <div>{t('import.conflicts')}: <span className="font-mono">{existingDayStates.length}</span></div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={isImporting}
              onClick={() => void runImport(true)}
              className="btn btn-primary flex-1"
            >
              {t('import.overwrite')}
            </button>
            <button
              type="button"
              disabled={isImporting}
              onClick={() => void runImport(false)}
              className="btn btn-ghost flex-1 border border-[var(--border)]"
            >
              {t('import.keep')}
            </button>
          </div>
        </section>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          {result.imported} {t('import.success')}, {result.skipped} {t('import.skipped')}
        </div>
      )}
    </div>
  );
}
