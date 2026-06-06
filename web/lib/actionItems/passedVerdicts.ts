/**
 * 검증 게이트 판정(verdicts) → 통과한 후보 index 집합 (순수 로직).
 *
 * career-actions route(생성+게이트)의 ② 게이트 응답 파싱 단계.
 * LLM 게이트가 후보별로 낸 판정 배열에서 **명시적으로 통과(pass===true)** 이고
 * index가 정수인 것만 골라 Set으로 모은다. (fail-closed: 애매하면 통과 안 시킴.)
 *
 * 안전 원칙:
 *  - `v && v.pass === true` — truthy가 아니라 정확히 boolean true만 통과(누락/문자열 'true' 등 거부).
 *  - `Number.isInteger(v.index)` — 소수/NaN/문자열 index 거부.
 *  - 반환은 Set이므로 중복 index는 자연히 1개로 합쳐진다.
 *  - 통과 index가 후보 범위를 벗어나도(out-of-range) 조립 루프가 candidates 길이로 막으므로 안전.
 *
 * 기존 route.ts의 인라인 `new Set(verdicts.filter(...).map(...))`를 byte-for-byte 보존해 분리한 것.
 */

// 게이트 판정(LLM 출력)
export interface Verdict {
  index: number;
  pass: boolean;
  fail?: string[];
}

/**
 * verdict 배열에서 통과(pass===true && 정수 index)한 index들의 Set을 만든다.
 */
export function passedIndexSet(verdicts: Verdict[]): Set<number> {
  return new Set(
    verdicts.filter((v) => v && v.pass === true && Number.isInteger(v.index)).map((v) => v.index),
  );
}
