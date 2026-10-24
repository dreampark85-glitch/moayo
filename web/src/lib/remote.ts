// Supabase 영속화 어댑터. 스키마: supabase/schema.sql
// 앱 내부 날짜시각은 타임존 없는 로컬 표기('YYYY-MM-DDTHH:mm:ss')이므로 DB(timestamptz)와는 여기서만 변환한다.
// 스트릭은 기록에서 계산(selectors)하므로 streaks 테이블은 읽고 쓰지 않는다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { SaveFailedError } from './api.ts';
import type { Sync } from './api.ts';
import { BONUS_GOAL_ID, bonusMissionId, DEFAULT_NOTIFICATION_SETTINGS } from './types.ts';
import type {
  AppEvent,
  AppState,
  Difficulty,
  Goal,
  ISODateTime,
  Mission,
  PracticeRecord,
  Recommendation,
  RecordKind,
  Verification,
  Weekday,
} from './types.ts';

const EVENT_LOAD_LIMIT = 500;

const pad = (n: number) => String(n).padStart(2, '0');

function toIso(local: ISODateTime): string {
  return new Date(local).toISOString();
}

function fromIso(iso: string): ISODateTime {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createEmptyState(): AppState {
  return {
    user: {
      userId: '',
      nickname: '',
      preferredTime: 'morning',
      level: 'beginner',
      notificationIntensity: 'normal',
      subscription: 'free',
    },
    goals: [],
    missions: [],
    records: [],
    recommendations: [],
    painClearedAt: {},
    alarm: null,
    onboarded: false,
    notificationSettings: { ...DEFAULT_NOTIFICATION_SETTINGS },
    events: [],
    reminder: null,
    demoDate: null,
  };
}

let pendingUserId: Promise<string> | null = null;

/** 세션이 있으면 재사용하고, 없으면 익명 로그인으로 user_id를 발급한다. (StrictMode 중복 호출에도 로그인은 1회) */
export function ensureUserId(db: SupabaseClient): Promise<string> {
  pendingUserId ??= (async () => {
    const { data } = await db.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: anon, error } = await db.auth.signInAnonymously();
    check(error);
    if (!anon.user) throw new Error('익명 로그인에 실패했어요.');
    return anon.user.id;
  })().catch((e) => {
    pendingUserId = null; // 실패하면 다시 시도할 수 있게 비운다
    throw e;
  });
  return pendingUserId;
}

const goalRow = (g: Goal) => ({
  goal_id: g.goalId,
  user_id: g.userId,
  exercise: g.exercise,
  body_part: g.bodyPart,
  unit: g.unit,
  target: g.target,
  weekdays: g.weekdays,
  time_of_day: g.time,
  start_date: g.startDate,
  end_date: g.endDate,
  status: g.status,
});

const missionRow = (m: Mission) => ({
  mission_id: m.missionId,
  goal_id: m.goalId,
  mission_date: m.date,
  scheduled_at: toIso(m.scheduledAt),
  type: m.type,
  snooze_count: m.snoozeCount,
});

const recommendationRow = (r: Recommendation) => ({
  rec_id: r.recId,
  goal_id: r.goalId,
  rule: r.rule,
  proposed_amount: r.proposedAmount,
  response: r.response,
  responded_at: toIso(r.respondedAt),
});

export async function loadState(db: SupabaseClient, userId: string): Promise<AppState> {
  const [profile, goals, missions, records, recs, pains, events] = await Promise.all([
    db.from('profiles').select('*').eq('user_id', userId).single(),
    db.from('goals').select('*').order('created_at'),
    db.from('missions').select('*').order('mission_date'),
    db.from('records').select('*').order('record_date'),
    db.from('recommendations').select('*').order('responded_at'),
    db.from('pain_clears').select('*'),
    db.from('app_events').select('*').order('created_at', { ascending: false }).limit(EVENT_LOAD_LIMIT),
  ]);
  for (const r of [profile, goals, missions, records, recs, pains, events]) check(r.error);
  const p = profile.data!;
  return {
    user: {
      userId,
      nickname: p.nickname,
      preferredTime: p.preferred_time,
      level: p.level,
      notificationIntensity: 'normal',
      subscription: 'free',
    },
    goals: goals.data!.map((g): Goal => ({
      goalId: g.goal_id,
      userId: g.user_id,
      exercise: g.exercise,
      bodyPart: g.body_part,
      unit: g.unit,
      target: g.target,
      weekdays: g.weekdays as Weekday[],
      time: String(g.time_of_day).slice(0, 5),
      startDate: g.start_date,
      endDate: g.end_date,
      status: g.status,
    })),
    missions: missions.data!.map((m): Mission => ({
      missionId: m.mission_id,
      goalId: m.goal_id,
      date: m.mission_date,
      scheduledAt: fromIso(m.scheduled_at),
      type: m.type,
      snoozeCount: m.snooze_count,
    })),
    records: records.data!.map((r): PracticeRecord => ({
      recordId: r.record_id,
      kind: r.kind as RecordKind,
      // 보너스는 DB에서 goal/mission이 null → 클라이언트 센티널로 변환
      missionId: r.mission_id ?? bonusMissionId(r.record_date, r.bonus_key ?? ''),
      goalId: r.goal_id ?? BONUS_GOAL_ID,
      date: r.record_date,
      status: r.status,
      amount: r.amount,
      durationSec: r.duration_sec,
      verification: r.verification as Verification,
      difficulty: (r.difficulty as Difficulty | null) ?? null,
      memo: r.memo,
      completedAt: fromIso(r.completed_at),
    })),
    recommendations: recs.data!.map((r): Recommendation => ({
      recId: r.rec_id,
      goalId: r.goal_id,
      rule: r.rule,
      proposedAmount: r.proposed_amount,
      response: r.response,
      respondedAt: fromIso(r.responded_at),
    })),
    painClearedAt: Object.fromEntries(pains.data!.map((x) => [x.exercise, fromIso(x.cleared_at)])),
    alarm: null,
    onboarded: p.onboarded,
    notificationSettings: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      reminder: p.reminder_setting ?? DEFAULT_NOTIFICATION_SETTINGS.reminder,
      bonusNotification: p.bonus_notification ?? DEFAULT_NOTIFICATION_SETTINGS.bonusNotification,
    },
    events: events.data!.reverse().map(
      (e): AppEvent => ({ type: e.type, date: e.event_date, payload: e.payload as AppEvent['payload'] }),
    ),
    reminder: null,
    demoDate: null,
  };
}

