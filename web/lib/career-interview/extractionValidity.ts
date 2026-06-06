import type { CareerInterviewKeyInsights } from '@/lib/types/database';

// CONTRACT_v2 §7: 세션 무효 — 신규 4키 중 핵심 3개가 모두 빈 문자열이면 결과 화면 진입 차단.
//   분석 결과가 비면(실질 내용 없음) 결과 페이지 대신 '결과 불가' 안내 → 홈.

/**
 * finalize 추출 결과가 '결과 화면을 띄울 만큼 유의미한가'를 판정.
 * 핵심 3키(presenting_issue / agreed_focus / user_takeaway)가 모두 비면 무효.
 * @returns true = 무효(결과 불가 안내), false = 유효(결과 페이지 진입)
 */
export function isExtractionInvalid(
  extraction: Partial<CareerInterviewKeyInsights>,
): boolean {
  return (
    !extraction.presenting_issue &&
    !extraction.agreed_focus &&
    !extraction.user_takeaway
  );
}
