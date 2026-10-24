// 흐름 검증: node scripts/verify-flows.ts (Node 24 타입 스트리핑)
// reducer + api(Mock 상태 계산, 빠른 실행을 위해 기록하는 가짜 Sync 사용)로 시연 시나리오를 헤드리스로 검증한다.
import assert from 'node:assert/strict';
import { createApi } from '../src/lib/api.ts';
import type { Api, Sync } from '../src/lib/api.ts';
import { setToday, startOfWeek, today } from '../src/lib/date.ts';
import { createDemoState } from '../src/lib/demoSeed.ts';
import { reducer } from '../src/lib/reducer.ts';
import type { Action } from '../src/lib/reducer.ts';
import { createInitialState } from '../src/lib/seed.ts';
import { weeklyReport } from '../src/lib/report.ts';
import {
  selectComeback, selectNextMissionPreview, selectNotificationStatus, selectRecommendations, selectRestDay, selectShieldLedger,
  selectStreak, selectWeeklyReport,
} from '../src/lib/selectors.ts';
import { BONUS_GOAL_ID, bonusMissionId } from '../src/lib/types.ts';
import type { AppState } from '../src/lib/types.ts';

let passed = 0;
let failed = 0;
async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed += 1;
    process.exitCode = 1;
    console.error(`  FAIL ${name}\n${e instanceof Error ? e.stack : String(e)}`);
  }
}

interface Env {
  api: Api;
  get: () => AppState;
  calls: string[];
  failBonus: { on: boolean };
}

function makeEnv(initial: AppState): Env {
  let state = initial;
  const calls: string[] = [];
  const failBonus = { on: false };
  const sync: Sync = {
    addGoal: async () => {},
    saveRecord: async (r) => void calls.push(`saveRecord:${r.kind}:${r.missionId}`),
    setSnoozeCount: async () => {},
    respondRecommendation: async () => {},
    confirmNextWeek: async () => {},
    clearPain: async () => {},
    saveBonus: async (r) => {
      if (failBonus.on) throw new Error('network');
      calls.push(`saveBonus:${r.missionId}`);
    },
    saveSettings: async (s) => void calls.push(`saveSettings:${s.reminder}:${s.bonusNotification}`),
    logEvent: async (e) => void calls.push(`logEvent:${e.type}`),
    rescheduleGoalTime: async (g, t, m) => void calls.push(`reschedule:${g}:${t}:${m.length > 0}`),
  };
  const dispatch = (a: Action) => {
    state = reducer(state, a);
  };
  const api = createApi(() => state, dispatch, sync);
  return { api, get: () => state, calls, failBonus };
}

function demoEnv(): Env {
  setToday('2026-10-23');
  return makeEnv(createDemoState());
}

const lungeMission = (d: string) => `m-g-demo-lunge-${d.replaceAll('-', '')}`;

