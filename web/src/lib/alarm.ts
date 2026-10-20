// 알림 시뮬레이션 규칙 (순수 함수, M-01). 시간 판단은 Date.now() 기반 deadline(ms)으로만 한다.
import type { AlarmState } from './types.ts';

export const SPEED = 60; // 시연 배속: 가상 10분 = 실제 10초
export const SNOOZE_VIRTUAL_MINUTES = 10;
export const SNOOZE_REAL_MS = (SNOOZE_VIRTUAL_MINUTES * 60 * 1000) / SPEED;
export const LAST_RING_TIMEOUT_MS = 30_000; // 3번째 노출 미해제 타임아웃
export const MAX_SNOOZE = 2;

export function triggerAlarm(missionId: string): AlarmState {
  return { missionId, shown: 1, phase: 'ringing', deadlineAt: null };
}

export function canSnooze(alarm: AlarmState): boolean {
  return alarm.phase === 'ringing' && alarm.shown <= MAX_SNOOZE;
}

/** 스누즈: shown<3 이고 ringing일 때만. 가상 10분(실제 SNOOZE_REAL_MS) 후 재노출 */
export function snoozeAlarm(alarm: AlarmState, now: number): AlarmState {
  if (!canSnooze(alarm)) return alarm;
  return { ...alarm, phase: 'snoozed', deadlineAt: now + SNOOZE_REAL_MS };
}

export type AlarmStep = { type: 'none' } | { type: 'wake'; next: AlarmState } | { type: 'timeout' };

export function nextAlarmStep(alarm: AlarmState, now: number): AlarmStep {
  if (alarm.deadlineAt === null || now < alarm.deadlineAt) return { type: 'none' };
  if (alarm.phase === 'snoozed') {
    const shown = (alarm.shown + 1) as AlarmState['shown'];
    const deadlineAt = shown === 3 ? now + LAST_RING_TIMEOUT_MS : null;
    return { type: 'wake', next: { ...alarm, shown, phase: 'ringing', deadlineAt } };
  }
  return alarm.shown === 3 ? { type: 'timeout' } : { type: 'none' };
}
