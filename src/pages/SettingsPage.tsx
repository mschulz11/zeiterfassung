import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { setLanguage } from '../i18n';
import type { AppSettings } from '../db/types';
import { TimeInput } from '../components/TimeInput';
import { minutesToHHMM } from '../lib/format';
import { WeeklyTimeInput } from '../components/WeeklyTimeInput';
import { DefaultBlocksSummary } from '../components/DefaultBlocksSummary';
import { defaultBlocksMinutes } from '../lib/dayTotals';

function totalDefaultBlocksMinutes(blocksGroup: AppSettings['defaultBlocks']) {
  let sum = 0;
  for (const k of Object.keys(blocksGroup) as Array<keyof AppSettings['defaultBlocks']>) {
    // count only Mon-Fri for weekly sum
    if (k === 'Sat' || k === 'Sun') continue;
    sum += defaultBlocksMinutes(blocksGroup[k]);
  }
  return sum;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const LOOKBACK_PRESETS: AppSettings['lookbackDays'][] = [7, 14, 30];

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('app'), []);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    theme: false,
    lookback: false,
    weekend: false,
    defaultBlocks: false,
    language: false,
    dayTargets: false,
    webdav: false,
  });

  if (!settings) return <div className="p-4 text-[var(--text-muted)]">…</div>;
  const activeSettings = settings;

  async function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    await db.settings.update('app', { [key]: value } as Partial<AppSettings>);
  }

  async function updateDefaultBlock(
    day: keyof AppSettings['defaultBlocks'],
    index: number,
    key: 'from' | 'to',
    value: string,
  ) {
    const next = {
      ...activeSettings.defaultBlocks,
      [day]: activeSettings.defaultBlocks[day].map((block, i) =>
        i === index ? { ...block, [key]: value } : block,
      ),
    };
    await update('defaultBlocks', next);
  }

  function toggle(key: keyof typeof collapsed) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  return (
    <div className="max-w-xl mx-auto p-3 space-y-4">
      <h1 className="text-lg font-semibold">{t('settings.heading')}</h1>

      

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t('settings.lookback')}</div>
          <button type="button" className="btn btn-ghost" onClick={() => toggle('lookback')}>{collapsed.lookback ? '▶' : '⌄'}</button>
        </div>
        {!collapsed.lookback && (
          <>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {LOOKBACK_PRESETS.map((lookback) => (
                <button
                  key={lookback}
                  type="button"
                  className={'btn ' + (settings.lookbackDays === lookback ? 'btn-primary' : 'btn-ghost border border-[var(--border)]')}
                  onClick={() => void update('lookbackDays', lookback)}
                >
                  {lookback}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <label className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">{t('settings.lookback')} (frei)</span>
                <input
                  type="number"
                  min={1}
                  value={settings.lookbackDays}
                  onChange={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 1);
                    void update('lookbackDays', v as AppSettings['lookbackDays']);
                  }}
                  className="input max-w-24"
                />
              </label>
            </div>
          </>
        )}
      </section> 

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t('settings.defaultBlocks')}</div>
          <div className={`text-xs font-mono ${totalDefaultBlocksMinutes(settings.defaultBlocks) === settings.weeklyTargetMinutes ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
            Soll: {minutesToHHMM(settings.weeklyTargetMinutes)} · Ist: {minutesToHHMM(totalDefaultBlocksMinutes(settings.defaultBlocks))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => toggle('defaultBlocks')}>{collapsed.defaultBlocks ? '▶' : '⌄'}</button>
        </div>
        {!collapsed.defaultBlocks && (
          <>
            <div className="text-xs text-[var(--text-muted)]">
              {t('settings.defaultBlocksHint', 'Default-Blöcke werden gegen das Tages-Soll validiert')}
            </div>
            {DAYS.map((day) => (
              <div key={day} className="space-y-2 rounded-lg border border-[var(--border)] p-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{t(`day.${day}`)}</div>
                  <button
                    type="button"
                    className="btn btn-ghost h-8 border border-[var(--border)] px-2"
                    onClick={() => void update('defaultBlocks', {
                      ...settings.defaultBlocks,
                      [day]: [...settings.defaultBlocks[day], { from: '08:00', to: '09:00' }],
                    })}
                  >
                    +
                  </button>
                </div>
                {settings.defaultBlocks[day].length === 0 && (
                  <div className="text-xs text-[var(--text-muted)]">{t('settings.noDefaultBlocks')}</div>
                )}
                <div className="text-xs font-mono text-[var(--text-muted)]">
                  <DefaultBlocksSummary day={day} blocks={settings.defaultBlocks[day]} weeklyTargetMinutes={settings.weeklyTargetMinutes} />
                </div>
                {settings.defaultBlocks[day].map((block, index) => (
                  <div key={`${day}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <TimeInput
                      value={block.from}
                      onCommit={(val) => void updateDefaultBlock(day, index, 'from', val)}
                    />
                    <TimeInput
                      value={block.to}
                      onCommit={(val) => void updateDefaultBlock(day, index, 'to', val)}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost h-10 w-10 border border-[var(--border)] px-0"
                      onClick={() => void update('defaultBlocks', {
                        ...settings.defaultBlocks,
                        [day]: settings.defaultBlocks[day].filter((_, i) => i !== index),
                      })}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t('settings.dayTargets')}</div>
          <button type="button" className="btn btn-ghost" onClick={() => toggle('dayTargets')}>{collapsed.dayTargets ? '▶' : '⌄'}</button>
        </div>
        {!collapsed.dayTargets && (
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <span className="text-sm">{t('settings.weeklyTarget')}</span>
              <WeeklyTimeInput
                minutes={settings.weeklyTargetMinutes}
                onChange={async (minutes) => void update('weeklyTargetMinutes', minutes)}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              {DAYS.map((d) => (
                <div key={d} className="flex items-center justify-between">
                  <div className="text-sm">{t(`day.${d}`)}</div>
                  <div className="font-mono text-sm text-[var(--text-muted)]">
                    {d === 'Sat' || d === 'Sun'
                      ? minutesToHHMM(0)
                      : minutesToHHMM(Math.round(activeSettings.weeklyTargetMinutes / 5))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t('settings.language')}</div>
          <button type="button" className="btn btn-ghost" onClick={() => toggle('language')}>{collapsed.language ? '▶' : '⌄'}</button>
        </div>
        {!collapsed.language && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              className={
                'btn ' + (settings.language === 'de' ? 'btn-primary' : 'btn-ghost border border-slate-200')
              }
              onClick={() => {
                void update('language', 'de');
                setLanguage('de');
              }}
            >
              Deutsch
            </button>
            <button
              className={
                'btn ' + (settings.language === 'en' ? 'btn-primary' : 'btn-ghost border border-slate-200')
              }
              onClick={() => {
                void update('language', 'en');
                setLanguage('en');
              }}
            >
              English
            </button>
          </div>
        )}
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{t('settings.webdav')}</div>
          <button type="button" className="btn btn-ghost" onClick={() => toggle('webdav')}>{collapsed.webdav ? '▶' : '⌄'}</button>
        </div>
        {!collapsed.webdav && (
          <>
            <label className="space-y-1 block">
              <span className="text-xs text-slate-500">{t('settings.webdavUrl')}</span>
              <input
                type="url"
                placeholder="https://..."
                className="input"
                value={settings.webdav.url}
                onChange={(e) => void update('webdav', { ...settings.webdav, url: e.target.value })}
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs text-slate-500">{t('settings.webdavUser')}</span>
              <input
                type="text"
                className="input"
                value={settings.webdav.username}
                onChange={(e) => void update('webdav', { ...settings.webdav, username: e.target.value })}
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs text-slate-500">{t('settings.webdavPassword')}</span>
              <input
                type="password"
                className="input"
                value={settings.webdav.password}
                onChange={(e) => void update('webdav', { ...settings.webdav, password: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.webdav.enabled}
                onChange={(e) =>
                  void update('webdav', { ...settings.webdav, enabled: e.target.checked })
                }
              />
              <span className="text-sm">{t('settings.webdavEnabled')}</span>
            </label>
            <div className="text-xs text-slate-500">
              {settings.webdav.lastSyncAt
                ? new Date(settings.webdav.lastSyncAt).toLocaleString()
                : 'no sync yet'}
            </div>
            <div className="text-xs italic text-slate-400">
              OneDrive-WebDAV: Sync-Modul wird in der nächsten Iteration gebaut.
            </div>
          </>
        )}
      </section>
    </div>
  );
}
