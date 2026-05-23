/**
 * 주차 계산 유틸 (schema v0.9 정합)
 *
 * 정책: 주차는 항상 `goals.started_at`을 기준으로 캘린더 날짜로 계산함.
 * `goals.current_week` 컬럼 값을 신뢰하지 않음.
 *
 * 이유:
 * - 스펙상 매주 월요일 자정 자동 전환이 정상이나 MVP에 cron 없음
 * - 이전엔 코칭 완료 시점에 +1 했으나, 사용자가 같은 주에 코칭을 여러 번 하면
 *   주차가 부풀려지는 버그 발생
 * - 날짜 기반 계산은 사용자 인터랙션과 무관하게 항상 정확
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_WEEK = 7;
const DEFAULT_TOTAL_WEEKS = 12;

/**
 * 목표 시작일로부터 오늘이 몇 주차인지 계산.
 *
 * - 시작일 당일 ~ 6일 후까지 = 1주차
 * - 7일 ~ 13일 후 = 2주차
 * - 12주차에서 클램프 (이후로도 12 유지)
 * - started_at이 미래이거나 invalid면 1주차로 폴백
 */
export function calculateCurrentWeek(
  startedAt: string | null | undefined,
  totalWeeks: number = DEFAULT_TOTAL_WEEKS,
): number {
  if (!startedAt) return 1;

  const start = new Date(startedAt);
  if (isNaN(start.getTime())) return 1;
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysFromStart = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY);
  if (daysFromStart < 0) return 1;

  const week = Math.floor(daysFromStart / DAYS_PER_WEEK) + 1;
  return Math.min(Math.max(week, 1), totalWeeks);
}
