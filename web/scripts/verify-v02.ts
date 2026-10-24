// v0.2 도메인 검증 (verify-domain.ts에서 호출). 순수 모듈의 규칙을 고정 날짜(2026-10-23 금)에서 확인한다.
import assert from 'node:assert/strict';
import { BONUS_OPTIONS, bonusCountInWeek } from '../src/lib/bonus.ts';
import { comebackAmount, comebackTarget } from '../src/lib/comeback.ts';
import { addDays, dateRange, setToday, weekdayOf } from '../src/lib/date.ts';
import { createDemoState } from '../src/lib/demoSeed.ts';
import { buildIcs, escapeText, foldLine } from '../src/lib/ics.ts';
import { withJosa } from '../src/lib/josa.ts';
import { computeMetrics } from '../src/lib/metrics.ts';
import { miniAmount } from '../src/lib/mini.ts';
import { isScheduled, missionIdOf } from '../src/lib/missions.ts';
import { canNotify } from '../src/lib/notify.ts';
import { recommend } from '../src/lib/recommendation.ts';
import { reminderMessage } from '../src/lib/reminderMessage.ts';
import { weeklyReport } from '../src/lib/report.ts';
import {
  selectBonusOptions, selectComeback, selectDayBonus, selectHeatmap, selectNextMissionPreview, selectNotificationStatus,
  selectRestDay,
} from '../src/lib/selectors.ts';
import { buildShieldLedger, shieldStock } from '../src/lib/shield.ts';
import { computeStreak } from '../src/lib/streak.ts';
import { BONUS_GOAL_ID, DEFAULT_NOTIFICATION_SETTINGS, bonusMissionId } from '../src/lib/types.ts';
import type { AppEvent, AppState, Goal, PracticeRecord, RecordKind } from '../src/lib/types.ts';

type Check = (name: string, fn: () => void | Promise<void>) => Promise<void>;
interface Fixtures {
  fixtureGoal: (p: Partial<Goal> & Pick<Goal, 'unit' | 'target'>) => Goal;
  fixtureRecords: (T: string, goalId: string, items: { d?: 'easy' | 'ok' | 'hard'; s?: 'done' | 'missed'; memo?: string }[]) => PracticeRecord[];
}

interface RecOpts {
  kind?: RecordKind;
  s?: 'done' | 'missed';
  d?: 'easy' | 'ok' | 'hard';
  memo?: string;
  at?: string; // 보너스 종류
}

function vrec(goalId: string, date: string, p: RecOpts = {}): PracticeRecord {
  const status = p.s ?? 'done';
  const kind = p.kind ?? 'normal';
  const missionId = kind === 'bonus' ? bonusMissionId(date, p.at ?? 'stretch') : missionIdOf(goalId, date);
  return {
    recordId: `r-${missionId}`, kind, missionId, goalId: kind === 'bonus' ? BONUS_GOAL_ID : goalId, date, status, amount: 1,
    durationSec: 1, verification: 'manual', difficulty: status === 'done' && kind !== 'bonus' ? (p.d ?? 'ok') : null,
    memo: p.memo ?? '', completedAt: `${date}T21:00:00`,
  };
}

const TT: Goal = {
  goalId: 'tt', userId: 'u', exercise: '런지', bodyPart: 'lower', unit: 'rep', target: 20, weekdays: [2, 4],
  time: '21:00', startDate: '2026-09-15', endDate: '2026-12-31', status: 'active',
};

