// MOAYO P0 도메인 타입 (PRD 10장 + 스펙 D17)
export type Unit = 'rep' | 'min' | 'step';
export type MissionType = 'count' | 'steps' | 'timer' | 'photo' | 'mini'; // P0 구현: count/steps/timer
export type Verification = 'auto' | 'manual' | 'simulated';
export type Difficulty = 'easy' | 'ok' | 'hard';
export type BodyPart = 'lower' | 'upper' | 'core' | 'full' | 'cardio';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=일
export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // 'YYYY-MM-DDTHH:mm:ss' (타임존 없는 로컬 표기)

export interface User {
  userId: string;
  nickname: string;
  preferredTime: 'morning' | 'lunch' | 'evening' | 'night';
  level: 'beginner' | 'intermediate';
  notificationIntensity: 'normal'; // 'strong'은 P1
  subscription: 'free'; // 구독은 범위 외
}

export interface Goal {
  goalId: string;
  userId: string;
  exercise: string;
  bodyPart: BodyPart;
  unit: Unit;
  target: number;
  weekdays: Weekday[];
  time: string; // 'HH:mm'
  startDate: ISODate;
  endDate: ISODate;
  status: 'active' | 'paused' | 'done';
}

export interface Mission {
  missionId: string; // m-{goalId}-{YYYYMMDD}
  goalId: string;
  date: ISODate;
  scheduledAt: ISODateTime;
  type: MissionType;
  snoozeCount: 0 | 1 | 2;
}

export interface PracticeRecord {
  recordId: string;
  missionId: string;
  goalId: string;
  date: ISODate; // 미션 예정일
  status: 'done' | 'missed';
  amount: number;
  durationSec: number;
  verification: Verification;
  difficulty: Difficulty | null; // missed는 null
  memo: string;
  completedAt: ISODateTime;
}

export type RuleId =
  | 'pain_stop'
  | 'missed_down'
  | 'hard_down'
  | 'easy_up'
  | 'ok_hold'
  | 'four_week_new'
  | 'insufficient_data'
  | 'no_data'
  | 'none';

export interface RecommendationResult {
  goalId: string;
  rule: RuleId;
  currentAmount: number;
  proposedAmount: number;
  plus10Amount: number | null; // ok_hold에서 수정 화면용 +10% 값
  message: string;
  extras: string[]; // 부가 제안(4주 지속 등)
  warnings: string[]; // 같은 부위 연속일 등
  stop: boolean; // 통증으로 추천 중단
  atCap: boolean;
  atMin: boolean;
}

export type RecommendationResponse = 'accepted' | 'edited' | 'skipped';

export interface Recommendation {
  recId: string;
  goalId: string;
  rule: RuleId;
  proposedAmount: number;
  response: RecommendationResponse;
  respondedAt: ISODateTime;
}

export interface Streak {
  current: number;
  longest: number;
  protectionUsedOn: ISODate[];
  protectionLeft: number;
}

export interface AlarmState {
  missionId: string;
  shown: 1 | 2 | 3;
  phase: 'ringing' | 'snoozed';
  /** snoozed: 재노출 시각, ringing(shown=3): 미해제 타임아웃 시각, 그 외 null (Date.now 기준 ms) */
  deadlineAt: number | null;
}

export interface AppState {
  user: User;
  goals: Goal[];
  missions: Mission[];
  records: PracticeRecord[];
  recommendations: Recommendation[];
  painClearedAt: Record<string, ISODateTime>; // 운동 종류 → 통증 해제 시각
  alarm: AlarmState | null;
  onboarded: boolean;
}

export interface GoalInput {
  exercise: string;
  bodyPart: BodyPart;
  unit: Unit;
  target: number;
  weekdays: Weekday[];
  time: string;
  durationWeeks: 1 | 2 | 3 | 4;
  templateId?: string;
}

export interface RecordInput {
  missionId: string;
  amount: number;
  durationSec: number;
  verification: Verification;
  difficulty: Difficulty;
  memo: string;
}
