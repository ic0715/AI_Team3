/**
 * 날짜 토글 안전 가드 (11 홈 action_completions 체크/해제용).
 *
 * 정책:
 * - 오늘과 과거 날짜는 토글 허용
 * - 미래 날짜는 차단 (사용자가 아직 안 한 일을 미리 체크하는 걸 방지)
 * - 시·분·초는 무시하고 캘린더 날짜로만 비교 (timezone normalize)
 *
 * 이전엔 home/page.tsx의 handleToggleDay 안에 인라인으로 있던 로직.
 * 단위 테스트 가능하도록 분리.
 */

/** 시·분·초를 0으로 정규화한 Date 사본 (원본 mutate 없음) */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 토글이 허용되는 날짜인지 판정.
 * @param target 토글하려는 날짜 (Date)
 * @param now 현재 시각 (테스트 주입용, 기본 new Date())
 * @returns true = 허용 (오늘 또는 과거), false = 차단 (미래)
 */
export function canToggleDate(target: Date, now: Date = new Date()): boolean {
  if (!(target instanceof Date) || Number.isNaN(target.getTime())) return false;
  if (Number.isNaN(now.getTime())) return false;

  const targetDay = startOfDay(target).getTime();
  const todayDay = startOfDay(now).getTime();
  return targetDay <= todayDay;
}