export async function runV02(check: Check, fx: Fixtures): Promise<void> {
  const { fixtureGoal, fixtureRecords } = fx;
  const T = '2026-10-23';
  setToday(T);
  const allDone = dateRange('2026-09-15', '2026-10-22').filter((d) => isScheduled(TT, d)).map((d) => vrec('tt', d));
  const ev = (type: AppEvent['type'], payload: AppEvent['payload'] = {}): AppEvent => ({ type, date: T, payload });
  const demo = createDemoState();
  const demoId = (d: string) => missionIdOf('g-demo-lunge', d);
  const demoRec = (d: string, p: RecOpts = {}): PracticeRecord => vrec('g-demo-lunge', d, p);
  const demoWith = (extra: PracticeRecord[]): AppState => ({ ...demo, records: [...demo.records, ...extra] });

  // ---- 조사 ----
  await check('josa: 은/는 (받침 유무)', () => {
    assert.equal(withJosa('런지', '은/는'), '런지는');
    assert.equal(withJosa('스쿼트', '은/는'), '스쿼트는');
    assert.equal(withJosa('플랭크', '은/는'), '플랭크는');
    assert.equal(withJosa('걷기', '은/는'), '걷기는');
    assert.equal(withJosa('푸시업', '은/는'), '푸시업은');
  });
  await check('josa: 이/가, 을/를, 과/와', () => {
    assert.equal(withJosa('런지', '이/가'), '런지가');
    assert.equal(withJosa('푸시업', '이/가'), '푸시업이');
    assert.equal(withJosa('런지', '을/를'), '런지를');
    assert.equal(withJosa('플랭크', '을/를'), '플랭크를');
    assert.equal(withJosa('런지', '과/와'), '런지와');
    assert.equal(withJosa('푸시업', '과/와'), '푸시업과');
  });
  await check('josa: 으로/로 (ㄹ받침은 로) + 단위', () => {
    assert.equal(withJosa('20회', '으로/로'), '20회로');
    assert.equal(withJosa('5분', '으로/로'), '5분으로');
    assert.equal(withJosa('500보', '으로/로'), '500보로');
    assert.equal(withJosa('서울', '으로/로'), '서울로');
    assert.equal(withJosa('집', '으로/로'), '집으로');
    assert.equal(withJosa('8월', '으로/로'), '8월로');
  });
  await check('josa: 숫자 끝자리와 빈 문자열', () => {
    assert.equal(withJosa('10', '이/가'), '10이');
    assert.equal(withJosa('2', '이/가'), '2가');
    assert.equal(withJosa('3', '을/를'), '3을');
    assert.equal(withJosa('1', '으로/로'), '1로');
    assert.equal(withJosa('', '은/는'), '는');
  });

  // ---- 미니/복귀 분량 ----
  await check('mini: 시간형 1분, 횟수형 25%(최소 5), 걸음형 25%(최소 500, 100보 단위)', () => {
    assert.equal(miniAmount(fixtureGoal({ unit: 'min', target: 10 })), 1);
    assert.equal(miniAmount(fixtureGoal({ unit: 'rep', target: 20 })), 5);
    assert.equal(miniAmount(fixtureGoal({ unit: 'rep', target: 40 })), 10);
    assert.equal(miniAmount(fixtureGoal({ unit: 'rep', target: 6 })), 5);
    assert.equal(miniAmount(fixtureGoal({ unit: 'step', target: 4000 })), 1000);
    assert.equal(miniAmount(fixtureGoal({ unit: 'step', target: 1000 })), 500);
  });
  await check('mini: 목표 분량보다 커지지 않음', () => {
    assert.equal(miniAmount(fixtureGoal({ unit: 'rep', target: 5 })), 5);
    assert.equal(miniAmount(fixtureGoal({ unit: 'step', target: 500 })), 500);
  });
  await check('comeback: 50%(최소 5회/1분/500보), 증가 없음', () => {
    assert.equal(comebackAmount(TT), 10);
    assert.equal(comebackAmount(fixtureGoal({ unit: 'rep', target: 8 })), 5);
    assert.equal(comebackAmount(fixtureGoal({ unit: 'min', target: 10 })), 1);
    assert.equal(comebackAmount(fixtureGoal({ unit: 'step', target: 3000 })), 1500);
    assert.equal(comebackAmount(fixtureGoal({ unit: 'step', target: 600 })), 500);
    for (const g of [TT, fixtureGoal({ unit: 'rep', target: 5 }), fixtureGoal({ unit: 'step', target: 500 })]) {
      assert.ok(comebackAmount(g) <= g.target);
    }
  });

  // ---- 리마인드 문구 ----
  const nm = { missionId: 'x', goalId: 'tt', date: '2026-10-27', scheduledAt: '2026-10-27T21:00:00', type: 'count' as const, snoozeCount: 0 as const };
  await check('reminder: 기록 없음', () => {
    assert.equal(reminderMessage(TT, [], nm), '오늘 21시, 첫 런지 미션이 있어요.');
  });
  await check('reminder: 쉬워요 (20회로)', () => {
    assert.equal(reminderMessage(TT, [vrec('tt', '2026-10-22', { d: 'easy' })], nm), '지난번엔 쉬웠어요. 오늘 21시, 런지 20회로 가볍게!');
  });
  await check('reminder: 적당해요 (런지는)', () => {
    assert.equal(reminderMessage(TT, [vrec('tt', '2026-10-22', { d: 'ok' })], nm), '지난주 런지는 ‘적당해요’였어요. 오늘 21시, 같은 분량이에요.');
  });
  await check('reminder: 힘들어요 (−20% 조정 분량 16회로)', () => {
    assert.equal(reminderMessage(TT, [vrec('tt', '2026-10-22', { d: 'hard' })], nm), '지난번엔 힘들었죠. 오늘은 16회로 맞춰 뒀어요.');
  });
  await check('reminder: 단위별 조사 5분으로 / 1000보로, 푸시업은', () => {
    const tm = fixtureGoal({ goalId: 'tm', exercise: '플랭크', unit: 'min', target: 6 });
    assert.ok(reminderMessage(tm, [vrec('tm', '2026-10-22', { d: 'easy' })], nm).includes('6분으로'));
    assert.ok(reminderMessage(tm, [vrec('tm', '2026-10-22', { d: 'hard' })], nm).includes('5분으로'));
    const st = fixtureGoal({ goalId: 'ts', exercise: '걷기', unit: 'step', target: 1000 });
    assert.ok(reminderMessage(st, [vrec('ts', '2026-10-22', { d: 'easy' })], nm).includes('1000보로'));
    const pu = fixtureGoal({ goalId: 'tp', exercise: '푸시업', unit: 'rep', target: 10 });
    assert.ok(reminderMessage(pu, [vrec('tp', '2026-10-22', { d: 'ok' })], nm).includes('푸시업은'));
  });
  await check('reminder: 직전 기록 = 가장 최근 done (미실천·보너스 무시), 30분 단위 시각', () => {
    const recs = [vrec('tt', '2026-10-15', { d: 'hard' }), vrec('tt', '2026-10-20', { s: 'missed' }), vrec('tt', '2026-10-21', { kind: 'bonus' })];
    assert.ok(reminderMessage(TT, recs, nm).startsWith('지난번엔 힘들었죠'));
    assert.ok(reminderMessage(TT, [], { ...nm, scheduledAt: '2026-10-27T21:30:00' }).includes('21시 30분'));
  });

  // ---- 알림 상한 ----
  const S = DEFAULT_NOTIFICATION_SETTINGS;
  const bonusOn = { ...S, bonusNotification: true };
  await check('notify: 빈 상태는 허용 (보너스는 설정이 꺼져 있으면 차단)', () => {
    assert.equal(canNotify([], T, 'mission', S).ok, true);
    assert.equal(canNotify([], T, 'reminder', S).ok, true);
    assert.equal(canNotify([], T, 'bonus', S).ok, false);
    assert.equal(canNotify([], T, 'bonus', bonusOn).ok, true);
  });
  await check('notify: 리마인드 1 + 미션 1 = 2회, 세 번째는 차단 (사유 포함)', () => {
    const events = [ev('reminder_sent'), ev('alarm_fired')];
    for (const k of ['mission', 'reminder', 'bonus'] as const) {
      const d = canNotify(events, T, k, bonusOn);
      assert.equal(d.ok, false);
      assert.ok(d.reason && d.reason.length > 0);
    }
  });
  await check('notify: 미션 알림은 하루 1회, 리마인드도 1회', () => {
    assert.equal(canNotify([ev('alarm_fired')], T, 'mission', S).ok, false);
    assert.equal(canNotify([ev('alarm_fired')], T, 'reminder', S).ok, true);
    assert.equal(canNotify([ev('reminder_sent')], T, 'reminder', S).ok, false);
    assert.equal(canNotify([ev('reminder_sent')], T, 'mission', S).ok, true);
  });
  await check('notify: 차단 이벤트·다른 날 이벤트는 집계하지 않음', () => {
    assert.equal(canNotify([ev('alarm_blocked'), ev('reminder_blocked')], T, 'mission', S).ok, true);
    assert.equal(canNotify([{ ...ev('alarm_fired'), date: '2026-10-22' }], T, 'mission', S).ok, true);
  });
  await check('notify: 보너스 알림도 합산 상한 2에 포함', () => {
    assert.equal(canNotify([ev('reminder_sent', { kind: 'bonus' }), ev('alarm_fired')], T, 'reminder', bonusOn).ok, false);
    assert.equal(canNotify([ev('reminder_sent', { kind: 'bonus' })], T, 'bonus', bonusOn).ok, false);
    assert.equal(canNotify([ev('reminder_sent', { kind: 'bonus' })], T, 'mission', bonusOn).ok, true);
  });

  // ---- 보너스 ----
  await check('bonus: 3종만, 운동 항목, 단위 규약(min=분)', () => {
    assert.deepEqual(BONUS_OPTIONS.map((o) => o.label), ['전신 스트레칭 1분', '스쿼트 10회', '제자리 걷기 1분']);
    assert.deepEqual(BONUS_OPTIONS.map((o) => [o.unit, o.amount]), [['min', 1], ['rep', 10], ['min', 1]]);
    assert.equal(new Set(BONUS_OPTIONS.map((o) => o.bonusKey)).size, 3);
  });
  await check('bonus: 주간 집계는 월~일, 보너스만', () => {
    const recs = [vrec('tt', '2026-10-19', { kind: 'bonus' }), vrec('tt', '2026-10-25', { kind: 'bonus', at: 'squat' }), vrec('tt', '2026-10-26', { kind: 'bonus' }), vrec('tt', '2026-10-20')];
    assert.equal(bonusCountInWeek(recs, '2026-10-23'), 2);
    assert.equal(bonusCountInWeek(recs, '2026-10-26'), 1);
  });
  await check('bonusMissionId 형식', () => {
    assert.equal(bonusMissionId('2026-10-23', 'squat'), 'bonus-2026-10-23-squat');
  });

  // ---- 스트릭 + 보호권 원장 ----
  const streakOf = (recs: PracticeRecord[]) => computeStreak([TT], recs, T);
  const withMissed = (dates: string[]) => allDone.map((r) => (dates.includes(r.date) ? vrec('tt', r.date, { s: 'missed' }) : r));
  await check('streak: 모두 done이면 보호권 월 1개 보유, 원장은 월 지급만', () => {
    const s0 = streakOf(allDone);
    assert.equal(s0.current, allDone.length);
    assert.equal(s0.protectionLeft, 1);
    const ledger = buildShieldLedger([TT], allDone, T);
    assert.deepEqual(ledger.map((e) => e.type), ['monthly', 'monthly']);
    assert.deepEqual(ledger.map((e) => e.date), ['2026-09-01', '2026-10-01']);
  });
  await check('streak: 같은 달 첫 미실천은 월 보호권이 방어', () => {
    const a = streakOf(withMissed(['2026-10-15']));
    assert.equal(a.current, allDone.length - 1);
    assert.deepEqual(a.protectionUsedOn, ['2026-10-15']);
    assert.equal(a.protectionLeft, 0);
  });
  await check('streak: 같은 달 두 번째 미실천은 끊김 (이후 done 1회 → 1)', () => {
    assert.equal(streakOf(withMissed(['2026-10-15', '2026-10-20'])).current, 1);
  });
  await check('streak: 데모 시드 → 스트릭 1, 보호권 0, 보호권 사용일 10/15', () => {
    const s1 = computeStreak(demo.goals, demo.records, T);
    assert.equal(s1.current, 1);
    assert.equal(s1.protectionLeft, 0);
    assert.deepEqual(s1.protectionUsedOn, ['2026-10-15']);
    assert.ok(s1.longest >= 1);
  });
  await check('streak: 보너스는 스트릭을 바꾸지 않음', () => {
    const withBonus = [...allDone, vrec('tt', '2026-10-21', { kind: 'bonus' }), vrec('tt', '2026-10-23', { kind: 'bonus', at: 'squat' })];
    assert.equal(streakOf(withBonus).current, streakOf(allDone).current);
  });
  await check('streak: 미니·복귀 기록도 스트릭을 유지', () => {
    const mixed = allDone.map((r, i) => (i % 3 === 0 ? { ...r, kind: 'mini' as const } : i % 3 === 1 ? { ...r, kind: 'comeback' as const } : r));
    assert.equal(streakOf(mixed).current, allDone.length);
  });
  const bon = (dates: string[]) => dates.map((d, i) => vrec('tt', d, { kind: 'bonus', at: ['stretch', 'squat', 'march'][i % 3] }));
  await check('shield: 보너스 3회 → 획득 1개(원장 earned), 보유 2, 스트릭 불변', () => {
    const recs = [...allDone, ...bon(['2026-10-14', '2026-10-16', '2026-10-21'])];
    const ledger = buildShieldLedger([TT], recs, T);
    assert.equal(ledger.filter((e) => e.type === 'earned').length, 1);
    assert.equal(ledger.find((e) => e.type === 'earned')?.date, '2026-10-21');
    assert.equal(streakOf(recs).protectionLeft, 2);
    assert.equal(streakOf(recs).current, streakOf(allDone).current);
    assert.equal(shieldStock(ledger), 2);
  });
  await check('shield: 보너스 2회는 획득 없음', () => {
    assert.equal(buildShieldLedger([TT], [...allDone, ...bon(['2026-10-14', '2026-10-16'])], T).filter((e) => e.type === 'earned').length, 0);
  });
  await check('shield: 같은 달 보너스 6회 → 무료 월 1개 제한(초과분 소멸)', () => {
    const recs = [...allDone, ...bon(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-07', '2026-10-09'])];
    assert.equal(buildShieldLedger([TT], recs, T).filter((e) => e.type === 'earned').length, 1);
  });
  await check('shield: 보유 합계는 2를 넘지 않음', () => {
    const recs = [...allDone, ...bon(['2026-09-16', '2026-09-17', '2026-09-18']), ...bon(['2026-10-01', '2026-10-02', '2026-10-03'])];
    assert.equal(buildShieldLedger([TT], recs, T).filter((e) => e.type === 'earned').length, 1); // 10월 획득은 보유 2(월+이월)라 소멸
    assert.ok(streakOf(recs).protectionLeft <= 2);
    const many = bon(dateRange('2026-09-01', '2026-09-30'));
    assert.ok(streakOf([...allDone, ...many]).protectionLeft <= 2);
  });
  await check('shield: 월 지급분 → 획득분 순으로 사용', () => {
    const recs = [...withMissed(['2026-10-15', '2026-10-20']), ...bon(['2026-09-16', '2026-09-17', '2026-09-18'])];
    const used = buildShieldLedger([TT], recs, T).filter((e) => e.type === 'used');
    assert.equal(used.length, 2);
    assert.ok(used[0].reason.includes('월 기본') && used[1].reason.includes('획득'));
    assert.equal(streakOf(recs).protectionLeft, 0);
    assert.equal(streakOf(recs).current, allDone.length - 2);
  });
  await check('shield: 보호권이 없으면 3번째 미실천은 끊김', () => {
    assert.equal(streakOf(withMissed(['2026-10-13', '2026-10-15', '2026-10-20'])).current, 1);
  });
  await check('shield: 목표 없음/미래 시작은 빈 원장', () => {
    assert.deepEqual(buildShieldLedger([], [], T), []);
    assert.deepEqual(buildShieldLedger([{ ...TT, startDate: '2026-12-01' }], [], T), []);
    assert.equal(computeStreak([], [], T).protectionLeft, 1);
  });

  // ---- 복귀 ----
  await check('comeback: 데모(10/22 복귀 완료) 직후엔 대상 없음', () => {
    assert.equal(comebackTarget(demo), null);
  });
  await check('comeback: 10/27 미실천 → 스트릭 0, 다음 목표일(10/29) 미션이 복귀 대상 (런지 10회)', () => {
    setToday('2026-10-28');
    const st = demoWith([demoRec('2026-10-27', { s: 'missed' })]);
    assert.equal(computeStreak(st.goals, st.records, '2026-10-28').current, 0);
    const c = comebackTarget(st);
    assert.equal(c?.missionId, demoId('2026-10-29'));
    assert.equal(c?.amount, 10);
    assert.equal(c?.message, '다시 시작이 제일 어려워요. 오늘은 10회만.');
    assert.equal(selectComeback(st)?.amount, 10);
    setToday(T);
  });
  await check('comeback: 완료하면 스트릭 1부터 재시작, 대상 해제', () => {
    setToday('2026-10-30');
    const st = demoWith([demoRec('2026-10-27', { s: 'missed' }), demoRec('2026-10-29', { kind: 'comeback' })]);
    assert.equal(computeStreak(st.goals, st.records, '2026-10-30').current, 1);
    assert.equal(comebackTarget(st), null);
    setToday(T);
  });
  await check('comeback: 복귀 미션을 놓치면 1회성이라 다시 제안하지 않음', () => {
    setToday('2026-10-30');
    assert.equal(comebackTarget(demoWith([demoRec('2026-10-27', { s: 'missed' }), demoRec('2026-10-29', { s: 'missed' })])), null);
    setToday(T);
  });
  await check('comeback: 통증 메모가 있으면 대상에서 제외, 해제하면 복귀', () => {
    setToday('2026-10-28');
    const pain = { ...demoRec('2026-10-13', { memo: '무릎 통증' }), recordId: 'r-pain', missionId: 'm-pain', completedAt: '2026-10-26T21:00:00' };
    const st = demoWith([demoRec('2026-10-27', { s: 'missed' }), pain]);
    assert.equal(comebackTarget(st), null);
    assert.equal(comebackTarget({ ...st, painClearedAt: { 런지: '2026-10-27T23:59:00' } })?.amount, 10);
    setToday(T);
  });

  // ---- 추천: kind 필터 ----
  await check('recommend: 미니·복귀 기록은 증감 판단 창에서 제외 (D4)', () => {
    const g = fixtureGoal({ unit: 'rep', target: 20 });
    const base = fixtureRecords(T, 'fx', [{ d: 'ok' }, { d: 'ok' }, { d: 'ok' }]);
    const polluted = [
      ...base.map((r, i) => (i < 2 ? { ...r, kind: 'mini' as const, difficulty: 'hard' as const } : r)),
      vrec('fx', addDays(T, -1), { kind: 'comeback', d: 'hard' }),
    ];
    const r = recommend({ goal: g, goals: [g], records: polluted, today: T, painClearedAt: {} });
    assert.notEqual(r.rule, 'hard_down');
    assert.equal(r.rule, 'insufficient_data'); // 일반 기록 1건
  });
  await check('recommend: 일반 기록 없이 미니만 있으면 no_data가 아니라 insufficient_data', () => {
    const g = fixtureGoal({ unit: 'rep', target: 20 });
    const r = recommend({ goal: g, goals: [g], records: [vrec('fx', addDays(T, -1), { kind: 'mini' })], today: T, painClearedAt: {} });
    assert.equal(r.rule, 'insufficient_data');
    assert.equal(r.proposedAmount, 20);
  });
  await check('recommend: 복귀 기록의 통증 메모도 추천을 중단, 증가폭 +20% 불변', () => {
    const g = fixtureGoal({ unit: 'rep', target: 20 });
    const normals = fixtureRecords(T, 'fx', [{ d: 'easy' }, { d: 'easy' }, { d: 'easy' }]);
    const pain = vrec('fx', addDays(T, -1), { kind: 'comeback', memo: '허리가 아파요' });
    const r = recommend({ goal: g, goals: [g], records: [...normals, pain], today: T, painClearedAt: {} });
    assert.equal(r.rule, 'pain_stop');
    assert.equal(r.stop, true);
    const ok = recommend({ goal: g, goals: [g], records: normals, today: T, painClearedAt: {} });
    assert.equal(ok.rule, 'easy_up');
    assert.ok(ok.proposedAmount <= Math.floor(g.target * 1.2));
  });

  // ---- 리포트 / 히트맵 / 일 상세 ----
  await check('report: 보너스는 실천 횟수·달성률 제외, bonusCount 별도, 미니 포함', () => {
    const recs = [
      vrec('tt', '2026-10-13'), { ...vrec('tt', '2026-10-15'), kind: 'mini' as const },
      vrec('tt', '2026-10-14', { kind: 'bonus' }), vrec('tt', '2026-10-16', { kind: 'bonus', at: 'squat' }), vrec('tt', '2026-10-18', { kind: 'bonus', at: 'march' }),
    ];
    const r = weeklyReport([TT], recs, '2026-10-12');
    assert.equal(r.doneCount, 2);
    assert.equal(r.miniCount, 1);
    assert.equal(r.comebackCount, 0);
    assert.equal(r.bonusCount, 3);
    assert.equal(r.scheduledCount, 2);
    assert.equal(r.achievementRate, 100);
    assert.equal(r.totalMinutes, 0);
  });
  await check('report: 복귀 횟수와 이전 주 비교', () => {
    const recs = [{ ...vrec('tt', '2026-10-13'), kind: 'comeback' as const }, vrec('tt', '2026-10-15'), vrec('tt', '2026-10-06')];
    const r = weeklyReport([TT], recs, '2026-10-12');
    assert.equal(r.comebackCount, 1);
    assert.equal(r.doneCount, 2);
    assert.equal(r.prevDoneCount, 1);
    assert.equal(r.deltaDone, 1);
  });
  await check('heatmap: 보너스는 level/doneCount에서 제외, bonusCount 별도, 일 상세 보너스 행', () => {
    const st = demoWith([vrec('x', '2026-10-21', { kind: 'bonus' }), vrec('x', '2026-10-21', { kind: 'bonus', at: 'squat' })]);
    const cells = selectHeatmap(st, '2026-10').cells;
    const cell = cells.find((c) => c.date === '2026-10-21')!;
    assert.equal(cell.bonusCount, 2);
    assert.equal(cell.doneCount, 0);
    assert.equal(cell.level, 0);
    const reg = cells.find((c) => c.date === '2026-10-13')!;
    assert.equal(reg.doneCount, 1);
    assert.equal(reg.bonusCount, 0);
    assert.equal(selectDayBonus(st, '2026-10-21').length, 2);
    assert.equal(selectDayBonus(st, '2026-10-13').length, 0);
  });

  // ---- 쉬는 날 / 다음 미션 예고 / 알림 상태 ----
  await check('selectors: 데모(금요일)는 쉬는 날이고 보너스 3종, 화요일은 아님, 목표 없으면 아님', () => {
    assert.equal(selectRestDay(demo), true);
    assert.equal(selectBonusOptions(demo).length, 3);
    setToday('2026-10-27');
    assert.equal(selectRestDay(demo), false);
    assert.deepEqual(selectBonusOptions(demo), []);
    setToday(T);
    assert.equal(selectRestDay({ ...demo, goals: [] }), false);
  });
  await check('selectors: 다음 미션 예고 10/27 21:00 런지, 시간 옵션 20:00/21:00/22:00', () => {
    const p = selectNextMissionPreview(demo)!;
    assert.equal(p.mission.date, '2026-10-27');
    assert.equal(p.time, '21:00');
    assert.equal(p.amount, 20);
    assert.deepEqual(p.timeOptions.map((o) => [o.label, o.time]), [['-1시간', '20:00'], ['그대로', '21:00'], ['+1시간', '22:00']]);
  });
  await check('selectors: 시간 옵션은 자정을 넘겨도 안전(00:30 → 23:30/00:30/01:30)', () => {
    const g = { ...demo.goals[0], time: '00:30' };
    const missions = demo.missions.map((m) => ({ ...m, scheduledAt: `${m.date}T00:30:00` }));
    const p = selectNextMissionPreview({ ...demo, goals: [g], missions })!;
    assert.deepEqual(p.timeOptions.map((o) => o.time), ['23:30', '00:30', '01:30']);
  });
  await check('selectors: 복귀 대상 미션의 예고 분량은 복귀 분량', () => {
    setToday('2026-10-28');
    const p = selectNextMissionPreview(demoWith([demoRec('2026-10-27', { s: 'missed' })]))!;
    assert.equal(p.mission.date, '2026-10-29');
    assert.equal(p.amount, 10);
    setToday(T);
  });
  await check('selectors: 알림 상태 집계(횟수·상한·사유 중복 제거)', () => {
    const none = selectNotificationStatus(demo);
    assert.deepEqual([none.todayCount, none.cap, none.capReached, none.reasons], [0, 2, false, []]);
    const st: AppState = {
      ...demo,
      events: [ev('reminder_sent'), ev('alarm_fired'), ev('alarm_blocked', { reason: 'r1' }), ev('reminder_blocked', { reason: 'r1' }), ev('reminder_blocked', { reason: 'r2' })],
    };
    const s2 = selectNotificationStatus(st);
    assert.equal(s2.todayCount, 2);
    assert.equal(s2.capReached, true);
    assert.deepEqual(s2.reasons, ['r1', 'r2']);
  });

  // ---- 지표 ----
  await check('metrics: 이번 주 실천 분해, 리마인드 완료율, 알림 끄기', () => {
    const recs = [vrec('tt', '2026-10-20'), { ...vrec('tt', '2026-10-22'), kind: 'mini' as const }, vrec('tt', '2026-10-21', { kind: 'bonus' }), vrec('tt', '2026-10-23', { kind: 'bonus', at: 'squat' })];
    const events: AppEvent[] = [
      ev('reminder_sent', { missionId: missionIdOf('tt', '2026-10-20') }), ev('reminder_sent', { missionId: 'm-none' }), ev('notification_off'), ev('notification_off'),
    ];
    const m = computeMetrics({ ...demo, goals: [TT], missions: [], records: recs, events });
    assert.deepEqual(m.weeklyDone, { normal: 1, mini: 1, comeback: 0, total: 2, bonus: 2 });
    assert.equal(m.reminderSent, 2);
    assert.equal(m.reminderDoneRate, 50);
    assert.equal(m.notificationOff, 2);
  });
  await check('metrics: 데모 시드의 보호권 사용 1회, 획득 0, 리마인드 없음', () => {
    const m = computeMetrics(demo);
    assert.equal(m.shieldUsed, 1);
    assert.equal(m.shieldEarned, 0);
    assert.equal(m.reminderDoneRate, 0);
  });
  await check('metrics: 공백 후 첫 미션 완료율 (D8)', () => {
    const goal = { ...TT, startDate: '2026-10-05', weekdays: [1, 4] as Goal['weekdays'] };
    const ms = ['2026-10-05', '2026-10-08', '2026-10-12', '2026-10-15'].map((d) => ({
      missionId: missionIdOf('tt', d), goalId: 'tt', date: d, scheduledAt: `${d}T21:00:00`, type: 'count' as const, snoozeCount: 0 as const,
    }));
    // 10/5: 이전 done 없음(제외), 10/8·10/12·10/15: 직전 2일 내 done 없음 → 공백 후 첫 미션. 10/12만 missed → 2/3
    const recs = [vrec('tt', '2026-10-05'), vrec('tt', '2026-10-08'), vrec('tt', '2026-10-12', { s: 'missed' }), vrec('tt', '2026-10-15')];
    assert.equal(computeMetrics({ ...demo, goals: [goal], missions: ms, records: recs }).firstAfterGapRate, 67);
  });

  // ---- .ics ----
  const NOW = '2026-10-23T12:00:00';
  const ics = buildIcs([TT, { ...TT, goalId: 'paused', status: 'paused' }], NOW);
  const lines = ics.split('\r\n');
  await check('ics: 구조 (CRLF, VCALENDAR 헤더, VTIMEZONE Asia/Seoul)', () => {
    assert.ok(ics.endsWith('\r\n'));
    assert.ok(!/[^\r]\n/.test(ics), 'CRLF만 사용');
    assert.equal(lines[0], 'BEGIN:VCALENDAR');
    for (const l of ['VERSION:2.0', 'CALSCALE:GREGORIAN', 'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'TZNAME:KST', 'END:VTIMEZONE', 'END:VCALENDAR']) {
      assert.ok(lines.includes(l), l);
    }
    assert.ok(lines.some((l) => l.startsWith('PRODID:')));
  });
  await check('ics: 진행 중 목표마다 VEVENT 1개 (일시정지 제외)', () => {
    assert.equal(lines.filter((l) => l === 'BEGIN:VEVENT').length, 1);
    assert.equal(lines.filter((l) => l === 'END:VEVENT').length, 1);
    assert.ok(lines.includes('UID:tt@moayo.app'));
  });
  await check('ics: DTSTART는 시작일 이후 첫 목표 요일 21:00 Asia/Seoul', () => {
    assert.ok(lines.includes('DTSTART;TZID=Asia/Seoul:20260915T210000'));
    assert.ok(buildIcs([{ ...TT, startDate: '2026-09-16' }], NOW).split('\r\n').includes('DTSTART;TZID=Asia/Seoul:20260917T210000'));
  });
  await check('ics: RRULE BYDAY=TU,TH, UNTIL=종료일 21:00 KST의 UTC(12:00Z)', () => {
    assert.ok(lines.includes('RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T120000Z'));
    assert.ok(buildIcs([{ ...TT, weekdays: [0, 1, 5] }], NOW).includes('BYDAY=MO,FR,SU'));
  });
  await check('ics: 새벽 시각은 UNTIL이 전날 UTC로 변환 (00:30 KST → 15:30Z 전날)', () => {
    assert.ok(buildIcs([{ ...TT, time: '00:30' }], NOW).includes('UNTIL=20261230T153000Z'));
  });
  await check('ics: DTSTAMP는 now의 UTC 변환, SUMMARY에 운동·분량', () => {
    assert.ok(lines.includes('DTSTAMP:20261023T030000Z'));
    assert.ok(lines.includes('SUMMARY:MOAYO 런지 20회'));
  });
  await check('ics: 텍스트 이스케이프 (; , \\ 줄바꿈)', () => {
    assert.equal(escapeText('a;b,c\\d\ne'), 'a\\;b\\,c\\\\d\\ne');
    assert.ok(buildIcs([{ ...TT, exercise: '런지;스쿼트,플랭크' }], NOW).includes('SUMMARY:MOAYO 런지\\;스쿼트\\,플랭크 20회'));
  });
  await check('ics: 줄 접기 75옥텟, 멀티바이트 안 쪼갬, 접힌 줄은 공백으로 시작', () => {
    const name = '아주아주긴운동이름'.repeat(8);
    const long = buildIcs([{ ...TT, exercise: name }], NOW);
    const enc = new TextEncoder();
    for (const l of long.split('\r\n')) assert.ok(enc.encode(l).length <= 75, `줄 길이 ${enc.encode(l).length}`);
    assert.ok(long.split('\r\n').some((l) => l.startsWith(' ')));
    assert.ok(long.replace(/\r\n /g, '').includes(name));
    assert.deepEqual(foldLine('short'), ['short']);
  });
  await check('ics: 종료일이 첫 요일보다 이르면 이벤트 생략, 목표 0개면 캘린더만', () => {
    assert.equal(buildIcs([{ ...TT, startDate: '2026-09-15', endDate: '2026-09-14' }], NOW).includes('BEGIN:VEVENT'), false);
    assert.equal(buildIcs([], NOW).includes('BEGIN:VEVENT'), false);
  });

  // ---- 데모 시드 ----
  await check('demo: 목표 1개(런지 화·목 21:00 20회), 오늘 금요일', () => {
    const g = demo.goals[0];
    assert.equal(demo.goals.length, 1);
    assert.deepEqual([g.exercise, g.weekdays, g.time, g.target], ['런지', [2, 4], '21:00', 20]);
    assert.equal(demo.demoDate, T);
    assert.equal(weekdayOf(T), 5);
  });
  await check('demo: 10월 기록 (10/13 done, 10/15·10/20 missed, 10/22 comeback done), 9월은 모두 done', () => {
    const by = (d: string) => demo.records.find((r) => r.date === d)!;
    assert.equal(by('2026-10-13').status, 'done');
    assert.equal(by('2026-10-15').status, 'missed');
    assert.equal(by('2026-10-20').status, 'missed');
    assert.equal(by('2026-10-22').kind, 'comeback');
    assert.equal(by('2026-10-22').status, 'done');
    assert.ok(demo.records.filter((r) => r.date < '2026-10-01').every((r) => r.status === 'done'));
  });

  setToday(null);
}
