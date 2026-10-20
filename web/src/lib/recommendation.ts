// 다음 운동 추천 (순수 함수). PRD 8장 + 스펙 D10~D12, D15, 계획 §4.2
import { addDays } from './date.ts';
import { isScheduled } from './missions.ts';
import type { BodyPart, Goal, ISODate, PracticeRecord, RecommendationResult, Unit } from './types.ts';

export const UNIT_STEP: Record<Unit, number> = { rep: 1, min: 1, step: 100 };
export const MIN_AMOUNT: Record<Unit, number> = { rep: 5, min: 5, step: 500 };
export const MAX_AMOUNT: Record<Unit, number> = { rep: Number.POSITIVE_INFINITY, min: 15, step: Number.POSITIVE_INFINITY };
export const MAX_INCREASE_RATIO = 0.2; // 안전 가드레일: 1회 증가폭 최대 +20%

const EPS = 1e-9;
const PAIN_PATTERN = /통증|아파|아픔|아프/;
const WARN_PARTS: BodyPart[] = ['lower', 'upper', 'core'];
const PART_LABEL: Record<BodyPart, string> = { lower: '하체', upper: '상체', core: '코어', full: '전신', cardio: '유산소' };

export function increaseAmount(base: number, unit: Unit, ratio = MAX_INCREASE_RATIO): number {
  const step = UNIT_STEP[unit];
  const inc = Math.floor((base * Math.min(ratio, MAX_INCREASE_RATIO)) / step + EPS) * step;
  return Math.min(base + inc, MAX_AMOUNT[unit]);
}

export function decreaseAmount(base: number, unit: Unit, ratio: number): number {
  const step = UNIT_STEP[unit];
  const dec = Math.ceil((base * ratio) / step - EPS) * step;
  return Math.max(base - dec, MIN_AMOUNT[unit]);
}

export function hasPainMemo(memo: string): boolean {
  return PAIN_PATTERN.test(memo);
}

export interface RecommendInput {
  goal: Goal;
  goals: Goal[];
  records: PracticeRecord[]; // 모든 목표의 기록
  today: ISODate;
  painClearedAt: Record<string, string>;
}

function byRecent(a: PracticeRecord, b: PracticeRecord): number {
  return a.completedAt < b.completedAt ? 1 : a.completedAt > b.completedAt ? -1 : 0;
}

/** 운동 종류 기준: [today-27, today]를 7일 4구간으로 나눠 모든 구간에 done 기록이 있는가 */
export function isFourWeekStreak(exercise: string, goals: Goal[], records: PracticeRecord[], today: ISODate): boolean {
  const ids = new Set(goals.filter((g) => g.exercise === exercise).map((g) => g.goalId));
  const done = records.filter((r) => r.status === 'done' && ids.has(r.goalId));
  for (let w = 0; w < 4; w++) {
    const end = addDays(today, -7 * w);
    const start = addDays(end, -6);
    if (!done.some((r) => r.date >= start && r.date <= end)) return false;
  }
  return true;
}

/** 같은 부위(하체·상체·코어) 다른 목표가 이 목표의 다음 예정일 전/후일에 있으면 경고 */
export function bodyPartWarnings(goal: Goal, goals: Goal[], today: ISODate): string[] {
  if (!WARN_PARTS.includes(goal.bodyPart)) return [];
  const others = goals.filter((g) => g.goalId !== goal.goalId && g.bodyPart === goal.bodyPart && g.status === 'active');
  const warnings: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    if (!isScheduled(goal, d)) continue;
    for (const other of others) {
      for (const adj of [addDays(d, -1), addDays(d, 1)]) {
        if (isScheduled(other, adj)) {
          const msg = `같은 부위(${PART_LABEL[goal.bodyPart]}) 운동이 연속일에 배정돼 있어요 (${other.exercise}). 회복 시간을 고려해 주세요.`;
          if (!warnings.includes(msg)) warnings.push(msg);
        }
      }
    }
    if (warnings.length > 0) break;
  }
  return warnings;
}

