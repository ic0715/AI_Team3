/**
 * 회고 코치 — 주차 마무리 시점 계산 (13 화면 finalize 단계).
 *
 * 두 가지 순수 함수:
 * 1. `computeBadgeAndComment(doneCount)` — 11 홈 타임라인 done 카드의 이모지 배지 + 코멘트
 * 2. `nextCoachingWeek(current, totalWeeks)` — 다음 주차 산정 (12주 클램프)
 *
 * 둘 다 finalizeCoaching 안에서 호출되며, DB INSERT/UPSERT의 입력으로 들어감.
 * 정책 변경 시 회귀 위험이 큰 영역이라 분리.
 *
 * 스펙: docs/functional_spec/_post_mvp_v2/11_home.md §6 (badge/comment 4구간)
 */

export interface BadgeAndComment {
  badge: string;
  comment: string;
}

/**
 * 주간 완료 횟수 기반 배지/코멘트 산출.
 *
 * 4구간 정책 (boundary 값에 주의):
 * - 7+: 🔥 완벽한 한 주!
 * - 5,6: 👍 꾸준함이 쌓이고 있어요
 * - 3,4: 😊 절반을 해냈어요
 * - 0,1,2 (음수 포함): 🌱 다음 주를 기대해요
 */
export function computeBadgeAndComment(doneCount: number): BadgeAndComment {
  if (doneCount >= 7) return { badge: '🔥', comment: '완벽한 한 주!' };
  if (doneCount >= 5) return { badge: '👍', comment: '꾸준함이 쌓이고 있어요' };
  if (doneCount >= 3) return { badge: '😊', comment: '절반을 해냈어요' };
  return { badge: '🌱', comment: '다음 주를 기대해요' };
}

/**
 * 다음 코칭 주차 산정 — 사이클 마지막(12주)에선 12로 클램프.
 *
 * @param current 현재 주차 (calculateCurrentWeek 결과 = 1~12)
 * @param totalWeeks 총 주차 (기본 12)
 * @returns Math.min(current + 1, totalWeeks)
 */
export function nextCoachingWeek(current: number, totalWeeks = 12): number {
  return Math.min(current + 1, totalWeeks);
}
