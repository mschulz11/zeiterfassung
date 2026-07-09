import { useEffect, useState } from 'react';

interface Props {
  minutes: number;
  onChange: (minutes: number) => void;
}

function minutesToHHMMFlex(mins: number): string {
  const sign = mins < 0 ? '-' : '';
  const abs = Math.abs(mins);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeWeeklyInput(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '').slice(0, 5); // allow up to 5 digits for hours+min e.g. 12000 -> 120:00
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits.length === 2 ? `${digits}:` : digits;
  return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
}

function parseWeekly(value: string): number | null {
  const normalized = normalizeWeeklyInput(value);
  const match = /^(-?\d{1,3}):(\d{2})$/.exec(normalized);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  return hours * 60 + minutes;
}

export function WeeklyTimeInput({ minutes, onChange }: Props) {
  const [draft, setDraft] = useState(() => minutesToHHMMFlex(minutes));

  useEffect(() => {
    setDraft(minutesToHHMMFlex(minutes));
  }, [minutes]);

  function commit(next = draft) {
    const parsed = parseWeekly(next);
    if (parsed !== null) {
      setDraft(minutesToHHMMFlex(parsed));
      if (parsed !== minutes) onChange(parsed);
    } else {
      setDraft(minutesToHHMMFlex(minutes));
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft}
      onChange={(e) => {
        const next = normalizeWeeklyInput(e.target.value);
        setDraft(next);
        if (/^-?\d+:\d{2}$/.test(next)) commit(next);
      }}
      onBlur={() => commit()}
      className="input max-w-24 font-mono"
      placeholder="HH:MM"
      aria-label="Wochen-Soll"
    />
  );
}