export function createRemoteSync(db: SupabaseClient, userId: string): Sync {
  return {
    async addGoal(goal, missions, onboarded) {
      check((await db.from('goals').insert(goalRow({ ...goal, userId }))).error);
      if (missions.length) check((await db.from('missions').insert(missions.map(missionRow))).error);
      if (onboarded) check((await db.from('profiles').update({ onboarded: true }).eq('user_id', userId)).error);
    },

    async saveRecord(record) {
      const { error } = await db.from('records').upsert(
        {
          record_id: record.recordId,
          user_id: userId,
          kind: record.kind,
          mission_id: record.missionId,
          goal_id: record.goalId,
          record_date: record.date,
          status: record.status,
          amount: record.amount,
          duration_sec: record.durationSec,
          verification: record.verification,
          difficulty: record.difficulty,
          memo: record.memo,
          completed_at: toIso(record.completedAt),
        },
        { onConflict: 'mission_id' },
      );
      if (error) throw new SaveFailedError();
    },

    async setSnoozeCount(missionId, snoozeCount) {
      check((await db.from('missions').update({ snooze_count: snoozeCount }).eq('mission_id', missionId)).error);
    },

    async respondRecommendation(recommendation) {
      check((await db.from('recommendations').insert(recommendationRow(recommendation))).error);
    },

    async confirmNextWeek(goalId, target, time, missions, recommendation) {
      check((await db.from('goals').update({ target, time_of_day: time }).eq('goal_id', goalId)).error);
      if (missions.length) {
        check((await db.from('missions').upsert(missions.map(missionRow), { onConflict: 'mission_id' })).error);
      }
      check((await db.from('recommendations').insert(recommendationRow(recommendation))).error);
    },

    async saveBonus(record) {
      // 보너스는 goal/mission 없이 저장 (record_id가 날짜+종류로 결정적이라 재시도해도 중복되지 않음)
      const bonusKey = record.missionId.split('-').slice(4).join('-');
      const { error } = await db.from('records').upsert(
        {
          record_id: record.recordId,
          user_id: userId,
          kind: 'bonus',
          bonus_key: bonusKey,
          mission_id: null,
          goal_id: null,
          record_date: record.date,
          status: 'done',
          amount: record.amount,
          duration_sec: record.durationSec,
          verification: record.verification,
          difficulty: null,
          memo: '',
          completed_at: toIso(record.completedAt),
        },
        { onConflict: 'record_id' },
      );
      if (error) throw new SaveFailedError();
    },

    async saveSettings(settings) {
      check(
        (
          await db
            .from('profiles')
            .update({ reminder_setting: settings.reminder, bonus_notification: settings.bonusNotification })
            .eq('user_id', userId)
        ).error,
      );
    },

    async logEvent(event) {
      check((await db.from('app_events').insert({ user_id: userId, type: event.type, event_date: event.date, payload: event.payload })).error);
    },

    async rescheduleGoalTime(goalId, time, missions) {
      check((await db.from('goals').update({ time_of_day: time }).eq('goal_id', goalId)).error);
      if (missions.length) {
        check((await db.from('missions').upsert(missions.map(missionRow), { onConflict: 'mission_id' })).error);
      }
    },

    async clearPain(exercise, at) {
      check((await db.from('pain_clears').upsert({ user_id: userId, exercise, cleared_at: toIso(at) })).error);
    },
  };
}
