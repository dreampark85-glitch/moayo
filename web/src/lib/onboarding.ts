// 온보딩 진단 3문항 → 첫 목표 제안 (순수 함수, G-03)
import { getTemplate, templateToInput } from './templates.ts';
import type { GoalInput, Weekday } from './types.ts';

export type Frequency = 'none' | 'light' | 'regular';
export type PreferredTime = 'morning' | 'lunch' | 'evening' | 'night';
export type Place = 'home' | 'outdoor' | 'office';

export interface OnboardingAnswers {
  frequency: Frequency;
  time: PreferredTime;
  place: Place;
}

export const TIME_OF: Record<PreferredTime, string> = { morning: '07:30', lunch: '12:30', evening: '19:00', night: '22:00' };
const WEEKDAYS_OF: Record<Frequency, Weekday[]> = { none: [1, 3, 5], light: [1, 3, 5], regular: [1, 2, 3, 4, 5] };
const STEPS_OF: Record<Frequency, number> = { none: 1000, light: 1500, regular: 3000 };
const REPS_OF: Record<Frequency, number> = { none: 10, light: 15, regular: 20 };

export interface OnboardingSuggestion {
  goal: GoalInput;
  reason: string;
}

export function suggestFirstGoal(a: OnboardingAnswers): OnboardingSuggestion {
  const weekdays = WEEKDAYS_OF[a.frequency];
  const time = TIME_OF[a.time];
  if (a.place === 'outdoor') {
    const base = templateToInput(getTemplate('lunch-1000')!, 2);
    return {
      goal: { ...base, target: STEPS_OF[a.frequency], weekdays, time },
      reason: '밖에서 할 수 있는 걷기로 가볍게 시작해요.',
    };
  }
  if (a.place === 'office' || a.frequency === 'none') {
    const base = templateToInput(getTemplate(a.time === 'night' ? 'bedtime-stretch' : 'morning-stretch')!, 2);
    return {
      goal: { ...base, weekdays, time },
      reason: '운동이 처음이거나 공간이 좁아도 할 수 있는 5분 스트레칭부터 시작해요.',
    };
  }
  const base = templateToInput(getTemplate('squat-20')!, 2);
  return {
    goal: { ...base, target: REPS_OF[a.frequency], weekdays, time },
    reason: '집에서 짧게 할 수 있는 스쿼트로 시작해요.',
  };
}
