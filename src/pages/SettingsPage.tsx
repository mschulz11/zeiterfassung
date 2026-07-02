import { useTranslation } from 'react-i18next';
import { db } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { setLanguage } from '../i18n';
import type { AppSettings } from '../db/types';

export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.get('app'), []);

  if (!settings) return <div className="p-4 text-slate-500">…</div>;

  async function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    await db.settings.update('app', { [key]: value } as Partial<AppSettings>);
  }

  return (
    <div className="max-w-xl mx-auto p-3 space-y-4">
      <h1 className="text-lg font-semibold">{t('settings.heading')}</h1>

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
          {(Object.keys(settings.dayTargets) as Array<keyof typeof settings.dayTargets>).map(
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
