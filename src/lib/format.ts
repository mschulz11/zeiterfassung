// Zeit-Formatierung: Minuten <-> HH:MM

export function minutesToHHMM(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  return (parseInt(m[1], 10) || 0) * 60 + (parseInt(m[2], 10) || 0);
}

// Dauer eines Eintrags (Brutto minus Pause)
export function entryDurationMinutes(fromTime: string, toTime: string, breakMinutes: number): number {
  const from = hhmmToMinutes(fromTime);
  const to = hhmmToMinutes(toTime);
  return Math.max(0, to - from - (breakMinutes || 0));
}
