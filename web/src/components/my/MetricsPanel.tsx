'use client';

import type { MetricsView } from '@/lib/metrics';

export function MetricsPanel({ metrics }: { metrics: MetricsView }) {
  const { weeklyDone: w } = metrics;
  const rows: { label: string; value: string }[] = [
    { label: '이번 주 실천', value: `일반 ${w.normal} · 미니 ${w.mini} · 복귀 ${w.comeback} (합계 ${w.total}회)` },
    { label: '보너스 (별도 집계)', value: `${w.bonus}회` },
    { label: '공백 후 첫 미션 완료율', value: `${metrics.firstAfterGapRate}%` },
    { label: '리마인드 발송 수', value: `${metrics.reminderSent}회` },
    { label: '리마인드 후 완료율', value: `${metrics.reminderDoneRate}%` },
    { label: '보호권 획득', value: `${metrics.shieldEarned}개` },
    { label: '보호권 사용', value: `${metrics.shieldUsed}개` },
    { label: '알림 끄기 횟수', value: `${metrics.notificationOff}회` },
  ];
  return (
    <section aria-labelledby="metrics-title" className="space-y-2">
      <h3 id="metrics-title" className="text-sm font-bold">
        시연 지표
      </h3>
      <dl className="grid grid-cols-1 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-lg border border-slate-300 bg-white p-3">
            <dt className="text-xs text-slate-600">{r.label}</dt>
            <dd className="text-sm font-bold">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
