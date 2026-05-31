/**
 * 미래 주차 액션 맵 빌드 (11 홈 타임라인용).
 *
 * 정책:
 * - DB row 입력 순서가 `week_number ASC + created_at DESC`로 들어온다고 가정.
 * - 같은 `week_number`가 여러 번 나오면 **첫 발견(=최신 created_at)** 만 유지.
 * - 정렬 의존이라 호출 측에서 ORDER BY를 깨면 잘못된 액션이 노출됨.
 *   호출 측 단순 가정에 묶이지 않도록 본 함수는 입력 순서를 신뢰.
 *
 * v1: app/home/page.tsx line ~240의 인라인 로직을 그대로 추출.
 */

export interface FutureActionRow {
  week_number: number;
  title: string;
}

export function buildFutureActionsByWeek(
  rows: FutureActionRow[] | null | undefined,
): Map<number, string> {
  const map = new Map<number, string>();
  if (!rows) return map;

  for (const row of rows) {
    if (!map.has(row.week_number)) {
      map.set(row.week_number, row.title);
    }
  }
  return map;
}
