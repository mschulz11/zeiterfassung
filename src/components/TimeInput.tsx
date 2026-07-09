import { useEffect, useState } from 'react';

interface Props {
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  onCommit: (value: string) => void;
}

function normalizeTimeInput(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits.length === 2 ? `${digits}:` : digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function parseTime(value: string): string | null {
  const normalized = normalizeTimeInput(value);
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function TimeInput({ value, disabled, invalid, onCommit }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(nextDraft = draft) {
    const parsed = parseTime(nextDraft);
    if (parsed) {
      setDraft(parsed);
      if (parsed !== value) onCommit(parsed);
    } else {
      setDraft(value);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={draft}
        onChange={(event) => {
          const next = normalizeTimeInput(event.target.value);
          setDraft(next);
          if (/^\d{2}:\d{2}$/.test(next)) commit(next);
        }}
        onBlur={() => commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className={`input w-full pr-6 font-mono ${invalid ? 'border-red-400' : ''}`}
        placeholder="HH:MM"
        aria-label="Zeit"
      />
      {!disabled && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            const now = new Date();
            const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            setDraft(hhmm);
            onCommit(hhmm);
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          title="Jetzt"
          aria-label="Aktuelle Uhrzeit"
        >
          ⏱
        </button>
      )}
    </div>
  );
}
