// 도메인 검증: node scripts/verify-domain.ts (Node 24 타입 스트리핑)
// '오늘'을 연속 7일(모든 요일)과 실제 오늘 날짜로 바꿔 가며 같은 기대 결과가 나오는지 확인한다.
import assert from 'node:assert/strict';
import { nextAlarmStep, snoozeAlarm, triggerAlarm, LAST_RING_TIMEOUT_MS, SNOOZE_REAL_MS } from '../src/lib/alarm.ts';
import { createApi, FAIL_TRIGGER, SaveFailedError } from '../src/lib/api.ts';
import { addDays, dateRange, setToday, today, weekdayOf, startOfWeek } from '../src/lib/date.ts';
import { isScheduled } from '../src/lib/missions.ts';
import { suggestFirstGoal } from '../src/lib/onboarding.ts';
import { decreaseAmount, increaseAmount, isFourWeekStreak, recommend } from '../src/lib/recommendation.ts';
import { reducer } from '../src/lib/reducer.ts';
import type { Action } from '../src/lib/reducer.ts';
import { createInitialState } from '../src/lib/seed.ts';
import { selectRecommendations, selectStreak, selectWeeklyReport } from '../src/lib/selectors.ts';
import { computeStreak } from '../src/lib/streak.ts';
import { TEMPLATES } from '../src/lib/templates.ts';
import type { AppState, Goal, PracticeRecord, RuleId } from '../src/lib/types.ts';

let passed = 0;
let failed = 0;
async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
  } catch (e) {
    failed += 1;
    process.exitCode = 1;
    console.error(`FAIL  [${today()}] ${name}\n${e instanceof Error ? e.stack : String(e)}`);
  }
}

function realToday(): string {
  setToday(null);
  return today();
}

function fixtureGoal(p: Partial<Goal> & Pick<Goal, 'unit' | 'target'>): Goal {
  return {
    goalId: 'fx', userId: 'u', exercise: 'fx', bodyPart: 'full', weekdays: [1, 2, 3, 4, 5, 6, 0],
    time: '10:00', startDate: '2020-01-01', endDate: '2099-12-31', status: 'active', ...p,
  };
}

function fixtureRecords(
  T: string,
  goalId: string,
  items: { d?: 'easy' | 'ok' | 'hard'; s?: 'done' | 'missed'; memo?: string }[],
): PracticeRecord[] {
  // items[0] = 가장 최근
  return items.map((it, i) => {
    const date = addDays(T, -1 - i);
    const status = it.s ?? 'done';
    return {
      recordId: `x${i}`, missionId: `m${i}`, goalId, date, status, amount: 1, durationSec: 1, verification: 'manual',
      difficulty: status === 'done' ? (it.d ?? 'ok') : null, memo: it.memo ?? '', completedAt: `${date}T10:00:00`,
    };
  });
}

function doneRecord(goalId: string, date: string, i: number): PracticeRecord {
  return {
    recordId: `d${i}`, missionId: `md${i}`, goalId, date, status: 'done', amount: 1, durationSec: 1,
    verification: 'manual', difficulty: 'ok', memo: '', completedAt: `${date}T10:00:00`,
  };
}

