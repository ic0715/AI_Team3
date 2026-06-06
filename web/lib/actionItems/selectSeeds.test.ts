import { describe, expect, it } from 'vitest';
import type { ActionItem, SeedEffort, SeedLevel } from '@/lib/constants/seeds';
import {
  careerLevelToSeedLevel,
  selectDisplaySeeds,
  type Rng,
} from './selectSeeds';

// 결정적 테스트용 시드 PRNG (mulberry32). 같은 시드 → 같은 수열.
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seed(id: string, level: SeedLevel, effort: SeedEffort): ActionItem {
  return { id, title: id, description: id, tags: [], level, effort };
}

// 10개 풀: junior 4 / senior 4 / any 2, effort 골고루
const POOL: ActionItem[] = [
  seed('j-q1', 'junior', 'quick'),
  seed('j-d1', 'junior', 'deep'),
  seed('j-h1', 'junior', 'habit'),
  seed('j-q2', 'junior', 'quick'),
  seed('s-q1', 'senior', 'quick'),
  seed('s-d1', 'senior', 'deep'),
  seed('s-h1', 'senior', 'habit'),
  seed('s-d2', 'senior', 'deep'),
  seed('a-q1', 'any', 'quick'),
  seed('a-h1', 'any', 'habit'),
];

describe('careerLevelToSeedLevel', () => {
  it('senior / senior_mid → senior', () => {
    expect(careerLevelToSeedLevel('senior')).toBe('senior');
    expect(careerLevelToSeedLevel('senior_mid')).toBe('senior');
  });

  it('junior / junior_new / 미상 → junior', () => {
    expect(careerLevelToSeedLevel('junior')).toBe('junior');
    expect(careerLevelToSeedLevel('junior_new')).toBe('junior');
    expect(careerLevelToSeedLevel(null)).toBe('junior');
    expect(careerLevelToSeedLevel(undefined)).toBe('junior');
    expect(careerLevelToSeedLevel('이상한값')).toBe('junior');
  });
});

describe('selectDisplaySeeds — 개수/기본', () => {
  it('풀 > count 면 정확히 count개 반환', () => {
    const out = selectDisplaySeeds(POOL, 'junior', mulberry32(1), 5);
    expect(out).toHaveLength(5);
  });

  it('풀 <= count 면 전부 반환(중복·누락 없음)', () => {
    const small = POOL.slice(0, 3);
    const out = selectDisplaySeeds(small, 'junior', mulberry32(1), 5);
    expect(out).toHaveLength(3);
    expect(new Set(out.map((s) => s.id))).toEqual(new Set(small.map((s) => s.id)));
  });

  it('반환 항목은 모두 풀의 원소이며 중복 없음', () => {
    const out = selectDisplaySeeds(POOL, 'senior', mulberry32(42), 5);
    const ids = out.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of out) expect(POOL).toContain(s);
  });
});

describe('selectDisplaySeeds — 결정성(같은 rng → 같은 결과)', () => {
  it('동일 시드는 동일 결과', () => {
    const a = selectDisplaySeeds(POOL, 'junior', mulberry32(7), 5).map((s) => s.id);
    const b = selectDisplaySeeds(POOL, 'junior', mulberry32(7), 5).map((s) => s.id);
    expect(a).toEqual(b);
  });

  it('다른 시드는 (대개) 다른 결과 — 풀 다양성 확인', () => {
    const a = selectDisplaySeeds(POOL, 'junior', mulberry32(1), 5).map((s) => s.id).join(',');
    const b = selectDisplaySeeds(POOL, 'junior', mulberry32(999), 5).map((s) => s.id).join(',');
    expect(a).not.toEqual(b);
  });
});

