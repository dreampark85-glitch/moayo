'use client';

import { useState } from 'react';
import type { Api } from '@/lib/api';
import { formatKo, today } from '@/lib/date';
import type { MetricsView } from '@/lib/metrics';
import { isSupabaseConfigured } from '@/lib/supabase';
import { MetricsPanel } from './MetricsPanel';

const BTN = 'min-h-11 rounded-lg border-2 border-slate-700 bg-white px-3 text-sm font-bold';

export function DemoTools({ api, metrics }: { api: Api; metrics: MetricsView }) {
  const [message, setMessage] = useState('');
  if (isSupabaseConfigured) return null;

  async function run(text: string, action: () => void | Promise<unknown>) {
    try {
      await action();
      setMessage(text);
    } catch (e) {
      setMessage(e instanceof Error ? `실패: ${e.message}` : '실패했어요.');
    }
  }

  return (
    <section aria-labelledby="demo-title" className="space-y-3 rounded-xl border-2 border-dashed border-amber-700 bg-amber-50 p-4">
      <h2 id="demo-title" className="text-base font-bold">
        시연 도구 (실습용)
      </h2>
      <p className="text-sm">실습용 기능이에요. 메모리에 있는 데모 상태만 바꾸며 새로고침하면 처음으로 돌아가요.</p>
      <p className="text-sm font-semibold">
        현재 가상 날짜: {formatKo(today())} ({today()})
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={BTN} onClick={() => void run('하루 뒤로 이동했어요.', () => api.advanceDays(1))}>
          +1일
        </button>
        <button type="button" className={BTN} onClick={() => void run('일주일 뒤로 이동했어요.', () => api.advanceDays(7))}>
          +1주
        </button>
        <button
          type="button"
          className={`${BTN} col-span-2`}
          onClick={() => void run('이번 미션을 놓친 것으로 처리했어요.', () => api.missNextMission())}
        >
          이번 미션 놓치기
        </button>
        <button type="button" className={BTN} onClick={() => void run('시연 시나리오(10/23)로 바꿨어요.', () => api.loadScenario('demo'))}>
          시연 시나리오(10/23)
        </button>
        <button type="button" className={BTN} onClick={() => void run('기본 데이터로 되돌렸어요.', () => api.loadScenario('default'))}>
          기본 데이터
        </button>
      </div>
      <div aria-live="polite" className="text-sm font-semibold text-emerald-900">
        {message}
      </div>
      <MetricsPanel metrics={metrics} />
    </section>
  );
}
