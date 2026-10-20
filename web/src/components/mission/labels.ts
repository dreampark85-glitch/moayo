import type { Difficulty, Unit, Verification } from '@/lib/types';

export function amountLabel(unit: Unit, amount: number): string {
  if (unit === 'rep') return `${amount}회`;
  if (unit === 'min') return `${amount}분`;
  return `${amount.toLocaleString('ko-KR')}보`;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '쉬워요',
  ok: '적당해요',
  hard: '힘들어요',
};

export const VERIFICATION_LABEL: Record<Verification, string> = {
  auto: '자동',
  manual: '수동 카운트',
  simulated: '시뮬레이션',
};

export function verificationOf(unit: Unit): Verification {
  return unit === 'rep' ? 'manual' : unit === 'step' ? 'simulated' : 'auto';
}
