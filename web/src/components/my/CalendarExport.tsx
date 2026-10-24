'use client';

import { useState } from 'react';
import { buildIcs } from '@/lib/ics';
import type { Goal } from '@/lib/types';

export function CalendarExport({ goals }: { goals: Goal[] }) {
  const [message, setMessage] = useState('');
  const active = goals.filter((g) => g.status === 'active');

  function download() {
    const ics = buildIcs(active, new Date().toISOString());
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'moayo-goals.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage('캘린더 파일(moayo-goals.ics)을 내려받았어요.');
  }

  return (
    <section aria-labelledby="cal-title" className="space-y-2 rounded-xl border border-slate-300 p-4">
      <h2 id="cal-title" className="text-base font-bold">
        캘린더 내보내기
      </h2>
      <button
        type="button"
        onClick={download}
        disabled={active.length === 0}
        className="min-h-12 w-full rounded-xl border-2 border-emerald-700 px-4 font-bold text-emerald-900 disabled:opacity-50"
      >
        캘린더(.ics) 내보내기
      </button>
      {active.length === 0 ? <p className="text-sm text-slate-700">진행 중인 목표가 없어서 내보낼 일정이 없어요.</p> : null}
      <div aria-live="polite" className="text-sm font-semibold text-emerald-900">
        {message}
      </div>
    </section>
  );
}