async function runAll(T: string): Promise<void> {
  const tag = `${T}(${'일월화수목금토'[weekdayOf(T)]})`;
  const state = createInitialState();
  const rec = (goal: Goal, items: Parameters<typeof fixtureRecords>[2]) =>
    recommend({ goal, goals: [goal], records: fixtureRecords(T, goal.goalId, items), today: T, painClearedAt: {} });

  // ---- 시드: 규칙 8종이 목표별로 각각 발동 ----
  const views = selectRecommendations(state);
  const byGoal = Object.fromEntries(views.map((v) => [v.goal.goalId, v]));
  const expected: Record<string, [RuleId, number]> = {
    'g-pushup': ['pain_stop', 10],
    'g-lunge': ['missed_down', 10],
    'g-jumpingjack': ['hard_down', 24],
    'g-squat': ['easy_up', 24],
    'g-plank': ['ok_hold', 10],
    'g-stretch': ['four_week_new', 5],
    'g-walk': ['insufficient_data', 1000],
    'g-yoga': ['no_data', 8],
  };
  for (const [goalId, [rule, amount]] of Object.entries(expected)) {
    await check(`${tag} seed ${goalId} → ${rule} (${amount})`, () => {
      assert.equal(byGoal[goalId].result.rule, rule);
      assert.equal(byGoal[goalId].result.proposedAmount, amount);
    });
  }
  await check(`${tag} seed: 8개 규칙이 서로 다르게 모두 발동, pain_stop만 stop`, () => {
    assert.equal(new Set(views.map((v) => v.result.rule)).size, 8);
    assert.equal(views.filter((v) => v.result.stop).length, 1);
    assert.equal(byGoal['g-pushup'].result.stop, true);
  });
  await check(`${tag} seed: 스쿼트 같은 부위(런지) 연속일 경고, 런지 시간대 제안 21:00→20:00`, () => {
    assert.ok(byGoal['g-squat'].result.warnings.some((w) => w.includes('같은 부위')));
    assert.equal(byGoal['g-lunge'].suggestedTime, '20:00');
    assert.equal(byGoal['g-squat'].suggestedTime, null);
  });
  await check(`${tag} seed: 4주 지속 부가 메시지(스쿼트, 플랭크), 플랭크 +10% = 11`, () => {
    assert.ok(byGoal['g-squat'].result.extras.some((e) => e.includes('4주')));
    assert.ok(byGoal['g-plank'].result.extras.some((e) => e.includes('4주')));
    assert.equal(byGoal['g-plank'].result.plus10Amount, 11);
  });
  await check(`${tag} seed: 오늘 예정 미션이 2개 이상이고 모두 기록 없음`, () => {
    const todays = state.missions.filter((m) => m.date === T);
    assert.ok(todays.length >= 2, `오늘 미션 ${todays.length}개`);
    assert.ok(todays.every((m) => !state.records.some((r) => r.missionId === m.missionId)));
    assert.ok(state.records.every((r) => r.date < T), '기록은 모두 오늘 이전');
  });

  // ---- 스트릭: 시드는 최근 27일이 모두 예정일이고 모두 done ----
  const streak = selectStreak(state);
  await check(`${tag} seed 스트릭 current=longest=27, 보호권 미사용`, () => {
    assert.equal(streak.current, 27);
    assert.equal(streak.longest, 27);
    assert.deepEqual(streak.protectionUsedOn, []);
    assert.equal(streak.protectionLeft, 1);
  });
  const todayMission = state.missions.find((m) => m.date === T)!;
  const todayRecord = (status: 'done' | 'missed'): PracticeRecord => ({
    ...state.records[0], recordId: 'rt', missionId: todayMission.missionId, goalId: todayMission.goalId,
    date: T, status, difficulty: status === 'done' ? 'ok' : null, completedAt: `${T}T07:00:00`,
  });
  await check(`${tag} 스트릭: 오늘 미완료는 리셋하지 않고, 완료하면 +1, 미실천은 보호권으로 흡수`, () => {
    assert.equal(computeStreak(state.goals, state.records, T).current, 27);
    assert.equal(computeStreak(state.goals, [...state.records, todayRecord('done')], T).current, 28);
    const missed = computeStreak(state.goals, [...state.records, todayRecord('missed')], T);
    assert.equal(missed.current, 27);
    assert.equal(missed.protectionLeft, 0);
  });
  await check(`${tag} 스트릭: 같은 달 두 번째 missed는 중단, 목표 없는 요일은 건너뜀`, () => {
    // 월·수·금 목표, 시작 전 14일. 모두 done이면 예정일 수만큼.
    const g = fixtureGoal({ unit: 'rep', target: 10, weekdays: [1, 3, 5], startDate: addDays(T, -14) });
    const days = dateRange(g.startDate, addDays(T, -1)).filter((d) => isScheduled(g, d));
    const all = days.map((d, i) => doneRecord(g.goalId, d, i));
    assert.equal(computeStreak([g], all, T).current, days.length);
    // 가장 최근 예정일을 빼면 보호권 1회로 흡수되어 나머지가 이어진다
    assert.equal(computeStreak([g], all.slice(0, -1), T).current, days.length - 1);
    // 최근 두 번 연속 누락: 첫 번째는 보호권 흡수, 두 번째(같은 달이면)에서 중단 → 0
    const sameMonth = monthOf(days[days.length - 1]) === monthOf(days[days.length - 2]);
    const twoMissed = computeStreak([g], all.slice(0, -2), T).current;
    if (sameMonth) assert.equal(twoMissed, 0);
  });

  // ---- 주간 리포트 ----
  await check(`${tag} 주간 리포트: 직전 주 지표`, () => {
    const { report, plan } = selectWeeklyReport(state);
    const start = addDays(startOfWeek(T), -7);
    assert.equal(report.weekStart, start);
    assert.equal(report.weekEnd, addDays(start, 6));
    assert.ok(report.doneCount > 0 && report.scheduledCount >= report.doneCount);
    assert.ok(report.achievementRate >= 0 && report.achievementRate <= 100);
    assert.ok(plan.every((p) => p.rule !== 'pain_stop'));
  });

  // ---- 증감식 / 경계 (날짜 무관) ----
  await check(`${tag} 증감식과 경계`, () => {
    assert.equal(increaseAmount(20, 'rep'), 24);
    assert.equal(increaseAmount(15, 'min'), 15);
    assert.equal(increaseAmount(14, 'min'), 15);
    assert.equal(increaseAmount(5, 'rep'), 6);
    assert.equal(increaseAmount(1000, 'step'), 1200);
    assert.equal(decreaseAmount(15, 'rep', 0.3), 10);
    assert.equal(decreaseAmount(30, 'rep', 0.2), 24);
    assert.equal(decreaseAmount(5, 'rep', 0.3), 5);
    assert.equal(decreaseAmount(5, 'min', 0.2), 5);
    assert.equal(decreaseAmount(1000, 'step', 0.3), 700);
    assert.equal(decreaseAmount(600, 'step', 0.3), 500);
  });
  await check(`${tag} 시간형 15분 easy_up → atCap, 올려볼까요 문구 없음`, () => {
    const r = rec(fixtureGoal({ unit: 'min', target: 15 }), [{ d: 'easy' }, { d: 'easy' }, { d: 'ok' }]);
    assert.equal(r.rule, 'easy_up');
    assert.equal(r.atCap, true);
    assert.equal(r.proposedAmount, 15);
    assert.ok(!r.message.includes('올려볼까요'));
  });
  await check(`${tag} 5회 missed_down → atMin, 걸음 100보 단위`, () => {
    const r = rec(fixtureGoal({ unit: 'rep', target: 5 }), [{ s: 'missed' }, { s: 'missed' }, { d: 'ok' }]);
    assert.equal(r.rule, 'missed_down');
    assert.equal(r.atMin, true);
    assert.equal(r.proposedAmount, 5);
    const w = rec(fixtureGoal({ unit: 'step', target: 1500 }), [{ d: 'easy' }, { d: 'easy' }, { d: 'ok' }]);
    assert.equal(w.proposedAmount, 1800);
  });
  await check(`${tag} 우선순위: 통증 > 미실천 > 힘들어요`, () => {
    const g = fixtureGoal({ unit: 'rep', target: 20 });
    const pain = rec(g, [{ s: 'missed', memo: '무릎이 아파요' }, { s: 'missed' }, { d: 'ok' }]);
    assert.equal(pain.rule, 'pain_stop');
    assert.equal(pain.stop, true);
    assert.equal(rec(g, [{ s: 'missed' }, { d: 'hard' }, { s: 'missed' }]).rule, 'missed_down');
  });
  await check(`${tag} 신규(n<3): 안전 규칙은 1회로 발동, 나머지는 데이터 부족`, () => {
    const g = fixtureGoal({ unit: 'rep', target: 20 });
    assert.equal(rec(g, [{ d: 'hard' }]).rule, 'hard_down');
    assert.equal(rec(g, [{ s: 'missed' }]).rule, 'missed_down');
    assert.equal(rec(g, [{ memo: '통증' }]).rule, 'pain_stop');
    assert.equal(rec(g, [{ d: 'easy' }, { d: 'easy' }]).rule, 'insufficient_data');
    assert.equal(rec(g, []).rule, 'no_data');
  });
  await check(`${tag} 통증 해제 후에는 pain_stop 아님, missed가 섞이면 easy_up 불성립`, () => {
    const g = fixtureGoal({ unit: 'rep', target: 20, exercise: '푸시업' });
    const r = recommend({
      goal: g, goals: [g], records: fixtureRecords(T, g.goalId, [{ memo: '통증' }, { d: 'ok' }, { d: 'ok' }]),
      today: T, painClearedAt: { 푸시업: `${T}T23:59:00` },
    });
    assert.notEqual(r.rule, 'pain_stop');
    assert.notEqual(rec(g, [{ d: 'easy' }, { s: 'missed' }, { d: 'easy' }]).rule, 'easy_up');
  });
  await check(`${tag} 4주 윈도우 경계: today−28 기록은 윈도우 밖`, () => {
    const g = fixtureGoal({ unit: 'rep', target: 20 });
    const mk = (offset: number, i: number) => doneRecord(g.goalId, addDays(T, offset), i);
    assert.equal(isFourWeekStreak(g.exercise, [g], [mk(-1, 0), mk(-8, 1), mk(-15, 2), mk(-22, 3)], T), true);
    assert.equal(isFourWeekStreak(g.exercise, [g], [mk(-1, 0), mk(-8, 1), mk(-15, 2), mk(-28, 3)], T), false);
  });

  // ---- Mock API: 지연, 실패 트리거, 원자성 ----
  let live: AppState = createInitialState();
  const dispatch = (a: Action) => {
    live = reducer(live, a);
  };
  const api = createApi(() => live, dispatch);
  const todays = live.missions.filter((m) => m.date === T);
  const missionA = todays[0].missionId;
  const missionB = todays[1].missionId;
  const goalA = live.goals.find((g) => g.goalId === todays[0].goalId)!;
  const recordCount = live.records.length;
  await check(`${tag} API: 실패테스트 메모 → SaveFailedError, 상태 변경 없음, ~700ms`, async () => {
    const t = Date.now();
    await assert.rejects(
      api.saveRecord({ missionId: missionA, amount: goalA.target, durationSec: 60, verification: 'auto', difficulty: 'ok', memo: `${FAIL_TRIGGER} 입니다` }),
      SaveFailedError,
    );
    assert.ok(Date.now() - t >= 690, '700ms 지연');
    assert.equal(live.records.length, recordCount);
  });
  await check(`${tag} API: 메모를 고치면 저장 성공`, async () => {
    const r = await api.saveRecord({ missionId: missionA, amount: goalA.target, durationSec: 60, verification: 'auto', difficulty: 'ok', memo: '좋았어요' });
    assert.equal(r.status, 'done');
    assert.equal(live.records.length, recordCount + 1);
  });
  await check(`${tag} API: 알림 스누즈 후 미실천 기록`, async () => {
    api.alarmTrigger(missionB);
    assert.equal(api.alarmSnooze(), true);
    assert.equal(live.missions.find((m) => m.missionId === missionB)?.snoozeCount, 1);
    await api.markMissed(missionB);
    assert.equal(live.records.find((x) => x.missionId === missionB)?.status, 'missed');
    assert.equal(live.alarm, null);
  });
  await check(`${tag} API: confirmNextWeek이 목표량·알림 시각을 갱신`, async () => {
    await api.confirmNextWeek([{ goalId: 'g-lunge', rule: 'missed_down', response: 'accepted', amount: 10, time: '20:00' }]);
    const g = live.goals.find((x) => x.goalId === 'g-lunge');
    assert.equal(g?.target, 10);
    assert.equal(g?.time, '20:00');
    const next = live.missions.find((m) => m.goalId === 'g-lunge' && m.date > T);
    assert.equal(next?.scheduledAt.slice(11, 16), '20:00');
  });
  await check(`${tag} API: 목표 생성 검증 (최소/최대 분량, 요일) 및 기간`, async () => {
    const base = { exercise: '플랭크', bodyPart: 'core', unit: 'min', durationWeeks: 2, time: '07:00' } as const;
    await assert.rejects(api.createGoal({ ...base, target: 20, weekdays: [1] }));
    await assert.rejects(api.createGoal({ ...base, target: 10, weekdays: [] }));
    const g = await api.createGoal({ ...base, target: 10, weekdays: [1, 3] });
    assert.equal(g.startDate, T);
    assert.equal(g.endDate, addDays(T, 13));
  });
}

