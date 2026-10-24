// Supabase 스모크 테스트 (v0.2 마이그레이션 적용 후 실행).
//   node --env-file=.env.local scripts/smoke-supabase.mjs
// 익명 로그인 -> mini/comeback/bonus 기록 왕복, 보너스 null FK 제약, 설정 갱신, app_events, RLS 격리, 시험 행 정리.
// 키·토큰 값은 절대 출력하지 않는다. 앱 코드가 아닌 운영 점검용 스크립트다.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 필요해요. (값은 출력하지 않아요)');
  process.exit(2);
}

let failed = 0;
function report(name, ok, detail = '') {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ` -- ${detail}`}`);
}
async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    report(name, false, e instanceof Error ? e.message : String(e));
  }
}

async function signIn() {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`익명 로그인 실패: ${error?.message ?? 'no user'}`);
  return { db, userId: data.user.id };
}

const run = Date.now().toString(36);
const date = '2026-10-23';
const goalId = `smoke-g-${run}`;
const missionIds = ['mini', 'comeback', 'normal'].map((k) => `m-${goalId}-${k}`);
const bonusRecordId = `r-bonus-${date}-stretch-${run}`;

const A = await signIn();
const B = await signIn();
try {
  // 사전 준비: 목표 + 미션 3개
  await step('목표·미션 생성', async () => {
    const g = await A.db.from('goals').insert({
      goal_id: goalId, user_id: A.userId, exercise: '스모크', body_part: 'lower', unit: 'rep', target: 20,
      weekdays: [2, 4], time_of_day: '21:00', start_date: '2026-09-15', end_date: '2026-12-31', status: 'active',
    });
    if (g.error) throw new Error(g.error.message);
    const dates = ['2026-10-20', '2026-10-22', '2026-10-27'];
    const m = await A.db.from('missions').insert(
      missionIds.map((id, i) => ({
        mission_id: id, goal_id: goalId, mission_date: dates[i], scheduled_at: `${dates[i]}T12:00:00Z`, type: 'count', snooze_count: 0,
      })),
    );
    if (m.error) throw new Error(m.error.message);
    report('목표·미션 생성', true);
  });

  // kind 왕복
  for (const [i, kind] of ['mini', 'comeback', 'normal'].entries()) {
    await step(`records kind=${kind} 저장·재조회`, async () => {
      const up = await A.db.from('records').upsert(
        {
          record_id: `r-${missionIds[i]}`, user_id: A.userId, kind, mission_id: missionIds[i], goal_id: goalId,
          record_date: ['2026-10-20', '2026-10-22', '2026-10-27'][i], status: 'done', amount: 10, duration_sec: 30,
          verification: 'manual', difficulty: 'ok', memo: '', completed_at: new Date().toISOString(),
        },
        { onConflict: 'mission_id' },
      );
      if (up.error) throw new Error(up.error.message);
      const got = await A.db.from('records').select('kind').eq('record_id', `r-${missionIds[i]}`).single();
      report(`records kind=${kind} 저장·재조회`, got.data?.kind === kind, got.error?.message);
    });
  }

  // 보너스: goal/mission null
  await step('보너스 기록(goal_id/mission_id null) 저장', async () => {
    const up = await A.db.from('records').upsert(
      {
        record_id: bonusRecordId, user_id: A.userId, kind: 'bonus', bonus_key: 'stretch', mission_id: null, goal_id: null,
        record_date: date, status: 'done', amount: 1, duration_sec: 60, verification: 'auto', difficulty: null, memo: '',
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'record_id' },
    );
    report('보너스 기록(goal_id/mission_id null) 저장', !up.error, up.error?.message);
    const again = await A.db.from('records').upsert(
      {
        record_id: bonusRecordId, user_id: A.userId, kind: 'bonus', bonus_key: 'stretch', mission_id: null, goal_id: null,
        record_date: date, status: 'done', amount: 1, duration_sec: 60, verification: 'auto', difficulty: null, memo: '',
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'record_id' },
    );
    report('보너스 재시도는 중복되지 않음(멱등)', !again.error, again.error?.message);
    const list = await A.db.from('records').select('record_id').eq('record_id', bonusRecordId);
    report('보너스 행 1건 재조회', list.data?.length === 1, list.error?.message);
  });

  await step('형태 제약: 보너스인데 goal_id가 있으면 거부', async () => {
    const bad = await A.db.from('records').insert({
      record_id: `r-bad-${run}`, user_id: A.userId, kind: 'bonus', bonus_key: 'squat', mission_id: null, goal_id: goalId,
      record_date: date, status: 'done', amount: 10, duration_sec: 30, verification: 'manual', difficulty: null, memo: '',
      completed_at: new Date().toISOString(),
    });
    report('형태 제약: 보너스인데 goal_id가 있으면 거부', Boolean(bad.error));
  });

  // 설정
  await step('설정(reminder_setting/bonus_notification) 갱신·조회', async () => {
    const up = await A.db.from('profiles').update({ reminder_setting: 'morning', bonus_notification: true }).eq('user_id', A.userId);
    if (up.error) throw new Error(up.error.message);
    const got = await A.db.from('profiles').select('reminder_setting, bonus_notification').eq('user_id', A.userId).single();
    report(
      '설정(reminder_setting/bonus_notification) 갱신·조회',
      got.data?.reminder_setting === 'morning' && got.data?.bonus_notification === true,
      got.error?.message,
    );
    const def = await B.db.from('profiles').select('reminder_setting, bonus_notification').eq('user_id', B.userId).single();
    report('신규 사용자 기본값 hourBefore/false', def.data?.reminder_setting === 'hourBefore' && def.data?.bonus_notification === false, def.error?.message);
  });

  // 이벤트
  await step('app_events 기록·조회', async () => {
    const ins = await A.db.from('app_events').insert({
      user_id: A.userId, type: 'reminder_sent', event_date: date, payload: { missionId: missionIds[0], smoke: run },
    });
    if (ins.error) throw new Error(ins.error.message);
    const got = await A.db.from('app_events').select('type, payload').eq('user_id', A.userId);
    report('app_events 기록·조회', got.data?.some((e) => e.type === 'reminder_sent' && e.payload?.smoke === run) === true, got.error?.message);
  });

  // RLS 격리
  await step('RLS: 다른 사용자(B)는 A의 기록·이벤트를 볼 수 없음', async () => {
    const rec = await B.db.from('records').select('record_id').eq('record_id', bonusRecordId);
    const ev = await B.db.from('app_events').select('event_id').eq('user_id', A.userId);
    const goals = await B.db.from('goals').select('goal_id').eq('goal_id', goalId);
    report('RLS: B는 A의 records/app_events/goals 비가시', (rec.data?.length ?? 0) === 0 && (ev.data?.length ?? 0) === 0 && (goals.data?.length ?? 0) === 0);
    const forged = await B.db.from('records').insert({
      record_id: `r-forge-${run}`, user_id: A.userId, kind: 'bonus', bonus_key: 'squat', mission_id: null, goal_id: null,
      record_date: date, status: 'done', amount: 10, duration_sec: 30, verification: 'manual', difficulty: null, memo: '',
      completed_at: new Date().toISOString(),
    });
    report('RLS: B가 A 명의로 기록 삽입 불가', Boolean(forged.error));
  });
} finally {
  // 정리: 시험 행 삭제(기록·이벤트·목표(미션 cascade)), 설정 원복
  await A.db.from('records').delete().eq('record_id', bonusRecordId);
  await A.db.from('app_events').delete().eq('user_id', A.userId);
  await A.db.from('goals').delete().eq('goal_id', goalId);
  await A.db.from('profiles').update({ reminder_setting: 'hourBefore', bonus_notification: false }).eq('user_id', A.userId);
  const left = await A.db.from('goals').select('goal_id').eq('goal_id', goalId);
  report('정리: 시험 목표 삭제됨', (left.data?.length ?? 0) === 0);
}

console.log(failed === 0 ? '\n스모크 전 항목 ok' : `\n${failed}개 항목 FAIL`);
process.exit(failed === 0 ? 0 : 1);
