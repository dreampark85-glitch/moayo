// 앱 상태 reducer (순수). UI는 직접 import하지 않고 AppProvider/api를 통해서만 사용한다.
import type { AlarmState, AppState, Goal, Mission, PracticeRecord, Recommendation } from './types.ts';

export type Action =
  | { type: 'ADD_GOAL'; goal: Goal; missions: Mission[] }
  | { type: 'SAVE_RECORD'; record: PracticeRecord }
  | { type: 'SET_ALARM'; alarm: AlarmState | null }
  | { type: 'SET_SNOOZE_COUNT'; missionId: string; snoozeCount: 0 | 1 | 2 }
  | { type: 'RESPOND_RECOMMENDATION'; recommendation: Recommendation }
  | { type: 'CONFIRM_NEXT_WEEK'; goalId: string; target: number; time: string; missions: Mission[]; recommendation: Recommendation }
  | { type: 'CLEAR_PAIN'; exercise: string; at: string }
  | { type: 'COMPLETE_ONBOARDING'; goal: Goal; missions: Mission[] };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_GOAL':
      return { ...state, goals: [...state.goals, action.goal], missions: [...state.missions, ...action.missions] };
    case 'COMPLETE_ONBOARDING':
      return {
        ...state,
        onboarded: true,
        goals: [...state.goals, action.goal],
        missions: [...state.missions, ...action.missions],
      };
    case 'SAVE_RECORD': {
      const others = state.records.filter((r) => r.missionId !== action.record.missionId);
      const alarm = state.alarm?.missionId === action.record.missionId ? null : state.alarm;
      return { ...state, records: [...others, action.record], alarm };
    }
    case 'SET_ALARM':
      return { ...state, alarm: action.alarm };
    case 'SET_SNOOZE_COUNT':
      return {
        ...state,
        missions: state.missions.map((m) => (m.missionId === action.missionId ? { ...m, snoozeCount: action.snoozeCount } : m)),
      };
    case 'RESPOND_RECOMMENDATION':
      return { ...state, recommendations: [...state.recommendations, action.recommendation] };
    case 'CONFIRM_NEXT_WEEK': {
      const keep = state.missions.filter((m) => !action.missions.some((n) => n.missionId === m.missionId));
      return {
        ...state,
        goals: state.goals.map((g) => (g.goalId === action.goalId ? { ...g, target: action.target, time: action.time } : g)),
        missions: [...keep, ...action.missions],
        recommendations: [...state.recommendations, action.recommendation],
      };
    }
    case 'CLEAR_PAIN':
      return { ...state, painClearedAt: { ...state.painClearedAt, [action.exercise]: action.at } };
  }
}