function monthOf(d: string): string {
  return d.slice(0, 7);
}

async function main() {
  const real = realToday();
  const anchors = [...Array.from({ length: 7 }, (_, i) => addDays('2026-03-02', i)), real];
  console.log(`실제 오늘 = ${real} (${'일월화수목금토'[weekdayOf(real)]}), 검증 기준일 ${anchors.length}개`);
  for (const d of anchors) {
    setToday(d);
    const before = passed;
    await runAll(d);
    console.log(`  ${d}(${'일월화수목금토'[weekdayOf(d)]}): ${passed - before} checks`);
  }
  setToday(null);

  // ---- 날짜 무관 단위 검증 ----
  await check('알림: 스누즈 2회 후 3번째 노출은 스누즈 불가, 30초 후 타임아웃', () => {
    let a = triggerAlarm('m');
    const t0 = 1_000_000;
    a = snoozeAlarm(a, t0);
    assert.equal(a.phase, 'snoozed');
    assert.equal(nextAlarmStep(a, t0 + SNOOZE_REAL_MS - 1).type, 'none');
    let s = nextAlarmStep(a, t0 + SNOOZE_REAL_MS);
    assert.equal(s.type, 'wake');
    if (s.type !== 'wake') return;
    a = s.next;
    assert.equal(a.shown, 2);
    a = snoozeAlarm(a, t0 + SNOOZE_REAL_MS);
    const t1 = t0 + SNOOZE_REAL_MS * 2;
    s = nextAlarmStep(a, t1);
    assert.equal(s.type, 'wake');
    if (s.type !== 'wake') return;
    a = s.next;
    assert.equal(a.shown, 3);
    assert.equal(snoozeAlarm(a, t1), a);
    assert.equal(nextAlarmStep(a, t1 + LAST_RING_TIMEOUT_MS - 1).type, 'none');
    assert.equal(nextAlarmStep(a, t1 + LAST_RING_TIMEOUT_MS).type, 'timeout');
  });
  await check('템플릿 10종 이상, 온보딩 제안은 유효한 분량', () => {
    assert.ok(TEMPLATES.length >= 10);
    const s = suggestFirstGoal({ frequency: 'none', time: 'night', place: 'home' });
    assert.equal(s.goal.exercise, '스트레칭');
    assert.equal(s.goal.time, '22:00');
    assert.equal(suggestFirstGoal({ frequency: 'regular', time: 'evening', place: 'home' }).goal.target, 20);
    assert.equal(suggestFirstGoal({ frequency: 'light', time: 'lunch', place: 'outdoor' }).goal.unit, 'step');
  });

  console.log(`\n${passed} checks passed${failed ? `, ${failed} FAILED` : ''}`);
}

main();
