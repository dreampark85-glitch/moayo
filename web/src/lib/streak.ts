// 스트릭 + 보호권 원장 (순수 함수). 기준: 목표 요일 (스펙 D8, PRD R-04·8.3)
//  - 예정일: 해당 날짜에 예정된 목표가 1개 이상
//  - done일: 예정 목표 중 1개 이상 done(normal·mini·comeback) / missed일: done이 없음(missed 기록 또는 기록 없음)
//  - 예정 없는 날은 건너뜀. 오늘이 예정일이고 done도 missed 기록도 없으면 오늘은 건너뜀
//  - 보호권(날짜 순 시뮬레이션): 매월 1개 자동 지급(월말 소멸), 보너스 3회마다 1개 획득(이월),
//    무료 사용자 획득은 월 1개, 보유 합계 ≤ 2. missed일에는 월 지급분 → 획득분 순으로 자동 사용
//  - 보너스 기록(kind='bonus')은 스트릭·실천 횟수에 포함되지 않는다
import { addDays, monthKey } from './date.ts';
import { isScheduled } from './missions.ts';
import type { Goal, ISODate, PracticeRecord, ShieldLedgerEntry, Streak } from './types.ts';

type DayStatus = 'done' | 'missed' | 'skip';

export const BONUS_PER_SHIELD = 3;
export const SHIELD_STOCK_MAX = 2;
export const FREE_EARN_PER_MONTH = 1;

function dayStatus(goals: Goal[], records: PracticeRecord[], date: ISODate, today: ISODate): DayStatus {
  const scheduled = goals.filter((g) => isScheduled(g, date));
  if (scheduled.length === 0) return 'skip';
  const ids = new Set(scheduled.map((g) => g.goalId));
  const dayRecords = records.filter((r) => r.date === date && r.kind !== 'bonus' && ids.has(r.goalId));
  if (dayRecords.some((r) => r.status === 'done')) return 'done';
  if (date === today && !dayRecords.some((r) => r.status === 'missed')) return 'skip';
  return 'missed';
}

export interface StreakSim {
  streak: Streak;
  ledger: ShieldLedgerEntry[];
  /** 스트릭이 0으로 끊긴 날짜. 이후 done이 생기면 null (복귀 미션 판단용) */
  lastBreak: ISODate | null;
}

export function simulateStreak(goals: Goal[], records: PracticeRecord[], today: ISODate): StreakSim {
  const empty: StreakSim = {
    streak: { current: 0, longest: 0, protectionUsedOn: [], protectionLeft: 1 },
    ledger: [],
    lastBreak: null,
  };
  if (goals.length === 0) return empty;
  const earliest = goals.reduce((min, g) => (g.startDate < min ? g.startDate : min), goals[0].startDate);
  if (earliest > today) return empty;

  // 보너스 3회째가 되는 날짜 → 획득 시도
  const bonuses = records
    .filter((r) => r.kind === 'bonus' && r.status === 'done' && r.date <= today)
    .sort((a, b) => (a.date === b.date ? (a.missionId < b.missionId ? -1 : 1) : a.date < b.date ? -1 : 1));
  const earnsOn = new Map<ISODate, { n: number }[]>();
  bonuses.forEach((r, i) => {
    if ((i + 1) % BONUS_PER_SHIELD !== 0) return;
    const d = r.date < earliest ? earliest : r.date;
    earnsOn.set(d, [...(earnsOn.get(d) ?? []), { n: i + 1 }]);
  });

  const ledger: ShieldLedgerEntry[] = [];
  const protectionUsedOn: ISODate[] = [];
  let monthlyAvail = false;
  let earned = 0;
  let earnedThisMonth = 0;
  let curMonth = '';
  let run = 0;
  let longest = 0;
  let lastBreak: ISODate | null = null;

  for (let d = earliest; d <= today; d = addDays(d, 1)) {
    const mk = monthKey(d);
    if (mk !== curMonth) {
      curMonth = mk;
      monthlyAvail = false; // 월 지급분은 월말 소멸
      earnedThisMonth = 0;
      if (earned < SHIELD_STOCK_MAX) {
        monthlyAvail = true;
        ledger.push({ date: `${mk}-01`, type: 'monthly', reason: '매월 기본 지급' });
      }
    }
    for (const e of earnsOn.get(d) ?? []) {
      const stock = (monthlyAvail ? 1 : 0) + earned;
      if (earnedThisMonth >= FREE_EARN_PER_MONTH || stock >= SHIELD_STOCK_MAX) continue; // 초과분 소멸
      earned += 1;
      earnedThisMonth += 1;
      ledger.push({ date: d, type: 'earned', reason: `보너스 실천 ${e.n}회 달성` });
    }
    const s = dayStatus(goals, records, d, today);
    if (s === 'skip') continue;
    if (s === 'done') {
      run += 1;
      longest = Math.max(longest, run);
      lastBreak = null;
      continue;
    }
    if (monthlyAvail) {
      monthlyAvail = false;
      protectionUsedOn.push(d);
      ledger.push({ date: d, type: 'used', reason: '월 기본 보호권으로 미실천 방어' });
    } else if (earned > 0) {
      earned -= 1;
      protectionUsedOn.push(d);
      ledger.push({ date: d, type: 'used', reason: '획득 보호권으로 미실천 방어' });
    } else {
      if (run > 0) lastBreak = d;
      run = 0;
    }
  }

  return {
    streak: { current: run, longest: Math.max(longest, run), protectionUsedOn, protectionLeft: (monthlyAvail ? 1 : 0) + earned },
    ledger,
    lastBreak,
  };
}

export function computeStreak(goals: Goal[], records: PracticeRecord[], today: ISODate): Streak {
  return simulateStreak(goals, records, today).streak;
}
