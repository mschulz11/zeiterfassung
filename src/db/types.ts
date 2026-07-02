// Datenmodell

export type EntryStatus =
  | 'planned'    // gepl.  – nur Sollzeiten, nicht real
  | 'entered'    // real eingetragen
  | 'halfday'    // halbtags
  | 'sick'       // krank
  | 'vacation'   // urlaub
  | 'free'       // frei
  | 'manual';    // manuel

export interface Entry {
  id?: number;
  date: string;            // YYYY-MM-DD
  order: number;           // Reihenfolge der Einträge am Tag (0, 1, 2, …)
  fromTime: string;        // HH:MM
  toTime: string;          // HH:MM
  breakMinutes: number;
  status: EntryStatus;
  note?: string;
  updatedAt: number;       // ms epoch, für Sync-Konfliktstrategie
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
  dayTargets: DayTargets;
  overtimeBalanceMinutes: number;   // "Für die Firma"-Saldo
  webdav: WebDavConfig;
}
