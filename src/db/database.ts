import Dexie from 'dexie';
import type { Entry, AppSettings, WeekCountState } from './types';

class ZeiterfassungDB extends Dexie {
  entries!: Dexie.Table<Entry, number>;
  settings!: Dexie.Table<AppSettings, string>;
  weeks!: Dexie.Table<WeekCountState, string>;

  constructor() {
    super('zeiterfassung');
    this.version(1).stores({
      entries: '++id, date, status, updatedAt',
      settings: 'id',
      weeks: 'iso, countedForOvertime',
    });
  }
}

export const db = new ZeiterfassungDB();

// Default-Settings beim ersten Start anlegen
export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app');
  if (existing) return existing;

  const defaults: AppSettings = {
    id: 'app',
    language: 'de',
    dayTargets: {
      Mon: 480, Tue: 480, Wed: 480, Thu: 480,   // 8h
      Fri: 360,                                 // 6h
      Sat: 0, Sun: 0,
    },
    overtimeBalanceMinutes: 0,
    webdav: {
      enabled: false,
      url: '',
      username: '',
      password: '',
      lastSyncAt: null,
      lastSyncStatus: 'idle',
    },
  };
  await db.settings.put(defaults);
  return defaults;
}
