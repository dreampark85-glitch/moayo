// 스트릭 계산 (순수 함수). 기준: 목표 요일 (스펙 D8, 계획 §4.1)
//  - 예정일: 해당 날짜에 예정된 목표가 1개 이상
//  - done일: 예정 목표 중 1개 이상 done / missed일: done이 없음(missed 기록 또는 기록 없음)
//  - 예정 없는 날은 건너뜀. 오늘이 예정일이고 done도 missed 기록도 없으면 오늘은 건너뜀
//  - 보호권: 달력 월당 1회, 해당 월의 첫 missed일을 흡수(+0, 중단 없음)
import { addDays, monthKey } from './date.ts';
import { isScheduled } from './missions.ts';
import type { Goal, ISODate, PracticeRecord, Streak } from './types.ts';

type DayStatus = 'done' | 'missed' | 'skip';

function dayStatus(goals: Goal[], records: PracticeRecord[], date: ISODate, today: ISODate): DayStatus {
  const scheduled = goals.filter((g) => isScheduled(g, date));
  if (scheduled.length === 0) return 'skip';
  const ids = new Set(scheduled.map((g) => g.goalId));
  const dayRecords = records.filter((r) => r.date === date && ids.has(r.goalId));
  if (dayRecords.some((r) => r.status === 'done')) return 'done';
  if (date === today && !dayRecords.some((r) => r.status === 'missed')) return 'skip';
  return 'missed';
}

export function computeStreak(goals: Goal[], records: PracticeRecord[], today: ISODate): Streak {
  if (goals.length === 0) return { current: 0, longest: 0, protectionUsedOn: [], protectionLeft: 1 };
  const earliest = goals.reduce((min, g) => (g.startDate < min ? g.startDate : min), goals[0].startDate);
  const dates: ISODate[] = [];
  for (let d = earliest; d <= today; d = addDays(d, 1)) dates.push(d);
  const statuses = dates.map((d) => dayStatus(goals, records, d, today));

  // current: 오늘부터 과거로
  let current = 0;
  const usedMonths = new Set<string>();
  const protectionUsedOn: ISODate[] = [];
  for (let i = dates.length - 1; i >= 0; i--) {
    const s = statuses[i];
    if (s === 'skip') continue;
    if (s === 'done') {
      current += 1;
      continue;
    }
    const m = monthKey(dates[i]);
    if (!usedMonths.has(m)) {
      usedMonths.add(m);
      protectionUsedOn.push(dates[i]);
      continue;
    }
    break;
  }

  // longest: 과거에서 오늘로 (같은 보호권 규칙)
  let longest = 0;
  let run = 0;
  const fwdUsed = new Set<string>();
  for (let i = 0; i < dates.length; i++) {
    const s = statuses[i];
    if (s === 'skip') continue;
    if (s === 'done') {
      run += 1;
      longest = Math.max(longest, run);
      continue;
    }
    const m = monthKey(dates[i]);
    if (!fwdUsed.has(m)) {
      fwdUsed.add(m);
      continue;
    }
    run = 0;
  }
  longest = Math.max(longest, current);

  const protectionLeft = usedMonths.has(monthKey(today)) ? 0 : 1;
  return { current, longest, protectionUsedOn, protectionLeft };
}
