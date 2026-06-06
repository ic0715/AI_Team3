/**
 * LLM 생성 후보(candidates)의 1차 위생 필터 (순수 로직).
 *
 * career-actions route(생성+게이트)의 ① 생성 직후 단계.
 * LLM이 뱉은 raw 출력에서 다음만 통과시킨다:
 *  - 배열이어야 함(아니면 빈 배열로 시작),
 *  - falsy 항목 제외(`!!c`),
 *  - title이 string이고 trim 후 비어있지 않을 것,
 *  - strength_link가 string이고 사용자 Top5 강점 집합(strengthSet) 안에 있을 것
 *    (강점 연계는 제품 핵심 — 여기서 1차 강제),
 *  - 최대 limit(GENERATE_CANDIDATE_COUNT)개로 slice.
 *
 * 기존 route.ts의 인라인 filter+slice를 byte-for-byte 보존해 분리한 것.
 * (게이트 호출 전 단계이므로 여기 통과가 곧 노출은 아니다 — 게이트가 최종 판정.)
 */

// 생성 후보(LLM 출력)
export interface GenCandidate {
  title: string;
  description: string;
  tags: string[];
  strength_link: string;
  competency_fit?: string;
}

/**
 * raw 후보 배열을 위생 필터링한다.
 * @param candidatesRaw LLM 파싱 결과(배열 아닐 수 있음 → 방어).
 * @param strengthSet   사용자 Top5 강점(name_ko) 집합.
 * @param limit         최대 후보 수(GENERATE_CANDIDATE_COUNT).
 */
export function sanitizeCandidates(
  candidatesRaw: GenCandidate[] | null | undefined | unknown,
  strengthSet: Set<string>,
  limit: number,
): GenCandidate[] {
  return (Array.isArray(candidatesRaw) ? candidatesRaw : [])
    .filter(
      (c): c is GenCandidate =>
        !!c &&
        typeof c.title === 'string' &&
        c.title.trim().length > 0 &&
        typeof c.strength_link === 'string' &&
        strengthSet.has(c.strength_link),
    )
    .slice(0, limit);
}
