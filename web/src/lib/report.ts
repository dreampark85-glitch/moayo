// 주간 리포트 지표 (순수 함수). 주는 월~일 기준, 기본은 오늘 직전에 끝난 주.
import { addDays, dateRange, startOfWeek } from './date.ts';
import { isScheduled } from './missions.ts';
import type { Goal, ISODate, PracticeRecord } from './types.ts';

export interface WeeklyReport {
  weekStart: ISODate;
  weekEnd: ISODate;
  doneCount: number;
  missedCount: number;
  scheduledCount: number;
  totalMinutes: number;
  achievementRate: number; // 0~100 (done / 예정 미션)
  prevDoneCount: number;
  prevAchievementRate: number;
  deltaDone: number;
  deltaRate: number;
}

export function lastCompletedWeekStart(today: ISODate): ISODate {
  return addDays(startOfWeek(today), -7);
}

function weekStats(goals: Goal[], records: PracticeRecord[], weekStart: ISODate) {
  const weekEnd = addDays(weekStart, 6);
  const days = dateRange(weekStart, weekEnd);
  const scheduledCount = days.reduce((sum, d) => sum + goals.filter((g) => isScheduled(g, d)).length, 0);
  const inWeek = records.filter((r) => r.date >= weekStart && r.date <= weekEnd);
  const done = inWeek.filter((r) => r.status === 'done');
  const totalMinutes = Math.round(done.reduce((sum, r) => sum + r.durationSec, 0) / 60);
  const rate = scheduledCount === 0 ? 0 : Math.round((done.length / scheduledCount) * 100);
  return {
    weekEnd,
    doneCount: done.length,
    missedCount: inWeek.filter((r) => r.status === 'missed').length,
    scheduledCount,
    totalMinutes,
    rate,
  };
}

export function weeklyReport(goals: Goal[], records: PracticeRecord[], weekStart: ISODate): WeeklyReport {
  const cur = weekStats(goals, records, weekStart);
  const prev = weekStats(goals, records, addDays(weekStart, -7));
  return {
    weekStart,
    weekEnd: cur.weekEnd,
    doneCount: cur.doneCount,
    missedCount: cur.missedCount,
    scheduledCount: cur.scheduledCount,
    totalMinutes: cur.totalMinutes,
    achievementRate: cur.rate,
    prevDoneCount: prev.doneCount,
    prevAchievementRate: prev.rate,
    deltaDone: cur.doneCount - prev.doneCount,
    deltaRate: cur.rate - prev.rate,
  };
}
