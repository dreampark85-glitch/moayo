'use client';

import Link from 'next/link';
import { amountLabel } from '@/components/mission/labels';
import { RestDayCard } from '@/components/home/RestDayCard';
import { SafetyNotice } from '@/components/shell/SafetyNotice';
import { useApp, useScreenReady } from '@/components/shell/AppProvider';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { formatKo, timeOf, today } from '@/lib/date';
import {
  selectComeback,
  selectNextAlarm,
  selectNotificationStatus,
  selectRestDay,
  selectStreak,
  selectTodayMissions,
} from '@/lib/selectors';
import type { MissionView } from '@/lib/selectors';

const STATUS_LABEL = { pending: '대기', done: '완료', missed: '미실천' } as const;
const STATUS_MARK = { pending: '○', done: '✓', missed: '✕' } as const;

export function HomeScreen() {
  const { state, api } = useApp();
  const ready = useScreenReady('home');
  if (!ready) return <ScreenSkeleton label="홈을 불러오는 중" />;

  const todays = selectTodayMissions(state);
  const featured = todays.find((v) => v.status === 'pending') ?? null;
  const others = todays.filter((v) => v !== featured);
  const next = selectNextAlarm(state);
  const streak = selectStreak(state);
  const comeback = selectComeback(state);
  const featuredComeback = comeback && featured && comeback.missionId === featured.mission.missionId ? comeback : null;
  const restDay = selectRestDay(state);
  const status = selectNotificationStatus(state);
  const statusText = [status.capReached ? '오늘 알림 상한 도달' : '', ...status.reasons].filter(Boolean).join(' · ');
  const reminder = state.reminder;

  return (
    <div className="space-y-5 p-4">
      <header>
        <p className="text-sm text-slate-600">{formatKo(today())}</p>
        <h1 className="text-2xl font-bold text-slate-900">오늘의 미션</h1>
      </header>

      <section aria-label="스트릭" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
        <p className="text-lg font-bold">연속 {streak.current}일 실천 중</p>
        <p className="text-sm">
          최장 {streak.longest}일 · 보호권 {streak.protectionLeft > 0 ? `${streak.protectionLeft}개 남음` : '이번 달 사용함'}
        </p>
      </section>

      {restDay && <RestDayCard />}

      <section aria-label="오늘의 미션 카드" className="rounded-2xl bg-slate-900 p-5 text-white">
        {featured ? (
          <>
            <p className="text-sm text-slate-300">{timeOf(featured.mission.scheduledAt)} 예정</p>
            <p className="mt-1 text-3xl font-bold">{featured.goal.exercise}</p>
            <p className="text-5xl font-extrabold">
              {amountLabel(featured.goal.unit, featuredComeback ? featuredComeback.amount : featured.goal.target)}
            </p>
            {featuredComeback && <p className="mt-2 text-base text-slate-100">{featuredComeback.message}</p>}
            <Link
              href={`/mission/${featured.mission.missionId}${featuredComeback ? '?mode=comeback' : ''}`}
              className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-emerald-400 px-4 text-lg font-bold text-slate-900"
            >
              지금 시작
            </Link>
          </>
        ) : todays.length > 0 ? (
          <>
            <p className="text-2xl font-bold">오늘 미션을 모두 마쳤어요</p>
            <p className="mt-1 text-sm text-slate-300">처리된 미션은 아래 목록에서 확인할 수 있어요.</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold">오늘은 예정된 미션이 없어요</p>
            <p className="mt-1 text-sm text-slate-300">
              {next
                ? `다음 미션은 ${formatKo(next.mission.date)} ${timeOf(next.mission.scheduledAt)} ${next.goal.exercise}이에요.`
                : '목표를 추가해 보세요.'}
            </p>
          </>
        )}
      </section>

      {reminder && reminder.message && (
        <section aria-label="리마인드" className="rounded-xl border-2 border-emerald-700 bg-emerald-50 p-3 text-emerald-950">
          <h2 className="text-sm font-bold">리마인드</h2>
          <p className="text-base font-semibold">{reminder.message}</p>
        </section>
      )}

      <section aria-label="다음 알림" className="rounded-xl border border-slate-200 p-3">
        <h2 className="text-sm font-semibold text-slate-600">다음 알림</h2>
        <p className="text-lg font-bold text-slate-900">
          {next ? `${formatKo(next.mission.date)} ${timeOf(next.mission.scheduledAt)} · ${next.goal.exercise}` : '예정된 알림이 없어요'}
        </p>
        <button
          type="button"
          disabled={!featured}
          onClick={() => featured && api.alarmTrigger(featured.mission.missionId)}
          className="mt-2 min-h-11 rounded-lg border border-slate-400 px-4 text-sm font-semibold text-slate-900 disabled:opacity-50"
        >
          지금 알림 발생(시연)
        </button>
        <button
          type="button"
          onClick={() => api.triggerReminder()}
          className="ml-2 mt-2 min-h-11 rounded-lg border border-slate-400 px-4 text-sm font-semibold text-slate-900"
        >
          리마인드 발생(시연)
        </button>
        <p role="status" className={statusText ? 'mt-2 rounded-lg border-2 border-amber-700 bg-amber-50 p-2 text-sm font-semibold text-amber-950' : 'sr-only'}>
          {statusText}
        </p>
      </section>

      {others.length > 0 && (
        <section aria-label="오늘의 다른 미션">
          <h2 className="mb-2 text-lg font-bold text-slate-900">오늘의 다른 미션</h2>
          <ul className="space-y-2">
            {others.map((v) => (
              <MissionRow key={v.mission.missionId} view={v} />
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/goals/new"
        className="flex min-h-11 items-center justify-center rounded-xl border border-slate-400 px-4 font-semibold text-slate-900"
      >
        목표 추가
      </Link>

      <SafetyNotice />
    </div>
  );
}

function MissionRow({ view }: { view: MissionView }) {
  return (
    <li className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
      <Link href={`/mission/${view.mission.missionId}`} className="flex min-h-11 flex-1 flex-col justify-center">
        <span className="font-semibold text-slate-900">
          {view.goal.exercise} {amountLabel(view.goal.unit, view.goal.target)}
        </span>
        <span className="text-xs text-slate-600">{timeOf(view.mission.scheduledAt)}</span>
      </Link>
      <span className="ml-2 rounded-full border border-slate-400 px-2 py-0.5 text-sm font-semibold text-slate-900">
        <span aria-hidden="true">{STATUS_MARK[view.status]} </span>
        {STATUS_LABEL[view.status]}
      </span>
    </li>
  );
}