describe('selectDisplaySeeds — 포맷 다양성', () => {
  it('버킷이 충분하면 결과에 effort가 2종 이상 섞인다', () => {
    // 여러 시드로 반복해도 한 가지 effort로만 5개가 차지 않아야 한다.
    for (let s = 0; s < 20; s++) {
      const out = selectDisplaySeeds(POOL, 'junior', mulberry32(s), 5);
      const efforts = new Set(out.map((x) => x.effort));
      expect(efforts.size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('selectDisplaySeeds — career_level 가중', () => {
  it('junior 선택 시 junior/any가 senior보다 더 자주 노출된다(통계적)', () => {
    let matched = 0;
    let other = 0;
    const trials = 200;
    for (let s = 0; s < trials; s++) {
      const out = selectDisplaySeeds(POOL, 'junior', mulberry32(s + 1), 5);
      for (const item of out) {
        if (item.level === 'junior' || item.level === 'any') matched++;
        else other++;
      }
    }
    // 가중치 2:1 → 매칭 레벨이 분명히 더 많아야 한다.
    expect(matched).toBeGreaterThan(other);
  });
});

describe('selectDisplaySeeds — 경계/방어 (10 폴백 경로 하드닝)', () => {
  it('빈 풀 → 빈 배열', () => {
    expect(selectDisplaySeeds([], 'junior', mulberry32(1), 5)).toEqual([]);
  });

  it('count=0 이고 풀이 비어있지 않으면 → 빈 배열', () => {
    // pool.length(10) > count(0) 이므로 diversify 경로 → 0개
    expect(selectDisplaySeeds(POOL, 'junior', mulberry32(1), 0)).toEqual([]);
  });

  it('count=1 → 정확히 1개', () => {
    const out = selectDisplaySeeds(POOL, 'junior', mulberry32(3), 1);
    expect(out).toHaveLength(1);
    expect(POOL).toContain(out[0]);
  });

  it('count > 풀 크기 → 풀 전체 반환(누락·중복 없음)', () => {
    const out = selectDisplaySeeds(POOL, 'junior', mulberry32(5), 99);
    expect(out).toHaveLength(POOL.length);
    expect(new Set(out.map((s) => s.id))).toEqual(new Set(POOL.map((s) => s.id)));
  });

  it('풀 크기 === count (boundary) → 전부 반환', () => {
    const out = selectDisplaySeeds(POOL, 'senior', mulberry32(8), POOL.length);
    expect(out).toHaveLength(POOL.length);
    expect(new Set(out.map((s) => s.id)).size).toBe(POOL.length);
  });

  it('rng가 항상 0을 반환해도(log(0) 폭주 방지 가드) 정상 동작 — count개·중복 없음', () => {
    const zeroRng: Rng = () => 0;
    const out = selectDisplaySeeds(POOL, 'junior', zeroRng, 5);
    expect(out).toHaveLength(5);
    expect(new Set(out.map((s) => s.id)).size).toBe(5);
    for (const s of out) expect(POOL).toContain(s);
  });

  it('rng가 항상 1을 반환해도 정상 동작', () => {
    const oneRng: Rng = () => 1;
    const out = selectDisplaySeeds(POOL, 'senior', oneRng, 5);
    expect(out).toHaveLength(5);
    expect(new Set(out.map((s) => s.id)).size).toBe(5);
  });

  it('미지의 effort 버킷도 안전 수용(드롭하지 않음)', () => {
    // effort를 알 수 없는 값으로 둔 풀 — diversify가 동적으로 버킷을 추가해야 한다.
    const weird: ActionItem[] = [
      seed('w1', 'junior', 'quick'),
      seed('w2', 'junior', 'deep'),
      { ...seed('w3', 'junior', 'quick'), effort: 'unknown' as unknown as SeedEffort },
      { ...seed('w4', 'junior', 'quick'), effort: 'mystery' as unknown as SeedEffort },
      seed('w5', 'junior', 'habit'),
    ];
    const out = selectDisplaySeeds(weird, 'junior', mulberry32(2), 4);
    expect(out).toHaveLength(4);
    // 미지 effort 항목이 결과에 들어올 수 있어야(전체 풀이 4개 이상이고 count=4)
    expect(new Set(out.map((s) => s.id)).size).toBe(4);
  });

  it('count보다 적은 풀(미지 effort 포함) → 풀 전체 반환', () => {
    const tiny: ActionItem[] = [
      { ...seed('t1', 'junior', 'quick'), effort: 'zzz' as unknown as SeedEffort },
      seed('t2', 'senior', 'deep'),
    ];
    const out = selectDisplaySeeds(tiny, 'junior', mulberry32(1), 5);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((s) => s.id))).toEqual(new Set(['t1', 't2']));
  });
});
