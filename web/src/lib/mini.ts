// 미니 미션(1분 버전) 분량 (순수). M-06: 시간형 1분, 횟수형 25%(최소 5회), 걸음형 25%(최소 500보, 계획 D3).
import type { Goal, Unit } from './types.ts';

export const MINI_MIN: Record<Unit, number> = { rep: 5, min: 1, step: 500 };

/** 비율 분량: 시간형은 고정 최소값, 걸음형은 100보 단위, 목표 분량을 넘지 않는다 */
export function scaledAmount(goal: Goal, ratio: number, min: Record<Unit, number>): number {
  if (goal.unit === 'min') return Math.min(goal.target, min.min);
  const raw = goal.unit === 'step' ? Math.round((goal.target * ratio) / 100) * 100 : Math.ceil(goal.target * ratio);
  return Math.min(goal.target, Math.max(min[goal.unit], raw));
}

export function miniAmount(goal: Goal): number {
  return scaledAmount(goal, 0.25, MINI_MIN);
}
