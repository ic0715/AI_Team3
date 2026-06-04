/**
 * 액션 시드 풀에서 화면에 보여줄 N개를 고르는 순수 로직.
 *
 * 설계 원칙 (왜 이렇게 하나):
 * - **1회 셔플 고정**: 호출부(page)가 마운트 시 한 번만 호출해 state에 박아둔다.
 *   리렌더/네트워크 재시도로 다시 굴러서 사용자가 고른 카드가 사라지는 버그를 막기 위함.
 *   rng를 주입받으므로 테스트에선 시드 고정 → 결정적, 런타임에선 Math.random → 매 방문 새 5개.
 * - **career_level 가중**: 연계 강점은 map.md에서 "역량 단위"라 액션 단위 강점 가중이 불가능.
 *   대신 사용 가능한 개인화 신호인 career_level로 레벨 매칭 시드에 가중치를 둔다(2배).
 *   강점 반영은 이후 AI 문구 재작성 단계가 담당한다.
 * - **포맷 다양성**: effort 버킷(quick/deep/habit)을 라운드로빈으로 뽑아
 *   "5개 전부 1~2시간 깊은 작업" 같은 쏠림을 방지한다.
 */

import type { ActionItem, SeedEffort } from '@/lib/constants/seeds';

export type Rng = () => number;

// 다양성 라운드로빈에서 버킷을 도는 순서. (빠른 것 → 깊은 것 → 매일 습관)
const EFFORT_ORDER: SeedEffort[] = ['quick', 'deep', 'habit'];

/** profiles.career_level(enum) → 시드 레벨(junior/senior). 미상은 junior로 안전 처리. */
export function careerLevelToSeedLevel(
  careerLevel: string | null | undefined,
): 'junior' | 'senior' {
  return careerLevel === 'senior' || careerLevel === 'senior_mid' ? 'senior' : 'junior';
}

/**
 * 가중 셔플 (Efraimidis–Spirakis 가중 무작위 정렬).
 * 각 항목 key = rng^(1/weight) 를 내림차순 정렬 → weight 큰 항목이 앞쪽에 올 확률↑.
 * level이 사용자 레벨과 맞거나 'any'면 weight 2, 아니면 1.
 */
function weightedShuffle<T extends ActionItem>(
  items: T[],
  preferred: 'junior' | 'senior',
  rng: Rng,
): T[] {
  return items
    .map((s) => {
      const matched = s.level === preferred || s.level === 'any';
      const weight = matched ? 2 : 1;
      const r = rng();
      // r이 0이면 log(0) 폭주 → 최소값으로 보정. (0,1] 범위 보장)
      const u = r <= 0 ? Number.MIN_VALUE : r;
      return { s, key: Math.pow(u, 1 / weight) };
    })
    .sort((a, b) => b.key - a.key)
    .map((x) => x.s);
}

/**
 * effort 버킷을 라운드로빈으로 비워가며 count개 추출.
 * 이미 가중 셔플된 순서를 유지하므로 각 버킷 내에서도 weight 높은 게 먼저 뽑힌다.
 */
function diversifyByEffort<T extends ActionItem>(ordered: T[], count: number): T[] {
  const buckets = new Map<SeedEffort, T[]>();
  for (const eff of EFFORT_ORDER) buckets.set(eff, []);
  for (const s of ordered) {
    if (!buckets.has(s.effort)) buckets.set(s.effort, []); // 미지의 effort도 안전 수용
    buckets.get(s.effort)!.push(s);
  }

  const result: T[] = [];
  let progressed = true;
  while (result.length < count && progressed) {
    progressed = false;
    for (const arr of buckets.values()) {
      if (result.length >= count) break;
      if (arr.length > 0) {
        result.push(arr.shift()!);
        progressed = true;
      }
    }
  }
  return result;
}

/**
 * 풀에서 보여줄 count개를 고른다.
 * - 풀이 count 이하면 전부 반환(가중 셔플로 순서만 다양화).
 * - 그 외엔 가중 셔플 → effort 다양성 라운드로빈으로 count개 선별.
 */
export function selectDisplaySeeds<T extends ActionItem>(
  pool: T[],
  careerLevel: string | null | undefined,
  rng: Rng = Math.random,
  count = 5,
): T[] {
  const preferred = careerLevelToSeedLevel(careerLevel);
  const ordered = weightedShuffle(pool, preferred, rng);
  if (pool.length <= count) return ordered;
  return diversifyByEffort(ordered, count);
}
