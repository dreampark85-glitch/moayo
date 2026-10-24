'use client';

import { useState } from 'react';
import { CountRun, StepsRun, TimerRun } from '@/components/mission/MissionScreen';
import { KIND_LABEL, amountLabel } from '@/components/mission/labels';
import { useApp } from '@/components/shell/AppProvider';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { today } from '@/lib/date';
import { selectBonusOptions } from '@/lib/selectors';
import { bonusMissionId } from '@/lib/types';
import type { BonusOption } from '@/lib/types';

const SECONDARY_BTN = 'min-h-11 rounded-xl border-2 border-slate-500 px-4 font-semibold text-slate-900 disabled:opacity-50';

export function RestDayCard() {
  const { state, api } = useApp();
  const options = selectBonusOptions(state);
  const [active, setActive] = useState<BonusOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const doneIds = new Set(state.records.filter((r) => r.kind === 'bonus' && r.date === today()).map((r) => r.missionId));
  const isDone = (o: BonusOption) => doneIds.has(bonusMissionId(today(), o.bonusKey));
  const doneOptions = options.filter(isDone);

  async function complete(option: BonusOption, amount: number, durationSec: number) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.saveBonus({ bonusKey: option.bonusKey, amount, durationSec });
      setNotice(`${option.label} 보너스 완료`);
      setActive(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '보너스 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="쉬는 날 보너스" className="space-y-3 rounded-2xl border-2 border-sky-700 bg-sky-50 p-4 text-slate-900">
      <h2 className="text-2xl font-bold">오늘은 쉬는 날</h2>
      <p className="text-sm">
        쉬는 날에는 원하면 1분짜리 {KIND_LABEL.bonus} 운동을 해볼 수 있어요. 보너스는 스트릭과 주간 실천 횟수에 포함되지 않아요.
      </p>
      <LiveRegion message={notice} />
      {error && active && (
        <RetryBanner message={error} onRetry={() => complete(active, active.amount, active.unit === 'min' ? active.amount * 60 : 0)} retrying={saving} />
      )}
      {active ? (
        <div className="space-y-3 rounded-xl bg-white p-3">
          <p className="text-lg font-bold">
            {active.label} {amountLabel(active.unit, active.amount)}
          </p>
          {active.unit === 'rep' && (
            <CountRun target={active.amount} initial={0} doneLabel="보너스 완료" onComplete={(n) => complete(active, n, 0)} />
          )}
          {active.unit === 'step' && (
            <StepsRun target={active.amount} initial={0} doneLabel="보너스 완료" onComplete={(n) => complete(active, n, 0)} />
          )}
          {active.unit === 'min' && (
            <TimerRun targetMin={active.amount} doneLabel="보너스 완료" onComplete={(sec) => complete(active, active.amount, sec)} />
          )}
          <button type="button" onClick={() => setActive(null)} disabled={saving} className={`${SECONDARY_BTN} w-full`}>
            그만두기
          </button>
        </div>
      ) : (
        options.length > 0 && (
          <ul className="space-y-2">
            {options.map((o) => (
              <li key={o.bonusKey} className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                <span className="font-semibold">
                  {o.label} {amountLabel(o.unit, o.amount)}
                </span>
                {isDone(o) ? (
                  <span className="rounded-full border-2 border-emerald-800 px-2 py-0.5 text-sm font-bold text-emerald-900">
                    <span aria-hidden="true">✓ </span>보너스 완료
                  </span>
                ) : (
                  <button type="button" onClick={() => setActive(o)} className={SECONDARY_BTN}>
                    시작
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      )}
      {doneOptions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold">오늘 완료한 보너스</h3>
          <ul className="list-inside list-disc text-sm">
            {doneOptions.map((o) => (
              <li key={o.bonusKey}>
                {o.label} {amountLabel(o.unit, o.amount)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
