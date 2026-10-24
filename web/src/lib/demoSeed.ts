// 시연 시나리오 시드 (계획 §2). Mock 모드 전용. 오늘 2026-10-23(금) 고정, 런지 화·목 21:00 20회.
// 기대: 스트릭 1, 보호권 0, 다음 미션 10/27(화) 21:00, 오늘은 쉬는 날.
import { dateRange, makeDateTime } from './date.ts';
import { buildMissions, isScheduled, missionIdOf } from './missions.ts';
import { durationOf } from './seed.ts';
import { DEFAULT_NOTIFICATION_SETTINGS } from './types.ts';
import type { AppState, Goal, ISODate, PracticeRecord, RecordKind } from './types.ts';

export const DEMO_TODAY: ISODate = '2026-10-23';
const DEMO_USER_ID = 'u-demo';

const OCT_MISSED: ISODate[] = ['2026-10-15', '2026-10-20'];
const COMEBACK_DAY: ISODate = '2026-10-22';

export function createDemoState(): AppState {
  const goal: Goal = {
    goalId: 'g-demo-lunge',
    userId: DEMO_USER_ID,
    exercise: '런지',
    bodyPart: 'lower',
    unit: 'rep',
    target: 20,
    weekdays: [2, 4],
    time: '21:00',
    startDate: '2026-09-15',
    endDate: '2026-12-31',
    status: 'active',
  };
  const records: PracticeRecord[] = dateRange(goal.startDate, '2026-10-22')
    .filter((d) => isScheduled(goal, d))
    .map((date): PracticeRecord => {
      const missionId = missionIdOf(goal.goalId, date);
      const missed = OCT_MISSED.includes(date);
      const kind: RecordKind = date === COMEBACK_DAY ? 'comeback' : 'normal';
      const amount = missed ? 0 : kind === 'comeback' ? 10 : goal.target;
      return {
        recordId: `r-${missionId}`,
        kind,
        missionId,
        goalId: goal.goalId,
        date,
        status: missed ? 'missed' : 'done',
        amount,
        durationSec: missed ? 0 : durationOf(goal.unit, amount),
        verification: 'manual',
        difficulty: missed ? null : 'ok',
        memo: '',
        completedAt: makeDateTime(date, goal.time),
      };
    });
  return {
    user: {
      userId: DEMO_USER_ID,
      nickname: '지은',
      preferredTime: 'night',
      level: 'beginner',
      notificationIntensity: 'normal',
      subscription: 'free',
    },
    goals: [goal],
    missions: buildMissions(goal),
    records,
    recommendations: [],
    painClearedAt: {},
    alarm: null,
    onboarded: true,
    notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },
    events: [],
    reminder: null,
    demoDate: DEMO_TODAY,
  };
}
