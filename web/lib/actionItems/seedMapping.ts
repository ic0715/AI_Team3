/**
 * 역량 코드 ↔ 시드 슬러그 매핑 (순수 로직).
 *
 * `competencyCodeToSlug(code)` — DB의 competency_code(예: "T-1")를 seeds.ts 슬러그(예: "critical-thinking")로 변환.
 *   매핑에 없는 코드는 그대로 통과(방어적 fallback).
 *
 * 액션 도출은 C(생성)+검증 게이트로 전환됨 — 시드 풀은 폴백/보충 용도로만 남는다(`selectSeeds.ts`).
 * (과거 B+의 `applyAiSelection`·`buildSourceSeedId`는 풀 선택 경로 제거로 함께 삭제됨.)
 */

// DB는 competency_code를 "T-1" 등 스펙 형식으로 저장. 시드 lookup은 슬러그(constants) 기준이라 역매핑 필요.
export const CODE_TO_SLUG: Record<string, string> = {
  'T-1': 'critical-thinking',
  'T-2': 'data-analysis',
  'T-3': 'planning',
  'I-1': 'communication',
  'I-2': 'leadership',
  'I-3': 'persuasion',
  'R-1': 'collaboration',
  'R-2': 'mentoring',
  'R-3': 'empathy-comm',
  'E-1': 'execution',
  'E-2': 'problem-solving',
  'E-3': 'self-management',
};

/**
 * competency_code → seeds 슬러그.
 * 매핑에 없거나 falsy면 입력을 그대로 반환(빈 문자열 포함). null/undefined → ''.
 */
export function competencyCodeToSlug(code: string | null | undefined): string {
  if (!code) return '';
  return CODE_TO_SLUG[code] ?? code;
}
