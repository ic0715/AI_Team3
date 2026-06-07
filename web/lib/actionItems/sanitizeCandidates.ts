/**
 * LLM 생성 후보(candidates)의 1차 위생 필터 (순수 로직).
 *
 * career-actions route(생성+게이트)의 ① 생성 직후 단계.
 * LLM이 뱉은 raw 출력에서 다음만 통과시킨다:
 *  - 배열이어야 함(아니면 빈 배열로 시작),
 *  - falsy 항목 제외(`!!c`),
 *  - title이 string이고 trim 후 비어있지 않을 것,
 *  - strength_link가 사용자 Top5 강점으로 **정규화**될 것
 *    (정확일치/공백/영문명/부분포함 — normalizeStrengthLink. 강점 연계는 제품 핵심 — 여기서 1차 강제),
 *  - 최대 limit(GENERATE_CANDIDATE_COUNT)개로 slice.
 *
 * 정규화로 통과한 후보는 strength_link를 **정식 한글명으로 치환**해 반환한다
 * (후속 게이트·조립 단계의 strengthSet.has()가 그대로 통과하도록). 정확일치였던 후보는
 * 치환이 불필요하므로 원본 객체를 그대로 보존한다(참조 동일).
 */

import { normalizeStrengthLink } from './strengthLink';

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
  const out: GenCandidate[] = [];
  for (const c of Array.isArray(candidatesRaw) ? candidatesRaw : []) {
    if (out.length >= limit) break;
    if (!c || typeof (c as GenCandidate).title !== 'string') continue;
    const title = (c as GenCandidate).title;
    if (title.trim().length === 0) continue;
    const canonical = normalizeStrengthLink((c as GenCandidate).strength_link, strengthSet);
    if (!canonical) continue;
    // 정확일치였으면 원본 보존(참조 동일), 변형이었으면 정식명으로 치환한 새 객체.
    out.push(canonical === (c as GenCandidate).strength_link ? c : { ...c, strength_link: canonical });
  }
  return out;
}