export function recommend(input: RecommendInput): RecommendationResult {
  const { goal, goals, records, today, painClearedAt } = input;
  const base = goal.target;
  const unit = goal.unit;
  const label = goal.exercise;
  const history = records.filter((r) => r.goalId === goal.goalId).sort(byRecent);
  const recent = history.slice(0, 3);
  const n = history.length;
  const warnings = bodyPartWarnings(goal, goals, today);

  const result: RecommendationResult = {
    goalId: goal.goalId,
    rule: 'none',
    currentAmount: base,
    proposedAmount: base,
    plus10Amount: null,
    message: '',
    extras: [],
    warnings,
    stop: false,
    atCap: false,
    atMin: false,
  };

  if (n === 0) {
    result.rule = 'no_data';
    result.message = `아직 기록이 없어요. 처음 목표(${base}${unitSuffix(unit)})로 시작해 볼까요?`;
    return result;
  }

  // 1. 통증 (최근 3건, 통증 해제 시각 이후)
  const clearedAt = painClearedAt[goal.exercise] ?? '';
  if (recent.some((r) => hasPainMemo(r.memo) && r.completedAt > clearedAt)) {
    result.rule = 'pain_stop';
    result.stop = true;
    result.message = `통증 메모가 있어 ${label} 추천을 멈췄어요. 충분히 쉬고, 통증이 계속되면 운동을 중단하고 전문가와 상담하세요.`;
    return result;
  }

  const missed = recent.filter((r) => r.status === 'missed').length;
  const hard = recent.filter((r) => r.difficulty === 'hard').length;
  const easy = recent.filter((r) => r.difficulty === 'easy').length;
  const allDone = recent.length === 3 && recent.every((r) => r.status === 'done');
  const fourWeek = isFourWeekStreak(goal.exercise, goals, records, today);
  const fourWeekExtra = '같은 운동을 4주째 하고 있어요. 새 운동이나 챌린지는 어때요?';

  const missedTrigger = n >= 3 ? missed >= 2 : recent[0].status === 'missed';
  const hardTrigger = n >= 3 ? hard >= 2 : recent[0].difficulty === 'hard';

  if (missedTrigger) {
    const next = decreaseAmount(base, unit, 0.3);
    result.rule = 'missed_down';
    result.proposedAmount = next;
    result.atMin = next === base;
    result.message = result.atMin
      ? '이미 최소 분량이에요. 분량 대신 시간대 변경이나 미니 미션을 고려해요.'
      : `최근 실천이 어려웠나 봐요. ${next}${unitSuffix(unit)}로 줄이고 시간대를 바꿔볼까요?`;
    result.extras.push('시간이 없을 땐 1분 미니 미션을 권해요. (미니 미션은 다음 버전에서 제공돼요)');
    if (fourWeek) result.extras.push(fourWeekExtra);
    return result;
  }

  if (hardTrigger) {
    const next = decreaseAmount(base, unit, 0.2);
    result.rule = 'hard_down';
    result.proposedAmount = next;
    result.atMin = next === base;
    result.message = result.atMin
      ? '이미 최소 분량이에요. 무리하지 말고 쉬운 대체 운동을 고려해요.'
      : `무리하지 말고 ${next}${unitSuffix(unit)}로 조정해요.`;
    if (fourWeek) result.extras.push(fourWeekExtra);
    return result;
  }

  if (n < 3) {
    result.rule = 'insufficient_data';
    result.message = '현재 분량을 유지해요. 기록이 3회 쌓이면 맞춤 추천을 해드릴게요 (데이터 더 모으는 중).';
    return result;
  }

  if (allDone && easy >= 2) {
    const next = increaseAmount(base, unit);
    result.rule = 'easy_up';
    result.proposedAmount = next;
    result.atCap = next === base;
    result.message = result.atCap
      ? `이미 상한(${MAX_AMOUNT[unit]}${unitSuffix(unit)})이에요. 현재 분량을 유지해요.`
      : `이제 ${next}${unitSuffix(unit)}도 충분해요. 올려볼까요?`;
    if (fourWeek) result.extras.push(fourWeekExtra);
    return result;
  }

  if (allDone && hard === 0) {
    result.rule = 'ok_hold';
    result.proposedAmount = base;
    const plus = increaseAmount(base, unit, 0.1);
    result.plus10Amount = plus > base ? plus : null;
    result.message = '좋은 페이스예요. 분량은 유지하고 운동 종류를 하나 더해볼까요?';
    result.extras.push('운동 종류 1개 추가를 제안해요. (수정 화면에서 분량 +10%도 선택할 수 있어요)');
    if (fourWeek) result.extras.push(fourWeekExtra);
    return result;
  }

  if (fourWeek) {
    result.rule = 'four_week_new';
    result.message = fourWeekExtra;
    return result;
  }

  result.rule = 'none';
  result.message = '현재 분량을 유지해요.';
  return result;
}

export function unitSuffix(unit: Unit): string {
  return unit === 'rep' ? '회' : unit === 'min' ? '분' : '보';
}
