/**
 * 회고 코치 — "확정" 의사 감지 (13 화면).
 *
 * 정책 (CONFIRM_WORDS 부분 일치):
 * - 재협의 모드에서 사용자가 "확정", "좋아요", "네" 등을 말하면 요약 화면으로 복귀.
 * - 단순 substring 매칭(`String.prototype.includes`)이므로 긴 문장 안에 포함돼도 매칭됨.
 *   (예: "그걸로 확정할게요" → 매칭, "괜찮은 것 같아요" → 매칭)
 * - 영문 'OK'/'ok' 둘 다 등록 (대소문자 구분).
 * - 빈 문자열/공백만/null은 모두 false.
 *
 * 이전엔 app/reflect/coach/page.tsx 내부 함수. 단위 테스트 가능하도록 분리.
 */

export const CONFIRM_WORDS = [
  '확정',
  '좋아요',
  '네',
  '응',
  '맞아',
  'OK',
  'ok',
  '괜찮',
  '이걸로',
] as const;

export function isConfirmation(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t) return false;
  return CONFIRM_WORDS.some((w) => t.includes(w));
}
