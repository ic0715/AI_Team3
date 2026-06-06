/**
 * 문자열 길이 클램프 (순수 로직).
 *
 * career-actions route(생성+게이트)에서 생성 액션의 title(60)·description(120)을
 * 저장/표시 한계에 맞춰 자르는 데 쓰인다. 비-문자열 입력은 빈 문자열로 안전 처리.
 *
 * 동작 계약(기존 route.ts의 인라인 `clamp`와 byte-for-byte 동일):
 * - 입력이 string이 아니면 '' 로 시작(typeof 가드).
 * - 길이가 max 이하면 입력을 그대로 반환(자르지 않음 → 끝 공백도 보존).
 * - 길이가 max 초과면 max까지 slice 후 `trimEnd()`로 끝 공백 제거.
 *
 * 길이는 JS `String.length`(UTF-16 code unit) 기준 — 한글 음절 1, 이모지(surrogate pair) 2.
 * slice도 code unit 기준이므로 경계에서 surrogate pair가 쪼개질 수 있으나,
 * 기존 page/route 동작을 그대로 보존하기 위해 의도적으로 그대로 둔다.
 */
export const clamp = (s: unknown, max: number): string => {
  const str = typeof s === 'string' ? s : '';
  return str.length > max ? str.slice(0, max).trimEnd() : str;
};
