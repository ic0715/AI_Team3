/**
 * 문자열 앞쪽 이모지 제거 — 태그 표시용 (09 career-result 등).
 *
 * 배경(버그 수정):
 *   기존 page.tsx는 유니코드 Emoji 속성 기반 정규식으로 앞 이모지를 떼어냈다.
 *   그러나 Emoji 속성은 그림 이모지뿐 아니라 ASCII 숫자 0-9, 샵(#), 별표까지
 *   포함한다(키캡 이모지 구성요소 때문). 그 결과 "3개월 챌린지"처럼 숫자로
 *   시작하는 태그의 앞자리가 "개월 챌린지"로 잘리는 버그가 있었다.
 *
 *   해결: Extended_Pictographic (실제 그림 이모지만, 숫자/샵/별표 제외)로 교체한다.
 *
 * 정책:
 *   - 맨 앞의 그림 이모지 1개 + 뒤따르는 variation selector(U+FE0F) + 뒤따르는 공백을 제거.
 *   - ZWJ(U+200D)로 이어진 합성 이모지(예: 가족 이모지)도 한 덩어리로 제거.
 *   - 이모지로 시작하지 않으면(숫자/한글/영문 등) 원본 그대로 반환.
 *   - null/undefined 는 빈 문자열로 반환.
 */

// 맨 앞 그림 이모지(필요 시 variation selector / ZWJ 합성 포함) + 뒤 공백.
// FE0F = variation selector-16, 200D = zero-width joiner.
const LEADING_EMOJI =
  /^\p{Extended_Pictographic}(?:\u{FE0F}|\u{200D}\p{Extended_Pictographic})*\s*/u;

export function stripLeadingEmoji(tag: string | null | undefined): string {
  if (!tag) return '';
  return tag.replace(LEADING_EMOJI, '');
}
