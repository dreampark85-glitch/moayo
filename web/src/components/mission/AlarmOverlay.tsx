'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { amountLabel } from '@/components/mission/labels';
import { useApp } from '@/components/shell/AppProvider';
import { MAX_SNOOZE, canSnooze } from '@/lib/alarm';
import { selectComeback, selectMissionView } from '@/lib/selectors';

const TICK_MS = 250;

export function AlarmOverlay() {
  const { state, api } = useApp();
  const alarm = state.alarm;
  const active = alarm !== null;
  const [now, setNow] = useState<number | null>(null);

  // 마운트 후에만 동작하는 틱: snoozed 상태에서도 재노출·타임아웃 판단을 위해 계속 돈다
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      api.alarmTick();
      setNow(Date.now());
    }, TICK_MS);
    return () => clearInterval(id);
  }, [active, api]);

  if (!alarm || alarm.phase !== 'ringing') return null;
  const view = selectMissionView(state, alarm.missionId);
  if (!view) return null;
  const comeback = selectComeback(state);
  const comebackMessage = comeback && comeback.missionId === alarm.missionId ? comeback.message : '';
  const remainingSec =
    alarm.shown === 3 && alarm.deadlineAt !== null && now !== null
      ? Math.max(0, Math.ceil((alarm.deadlineAt - now) / 1000))
      : null;

  return (
    <AlarmDialog
      key={`${alarm.missionId}-${alarm.shown}`}
      title={`${view.goal.exercise} 미션 알림`}
      body={`${view.goal.exercise} ${amountLabel(view.goal.unit, view.goal.target)}를 하면 꺼져요`}
      shown={alarm.shown}
      snoozeLeft={MAX_SNOOZE - (alarm.shown - 1)}
      snoozable={canSnooze(alarm)}
      remainingSec={remainingSec}
      comebackMessage={comebackMessage}
      missionId={alarm.missionId}
    />
  );
}

interface DialogProps {
  title: string;
  body: string;
  shown: 1 | 2 | 3;
  snoozeLeft: number;
  snoozable: boolean;
  remainingSec: number | null;
  comebackMessage: string;
  missionId: string;
}

function AlarmDialog({ title, body, shown, snoozeLeft, snoozable, remainingSec, comebackMessage, missionId }: DialogProps) {
  const { api } = useApp();
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    startRef.current?.focus();
    return () => previous?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault(); // 스킵 불가
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeEl = document.activeElement;
    const inside = dialogRef.current?.contains(activeEl) ?? false;
    if (e.shiftKey && (activeEl === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (activeEl === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  function start() {
    api.alarmStart();
    router.push(`/mission/${missionId}`);
  }

  function startMini() {
    api.alarmStart();
    router.push(`/mission/${missionId}?mode=mini`);
  }

  // 3번째 노출 카운트다운 안내는 5초 단위로만 갱신해 스크린리더 과다 낭독을 막는다
  const announce =
    remainingSec === null ? '' : `약 ${Math.ceil(remainingSec / 5) * 5}초 안에 시작하지 않으면 미실천으로 기록돼요.`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alarm-title"
        aria-describedby="alarm-desc"
        onKeyDown={onKeyDown}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-slate-900"
      >
        <p className="text-sm font-semibold text-slate-700">알림 {shown}/3</p>
        <h2 id="alarm-title" className="text-2xl font-bold">
          {title}
        </h2>
        <p id="alarm-desc" className="text-xl font-semibold">
          {body}
        </p>
        {comebackMessage && <p className="text-base text-slate-800">{comebackMessage}</p>}
        <p className="text-sm text-slate-700">남은 스누즈 {snoozeLeft}회</p>
        {remainingSec !== null && (
          <div className="rounded-xl border-2 border-rose-700 bg-rose-50 p-3 text-rose-950">
            <p className="text-lg font-bold" aria-hidden="true">
              남은 시간 {remainingSec}초
            </p>
            <p className="text-sm">마지막 알림이에요. 시간 안에 시작하지 않으면 미실천 기록이 저장돼요.</p>
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {announce}
            </div>
          </div>
        )}
        <button
          ref={startRef}
          type="button"
          onClick={start}
          className="min-h-14 w-full rounded-xl bg-emerald-700 px-4 text-lg font-bold text-white"
        >
          미션 시작
        </button>
        <button
          type="button"
          onClick={startMini}
          className="min-h-12 w-full rounded-xl border-2 border-emerald-700 px-4 font-semibold text-emerald-900"
        >
          오늘은 1분 버전으로
        </button>
        {snoozable && (
          <button
            type="button"
            onClick={() => api.alarmSnooze()}
            className="min-h-12 w-full rounded-xl border-2 border-slate-500 px-4 font-semibold text-slate-900"
          >
            스누즈 10분 (남은 {snoozeLeft}회)
          </button>
        )}
      </div>
    </div>
  );
}