async function main() {
  console.log('1. 데모 시나리오 시드');
  await check('시드: 오늘 10/23(금), 스트릭 1, 보호권 0, 다음 미션 10/27 21:00, 쉬는 날', () => {
    const env = makeEnv(createInitialState());
    env.api.loadScenario('demo');
    const s = env.get();
    assert.equal(today(), '2026-10-23');
    assert.equal(s.demoDate, '2026-10-23');
    assert.equal(selectStreak(s).current, 1);
    assert.equal(selectStreak(s).protectionLeft, 0);
    const p = selectNextMissionPreview(s)!;
    assert.equal(p.mission.date, '2026-10-27');
    assert.equal(p.time, '21:00');
    assert.equal(p.goal.exercise, '런지');
    assert.equal(selectRestDay(s), true);
    assert.equal(selectComeback(s), null);
  });
  await check('시나리오 default: 가상 날짜 해제', () => {
    const env = makeEnv(createDemoState());
    env.api.loadScenario('default');
    assert.equal(env.get().demoDate, null);
    assert.equal(env.get().goals.length, 8);
    setToday(null);
  });

  console.log('2. 리마인드 · 알림 상한');
  await check('리마인드: 기본 hourBefore, 문구와 이벤트, 두 번째는 차단', () => {
    const env = demoEnv();
    assert.equal(env.get().notificationSettings.reminder, 'hourBefore');
    const r = env.api.triggerReminder();
    assert.equal(r.ok, true);
    assert.equal(env.get().reminder?.message, '지난주 런지는 ‘적당해요’였어요. 오늘 21시, 같은 분량이에요.');
    assert.equal(env.get().reminder?.missionId, lungeMission('2026-10-27'));
    assert.equal(env.get().events.filter((e) => e.type === 'reminder_sent').length, 1);
    const second = env.api.triggerReminder();
    assert.equal(second.ok, false);
    assert.ok(second.reason);
    assert.equal(env.get().events.filter((e) => e.type === 'reminder_blocked').length, 1);
    assert.equal(env.get().events.filter((e) => e.type === 'reminder_sent').length, 1);
  });
  await check('상한: 리마인드 + 미션 알림 = 2회, 세 번째 미션 알림은 차단되고 알림이 뜨지 않음', () => {
    const env = demoEnv();
    env.api.triggerReminder();
    const id = lungeMission('2026-10-27');
    env.api.alarmTrigger(id);
    assert.equal(env.get().alarm?.missionId, id);
    assert.equal(selectNotificationStatus(env.get()).todayCount, 2);
    assert.equal(selectNotificationStatus(env.get()).capReached, true);
    env.api.alarmStart();
    env.api.alarmTrigger(id);
    assert.equal(env.get().alarm, null);
    const blocked = env.get().events.filter((e) => e.type === 'alarm_blocked');
    assert.equal(blocked.length, 1);
    assert.ok(String(blocked[0].payload.reason).length > 0);
    assert.ok(selectNotificationStatus(env.get()).reasons.length >= 1);
  });
  await check('스누즈는 상한을 소모하지 않음', () => {
    const env = demoEnv();
    const id = lungeMission('2026-10-27');
    env.api.alarmTrigger(id);
    assert.equal(env.api.alarmSnooze(), true);
    assert.equal(env.api.alarmSnooze(), false); // 이미 snoozed 상태
    assert.equal(selectNotificationStatus(env.get()).todayCount, 1);
    assert.equal(env.api.triggerReminder().ok, true); // 미션 1 + 리마인드 1 가능
    assert.equal(selectNotificationStatus(env.get()).todayCount, 2);
  });
  await check('설정 변경: 리마인드 없음/보너스 알림 끔은 notification_off 기록, 없음이면 리마인드 거부', async () => {
    const env = demoEnv();
    await env.api.setNotificationSetting({ bonusNotification: true });
    assert.equal(env.get().events.filter((e) => e.type === 'notification_off').length, 0);
    await env.api.setNotificationSetting({ bonusNotification: false });
    await env.api.setNotificationSetting({ reminder: 'none' });
    assert.equal(env.get().events.filter((e) => e.type === 'notification_off').length, 2);
    const r = env.api.triggerReminder();
    assert.equal(r.ok, false);
    assert.ok(r.reason);
    assert.equal(env.get().reminder, null);
    assert.ok(env.calls.includes('saveSettings:none:false'));
    await env.api.setNotificationSetting({ reminder: 'none' }); // 이미 none: 추가 기록 없음
    assert.equal(env.get().events.filter((e) => e.type === 'notification_off').length, 2);
  });

  console.log('3. 보너스 · 보호권');
  await check('보너스 3회: kind=bonus, 센티널 goalId, 스트릭·주간 실천 횟수 불변, 보호권 +1, 원장 earned', async () => {
    const env = demoEnv();
    const week = startOfWeek(today());
    const before = weeklyReport(env.get().goals, env.get().records, week);
    const streakBefore = selectStreak(env.get());
    for (const key of ['stretch', 'squat', 'march']) {
      const r = await env.api.saveBonus({ bonusKey: key, amount: key === 'squat' ? 10 : 1, durationSec: 0 });
      assert.equal(r.kind, 'bonus');
      assert.equal(r.goalId, BONUS_GOAL_ID);
      assert.equal(r.missionId, bonusMissionId('2026-10-23', key));
    }
    const s = env.get();
    assert.equal(selectStreak(s).current, streakBefore.current);
    assert.equal(selectStreak(s).protectionLeft, 1);
    const after = weeklyReport(s.goals, s.records, week);
    assert.equal(after.doneCount, before.doneCount);
    assert.equal(after.achievementRate, before.achievementRate);
    assert.equal(after.bonusCount, 3);
    assert.equal(selectShieldLedger(s).filter((e) => e.type === 'earned').length, 1);
    assert.ok(env.calls.includes(`saveBonus:${bonusMissionId('2026-10-23', 'stretch')}`));
    setToday(null);
  });
  await check('보너스: 같은 종류 재저장은 중복되지 않고, 모르는 종류·저장 실패는 throw + 상태 불변', async () => {
    const env = demoEnv();
    await env.api.saveBonus({ bonusKey: 'stretch', amount: 1, durationSec: 60 });
    await env.api.saveBonus({ bonusKey: 'stretch', amount: 1, durationSec: 60 });
    assert.equal(env.get().records.filter((r) => r.kind === 'bonus').length, 1);
    await assert.rejects(env.api.saveBonus({ bonusKey: 'pizza', amount: 1, durationSec: 0 }));
    env.failBonus.on = true;
    await assert.rejects(env.api.saveBonus({ bonusKey: 'squat', amount: 10, durationSec: 30 }));
    assert.equal(env.get().records.filter((r) => r.kind === 'bonus').length, 1);
    setToday(null);
  });
  await check('보너스 6회(같은 달): 획득은 1개에 머물고(무료 월 1개), 보유는 2를 넘지 않음', async () => {
    const env = demoEnv();
    for (const key of ['stretch', 'squat', 'march']) await env.api.saveBonus({ bonusKey: key, amount: 1, durationSec: 0 });
    env.api.advanceDays(1);
    for (const key of ['stretch', 'squat', 'march']) await env.api.saveBonus({ bonusKey: key, amount: 1, durationSec: 0 });
    const s = env.get();
    assert.equal(s.records.filter((r) => r.kind === 'bonus').length, 6);
    assert.equal(selectShieldLedger(s).filter((e) => e.type === 'earned').length, 1);
    assert.ok(selectStreak(s).protectionLeft <= 2);
    setToday(null);
  });
  await check('획득 보호권은 미실천 때 자동 사용되어 스트릭이 유지되고 원장에 used 기록', async () => {
    const env = demoEnv();
    for (const key of ['stretch', 'squat', 'march']) await env.api.saveBonus({ bonusKey: key, amount: 1, durationSec: 0 });
    const missed = await env.api.missNextMission();
    assert.equal(missed?.status, 'missed');
    const s = env.get();
    assert.equal(selectStreak(s).current, 1);
    assert.equal(selectStreak(s).protectionLeft, 0);
    assert.ok(selectShieldLedger(s).some((e) => e.type === 'used' && e.reason.includes('획득')));
    assert.equal(selectComeback(s), null);
    setToday(null);
  });

  console.log('4. 미니 미션');
  await check('미니: kind=mini 저장, 스트릭 유지·증가, 리포트에 미니 n회 별도, 기본 소요 시간', async () => {
    const env = demoEnv();
    env.api.advanceDays(4); // 10/27 (화)
    assert.equal(today(), '2026-10-27');
    const id = lungeMission('2026-10-27');
    const r = await env.api.saveRecord({ missionId: id, amount: 5, durationSec: 0, verification: 'manual', difficulty: 'ok', memo: '', kind: 'mini' });
    assert.equal(r.kind, 'mini');
    assert.ok(r.durationSec > 0);
    assert.equal(selectStreak(env.get()).current, 2);
    const rep = weeklyReport(env.get().goals, env.get().records, '2026-10-26');
    assert.equal(rep.miniCount, 1);
    assert.equal(rep.doneCount, 1);
    assert.ok(env.calls.includes(`saveRecord:mini:${id}`));
    setToday(null);
  });

  console.log('5. 스트릭 끊김 · 복귀 미션');
  await check('이번 미션 놓치기: 스트릭 0, 날짜 이동, 복귀 대상(런지 10회, 문구), 완료 시 스트릭 1, 추천 규칙 재적용', async () => {
    const env = demoEnv();
    const missed = await env.api.missNextMission();
    assert.equal(missed?.missionId, lungeMission('2026-10-27'));
    assert.equal(today(), '2026-10-28');
    assert.equal(env.get().demoDate, '2026-10-28');
    assert.equal(selectStreak(env.get()).current, 0);
    const c = selectComeback(env.get())!;
    assert.equal(c.missionId, lungeMission('2026-10-29'));
    assert.equal(c.amount, 10);
    assert.equal(c.message, '다시 시작이 제일 어려워요. 오늘은 10회만.');
    assert.equal(selectNextMissionPreview(env.get())?.amount, 10);

    env.api.advanceDays(1);
    const done = await env.api.saveRecord({ missionId: c.missionId, amount: 10, durationSec: 0, verification: 'manual', difficulty: 'ok', memo: '', kind: 'comeback' });
    assert.equal(done.kind, 'comeback');
    assert.equal(selectStreak(env.get()).current, 1);
    assert.equal(selectComeback(env.get()), null);
    // 다음 추천은 일반 기록만 본다(복귀 기록 제외, D4): 최근 일반 3건 = 미실천 3 → missed_down 20 -> 14
    const rec = selectRecommendations(env.get())[0].result;
    assert.equal(rec.rule, 'missed_down');
    assert.equal(rec.proposedAmount, 14);
    assert.ok(rec.proposedAmount <= 20 * 1.2);
    setToday(null);
  });
  await check('복귀 중 통증 메모: 추천 중단(pain_stop), 분량 증가 없음', async () => {
    const env = demoEnv();
    await env.api.missNextMission();
    env.api.advanceDays(1);
    const c = selectComeback(env.get())!;
    await env.api.saveRecord({ missionId: c.missionId, amount: 10, durationSec: 0, verification: 'manual', difficulty: 'ok', memo: '무릎이 아파요', kind: 'comeback' });
    const view = selectRecommendations(env.get())[0];
    assert.equal(view.result.rule, 'pain_stop');
    assert.equal(view.result.stop, true);
    assert.ok(view.result.proposedAmount <= 20);
    assert.equal(selectWeeklyReport(env.get()).plan.length, 0);
    setToday(null);
  });
  await check('통증 메모가 먼저 있으면 복귀 대상 없음', async () => {
    const env = demoEnv();
    const id = lungeMission('2026-10-27');
    env.api.advanceDays(4);
    await env.api.saveRecord({ missionId: id, amount: 20, durationSec: 0, verification: 'manual', difficulty: 'ok', memo: '허리 통증', kind: 'normal' });
    assert.equal(selectComeback(env.get()), null);
    setToday(null);
  });

  console.log('6. 다음 미션 예고 · 시각 변경 · 날짜 이동');
  await check('시각 변경: 21:00 → 20:00이 이후 미션에 즉시 반영, 추천 기록 없음, Sync 호출', async () => {
    const env = demoEnv();
    const p = selectNextMissionPreview(env.get())!;
    const minus = p.timeOptions.find((o) => o.label === '-1시간')!;
    await env.api.rescheduleGoalTime(p.goal.goalId, minus.time);
    assert.equal(minus.time, '20:00');
    const after = selectNextMissionPreview(env.get())!;
    assert.equal(after.time, '20:00');
    assert.equal(after.mission.scheduledAt, '2026-10-27T20:00:00');
    assert.equal(env.get().goals[0].time, '20:00');
    assert.equal(env.get().recommendations.length, 0);
    assert.ok(env.calls.includes('reschedule:g-demo-lunge:20:00:true'));
    await assert.rejects(env.api.rescheduleGoalTime(p.goal.goalId, '25:99'));
    setToday(null);
  });
  await check('날짜 이동: advanceDays가 today()와 demoDate를 함께 바꾸고 쉬는 날 판단이 갱신', () => {
    const env = demoEnv();
    env.api.advanceDays(1);
    assert.equal(today(), '2026-10-24');
    assert.equal(env.get().demoDate, '2026-10-24');
    env.api.advanceDays(3);
    assert.equal(today(), '2026-10-27');
    assert.equal(selectRestDay(env.get()), false);
    setToday(null);
  });

  console.log('7. Persona A 회귀');
  await check('월·수·금 22:00 스쿼트 20회: 알림 → 20회 → 적당해요 ×3 → 추천 확정', async () => {
    setToday('2026-10-26'); // 월
    const empty: AppState = { ...createInitialState(), goals: [], missions: [], records: [], recommendations: [], onboarded: false };
    const env = makeEnv(empty);
    const goal = await env.api.completeOnboarding({ exercise: '스쿼트', bodyPart: 'lower', unit: 'rep', target: 20, weekdays: [1, 3, 5], time: '22:00', durationWeeks: 4 });
    for (const offset of [0, 2, 2]) {
      env.api.advanceDays(offset);
      const m = env.get().missions.find((x) => x.goalId === goal.goalId && x.date === today())!;
      env.api.alarmTrigger(m.missionId);
      assert.equal(env.get().alarm?.missionId, m.missionId);
      env.api.alarmStart();
      await env.api.saveRecord({ missionId: m.missionId, amount: 20, durationSec: 0, verification: 'manual', difficulty: 'ok', memo: '' });
    }
    assert.equal(selectStreak(env.get()).current, 3);
    const view = selectRecommendations(env.get())[0];
    assert.equal(view.result.rule, 'ok_hold');
    assert.equal(view.result.proposedAmount, 20);
    const out = await env.api.confirmNextWeek([{ goalId: goal.goalId, rule: 'ok_hold', response: 'accepted', amount: 20 }]);
    assert.equal(out[0].response, 'accepted');
    assert.equal(env.get().recommendations.length, 1);
    assert.equal(env.get().goals[0].target, 20);
    assert.ok(env.get().records.every((r) => r.kind === 'normal'));
    setToday(null);
  });

  setToday(null);
  console.log(`\n${passed} flow checks passed${failed ? `, ${failed} FAILED` : ''}`);
}

main();
