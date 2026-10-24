// 보너스(쉬는 날 가벼운 운동) 목록·집계 (순수). 운동 관련 3종만 허용(R-07). min 단위 amount는 '분'.
import { addDays, startOfWeek } from './date.ts';
import type { BonusOption, ISODate, PracticeRecord } from './types.ts';

export const BONUS_OPTIONS: BonusOption[] = [
  { bonusKey: 'stretch', label: '전신 스트레칭 1분', unit: 'min', amount: 1 },
  { bonusKey: 'squat', label: '스쿼트 10회', unit: 'rep', amount: 10 },
  { bonusKey: 'march', label: '제자리 걷기 1분', unit: 'min', amount: 1 },
];

/** date가 속한 주(월~일)의 보너스 done 기록 수 */
export function bonusCountInWeek(records: PracticeRecord[], date: ISODate): number {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  return records.filter((r) => r.kind === 'bonus' && r.status === 'done' && r.date >= start && r.date <= end).length;
}
