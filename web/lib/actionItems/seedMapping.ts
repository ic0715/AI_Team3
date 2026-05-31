/**
 * 10 액션 아이템 — 시드 매핑 / AI 개인화 병합 순수 로직.
 *
 * 세 가지 순수 함수:
 * 1. `competencyCodeToSlug(code)` — DB의 competency_code(예: "T-1")를 seeds.ts 슬러그(예: "critical-thinking")로 변환.
 *    매핑에 없는 코드는 그대로 통과(방어적 fallback).
 * 2. `buildSourceSeedId(code, careerLevel, index)` — baseSeeds와 AI 응답을 잇는 매칭 키 생성.
 *    형식: `{competency_code}-{careerLevel}-{1-based index}` (예: "T-1-junior-1").
 *    이 형식이 어긋나면 merge가 조용히 실패하므로 회귀 위험이 큼 → 분리해서 테스트.
 * 3. `mergeAiActions(baseSeeds, aiActions)` — sourceSeedId 기준으로 AI 결과를 시드에 덮어씀.
 *    매칭 안 되는 시드는 원본 유지, AI 결과가 비거나 null이면 baseSeeds 그대로 반환(폴백).
 *
 * 이전엔 app/onboarding/action-items/page.tsx 내부 로직. 단위 테스트 가능하도록 분리.
 */

// DB는 competency_code를 "T-1" 등 스펙 형식으로 저장. 시드 lookup은 슬러그(constants) 기준이라 역매핑 필요.
// 12역량 모두 매핑. seeds.ts에 시드 데이터가 없는 역량은 빈 배열 → AI가 fallback으로 처리.
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

/**
 * baseSeeds ↔ AI 응답 매칭 키. 1-based index 사용(스펙 코드 형식 보존).
 */
export function buildSourceSeedId(
  competencyCode: string,
  careerLevel: string,
  zeroBasedIndex: number,
): string {
  return `${competencyCode}-${careerLevel}-${zeroBasedIndex + 1}`;
}

export interface MergeableSeed {
  sourceSeedId: string;
  title: string;
  description: string;
  tags: string[];
}

export interface AiAction {
  sourceSeedId: string;
  title: string;
  description: string;
  tags: string[];
}

/**
 * AI 개인화 결과를 baseSeeds에 병합.
 * - sourceSeedId가 일치하는 시드만 title/description/tags를 AI 값으로 교체.
 * - 그 외 필드(id 등)는 보존 → 화면 key 안정성 유지.
 * - 매칭 안 되는 시드는 원본 그대로.
 * - aiActions가 null/undefined/빈 배열이면 baseSeeds를 그대로 반환(폴백).
 */
export function mergeAiActions<T extends MergeableSeed>(
  baseSeeds: T[],
  aiActions: AiAction[] | null | undefined,
): T[] {
  if (!aiActions || aiActions.length === 0) return baseSeeds;
  return baseSeeds.map((seed) => {
    const aiItem = aiActions.find((a) => a.sourceSeedId === seed.sourceSeedId);
    if (!aiItem) return seed;
    return {
      ...seed,
      title: aiItem.title,
      description: aiItem.description,
      tags: aiItem.tags,
    };
  });
}
