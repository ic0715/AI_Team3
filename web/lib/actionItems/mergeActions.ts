/**
 * 생성 액션(API 응답) → 화면 액션 매핑 + 풀 보충 병합 (순수 로직).
 *
 * 10 action-items 페이지의 "생성+게이트 통과분 + 부족분 풀 보충" 결정부.
 * 최근 변경된 표면(2줄 미리보기/병합 흐름)에서 인라인이던 두 순수 결정을 분리한 것:
 *  - `mapApiActions`  : API actions 배열 → DisplayAction[] (id 'gen-{i}', null 정규화, tags 가드).
 *  - `mergeWithPool`  : 생성분 우선 노출 + 부족분 poolFill로 보충, 생성분 ≥ count면 count로 자름.
 *
 * 둘 다 React/네트워크 의존 없는 순수 함수. (poolFill은 호출부가 주입.)
 * 기존 page.tsx 인라인 로직을 byte-for-byte 보존한다.
 */

// API(career-actions route)가 내려주는 액션 1건의 형태.
export interface ApiAction {
  title: string;
  description: string;
  tags: string[];
  strength_link: string | null;
  source_seed_id: string | null;
}

// 화면에 렌더되는 액션. 생성분(source_seed_id=null)과 풀 폴백분(시드 id)을 하나로 통합한다.
export interface DisplayAction {
  id: string;                  // React key + 선택 매칭. 생성분 'gen-{i}', 폴백분은 시드 id
  title: string;
  description: string;
  tags: string[];
  sourceSeedId: string | null; // 생성분 null, 폴백분 시드 id
  strengthLink: string | null; // 이 액션이 발휘하는 강점(생성분). 폴백분 null → 저장 시 Top1로 대체
}

/**
 * API actions 배열 → DisplayAction[].
 * - `actions`가 없으면 빈 배열로 시작(`data.actions ?? []`).
 * - 각 항목에 'gen-{i}' id 부여, tags 비배열은 [] 가드, null 필드는 ?? null로 정규화.
 *
 * 기존 page.tsx: `(data.actions ?? []).map((a, i) => ({ ... }))`.
 */
export function mapApiActions(actions: ApiAction[] | null | undefined): DisplayAction[] {
  return (actions ?? []).map((a, i) => ({
    id: `gen-${i}`,
    title: a.title,
    description: a.description,
    tags: Array.isArray(a.tags) ? a.tags : [],
    sourceSeedId: a.source_seed_id ?? null,
    strengthLink: a.strength_link ?? null,
  }));
}

/**
 * 생성 통과분 우선 노출 + 부족분은 검증된 풀(poolFill)로 보충. 전멸 시 풀 전체.
 * - generated가 count 이상이면 count개로 자름.
 * - 그 외엔 [...generated, ...poolFill(count - generated.length)].
 * - 결과가 비면(둘 다 0) poolFill(count)로 폴백.
 *
 * 기존 page.tsx:
 *   const result = generated.length >= COUNT ? generated.slice(0, COUNT)
 *                                            : [...generated, ...poolFill(COUNT - generated.length)];
 *   setAiActions(result.length > 0 ? result : poolFill(COUNT));
 */
export function mergeWithPool(
  generated: DisplayAction[],
  count: number,
  poolFill: (n: number) => DisplayAction[],
): DisplayAction[] {
  const result =
    generated.length >= count
      ? generated.slice(0, count)
      : [...generated, ...poolFill(count - generated.length)];
  return result.length > 0 ? result : poolFill(count);
}
