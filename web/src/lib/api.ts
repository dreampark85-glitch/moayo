// Mock API (비동기). fetch·서버 코드·DB 없이 메모리 상태만 다룬다.
// 읽기/쓰기 계약은 Supabase 전환 시 이 파일만 교체하면 되도록 유지한다.
//  - 영속 쓰기: API_DELAY_MS(700ms) 지연, 회고 메모에 FAIL_TRIGGER 포함 시 saveRecord 실패
//  - 알림 시뮬레이션·카운트·타이머는 클라이언트 로컬 처리(지연 없음, 스펙 D13)
import { addDays, makeDateTime, today } from './date.ts';
import { MAX_AMOUNT, MIN_AMOUNT } from './recommendation.ts';
import { buildMissions } from './missions.ts';
import { canSnooze, nextAlarmStep, snoozeAlarm, triggerAlarm } from './alarm.ts';
import type { Action } from './reducer.ts';
import { durationOf, seedTodayMissionIds } from './seed.ts';
import type {
  AppState,
  Goal,
  GoalInput,
  PracticeRecord,
  Recommendation,
  RecommendationResponse,
  RecordInput,
  RuleId,
} from './types.ts';

export const API_DELAY_MS = 700;
export const FAIL_TRIGGER = '실패테스트';

export class SaveFailedError extends Error {
  constructor() {
    super('기록 저장에 실패했어요. 메모를 확인한 뒤 다시 시도해 주세요.');
    this.name = 'SaveFailedError';
  }
}

