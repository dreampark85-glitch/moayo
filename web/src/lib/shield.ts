// 보호권 원장 (기록에서 파생, 저장 안 함). 시뮬레이션은 streak.ts의 simulateStreak.
import { simulateStreak } from './streak.ts';
import type { Goal, ISODate, PracticeRecord, ShieldLedgerEntry } from './types.ts';

export function buildShieldLedger(goals: Goal[], records: PracticeRecord[], today: ISODate): ShieldLedgerEntry[] {
  return simulateStreak(goals, records, today).ledger;
}

/** 원장에서 현재 보유 수 (0~2): 획득분(획득-사용) + 마지막 달 월 지급분이 미사용이면 1 */
export function shieldStock(ledger: ShieldLedgerEntry[]): number {
  const monthly = ledger.filter((e) => e.type === 'monthly');
  const lastMonth = monthly.length ? monthly[monthly.length - 1].date.slice(0, 7) : null;
  const monthlyUsed = ledger.some((e) => e.type === 'used' && e.reason.includes('월 기본') && e.date.slice(0, 7) === lastMonth);
  const earned = ledger.filter((e) => e.type === 'earned').length;
  const usedEarned = ledger.filter((e) => e.type === 'used' && e.reason.includes('획득')).length;
  return Math.max(0, earned - usedEarned) + (lastMonth && !monthlyUsed ? 1 : 0);
}
