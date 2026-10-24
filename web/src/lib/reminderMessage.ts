// 리마인드 문구 (순수). PRD M-08 표 + 조사 보정. 시각은 'H시'(분이 있으면 'H시 M분') 표기.
import { timeOf } from './date.ts';
import { withJosa } from './josa.ts';
import { decreaseAmount, unitSuffix } from './recommendation.ts';
import type { Goal, Mission, PracticeRecord } from './types.ts';

export function koTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return m === 0 ? `${h}시` : `${h}시 ${m}분`;
}

export function reminderMessage(goal: Goal, records: PracticeRecord[], nextMission: Mission | null): string {
  const time = koTime(nextMission ? timeOf(nextMission.scheduledAt) : goal.time);
  const last = records
    .filter((r) => r.goalId === goal.goalId && r.kind !== 'bonus' && r.status === 'done' && r.difficulty !== null)
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0))[0];
  const suffix = unitSuffix(goal.unit);
  const amountRo = (n: number) => withJosa(`${n}${suffix}`, '으로/로');
  if (!last) return `오늘 ${time}, 첫 ${goal.exercise} 미션이 있어요.`;
  if (last.difficulty === 'easy') return `지난번엔 쉬웠어요. 오늘 ${time}, ${goal.exercise} ${amountRo(goal.target)} 가볍게!`;
  if (last.difficulty === 'hard') {
    return `지난번엔 힘들었죠. 오늘은 ${amountRo(decreaseAmount(goal.target, goal.unit, 0.2))} 맞춰 뒀어요.`;
  }
  return `지난주 ${withJosa(goal.exercise, '은/는')} ‘적당해요’였어요. 오늘 ${time}, 같은 분량이에요.`;
}
