/**
 * 로컬 timezone 기준 오늘 날짜 문자열 (YYYY-MM-DD).
 *
 * 왜 toISOString()을 쓰지 않는가:
 *   toISOString()은 UTC 기준이라, KST(+9) 새벽 0~9시에 호출하면 전날 날짜가 나온다.
 *   (예: KST 6/1 오전 2시 → UTC 5/31 17시 → toISOString() "2025-05-31")
 *   goals.started_at 같은 "오늘" 값이 하루 어긋나면 주차 계산(calculateCurrentWeek)이 틀어진다.
 *   → getFullYear/getMonth/getDate(모두 로컬 timezone 기준)로 직접 조합해 이 버그를 회피.
 *
 * now를 주입 가능(기본값 new Date())하여 단위 테스트에서 결정적으로 검증할 수 있다.
 *
 * 09 career-result, 10 action-items 두 화면이 started_at 저장에 공통 사용 (중복 제거).
 */
export function localISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
