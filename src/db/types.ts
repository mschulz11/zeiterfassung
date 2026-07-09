// Datenmodell

export type DayStatus =
  | 'planned'
  | 'worked'
  | 'imported'
  | 'halfday'
  | 'free'
  | 'vacation'
  | 'sick';

export interface Entry {
  id?: number;
  date: string;            // YYYY-MM-DD
  order: number;           // Reihenfolge der Einträge am Tag (0, 1, 2, …)
  fromTime: string;        // HH:MM
  toTime: string;          // HH:MM
  updatedAt: number;       // ms epoch, für Sync-Konfliktstrategie
}

export interface DayState {
  date: string;            // YYYY-MM-DD
  status: DayStatus;
  updatedAt: number;
}

export interface WeekCountState {
  iso: string;             // "2026-W27"
  countedForOvertime: 'yes' | 'no' | null;
  appliedAt: number;
}

export interface DayTargets {
  Mon: number; Tue: number; Wed: number; Thu: number;
  Fri: number; Sat: number; Sun: number;
}

export interface TimeBlock {
  from: string;
  to: string;
}

export type DefaultBlocks = Record<keyof DayTargets, TimeBlock[]>;

export interface WebDavConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
  lastSyncAt: number | null;
  lastSyncStatus: 'idle' | 'ok' | 'error';
  lastSyncError?: string;
}

export interface AppSettings {
  id: 'app';
  language: 'de' | 'en';
  theme: 'daylight' | 'sand' | 'slate' | 'indigo' | 'midnight';
  lookbackDays: number;
  balanceStartDate: string | null;
  balanceStartDates: string[];  // all Neuzählen dates sorted oldest first, newest last
  balanceGiftMinutes: number;
  weeklyTargetMinutes: number;
  dayTargets: DayTargets;
  defaultBlocks: DefaultBlocks;
  showWeekend: boolean;
  overtimeBalanceMinutes: number;   // "Für die Firma"-Saldo
  webdav: WebDavConfig;
}
