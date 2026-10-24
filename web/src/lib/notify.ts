// 알림 일일 상한 판단 (순수). M-10: 하루 최대 2회(미션 1 + 리마인드 1), 스누즈는 집계 안 함.
// 보너스 알림은 설정이 켜진 경우만, 합산 상한 2에 포함(D5). 우선순위 미션 > 리마인드 > 보너스.
// 보너스 알림은 reminder_sent 이벤트(payload.kind === 'bonus')로 기록한다.
import type { AppEvent, ISODate, NotificationSettings } from './types.ts';

export type NotifyKind = 'mission' | 'reminder' | 'bonus';

export interface NotifyDecision {
  ok: boolean;
  reason?: string;
}

export function canNotify(events: AppEvent[], date: ISODate, kind: NotifyKind, settings: NotificationSettings): NotifyDecision {
  const todays = events.filter((e) => e.date === date);
  const missions = todays.filter((e) => e.type === 'alarm_fired').length;
  const sent = todays.filter((e) => e.type === 'reminder_sent');
  const bonuses = sent.filter((e) => e.payload.kind === 'bonus').length;
  const reminders = sent.length - bonuses;
  if (missions + sent.length >= settings.dailyCap) {
    return { ok: false, reason: `오늘 알림 상한(${settings.dailyCap}회)에 도달했어요` };
  }
  if (kind === 'mission' && missions >= 1) return { ok: false, reason: '미션 알림은 하루 1회까지만 보내요' };
  if (kind === 'reminder' && reminders >= 1) return { ok: false, reason: '리마인드는 하루 1회까지만 보내요' };
  if (kind === 'bonus') {
    if (!settings.bonusNotification) return { ok: false, reason: '보너스 알림이 꺼져 있어요' };
    if (bonuses >= 1) return { ok: false, reason: '보너스 알림은 하루 1회까지만 보내요' };
  }
  return { ok: true };
}
