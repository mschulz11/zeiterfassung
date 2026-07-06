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

export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function blockMinutes(entry: { fromTime: string; toTime: string }): number {
  return Math.max(0, hhmmToMinutes(entry.toTime) - hhmmToMinutes(entry.fromTime));
}

export function computeBreakMinutes(entries: Array<{ order: number; fromTime: string; toTime: string }>): number {
  const sorted = [...entries].sort((a, b) => a.order - b.order);
  let pause = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prevEnd = hhmmToMinutes(sorted[i - 1].toTime);
    const currentStart = hhmmToMinutes(sorted[i].fromTime);
    pause += Math.max(0, currentStart - prevEnd);
  }
  return pause;
}

export function entriesDurationMinutes(entries: Array<{ fromTime: string; toTime: string }>): number {
  return entries.reduce((sum, entry) => sum + blockMinutes(entry), 0);
}