export function delay(ms: number = API_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ApplyItem {
  goalId: string;
  rule: RuleId;
  response: RecommendationResponse;
  amount: number;
  time?: string;
}

export interface Api {
  createGoal(input: GoalInput): Promise<Goal>;
  completeOnboarding(input: GoalInput): Promise<Goal>;
  saveRecord(input: RecordInput): Promise<PracticeRecord>;
  markMissed(missionId: string): Promise<PracticeRecord>;
  applyRecommendation(item: ApplyItem): Promise<Recommendation>;
  confirmNextWeek(items: ApplyItem[]): Promise<Recommendation[]>;
  clearPain(exercise: string): Promise<void>;
  alarmTrigger(missionId: string): void;
  /** 가능하면 스누즈하고 true, 불가(3번째 노출 등)면 false */
  alarmSnooze(): boolean;
  alarmTick(): void;
  /** '미션 시작'으로 알림 해제(미션 화면 진입 직전) */
  alarmStart(): void;
}

/** generateStaticParams용: 빌드 시 정적 생성할 미션 id (오늘 예정 미션) */
export function listStaticMissionIds(): string[] {
  return seedTodayMissionIds();
}

export function validateGoalInput(input: GoalInput): string | null {
  if (!input.exercise.trim()) return '운동 종류를 입력해 주세요.';
  if (input.weekdays.length === 0) return '요일을 하나 이상 선택해 주세요.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return '시각을 HH:mm 형식으로 입력해 주세요.';
  if (input.target < MIN_AMOUNT[input.unit]) return `분량은 ${MIN_AMOUNT[input.unit]} 이상이어야 해요.`;
  if (input.target > MAX_AMOUNT[input.unit]) return `분량은 ${MAX_AMOUNT[input.unit]} 이하여야 해요.`;
  return null;
}

export function createApi(getState: () => AppState, dispatch: (a: Action) => void): Api {
  function newGoal(input: GoalInput): Goal {
    const state = getState();
    const start = today();
    return {
      goalId: `g-new-${state.goals.length + 1}`,
      userId: state.user.userId,
      exercise: input.exercise.trim(),
      bodyPart: input.bodyPart,
      unit: input.unit,
      target: input.target,
      weekdays: [...input.weekdays],
      time: input.time,
      startDate: start,
      endDate: addDays(start, input.durationWeeks * 7 - 1),
      status: 'active',
    };
  }

  function recordFor(missionId: string, partial: Partial<PracticeRecord>): PracticeRecord {
    const state = getState();
    const mission = state.missions.find((m) => m.missionId === missionId);
    const goal = mission && state.goals.find((g) => g.goalId === mission.goalId);
    if (!mission || !goal) throw new Error('미션을 찾을 수 없어요.');
    return {
      recordId: `r-${missionId}`,
      missionId,
      goalId: goal.goalId,
      date: mission.date,
      status: 'done',
      amount: 0,
      durationSec: 0,
      verification: goal.unit === 'rep' ? 'manual' : goal.unit === 'step' ? 'simulated' : 'auto',
      difficulty: null,
      memo: '',
      completedAt: mission.scheduledAt,
      ...partial,
    };
  }

  function recommendationOf(item: ApplyItem): Recommendation {
    const state = getState();
    return {
      recId: `rec-${state.recommendations.length + 1}`,
      goalId: item.goalId,
      rule: item.rule,
      proposedAmount: item.amount,
      response: item.response,
      respondedAt: makeDateTime(today(), '12:00'),
    };
  }

  function applyOne(item: ApplyItem): Recommendation {
    const goal = getState().goals.find((g) => g.goalId === item.goalId);
    if (!goal) throw new Error('목표를 찾을 수 없어요.');
    const recommendation = recommendationOf(item);
    if (item.response === 'skipped') {
      dispatch({ type: 'RESPOND_RECOMMENDATION', recommendation });
      return recommendation;
    }
    const time = item.time ?? goal.time;
    const updated: Goal = { ...goal, target: item.amount, time };
    dispatch({
      type: 'CONFIRM_NEXT_WEEK',
      goalId: goal.goalId,
      target: item.amount,
      time,
      missions: buildMissions(updated, addDays(today(), 1)),
      recommendation,
    });
    return recommendation;
  }

  return {
    async createGoal(input) {
      await delay();
      const error = validateGoalInput(input);
      if (error) throw new Error(error);
      const goal = newGoal(input);
      dispatch({ type: 'ADD_GOAL', goal, missions: buildMissions(goal) });
      return goal;
    },

    async completeOnboarding(input) {
      await delay();
      const error = validateGoalInput(input);
      if (error) throw new Error(error);
      const goal = newGoal(input);
      dispatch({ type: 'COMPLETE_ONBOARDING', goal, missions: buildMissions(goal) });
      return goal;
    },

    async saveRecord(input) {
      await delay();
      if (input.memo.includes(FAIL_TRIGGER)) throw new SaveFailedError(); // 상태 변경 없음(원자적)
      const state = getState();
      const mission = state.missions.find((m) => m.missionId === input.missionId);
      const goal = mission && state.goals.find((g) => g.goalId === mission.goalId);
      if (!mission || !goal) throw new Error('미션을 찾을 수 없어요.');
      const record = recordFor(input.missionId, {
        status: 'done',
        amount: input.amount,
        durationSec: input.durationSec || durationOf(goal.unit, input.amount),
        verification: input.verification,
        difficulty: input.difficulty,
        memo: input.memo.trim(),
      });
      dispatch({ type: 'SAVE_RECORD', record });
      return record;
    },

    async markMissed(missionId) {
      await delay();
      const existing = getState().records.find((r) => r.missionId === missionId);
      if (existing) return existing;
      const record = recordFor(missionId, { status: 'missed' });
      dispatch({ type: 'SAVE_RECORD', record });
      return record;
    },

    async applyRecommendation(item) {
      await delay();
      return applyOne(item);
    },

    async confirmNextWeek(items) {
      await delay();
      return items.map((item) => applyOne(item));
    },

    async clearPain(exercise) {
      await delay();
      dispatch({ type: 'CLEAR_PAIN', exercise, at: makeDateTime(today(), '23:59') });
    },

    alarmTrigger(missionId) {
      dispatch({ type: 'SET_ALARM', alarm: triggerAlarm(missionId) });
    },

    alarmSnooze() {
      const alarm = getState().alarm;
      if (!alarm || !canSnooze(alarm)) return false;
      dispatch({ type: 'SET_ALARM', alarm: snoozeAlarm(alarm, Date.now()) });
      dispatch({ type: 'SET_SNOOZE_COUNT', missionId: alarm.missionId, snoozeCount: alarm.shown as 1 | 2 });
      return true;
    },

    alarmTick() {
      const alarm = getState().alarm;
      if (!alarm) return;
      const step = nextAlarmStep(alarm, Date.now());
      if (step.type === 'wake') {
        dispatch({ type: 'SET_ALARM', alarm: step.next });
      } else if (step.type === 'timeout') {
        dispatch({ type: 'SET_ALARM', alarm: { ...alarm, deadlineAt: null } }); // 중복 타임아웃 방지
        void this.markMissed(alarm.missionId);
      }
    },

    alarmStart() {
      dispatch({ type: 'SET_ALARM', alarm: null });
    },
  };
}
