import type { SessionDurationChoice } from '@/lib/types/database';

// finalize 라우트(app/api/career-interview/finalize/route.ts)의 비정형 LLM 출력
// 파싱/검증 순수 로직. 라우트에서 verbatim 추출 — 동작 보존.

export const VALID_COMPETENCY_CODES = [
  'T-1', 'T-2', 'T-3',
  'I-1', 'I-2', 'I-3',
  'R-1', 'R-2', 'R-3',
  'E-1', 'E-2', 'E-3',
] as const;

export const VALID_DURATION: readonly SessionDurationChoice[] = ['short', 'medium', 'long'] as const;

/**
 * LLM raw 응답을 JSON 파트 / SUMMARY 파트로 분리.
 * '---SUMMARY---' 구분자가 정확히 1번 등장하지 않으면 throw.
 */
export function splitFinalizeResponse(raw: string): { jsonPart: string; summaryPart: string } {
  const parts = raw.split(/\n---SUMMARY---\n/);
  if (parts.length !== 2) {
    throw new Error('LLM 응답에 ---SUMMARY--- 구분자가 정확히 1번 등장하지 않음');
  }
  return { jsonPart: parts[0], summaryPart: parts[1] };
}

/**
 * session_duration_choice 검증 (enum 위반·누락 시 'medium' 강제).
 */
export function coerceSessionDuration(value: unknown): SessionDurationChoice {
  return (VALID_DURATION as readonly string[]).includes(value as string)
    ? (value as SessionDurationChoice)
    : 'medium';
}

/**
 * growth_competencies 정제:
 *   - 배열이 아니면 빈 배열
 *   - enum 위반/비문자열 제거
 *   - 중복 제거 (첫 등장 우선순위 유지)
 *   - 최대 5개
 */
export function cleanGrowthCompetencies(value: unknown): string[] {
  const rawCompetencies = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return rawCompetencies
    .filter((c: unknown): c is string =>
      typeof c === 'string' && (VALID_COMPETENCY_CODES as readonly string[]).includes(c),
    )
    .filter((c) => (seen.has(c) ? false : (seen.add(c), true)))
    .slice(0, 5);
}
