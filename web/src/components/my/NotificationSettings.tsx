'use client';

import { useState } from 'react';
import type { Api } from '@/lib/api';
import type { NotificationStatus } from '@/lib/selectors';
import type { NotificationSettings as Settings, ReminderSetting } from '@/lib/types';

const REMINDER_OPTIONS: { value: ReminderSetting; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'hourBefore', label: '1시간 전' },
  { value: 'morning', label: '당일 오전 9시' },
];

interface Props {
  settings: Settings;
  status: NotificationStatus;
  api: Api;
}

export function NotificationSettings({ settings, status, api }: Props) {
  const [message, setMessage] = useState('');

  async function update(patch: Parameters<Api['setNotificationSetting']>[0], text: string) {
    try {
      await api.setNotificationSetting(patch);
      setMessage(text);
    } catch (e) {
      setMessage(e instanceof Error ? `설정을 저장하지 못했어요: ${e.message}` : '설정을 저장하지 못했어요.');
    }
  }

  return (
    <section aria-labelledby="noti-title" className="space-y-3 rounded-xl border border-slate-300 p-4">
      <h2 id="noti-title" className="text-base font-bold">
        알림 설정
      </h2>

      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold">미션 리마인드</legend>
        <div role="radiogroup" aria-label="미션 리마인드 시점" className="space-y-1">
          {REMINDER_OPTIONS.map((o) => (
            <label key={o.value} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="radio"
                name="reminder"
                value={o.value}
                checked={settings.reminder === o.value}
                onChange={() => void update({ reminder: o.value }, `리마인드를 '${o.label}'(으)로 바꿨어요.`)}
                className="size-5"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings.bonusNotification}
          onChange={(e) =>
            void update({ bonusNotification: e.target.checked }, `보너스 알림을 ${e.target.checked ? '켰어요' : '껐어요'}.`)
          }
          className="size-5"
        />
        보너스 알림 받기
      </label>

      <div className="rounded-lg bg-slate-100 p-3 text-sm">
        <p>하루 최대 2회: 리마인드 1회 + 미션 알림 1회, 스누즈는 별도 집계 안 함</p>
        <p className="mt-1 font-semibold">
          오늘 사용: {status.todayCount}/{status.cap}회{status.capReached ? ' · 오늘 알림 상한 도달' : ''}
        </p>
      </div>
      <div aria-live="polite" className="text-sm font-semibold text-emerald-900">
        {message}
      </div>
    </section>
  );
}
