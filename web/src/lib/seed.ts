// 시드 데이터 (결정적, 난수 없음). 항상 '오늘'(today()) 기준 최근 4주 기록을 만든다.
// 목표별 예외 기록은 날짜가 아니라 '가장 최근 예정일부터 센 순번'(0=가장 최근)으로 지정하므로
// 어떤 요일에 열어도 추천 규칙 8종이 목표 8개에서 각각 한 번씩 발동한다.
//  푸시업 pain_stop / 런지 missed_down / 점핑잭 hard_down / 스쿼트 easy_up / 플랭크 ok_hold
//  스트레칭 four_week_new / 걷기 insufficient_data / 요가 no_data
import { addDays, dateRange, makeDateTime, today } from './date.ts';
import { buildMissions, isScheduled, missionIdOf } from './missions.ts';
import { DEFAULT_NOTIFICATION_SETTINGS } from './types.ts';
import type { AppState, Difficulty, Goal, ISODate, PracticeRecord, Unit, Verification } from './types.ts';

const USER_ID = 'u-1';
const HISTORY_DAYS = 27; // 오늘 포함 4주 구간의 시작 = today-27
const GOAL_DAYS = 42; // 목표 종료일 = today+42

interface Override {
  status?: 'done' | 'missed';
  difficulty?: Difficulty;
  memo?: string;
}

type GoalSeed = Omit<Goal, 'userId' | 'startDate' | 'endDate' | 'status'>;

const GOAL_SEEDS: GoalSeed[] = [
  { goalId: 'g-squat', exercise: '스쿼트', bodyPart: 'lower', unit: 'rep', target: 20, weekdays: [1, 3, 5], time: '22:00' },
  { goalId: 'g-lunge', exercise: '런지', bodyPart: 'lower', unit: 'rep', target: 15, weekdays: [2, 4], time: '21:00' },
  { goalId: 'g-pushup', exercise: '푸시업', bodyPart: 'upper', unit: 'rep', target: 10, weekdays: [1, 4], time: '07:30' },
  { goalId: 'g-jumpingjack', exercise: '점핑잭', bodyPart: 'cardio', unit: 'rep', target: 30, weekdays: [4, 6], time: '20:00' },
  { goalId: 'g-plank', exercise: '플랭크', bodyPart: 'core', unit: 'min', target: 10, weekdays: [0, 3], time: '21:30' },
  { goalId: 'g-stretch', exercise: '스트레칭', bodyPart: 'full', unit: 'min', target: 5, weekdays: [1, 2, 3, 4, 5], time: '07:00' },
  { goalId: 'g-walk', exercise: '걷기', bodyPart: 'cardio', unit: 'step', target: 1000, weekdays: [1, 3, 5], time: '12:30' },
  { goalId: 'g-yoga', exercise: '요가', bodyPart: 'full', unit: 'min', target: 8, weekdays: [6, 0], time: '09:00' },
];

// 목표별 예외 기록: 키 = 가장 최근 예정일부터의 순번 (0이 가장 최근). 기본은 done + 'ok'.
const OVERRIDES: Record<string, Record<number, Override>> = {
  'g-squat': { 0: { difficulty: 'easy' }, 1: { difficulty: 'easy' }, 2: { difficulty: 'ok' } },
  'g-lunge': { 0: { status: 'missed' }, 1: { difficulty: 'ok' }, 2: { status: 'missed' } },
  'g-pushup': { 0: { difficulty: 'hard', memo: '손목 통증이 있었어요' }, 1: { difficulty: 'ok' }, 2: { status: 'missed' } },
  'g-jumpingjack': { 0: { difficulty: 'hard' }, 1: { difficulty: 'hard' }, 2: { difficulty: 'ok' } },
  'g-plank': {},
  'g-stretch': { 0: { difficulty: 'easy' }, 1: { difficulty: 'ok' }, 2: { difficulty: 'hard' } },
  'g-walk': {},
  'g-yoga': {},
};

const VERIFICATION: Record<Unit, Verification> = { rep: 'manual', min: 'auto', step: 'simulated' };

export function durationOf(unit: Unit, amount: number): number {
  return unit === 'rep' ? amount * 3 : unit === 'min' ? amount * 60 : Math.round(amount * 0.75);
}

function buildGoals(): Goal[] {
  const t = today();
  const base = addDays(t, -HISTORY_DAYS);
  const end = addDays(t, GOAL_DAYS);
  return GOAL_SEEDS.map((s): Goal => {
    const common = { ...s, weekdays: [...s.weekdays], userId: USER_ID, endDate: end, status: 'active' as const };
    let startDate = base;
    if (s.goalId === 'g-walk') {
      // 기록이 정확히 2건(insufficient_data)이 되도록, 최근 2번의 예정일부터 시작
      const probe: Goal = { ...common, startDate: base };
      const past = dateRange(base, addDays(t, -1)).filter((d) => isScheduled(probe, d));
      startDate = past[Math.max(0, past.length - 2)];
    } else if (s.goalId === 'g-yoga') {
      startDate = t; // 오늘 시작 → 기록 없음(no_data)
    }
    return { ...common, startDate };
  });
}

function buildRecords(goals: Goal[]): PracticeRecord[] {
  const yesterday = addDays(today(), -1);
  const out: PracticeRecord[] = [];
  for (const g of goals) {
    const dates: ISODate[] = dateRange(g.startDate, yesterday).filter((d) => isScheduled(g, d));
    dates.forEach((date, i) => {
      const fromLatest = dates.length - 1 - i;
      const o = OVERRIDES[g.goalId]?.[fromLatest] ?? {};
      const status = o.status ?? 'done';
      const missionId = missionIdOf(g.goalId, date);
      out.push({
        recordId: `r-${missionId}`,
        kind: 'normal',
        missionId,
        goalId: g.goalId,
        date,
        status,
        amount: status === 'done' ? g.target : 0,
        durationSec: status === 'done' ? durationOf(g.unit, g.target) : 0,
        verification: VERIFICATION[g.unit],
        difficulty: status === 'done' ? (o.difficulty ?? 'ok') : null,
        memo: o.memo ?? '',
        completedAt: makeDateTime(date, g.time),
      });
    });
  }
  return out;
}

export function createInitialState(): AppState {
  const goals = buildGoals();
  return {
    user: {
      userId: USER_ID,
      nickname: '지은',
      preferredTime: 'evening',
      level: 'beginner',
      notificationIntensity: 'normal',
      subscription: 'free',
    },
    goals,
    missions: goals.flatMap((g) => buildMissions(g)),
    records: buildRecords(goals),
    recommendations: [],
    painClearedAt: {},
    alarm: null,
    onboarded: true,
    notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },
    events: [],
    reminder: null,
    demoDate: null,
  };
}

/** generateStaticParams용: 오늘 예정 미션 id */
export function seedTodayMissionIds(): string[] {
  const t = today();
  return buildGoals()
    .filter((g) => isScheduled(g, t))
    .map((g) => missionIdOf(g.goalId, t));
}
