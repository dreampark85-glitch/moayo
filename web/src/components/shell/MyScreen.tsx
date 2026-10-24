'use client';

import Link from 'next/link';
import { useApp, useScreenReady } from '@/components/shell/AppProvider';
import { SafetyNotice } from '@/components/shell/SafetyNotice';
import { CalendarExport } from '@/components/my/CalendarExport';
import { DemoTools } from '@/components/my/DemoTools';
import { NotificationSettings } from '@/components/my/NotificationSettings';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { selectMetrics, selectNotificationStatus } from '@/lib/selectors';

const LEVEL_LABEL = { beginner: '입문', intermediate: '중급' } as const;

function DisabledRow({ label }: { label: string }) {
  return (
    <li className="flex min-h-11 items-center justify-between rounded-lg border border-slate-300 px-3 text-sm">
      <span>{label}</span>
      <button type="button" disabled aria-disabled="true" className="min-h-11 rounded-lg bg-slate-100 px-3 text-slate-600">
        준비 중
      </button>
    </li>
  );
}

export function MyScreen() {
  const { state, api } = useApp();
  const ready = useScreenReady('my');
  if (!ready) return <ScreenSkeleton label="마이 화면을 불러오는 중" />;
  const { user } = state;

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-xl font-bold">마이</h1>

      <section aria-labelledby="profile-title" className="space-y-1 rounded-xl border border-slate-300 p-4">
        <h2 id="profile-title" className="text-base font-bold">
          프로필
        </h2>
        <p className="text-sm">닉네임: {user.nickname}</p>
        <p className="text-sm">레벨: {LEVEL_LABEL[user.level]}</p>
      </section>

      <section aria-labelledby="settings-title" className="space-y-2">
        <h2 id="settings-title" className="text-base font-bold">
          설정
        </h2>
        <ul className="space-y-2">
          <li className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <p className="flex min-h-11 items-center justify-between">
              <span>알림 강도</span>
              <strong>일반 알림</strong>
            </p>
            <label className="flex min-h-11 items-center gap-3 text-slate-600">
              <input type="checkbox" disabled className="size-5" />
              강한 알림 모드 (준비 중)
            </label>
          </li>
          <DisabledRow label="헬스 연동 (HealthKit / Health Connect)" />
          <DisabledRow label="구독 (Premium)" />
        </ul>
      </section>

      <NotificationSettings settings={state.notificationSettings} status={selectNotificationStatus(state)} api={api} />

      <CalendarExport goals={state.goals} />

      <Link href="/onboarding" className="flex min-h-12 items-center justify-center rounded-xl border-2 border-emerald-700 px-4 font-bold text-emerald-900">
        온보딩 다시 하기
      </Link>

      <section aria-labelledby="safety-title" className="space-y-2">
        <h2 id="safety-title" className="text-base font-bold">
          안전 고지
        </h2>
        <SafetyNotice />
      </section>

      <DemoTools api={api} metrics={selectMetrics(state)} />

      <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
        이 프로토타입은 데이터를 메모리에만 보관해요. 새로고침하면 처음 상태로 돌아가요.
      </p>
    </div>
  );
}
