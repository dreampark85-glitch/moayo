// 화면용 읽기 함수 (순수). UI는 state를 직접 해석하지 않고 이 함수들만 사용한다.
import { addDays, dateRange, monthKey, today, weekdayOf } from './date.ts';
import { isScheduled } from './missions.ts';
import { recommend } from './recommendation.ts';
import { lastCompletedWeekStart, weeklyReport } from './report.ts';
import type { WeeklyReport } from './report.ts';
import { computeStreak } from './streak.ts';
import type {
  AppState,
  Goal,
  ISODate,
  Mission,
  PracticeRecord,
  Recommendation,
  RecommendationResponse,
  RecommendationResult,
  Streak,
} from './types.ts';

export interface MissionView {
  mission: Mission;
  goal: Goal;
  status: 'pending' | 'done' | 'missed';
  record: PracticeRecord | null;
}

function viewOf(state: AppState, mission: Mission): MissionView | null {
  const goal = state.goals.find((g) => g.goalId === mission.goalId);
  if (!goal) return null;
  const record = state.records.find((r) => r.missionId === mission.missionId) ?? null;
  return { mission, goal, status: record ? record.status : 'pending', record };
}

export function selectMissionView(state: AppState, missionId: string): MissionView | null {
  const mission = state.missions.find((m) => m.missionId === missionId);
  return mission ? viewOf(state, mission) : null;
}

export function selectTodayMissions(state: AppState): MissionView[] {
  return state.missions
    .filter((m) => m.date === today())
    .map((m) => viewOf(state, m))
    .filter((v): v is MissionView => v !== null)
    .sort((a, b) => (a.mission.scheduledAt < b.mission.scheduledAt ? -1 : 1));
}

/** 다음 알림: 오늘 이후(오늘 포함) 기록이 없는 가장 이른 예정 미션 */
export function selectNextAlarm(state: AppState): MissionView | null {
  const pending = state.missions
    .filter((m) => m.date >= today() && !state.records.some((r) => r.missionId === m.missionId))
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
  for (const m of pending) {
    const v = viewOf(state, m);
    if (v) return v;
  }
  return null;
}

export function selectStreak(state: AppState): Streak {
  return computeStreak(state.goals, state.records, today());
}

export interface HeatmapCell {
  date: ISODate;
  doneCount: number;
  missedCount: number;
  scheduledCount: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface Heatmap {
  month: string; // 'YYYY-MM'
  leadingBlanks: number; // 첫 주 앞 빈 칸 수 (일요일 시작)
  cells: HeatmapCell[];
}

export function selectHeatmap(state: AppState, month: string): Heatmap {
  const first = `${month}-01`;
  let next = addDays(first, 31);
  next = `${monthKey(next)}-01`;
  const last = addDays(next, -1);
  const cells: HeatmapCell[] = dateRange(first, last).map((date) => {
    const day = state.records.filter((r) => r.date === date);
    const doneCount = day.filter((r) => r.status === 'done').length;
    const level = Math.min(doneCount, 4) as HeatmapCell['level'];
    return {
      date,
      doneCount,
      missedCount: day.filter((r) => r.status === 'missed').length,
      scheduledCount: state.goals.filter((g) => isScheduled(g, date)).length,
      level,
    };
  });
  return { month, leadingBlanks: weekdayOf(first), cells };
}

export interface DayItem {
  goal: Goal;
  mission: Mission | null;
  record: PracticeRecord | null;
}

export function selectDayDetail(state: AppState, date: ISODate): DayItem[] {
  return state.goals
    .map((goal): DayItem | null => {
      const record = state.records.find((r) => r.goalId === goal.goalId && r.date === date) ?? null;
      const mission = state.missions.find((m) => m.goalId === goal.goalId && m.date === date) ?? null;
      return record || mission ? { goal, mission, record } : null;
    })
    .filter((x): x is DayItem => x !== null);
}

export interface RecommendationView {
  goal: Goal;
  result: RecommendationResult;
  suggestedTime: string | null; // missed_down: 시간대 변경 제안(1시간 앞당김)
  latest: Recommendation | null;
}

function shiftHour(time: string, delta: number): string {
  const [h, m] = time.split(':').map(Number);
  const nh = (h + delta + 24) % 24;
  return `${String(nh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function selectRecommendations(state: AppState): RecommendationView[] {
  return state.goals
    .filter((g) => g.status === 'active')
    .map((goal) => {
      const result = recommend({
        goal,
        goals: state.goals,
        records: state.records,
        today: today(),
        painClearedAt: state.painClearedAt,
      });
      const latest = [...state.recommendations].reverse().find((r) => r.goalId === goal.goalId) ?? null;
      return {
        goal,
        result,
        suggestedTime: result.rule === 'missed_down' ? shiftHour(goal.time, -1) : null,
        latest,
      };
    });
}

export interface WeeklyReportView {
  report: WeeklyReport;
  plan: { goal: Goal; amount: number; time: string; rule: RecommendationResult['rule']; response: RecommendationResponse | null }[];
}

export function selectWeeklyReport(state: AppState): WeeklyReportView {
  const report = weeklyReport(state.goals, state.records, lastCompletedWeekStart(today()));
  const plan = selectRecommendations(state)
    .filter((v) => !v.result.stop)
    .map((v) => ({
      goal: v.goal,
      amount: v.result.proposedAmount,
      time: v.suggestedTime ?? v.goal.time,
      rule: v.result.rule,
      response: v.latest?.response ?? null,
    }));
  return { report, plan };
}
