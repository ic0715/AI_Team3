import { describe, expect, it } from 'vitest';
import {
  mapApiActions,
  mergeWithPool,
  type ApiAction,
  type DisplayAction,
} from './mergeActions';

const apiAction = (over: Partial<ApiAction> = {}): ApiAction => ({
  title: 'T',
  description: 'D',
  tags: ['t1'],
  strength_link: '분석',
  source_seed_id: null,
  ...over,
});

// 풀 보충 모킹 — 'pool-0', 'pool-1' ... id로 n개 생성.
const fakeFill = (n: number): DisplayAction[] =>
  Array.from({ length: Math.max(0, n) }, (_, i) => ({
    id: `pool-${i}`,
    title: `pool title ${i}`,
    description: `pool desc ${i}`,
    tags: [],
    sourceSeedId: `seed-${i}`,
    strengthLink: null,
  }));

describe('mapApiActions', () => {
  it('null/undefined → 빈 배열', () => {
    expect(mapApiActions(null)).toEqual([]);
    expect(mapApiActions(undefined)).toEqual([]);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(mapApiActions([])).toEqual([]);
  });

  it('id를 gen-{i}로 인덱스 순서대로 부여', () => {
    const out = mapApiActions([apiAction(), apiAction(), apiAction()]);
    expect(out.map((a) => a.id)).toEqual(['gen-0', 'gen-1', 'gen-2']);
  });

  it('필드를 DisplayAction 형태로 매핑(source_seed_id→sourceSeedId, strength_link→strengthLink)', () => {
    const out = mapApiActions([
      apiAction({ title: '제목', description: '설명', strength_link: '전략', source_seed_id: 'seed-9' }),
    ]);
    expect(out[0]).toEqual({
      id: 'gen-0',
      title: '제목',
      description: '설명',
      tags: ['t1'],
      sourceSeedId: 'seed-9',
      strengthLink: '전략',
    });
  });

  describe('null 정규화', () => {
    it('source_seed_id null → sourceSeedId null', () => {
      const out = mapApiActions([apiAction({ source_seed_id: null })]);
      expect(out[0].sourceSeedId).toBeNull();
    });
    it('strength_link null → strengthLink null', () => {
      const out = mapApiActions([apiAction({ strength_link: null })]);
      expect(out[0].strengthLink).toBeNull();
    });
    it('source_seed_id/strength_link undefined → null로 정규화(?? null)', () => {
      const weird = { title: 'T', description: 'D', tags: [] } as unknown as ApiAction;
      const out = mapApiActions([weird]);
      expect(out[0].sourceSeedId).toBeNull();
      expect(out[0].strengthLink).toBeNull();
    });
  });

  describe('tags 가드', () => {
    it('tags가 배열이 아니면 []', () => {
      const bad = { ...apiAction(), tags: 'x' as unknown as string[] };
      expect(mapApiActions([bad])[0].tags).toEqual([]);
    });
    it('tags null → []', () => {
      const bad = { ...apiAction(), tags: null as unknown as string[] };
      expect(mapApiActions([bad])[0].tags).toEqual([]);
    });
    it('정상 tags는 그대로 보존', () => {
      expect(mapApiActions([apiAction({ tags: ['a', 'b'] })])[0].tags).toEqual(['a', 'b']);
    });
  });
});

describe('mergeWithPool', () => {
  const COUNT = 5;
  const gen = (n: number): DisplayAction[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `gen-${i}`,
      title: `gen ${i}`,
      description: 'd',
      tags: [],
      sourceSeedId: null,
      strengthLink: '분석',
    }));

  it('생성분이 정확히 count면 그대로(보충 없음)', () => {
    const out = mergeWithPool(gen(5), COUNT, fakeFill);
    expect(out).toHaveLength(5);
    expect(out.every((a) => a.id.startsWith('gen-'))).toBe(true);
  });

  it('생성분이 count 초과면 count개로 자른다', () => {
    const out = mergeWithPool(gen(8), COUNT, fakeFill);
    expect(out).toHaveLength(5);
    expect(out.map((a) => a.id)).toEqual(['gen-0', 'gen-1', 'gen-2', 'gen-3', 'gen-4']);
  });

  it('생성분이 부족하면 풀로 보충(생성분 우선)', () => {
    const out = mergeWithPool(gen(2), COUNT, fakeFill);
    expect(out).toHaveLength(5);
    expect(out.map((a) => a.id)).toEqual(['gen-0', 'gen-1', 'pool-0', 'pool-1', 'pool-2']);
  });

  it('생성분이 0이면 풀 전체로 채운다(전멸 폴백 경로 아님, 정상 보충)', () => {
    const out = mergeWithPool([], COUNT, fakeFill);
    expect(out).toHaveLength(5);
    expect(out.every((a) => a.id.startsWith('pool-'))).toBe(true);
  });

  it('생성분 0 + 풀도 0 → 빈 result → poolFill(count) 재호출(여전히 0) → 빈 배열', () => {
    const emptyFill = () => [] as DisplayAction[];
    const out = mergeWithPool([], COUNT, emptyFill);
    expect(out).toEqual([]);
  });

  it('생성분이 있어 result가 비지 않으면 result 그대로(폴백 미발동)', () => {
    // 생성분 1개 + 풀 4개 = 5개 (length>0) → poolFill(count) 재호출 안 함
    let fillCalls = 0;
    const countingFill = (n: number) => {
      fillCalls += 1;
      return fakeFill(n);
    };
    mergeWithPool(gen(1), COUNT, countingFill);
    // 보충 1회만(부족분), 폴백 재호출 없음
    expect(fillCalls).toBe(1);
  });

  it('count가 0이면 빈 result → poolFill(0)=빈 → 빈 배열', () => {
    const out = mergeWithPool(gen(3), 0, fakeFill);
    expect(out).toEqual([]);
  });
});
