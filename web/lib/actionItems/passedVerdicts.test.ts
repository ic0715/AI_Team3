import { describe, expect, it } from 'vitest';
import { passedIndexSet, type Verdict } from './passedVerdicts';

// 정렬된 배열로 비교하기 위한 헬퍼(Set 순서 무관 검증).
const asSorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

describe('passedIndexSet', () => {
  it('빈 배열 → 빈 Set', () => {
    expect(passedIndexSet([]).size).toBe(0);
  });

  it('pass===true & 정수 index만 모은다', () => {
    const verdicts: Verdict[] = [
      { index: 0, pass: true },
      { index: 1, pass: false },
      { index: 2, pass: true },
    ];
    expect(asSorted(passedIndexSet(verdicts))).toEqual([0, 2]);
  });

  describe('pass가 정확히 boolean true가 아니면 제외(fail-closed)', () => {
    it("pass: 'true' (문자열) → 제외", () => {
      const v = [{ index: 0, pass: 'true' as unknown as boolean }];
      expect(passedIndexSet(v).size).toBe(0);
    });
    it('pass: 1 (truthy number) → 제외', () => {
      const v = [{ index: 0, pass: 1 as unknown as boolean }];
      expect(passedIndexSet(v).size).toBe(0);
    });
    it('pass 누락(undefined) → 제외', () => {
      const v = [{ index: 0 } as unknown as Verdict];
      expect(passedIndexSet(v).size).toBe(0);
    });
    it('pass: false → 제외', () => {
      expect(passedIndexSet([{ index: 0, pass: false }]).size).toBe(0);
    });
  });

  describe('index가 정수가 아니면 제외', () => {
    it('소수 index → 제외', () => {
      expect(passedIndexSet([{ index: 1.5, pass: true }]).size).toBe(0);
    });
    it('NaN index → 제외', () => {
      expect(passedIndexSet([{ index: NaN, pass: true }]).size).toBe(0);
    });
    it("문자열 index('0') → 제외", () => {
      const v = [{ index: '0' as unknown as number, pass: true }];
      expect(passedIndexSet(v).size).toBe(0);
    });
    it('index 누락 → 제외', () => {
      const v = [{ pass: true } as unknown as Verdict];
      expect(passedIndexSet(v).size).toBe(0);
    });
    it('음수 정수 index는 통과시킨다 (조립 루프가 범위로 막음 — 여기선 정수면 OK)', () => {
      // Number.isInteger(-1) === true → Set에 들어감. (out-of-range 안전망은 호출부 책임)
      expect(passedIndexSet([{ index: -1, pass: true }]).has(-1)).toBe(true);
    });
    it('큰 정수(out-of-range)도 정수면 통과 — Set엔 들어가나 조립 루프가 무시', () => {
      expect(passedIndexSet([{ index: 999, pass: true }]).has(999)).toBe(true);
    });
  });

  describe('falsy verdict 항목 방어', () => {
    it('null/undefined 항목은 제외', () => {
      const v = [null, undefined, { index: 0, pass: true }] as unknown as Verdict[];
      expect(asSorted(passedIndexSet(v))).toEqual([0]);
    });
  });

  describe('중복 index는 Set으로 1개 합쳐진다', () => {
    it('같은 index가 여러 번 통과해도 1개', () => {
      const v: Verdict[] = [
        { index: 0, pass: true },
        { index: 0, pass: true },
        { index: 1, pass: true },
      ];
      const s = passedIndexSet(v);
      expect(s.size).toBe(2);
      expect(asSorted(s)).toEqual([0, 1]);
    });
  });

  it('전부 통과 → 모든 index', () => {
    const v: Verdict[] = [0, 1, 2, 3, 4].map((index) => ({ index, pass: true }));
    expect(asSorted(passedIndexSet(v))).toEqual([0, 1, 2, 3, 4]);
  });
});
