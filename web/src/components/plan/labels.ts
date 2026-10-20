import type { RecommendationResponse, RuleId } from '@/lib/types';

export const RULE_LABEL: Record<RuleId, string> = {
  pain_stop: '통증 중단',
  missed_down: '미실천 감소',
  hard_down: '힘들어요 감소',
  easy_up: '증량',
  ok_hold: '유지',
  four_week_new: '4주 지속 새 운동',
  insufficient_data: '데이터 부족',
  no_data: '기록 없음',
  none: '유지',
};

export const RESPONSE_LABEL: Record<RecommendationResponse, string> = {
  accepted: '수락',
  edited: '수정',
  skipped: '건너뜀',
};
