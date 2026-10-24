// 복귀 미션 (순수). 8.3: 스트릭이 0으로 끊긴 직후 첫 목표일 미션 1회, 분량 50%(최소 5회/1분/500보).
// 증가가 없는 분량이므로 +20% 가드레일은 영향받지 않고, 통증 메모가 있으면 대상에서 제외한다.
import { scaledAmount } from './mini.ts';
import { hasActivePain, unitSuffix } from './recommendation.ts';
import { simulateStreak } from './streak.ts';
import { today } from './date.ts';
import type { AppState, Goal, Unit } from './types.ts';

export interface ComebackTarget {
  missionId: string;
  goalId: string;
  amount: number;
  message: string;
}

const COMEBACK_MIN: Record<Unit, number> = { rep: 5, min: 1, step: 500 };

export function comebackAmount(goal: Goal): number {
  return scaledAmount(goal, 0.5, COMEBACK_MIN);
}

export function comebackMessage(goal: Goal): string {
  return `다시 시작이 제일 어려워요. 오늘은 ${comebackAmount(goal)}${unitSuffix(goal.unit)}만.`;
}

/** 복귀 대상 미션(없으면 null): 마지막 끊김 이후 가장 이른 미션이 오늘 이후이고 기록이 없을 때만 */
export function comebackTarget(state: AppState): ComebackTarget | null {
  const t = today();
  const { lastBreak } = simulateStreak(state.goals, state.records, t);
  if (!lastBreak) return null;
  const after = state.missions
    .filter((m) => m.date > lastBreak && state.goals.some((g) => g.goalId === m.goalId && g.status === 'active'))
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
  if (after.length === 0) return null;
  const firstDate = after[0].date;
  if (firstDate < t) return null;
  for (const m of after.filter((x) => x.date === firstDate)) {
    if (state.records.some((r) => r.missionId === m.missionId)) continue;
    const goal = state.goals.find((g) => g.goalId === m.goalId)!;
    if (hasActivePain(goal, state.records, state.painClearedAt)) continue;
    return { missionId: m.missionId, goalId: goal.goalId, amount: comebackAmount(goal), message: comebackMessage(goal) };
  }
  return null;
}
