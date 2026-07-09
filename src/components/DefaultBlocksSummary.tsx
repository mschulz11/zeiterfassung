import type { TimeBlock } from '../db/types';
import { defaultBlocksMinutes } from '../lib/dayTotals';

interface Props {
  day: string;
  blocks: TimeBlock[];
  weeklyTargetMinutes: number;
}

export function DefaultBlocksSummary({ day, blocks, weeklyTargetMinutes }: Props) {
  const total = defaultBlocksMinutes(blocks);
  const isWeekend = day === 'Sat' || day === 'Sun';
  const target = isWeekend ? 0 : Math.round(weeklyTargetMinutes / 5);

  const warn = total !== target;

  return (
    <div>
      <div>Ist: {minutesToHHMM(total)} · Soll: {minutesToHHMM(target)} {warn && <span className="text-sm text-sky-600">(abweichend)</span>}</div>
    </div>
  );
}

function minutesToHHMM(mins: number) {
  const sign = mins < 0 ? '-' : '';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
