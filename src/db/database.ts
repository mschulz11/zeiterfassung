import Dexie from 'dexie';
import type { Entry, AppSettings, DayState, DayStatus, DefaultBlocks, WeekCountState } from './types';

class ZeiterfassungDB extends Dexie {
  entries!: Dexie.Table<Entry, number>;
  dayState!: Dexie.Table<DayState, string>;
  settings!: Dexie.Table<AppSettings, string>;
  weeks!: Dexie.Table<WeekCountState, string>;

  constructor() {
    super('zeiterfassung');
    this.version(1).stores({
      entries: '++id, date, status, updatedAt',
      settings: 'id',
      weeks: 'iso, countedForOvertime',
    });

    this.version(2).stores({
      entries: '++id, date, updatedAt',
      dayState: '&date, status, updatedAt',
      settings: 'id',
      weeks: 'iso, countedForOvertime',
    }).upgrade(async (tx) => {
      const legacyEntries = await tx.table('entries').toArray();
      const rank: Record<DayStatus, number> = {
        sick: 6,
        vacation: 6,
        free: 5,
        halfday: 4,
        worked: 3,
        planned: 1,
      };
      const best = new Map<string, { status: DayStatus; rank: number }>();

      for (const entry of legacyEntries as Array<{ date?: string; status?: string }>) {
        if (!entry.date) continue;
        let mapped: DayStatus = 'planned';
        switch (entry.status) { 
          case 'entered':
            mapped = 'worked';
            break;
          case 'halfday':
            mapped = 'halfday';
            break;
          case 'sick':
            mapped = 'sick';
            break;
          case 'vacation':
            mapped = 'vacation';
            break;
          case 'free':
            mapped = 'free';
            break;
          default:
            mapped = 'planned';
        }

        const current = best.get(entry.date);
        if (!current || current.rank < rank[mapped]) {
          best.set(entry.date, { status: mapped, rank: rank[mapped] });
        }
      }

      const now = Date.now();
      const dayStates: DayState[] = Array.from(best.entries()).map(([date, { status }]) => ({
        date,
        status,
        updatedAt: now,
      }));
      if (dayStates.length > 0) await tx.table('dayState').bulkPut(dayStates);
    });
  }
}

export const db = new ZeiterfassungDB();

export const DEFAULT_DAY_TARGETS: AppSettings['dayTargets'] = {
  Mon: 480, Tue: 480, Wed: 480, Thu: 480,
  Fri: 360,
  Sat: 0, Sun: 0,
};

export const DEFAULT_BLOCKS: DefaultBlocks = {
  Mon: [
    { from: '08:00', to: '12:30' },
    { from: '13:00', to: '17:00' },
  ],
  Tue: [
    { from: '08:00', to: '12:30' },
    { from: '13:00', to: '17:00' },
  ],
  Wed: [
    { from: '08:00', to: '12:30' },
    { from: '13:00', to: '17:00' },
  ],
  Thu: [
    { from: '08:00', to: '12:30' },
    { from: '13:00', to: '17:00' },
  ],
  Fri: [{ from: '08:00', to: '14:00' }],
  Sat: [],
  Sun: [],
};

function defaultSettings(): AppSettings {
  return {
    id: 'app',
    language: 'de',
    theme: 'daylight',
    lookbackDays: 14,
    weeklyTargetMinutes: 2400,
    dayTargets: DEFAULT_DAY_TARGETS,
    defaultBlocks: DEFAULT_BLOCKS,
    showWeekend: false,
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
}

function withSettingsDefaults(settings: Partial<AppSettings>): AppSettings {
  const defaults = defaultSettings();
  return {
    ...defaults,
    ...settings,
    theme: normalizeTheme(settings.theme),
    lookbackDays: Math.max(1, Number(settings.lookbackDays) || defaults.lookbackDays),
    weeklyTargetMinutes: Number(settings.weeklyTargetMinutes ?? 2400),
    dayTargets: { ...defaults.dayTargets, ...settings.dayTargets },
    defaultBlocks: { ...defaults.defaultBlocks, ...settings.defaultBlocks },
    webdav: { ...defaults.webdav, ...settings.webdav },
  };
}

function normalizeTheme(theme: unknown): AppSettings['theme'] {
  if (theme === 'dark') return 'midnight';
  if (theme === 'light' || theme === 'auto') return 'daylight';
  if (theme === 'daylight' || theme === 'sand' || theme === 'slate' || theme === 'indigo' || theme === 'midnight') {
    return theme;
  }
  return 'daylight';
}

// Default-Settings beim ersten Start anlegen und neue Felder defensiv ergänzen.
export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app');
  if (existing) {
    const normalized = withSettingsDefaults(existing);
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
      await db.settings.put(normalized);
    }
    return normalized;
  }

  const defaults = defaultSettings();
  await db.settings.put(defaults);
  return defaults;
}
