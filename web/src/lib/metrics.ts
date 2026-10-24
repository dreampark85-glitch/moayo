// 시연 지표 (기록·이벤트에서 계산, 순수). 정의: 계획 §6.
import { addDays, startOfWeek, today } from './date.ts';
import { buildShieldLedger } from './shield.ts';
import type { AppState, PracticeRecord } from './types.ts';

export interface MetricsView {
  weeklyDone: { normal: number; mini: number; comeback: number; total: number; bonus: number };
  firstAfterGapRate: number; // 0~100
  reminderSent: number;
  reminderDoneRate: number; // 0~100
  shieldEarned: number;
  shieldUsed: number;
  notificationOff: number;
}

const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((num / den) * 100));
const isPractice = (r: PracticeRecord) => r.kind !== 'bonus';

/** D8: 공백 후 첫 미션 = 직전 2일(전날·전전날)에 done이 없고 그 이전에 done이 있었던 상태에서 맞은 미션. 완료율 = done/전체 */
function firstAfterGap(state: AppState, t: string): number {
  const doneDates = state.records.filter((r) => isPractice(r) && r.status === 'done').map((r) => r.date);
  let total = 0;
  let done = 0;
  for (const m of state.missions) {
    const rec = state.records.find((r) => r.missionId === m.missionId);
    if (!(m.date < t || rec)) continue;
    const before = doneDates.filter((d) => d < m.date);
    if (before.length === 0) continue;
    const recent = before.some((d) => d >= addDays(m.date, -2));
    if (recent) continue;
    total += 1;
    if (rec && rec.status === 'done') done += 1;
  }
  return pct(done, total);
}

export function computeMetrics(state: AppState): MetricsView {
  const t = today();
  const start = startOfWeek(t);
  const end = addDays(start, 6);
  const week = state.records.filter((r) => r.status === 'done' && r.date >= start && r.date <= end);
  const count = (k: PracticeRecord['kind']) => week.filter((r) => r.kind === k).length;
  const normal = count('normal');
  const mini = count('mini');
  const comeback = count('comeback');

  const sent = state.events.filter((e) => e.type === 'reminder_sent' && e.payload.kind !== 'bonus');
  const withMission = sent.filter((e) => typeof e.payload.missionId === 'string');
  const reminderDone = withMission.filter((e) =>
    state.records.some((r) => r.missionId === e.payload.missionId && r.status === 'done' && isPractice(r)),
  ).length;

  const ledger = buildShieldLedger(state.goals, state.records, t);
  return {
    weeklyDone: { normal, mini, comeback, total: normal + mini + comeback, bonus: count('bonus') },
    firstAfterGapRate: firstAfterGap(state, t),
    reminderSent: state.events.filter((e) => e.type === 'reminder_sent').length,
    reminderDoneRate: pct(reminderDone, withMission.length),
    shieldEarned: ledger.filter((e) => e.type === 'earned').length,
    shieldUsed: ledger.filter((e) => e.type === 'used').length,
    notificationOff: state.events.filter((e) => e.type === 'notification_off').length,
  };
}
