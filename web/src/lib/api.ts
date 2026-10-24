// 앱 API (비동기). 상태 계산은 메모리(reducer)에서 하고, 영속화는 선택적 Sync로 위임한다.
//  - Sync 없음(Mock): API_DELAY_MS(700ms) 지연, 회고 메모에 FAIL_TRIGGER 포함 시 saveRecord 실패
//  - Sync 있음(Supabase): 서버 쓰기가 성공한 뒤에만 상태를 바꾼다(실패 시 상태 변경 없음)
//  - 알림 시뮬레이션·카운트·타이머는 클라이언트 로컬 처리(지연 없음, 스펙 D13)
import { addDays, makeDateTime, setToday, today } from './date.ts';
import { createDemoState, DEMO_TODAY } from './demoSeed.ts';
import { canNotify } from './notify.ts';
import { BONUS_OPTIONS } from './bonus.ts';
import { reminderMessage } from './reminderMessage.ts';
import { selectNextAlarm } from './selectors.ts';
import { createInitialState } from './seed.ts';
import { BONUS_GOAL_ID, bonusMissionId } from './types.ts';
import { MAX_AMOUNT, MIN_AMOUNT } from './recommendation.ts';
import { buildMissions } from './missions.ts';
import { canSnooze, nextAlarmStep, snoozeAlarm, triggerAlarm } from './alarm.ts';
import type { Action } from './reducer.ts';
import { durationOf, seedTodayMissionIds } from './seed.ts';
import type {
  AppEvent,
  AppEventType,
  AppState,
  BonusInput,
  Goal,
  GoalInput,
  Mission,
  NotificationSettings,
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

/** 서버 영속화 어댑터(lib/remote.ts). 각 메서드는 실패 시 throw한다. */
export interface Sync {
  addGoal(goal: Goal, missions: Mission[], onboarded: boolean): Promise<void>;
  saveRecord(record: PracticeRecord): Promise<void>;
  setSnoozeCount(missionId: string, snoozeCount: number): Promise<void>;
  respondRecommendation(recommendation: Recommendation): Promise<void>;
  confirmNextWeek(goalId: string, target: number, time: string, missions: Mission[], recommendation: Recommendation): Promise<void>;
  clearPain(exercise: string, at: string): Promise<void>;
  /** 보너스 기록 저장 (goal_id/mission_id null 변환은 remote.ts 내부) */
  saveBonus(record: PracticeRecord): Promise<void>;
  saveSettings(settings: NotificationSettings): Promise<void>;
  /** 비동기·실패 무시용(호출부가 catch) */
  logEvent(event: AppEvent): Promise<void>;
  rescheduleGoalTime(goalId: string, time: string, missions: Mission[]): Promise<void>;
}

export interface TriggerResult {
  ok: boolean;
  reason?: string;
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
  /** 리마인드 발생(시연): 설정·상한 확인 후 state.reminder 설정. 거부 시 { ok:false, reason } */
  triggerReminder(): TriggerResult;
  setNotificationSetting(patch: Partial<Omit<NotificationSettings, 'dailyCap'>>): Promise<void>;
  /** 이후 미션을 새 시각으로 재생성 (추천 기록 안 남김) */
  rescheduleGoalTime(goalId: string, time: string): Promise<void>;
  /** 시연 전용(Mock): 가상 오늘을 n일 이동 */
  advanceDays(n: number): void;
  /** 시연 전용(Mock): 다음 목표일 미션을 missed 처리하고 날짜 이동(D7). 대상이 없으면 null */
  missNextMission(): Promise<PracticeRecord | null>;
  /** 보너스 기록 저장 (missionId = bonusMissionId(today(), bonusKey)). 실패 시 throw */
  saveBonus(input: BonusInput): Promise<PracticeRecord>;
  /** 시연 시나리오 전환(Mock): 'demo'는 2026-10-23 고정 */
  loadScenario(name: 'default' | 'demo'): void;
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

export function createApi(getState: () => AppState, dispatch: (a: Action) => void, sync?: Sync): Api {
  const wait = () => (sync ? Promise.resolve() : delay());
  const uid = () => globalThis.crypto.randomUUID();

  function newGoal(input: GoalInput): Goal {
    const state = getState();
    const start = today();
    return {
      goalId: sync ? uid() : `g-new-${state.goals.length + 1}`,
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
      kind: 'normal',
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

  function logEvent(type: AppEventType, payload: AppEvent['payload']): void {
    const event: AppEvent = { type, date: today(), payload };
    dispatch({ type: 'LOG_EVENT', event });
    sync?.logEvent(event).catch(() => {}); // 알림 흐름을 막지 않는다(실패 시 지표용 이벤트만 누락)
  }

  function moveDate(date: string): void {
    setToday(date);
    dispatch({ type: 'SET_DEMO_DATE', date });
  }

  function recommendationOf(item: ApplyItem): Recommendation {
    const state = getState();
    return {
      recId: sync ? uid() : `rec-${state.recommendations.length + 1}`,
      goalId: item.goalId,
      rule: item.rule,
      proposedAmount: item.amount,
      response: item.response,
      respondedAt: makeDateTime(today(), '12:00'),
    };
  }

  async function applyOne(item: ApplyItem): Promise<Recommendation> {
    const goal = getState().goals.find((g) => g.goalId === item.goalId);
    if (!goal) throw new Error('목표를 찾을 수 없어요.');
    const recommendation = recommendationOf(item);
    if (item.response === 'skipped') {
      await sync?.respondRecommendation(recommendation);
      dispatch({ type: 'RESPOND_RECOMMENDATION', recommendation });
      return recommendation;
    }
    const time = item.time ?? goal.time;
    const updated: Goal = { ...goal, target: item.amount, time };
    const missions = buildMissions(updated, addDays(today(), 1));
    await sync?.confirmNextWeek(goal.goalId, item.amount, time, missions, recommendation);
    dispatch({ type: 'CONFIRM_NEXT_WEEK', goalId: goal.goalId, target: item.amount, time, missions, recommendation });
    return recommendation;
  }

  return {
    async createGoal(input) {
      await wait();
      const error = validateGoalInput(input);
      if (error) throw new Error(error);
      const goal = newGoal(input);
      const missions = buildMissions(goal);
      await sync?.addGoal(goal, missions, getState().onboarded);
      dispatch({ type: 'ADD_GOAL', goal, missions });
      return goal;
    },

    async completeOnboarding(input) {
      await wait();
      const error = validateGoalInput(input);
      if (error) throw new Error(error);
      const goal = newGoal(input);
      const missions = buildMissions(goal);
      await sync?.addGoal(goal, missions, true);
      dispatch({ type: 'COMPLETE_ONBOARDING', goal, missions });
      return goal;
    },

    async saveRecord(input) {
      await wait();
      if (!sync && input.memo.includes(FAIL_TRIGGER)) throw new SaveFailedError(); // 상태 변경 없음(원자적)
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
        kind: input.kind ?? 'normal',
      });
      await sync?.saveRecord(record);
      dispatch({ type: 'SAVE_RECORD', record });
      return record;
    },

    async markMissed(missionId) {
      await wait();
      const existing = getState().records.find((r) => r.missionId === missionId);
      if (existing) return existing;
      const record = recordFor(missionId, { status: 'missed' });
      await sync?.saveRecord(record);
      dispatch({ type: 'SAVE_RECORD', record });
      return record;
    },

    async applyRecommendation(item) {
      await wait();
      return applyOne(item);
    },

    async confirmNextWeek(items) {
      await wait();
      const out: Recommendation[] = [];
      for (const item of items) out.push(await applyOne(item)); // 순차 처리: recId·상태 의존
      return out;
    },

    async clearPain(exercise) {
      await wait();
      const at = makeDateTime(today(), '23:59');
      await sync?.clearPain(exercise, at);
      dispatch({ type: 'CLEAR_PAIN', exercise, at });
    },

    alarmTrigger(missionId) {
      const state = getState();
      const decision = canNotify(state.events, today(), 'mission', state.notificationSettings);
      if (!decision.ok) {
        logEvent('alarm_blocked', { missionId, reason: decision.reason ?? '' });
        return;
      }
      logEvent('alarm_fired', { missionId });
      dispatch({ type: 'SET_ALARM', alarm: triggerAlarm(missionId) });
    },

    alarmSnooze() {
      const alarm = getState().alarm;
      if (!alarm || !canSnooze(alarm)) return false;
      dispatch({ type: 'SET_ALARM', alarm: snoozeAlarm(alarm, Date.now()) });
      dispatch({ type: 'SET_SNOOZE_COUNT', missionId: alarm.missionId, snoozeCount: alarm.shown as 1 | 2 });
      sync?.setSnoozeCount(alarm.missionId, alarm.shown).catch(() => {}); // 알림은 로컬 우선, 저장 실패는 무시
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

    triggerReminder() {
      const state = getState();
      if (state.notificationSettings.reminder === 'none') return { ok: false, reason: '리마인드가 꺼져 있어요' };
      const next = selectNextAlarm(state);
      if (!next) return { ok: false, reason: '예정된 미션이 없어요' };
      const decision = canNotify(state.events, today(), 'reminder', state.notificationSettings);
      if (!decision.ok) {
        logEvent('reminder_blocked', { missionId: next.mission.missionId, reason: decision.reason ?? '' });
        return { ok: false, reason: decision.reason };
      }
      const message = reminderMessage(next.goal, state.records, next.mission);
      dispatch({
        type: 'SET_REMINDER',
        reminder: { missionId: next.mission.missionId, goalId: next.goal.goalId, message, date: today() },
      });
      logEvent('reminder_sent', { missionId: next.mission.missionId, goalId: next.goal.goalId });
      return { ok: true };
    },

    async setNotificationSetting(patch) {
      const prev = getState().notificationSettings;
      const settings: NotificationSettings = { ...prev, ...patch };
      await sync?.saveSettings(settings);
      dispatch({ type: 'SET_NOTIFICATION_SETTING', settings });
      if (prev.reminder !== 'none' && settings.reminder === 'none') logEvent('notification_off', { setting: 'reminder' });
      if (prev.bonusNotification && !settings.bonusNotification) logEvent('notification_off', { setting: 'bonus' });
    },

    async rescheduleGoalTime(goalId, time) {
      await wait();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('시각을 HH:mm 형식으로 입력해 주세요.');
      const goal = getState().goals.find((g) => g.goalId === goalId);
      if (!goal) throw new Error('목표를 찾을 수 없어요.');
      const missions = buildMissions({ ...goal, time }, addDays(today(), 1));
      await sync?.rescheduleGoalTime(goalId, time, missions);
      dispatch({ type: 'UPDATE_GOAL_TIME', goalId, time, missions });
    },

    advanceDays(n) {
      moveDate(addDays(today(), n));
    },

    async missNextMission() {
      const state = getState();
      const next = [...state.missions]
        .filter((m) => m.date >= today() && !state.records.some((r) => r.missionId === m.missionId))
        .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1))[0];
      if (!next) return null;
      const record = recordFor(next.missionId, { status: 'missed' });
      await sync?.saveRecord(record);
      dispatch({ type: 'SAVE_RECORD', record });
      if (addDays(next.date, 1) > today()) moveDate(addDays(next.date, 1)); // D7: 미래 기록은 스트릭이 보지 않으므로 날짜를 이동
      return record;
    },

    async saveBonus(input) {
      await wait();
      const option = BONUS_OPTIONS.find((o) => o.bonusKey === input.bonusKey);
      if (!option) throw new Error('알 수 없는 보너스 미션이에요.');
      const date = today();
      const missionId = bonusMissionId(date, option.bonusKey);
      const record: PracticeRecord = {
        recordId: `r-${missionId}`,
        kind: 'bonus',
        missionId,
        goalId: BONUS_GOAL_ID,
        date,
        status: 'done',
        amount: input.amount,
        durationSec: input.durationSec || (option.unit === 'min' ? input.amount * 60 : input.amount * 3),
        verification: option.unit === 'min' ? 'auto' : 'manual',
        difficulty: null,
        memo: '',
        completedAt: makeDateTime(date, '12:00'),
      };
      await sync?.saveBonus(record);
      dispatch({ type: 'SAVE_RECORD', record });
      return record;
    },

    loadScenario(name) {
      if (name === 'demo') {
        setToday(DEMO_TODAY);
        dispatch({ type: 'HYDRATE', state: createDemoState() });
      } else {
        setToday(null);
        dispatch({ type: 'HYDRATE', state: createInitialState() });
      }
    },
  };
}
