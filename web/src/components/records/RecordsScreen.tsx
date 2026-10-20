'use client';

import { useMemo, useState } from 'react';
import { useApp, useScreenReady } from '@/components/shell/AppProvider';
import { Tabs } from '@/components/ui/Tabs';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { WEEKDAY_KO, addDays, dateRange, formatKo, monthKey, startOfWeek, today, weekdayOf } from '@/lib/date';
import { selectDayDetail, selectHeatmap, selectStreak } from '@/lib/selectors';
import { DayDetailModal } from './DayDetailModal';
import { Heatmap, HeatmapLegend } from './Heatmap';

const TABS = [
  { id: 'month', label: '월간' },
  { id: 'week', label: '주간' },
];
const MAX_BACK_MONTHS = 3;
const MAX_FORWARD_MONTHS = 3;

function shiftMonth(month: string, delta: 1 | -1): string {
  const first = `${month}-01`;
  return monthKey(delta === 1 ? addDays(first, 31) : addDays(first, -1));
}

function monthTitle(month: string): string {
  const [y, m] = month.split('-');
  return `${y}년 ${Number(m)}월`;
}

export function RecordsScreen() {
  const { state } = useApp();
  const ready = useScreenReady('records');
  const [tab, setTab] = useState('month');
  const [month, setMonth] = useState(() => monthKey(today()));
  const [openDate, setOpenDate] = useState<string | null>(null);

  const heatmap = useMemo(() => selectHeatmap(state, month), [state, month]);
  const streak = useMemo(() => selectStreak(state), [state]);
  const weekCells = useMemo(() => {
    const start = startOfWeek(today());
    const days = dateRange(start, addDays(start, 6));
    const months = Array.from(new Set(days.map(monthKey)));
    const cells = months.flatMap((m) => selectHeatmap(state, m).cells);
    return days.map((d) => cells.find((c) => c.date === d)).filter((c) => c !== undefined);
  }, [state]);

  if (!ready) return <ScreenSkeleton label="기록을 불러오는 중" />;

  const current = monthKey(today());
  let min = current;
  for (let i = 0; i < MAX_BACK_MONTHS; i++) min = shiftMonth(min, -1);
  let max = current;
  for (let i = 0; i < MAX_FORWARD_MONTHS; i++) max = shiftMonth(max, 1);
  const dayItems = openDate ? selectDayDetail(state, openDate) : [];

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">기록</h1>

      <section aria-label="스트릭" className="rounded-xl border-2 border-emerald-700 bg-emerald-50 p-4">
        <p className="text-2xl font-bold">
          <span aria-hidden="true">🔥 </span>현재 {streak.current}일 연속
        </p>
        <p className="mt-1 text-sm">
          최장 {streak.longest}일 · 스트릭 보호권 {streak.protectionLeft}개 남음 (이번 달)
        </p>
        {streak.protectionUsedOn.length > 0 ? (
          <p className="mt-1 text-xs text-slate-700">보호권 사용일: {streak.protectionUsedOn.join(', ')}</p>
        ) : null}
      </section>

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="기록 보기 방식">
        {tab === 'month' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonth(shiftMonth(month, -1))}
                disabled={month <= min}
                aria-label="이전 달"
                className="min-h-11 min-w-11 rounded-lg border border-slate-400 disabled:opacity-40"
              >
                <span aria-hidden="true">◀</span>
              </button>
              <h2 aria-live="polite" className="text-base font-bold">
                {monthTitle(month)}
              </h2>
              <button
                type="button"
                onClick={() => setMonth(shiftMonth(month, 1))}
                disabled={month >= max}
                aria-label="다음 달"
                className="min-h-11 min-w-11 rounded-lg border border-slate-400 disabled:opacity-40"
              >
                <span aria-hidden="true">▶</span>
              </button>
            </div>
            <Heatmap heatmap={heatmap} label={`${monthTitle(month)} 실천 히트맵`} onOpen={setOpenDate} />
            <p className="text-xs text-slate-600">날짜를 누르면(방향키로 이동, Enter) 그날의 상세 기록을 볼 수 있어요.</p>
            <HeatmapLegend />
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-base font-bold">이번 주 (월~일)</h2>
            <ul className="space-y-2">
              {weekCells.map((c) => (
                <li key={c.date}>
                  <button
                    type="button"
                    onClick={() => setOpenDate(c.date)}
                    className="flex min-h-12 w-full items-center justify-between rounded-lg border border-slate-300 px-3 text-sm"
                  >
                    <span className="font-semibold">
                      {formatKo(c.date)}
                      {c.date === today() ? ' · 오늘' : ''}
                    </span>
                    <span>
                      {c.doneCount}회 완료{c.missedCount > 0 ? ` · 미실천 ${c.missedCount}회` : ''}
                      {c.doneCount === 0 && c.missedCount === 0 && c.scheduledCount > 0 && c.date >= today()
                        ? ` · 예정 ${c.scheduledCount}개`
                        : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-600">
              {WEEKDAY_KO[weekdayOf(today())]}요일 기준 이번 주예요. 항목을 누르면 상세 기록을 볼 수 있어요.
            </p>
          </div>
        )}
      </Tabs>

      <DayDetailModal date={openDate} items={dayItems} onClose={() => setOpenDate(null)} />
    </div>
  );
}
