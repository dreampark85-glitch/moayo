import Link from 'next/link';
import { WEEKDAY_KO } from '@/lib/date';
import { BODY_PART_LABEL, UNIT_LABEL } from '@/lib/templates';
import type { Goal } from '@/lib/types';

export function GoalsPanel({ goals }: { goals: Goal[] }) {
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {goals.map((g) => (
          <li key={g.goalId} className="rounded-xl border border-slate-300 p-3 text-sm">
            <p className="text-base font-bold">
              {g.exercise} {g.target}
              {UNIT_LABEL[g.unit]}
            </p>
            <p className="text-slate-700">
              {g.weekdays.map((d) => WEEKDAY_KO[d]).join('·')} {g.time} · {BODY_PART_LABEL[g.bodyPart]}
            </p>
            <p className="text-slate-700">
              기간 {g.startDate} ~ {g.endDate}
            </p>
          </li>
        ))}
      </ul>
      <Link href="/goals/new" className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-4 font-bold text-white">
        새 목표 추가
      </Link>
    </div>
  );
}
