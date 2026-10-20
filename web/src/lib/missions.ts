import { compactDate, dateRange, makeDateTime, weekdayOf } from './date.ts';
import type { Goal, ISODate, Mission, MissionType, Unit } from './types.ts';

export function missionIdOf(goalId: string, date: ISODate): string {
  return `m-${goalId}-${compactDate(date)}`;
}

export function missionTypeOf(unit: Unit): MissionType {
  return unit === 'rep' ? 'count' : unit === 'step' ? 'steps' : 'timer';
}

export function isScheduled(goal: Goal, date: ISODate): boolean {
  return (
    goal.status !== 'paused' &&
    date >= goal.startDate &&
    date <= goal.endDate &&
    goal.weekdays.includes(weekdayOf(date))
  );
}

/** goal의 [from, to] 구간 예정 미션 생성 (기본: 목표 전체 기간) */
export function buildMissions(goal: Goal, from?: ISODate, to?: ISODate): Mission[] {
  const start = from && from > goal.startDate ? from : goal.startDate;
  const end = to && to < goal.endDate ? to : goal.endDate;
  if (start > end) return [];
  return dateRange(start, end)
    .filter((d) => isScheduled(goal, d))
    .map((d) => ({
      missionId: missionIdOf(goal.goalId, d),
      goalId: goal.goalId,
      date: d,
      scheduledAt: makeDateTime(d, goal.time),
      type: missionTypeOf(goal.unit),
      snoozeCount: 0,
    }));
}
