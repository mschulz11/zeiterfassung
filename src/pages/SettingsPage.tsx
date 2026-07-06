import { useTranslation } from 'react-i18next';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { setLanguage } from '../i18n';
import type { AppSettings } from '../db/types';
import { applyTheme } from '../lib/theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const THEMES: AppSettings['theme'][] = ['auto', 'light', 'dark'];
const LOOKBACKS: AppSettings['lookbackDays'][] = [7, 14, 30];

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('app'), []);

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

  return (
    <div className="max-w-xl mx-auto p-3 space-y-4">
      <h1 className="text-lg font-semibold">{t('settings.heading')}</h1>

      <section className="card space-y-2">
        <div className="text-sm font-medium">{t('settings.theme')}</div>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              className={'btn ' + (settings.theme === theme ? 'btn-primary' : 'btn-ghost border border-[var(--border)]')}
              onClick={() => {
                void update('theme', theme);
                applyTheme(theme);
              }}
            >
              {t(`theme.${theme}`)}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-2">
        <div className="text-sm font-medium">{t('settings.lookback')}</div>
        <div className="grid grid-cols-3 gap-2">
          {LOOKBACKS.map((lookback) => (
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
      </section>

      <section className="card">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{t('settings.weekend')}</span>
          <input
            type="checkbox"
            checked={settings.showWeekend}
            onChange={(e) => void update('showWeekend', e.target.checked)}
          />
        </label>
      </section>

      <section className="card space-y-3">
        <div className="text-sm font-medium">{t('settings.defaultBlocks')}</div>
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
            {settings.defaultBlocks[day].map((block, index) => (
              <div key={`${day}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="time"
                  value={block.from}
                  onChange={(e) => void updateDefaultBlock(day, index, 'from', e.target.value)}
                  className="input font-mono"
                />
                <input
                  type="time"
                  value={block.to}
                  onChange={(e) => void updateDefaultBlock(day, index, 'to', e.target.value)}
                  className="input font-mono"
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
      </section>

      <section className="card space-y-2">
        <div className="text-sm font-medium">{t('settings.language')}</div>
        <div className="grid grid-cols-2 gap-2">
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
      </section>

      <section className="card space-y-2">
        <div className="text-sm font-medium">{t('settings.dayTargets')}</div>
        <div className="grid grid-cols-2 gap-2">
          {DAYS.map(
            (k) => (
              <label key={k} className="flex items-center justify-between gap-2">
                <span className="text-sm">{t(`day.${k}`)}</span>
                <input
                  type="number"
                  min={0}
                  max={720}
                  value={settings.dayTargets[k]}
                  onChange={(e) =>
                    void db.settings.update('app', {
                      dayTargets: {
                        ...settings.dayTargets,
                        [k]: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="input max-w-24"
                />
              </label>
            ),
          )}
        </div>
      </section>

      <section className="card space-y-2">
        <div className="text-sm font-medium">{t('settings.webdav')}</div>
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
      </section>
    </div>
  );
}
