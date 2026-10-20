'use client';

import { useState } from 'react';
import { LiveRegion } from '@/components/ui/LiveRegion';
import type { Api } from '@/lib/api';
import { formatKo } from '@/lib/date';
import type { WeeklyReportView } from '@/lib/selectors';
import { UNIT_LABEL } from '@/lib/templates';
import { RESPONSE_LABEL, RULE_LABEL } from './labels';

function signed(n: number, suffix: string): string {
  if (n === 0) return `±0${suffix} (변화 없음)`;
  return `${n > 0 ? '+' : '-'}${Math.abs(n)}${suffix} (${n > 0 ? '증가' : '감소'})`;
}

export function WeeklyReportPanel({ view, api }: { view: WeeklyReportView; api: Api }) {
  const { report, plan } = view;
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await api.confirmNextWeek(
        plan.map((p) => ({ goalId: p.goal.goalId, rule: p.rule, response: 'accepted' as const, amount: p.amount, time: p.time })),
      );
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '확정하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  const metrics: { label: string; value: string }[] = [
    { label: '실천 횟수', value: `${report.doneCount}회` },
    { label: '총 시간', value: `${report.totalMinutes}분` },
    { label: '달성률', value: `${report.achievementRate}%` },
    { label: '지난주 대비 실천 횟수', value: signed(report.deltaDone, '회') },
    { label: '지난주 대비 달성률', value: signed(report.deltaRate, '%p') },
  ];

  return (
    <div className="space-y-4">
      <section aria-labelledby="report-title" className="space-y-2">
        <h2 id="report-title" className="text-base font-bold">
          지난주 리포트 ({formatKo(report.weekStart)} ~ {formatKo(report.weekEnd)})
        </h2>
        <dl className="grid grid-cols-2 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-xl border border-slate-300 p-3">
              <dt className="text-xs text-slate-600">{m.label}</dt>
              <dd className="text-lg font-bold">{m.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="next-title" className="space-y-2">
        <h2 id="next-title" className="text-base font-bold">
          다음 주 계획
        </h2>
        <ul className="space-y-2">
          {plan.map((p) => (
            <li key={p.goal.goalId} className="rounded-lg border border-slate-300 p-3 text-sm">
              <p className="font-bold">
                {p.goal.exercise} {p.goal.target === p.amount ? `${p.amount}${UNIT_LABEL[p.goal.unit]} 유지` : `${p.goal.target}${UNIT_LABEL[p.goal.unit]} → ${p.amount}${UNIT_LABEL[p.goal.unit]}`}
              </p>
              <p className="text-slate-700">
                {p.time} · {RULE_LABEL[p.rule]}
                {p.response ? ` · 최근 응답: ${RESPONSE_LABEL[p.response]}` : ''}
              </p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={saving || done || plan.length === 0}
          className="min-h-14 w-full rounded-xl bg-emerald-700 px-4 text-lg font-bold text-white disabled:opacity-60"
        >
          {saving ? '확정하는 중…' : done ? '다음 주 계획 확정 완료' : '다음 주 계획 1탭 확정'}
        </button>
        <div aria-live="polite" className="text-sm font-semibold text-emerald-900">
          {done ? '다음 주 계획이 확정됐어요. 알림 시각과 분량이 반영돼요.' : ''}
        </div>
        {error ? (
          <p role="alert" aria-live="assertive" className="text-sm font-semibold text-rose-800">
            오류: {error}
          </p>
        ) : null}
        <LiveRegion message={saving ? '다음 주 계획을 확정하는 중이에요' : ''} />
      </section>
    </div>
  );
}
