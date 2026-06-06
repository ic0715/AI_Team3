import { describe, expect, it } from 'vitest';
import { clamp } from './clamp';

describe('clamp', () => {
  describe('비-문자열 입력 → 빈 문자열', () => {
    it('null → ""', () => {
      expect(clamp(null, 10)).toBe('');
    });
    it('undefined → ""', () => {
      expect(clamp(undefined, 10)).toBe('');
    });
    it('number → ""', () => {
      expect(clamp(123, 10)).toBe('');
    });
    it('object → ""', () => {
      expect(clamp({ title: 'x' }, 10)).toBe('');
    });
    it('array → ""', () => {
      expect(clamp(['a', 'b'], 10)).toBe('');
    });
    it('boolean → ""', () => {
      expect(clamp(true, 10)).toBe('');
    });
  });

  describe('빈 문자열', () => {
    it('"" → "" (max 무관)', () => {
      expect(clamp('', 5)).toBe('');
      expect(clamp('', 0)).toBe('');
    });
  });

  describe('길이 ≤ max → 입력 그대로 (자르지 않음)', () => {
    it('짧은 문자열은 그대로', () => {
      expect(clamp('hello', 10)).toBe('hello');
    });
    it('정확히 max 길이 → 그대로 (boundary, 경계는 자르지 않음)', () => {
      expect(clamp('hello', 5)).toBe('hello');
    });
    it('길이 ≤ max면 끝 공백도 보존 (trimEnd 안 함)', () => {
      expect(clamp('hi   ', 10)).toBe('hi   ');
      expect(clamp('hi   ', 5)).toBe('hi   '); // length 5 === max → 그대로
    });
  });

  describe('길이 > max → slice(0, max) 후 trimEnd', () => {
    it('초과분을 잘라낸다', () => {
      expect(clamp('abcdefghij', 5)).toBe('abcde');
    });
    it('max+1 (boundary just over) → max까지', () => {
      expect(clamp('abcdef', 5)).toBe('abcde');
    });
    it('자른 경계에 공백이 걸리면 trimEnd로 제거', () => {
      // "ab   xyz" slice(0,5) = "ab   " → trimEnd → "ab"
      expect(clamp('ab   xyz', 5)).toBe('ab');
    });
    it('자른 뒤 끝 공백이 없으면 그대로', () => {
      // "abcdefg" slice(0,5) = "abcde" → trimEnd 무변화
      expect(clamp('abcdefg', 5)).toBe('abcde');
    });
    it('max=0 이고 초과면 빈 문자열', () => {
      expect(clamp('abc', 0)).toBe('');
    });
  });

  describe('한글/UTF-16 code unit 길이', () => {
    it('한글 음절은 1 code unit으로 센다', () => {
      // 6자 → max 5 초과 → 5자
      expect(clamp('가나다라마바', 5)).toBe('가나다라마');
    });
    it('한글이 정확히 max면 그대로', () => {
      expect(clamp('가나다라마', 5)).toBe('가나다라마');
    });
  });

  describe('route.ts 실제 사용 한계 (title 60 / description 120)', () => {
    it('title: 200자 → 60자 이하', () => {
      const out = clamp('ㄱ'.repeat(200), 60);
      expect(out.length).toBeLessThanOrEqual(60);
      expect(out.length).toBe(60);
    });
    it('description: 300자 → 120자 이하', () => {
      const out = clamp('ㄴ'.repeat(300), 120);
      expect(out.length).toBeLessThanOrEqual(120);
      expect(out.length).toBe(120);
    });
  });
});
