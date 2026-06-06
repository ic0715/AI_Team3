import { describe, expect, it } from 'vitest';
import { sanitizeCandidates, type GenCandidate } from './sanitizeCandidates';

// 헬퍼: 유효한 후보 1개를 만든다.
const cand = (title: string, strength: string): GenCandidate => ({
  title,
  description: `${title} 설명`,
  tags: ['⏱ 30분'],
  strength_link: strength,
});

const TOP5 = new Set(['분석', '전략', '공감']);
const LIMIT = 10;

describe('sanitizeCandidates', () => {
  describe('배열이 아닌 입력 → 빈 배열', () => {
    it('null → []', () => {
      expect(sanitizeCandidates(null, TOP5, LIMIT)).toEqual([]);
    });
    it('undefined → []', () => {
      expect(sanitizeCandidates(undefined, TOP5, LIMIT)).toEqual([]);
    });
    it('객체(배열 아님) → []', () => {
      expect(sanitizeCandidates({ title: 'x' } as unknown, TOP5, LIMIT)).toEqual([]);
    });
    it('문자열 → []', () => {
      expect(sanitizeCandidates('not array' as unknown, TOP5, LIMIT)).toEqual([]);
    });
    it('빈 배열 → []', () => {
      expect(sanitizeCandidates([], TOP5, LIMIT)).toEqual([]);
    });
  });

  describe('falsy / 형식 위반 항목 제외', () => {
    it('null 항목은 제외', () => {
      const out = sanitizeCandidates([null, cand('A', '분석')] as unknown, TOP5, LIMIT);
      expect(out.map((c) => c.title)).toEqual(['A']);
    });
    it('undefined 항목은 제외', () => {
      const out = sanitizeCandidates([undefined, cand('A', '분석')] as unknown, TOP5, LIMIT);
      expect(out.map((c) => c.title)).toEqual(['A']);
    });
    it('title이 string이 아니면 제외', () => {
      const bad = { ...cand('x', '분석'), title: 123 as unknown as string };
      const out = sanitizeCandidates([bad, cand('A', '분석')], TOP5, LIMIT);
      expect(out.map((c) => c.title)).toEqual(['A']);
    });
    it('title이 공백만이면 trim 후 0자 → 제외', () => {
      const out = sanitizeCandidates([cand('   ', '분석'), cand('A', '분석')], TOP5, LIMIT);
      expect(out.map((c) => c.title)).toEqual(['A']);
    });
    it('title이 빈 문자열 → 제외', () => {
      const out = sanitizeCandidates([cand('', '분석')], TOP5, LIMIT);
      expect(out).toEqual([]);
    });
  });

  describe('강점 연계(Top5 내) 강제', () => {
    it('strength_link가 Top5 밖이면 제외', () => {
      const out = sanitizeCandidates([cand('A', '리더십'), cand('B', '분석')], TOP5, LIMIT);
      expect(out.map((c) => c.title)).toEqual(['B']);
    });
    it('strength_link가 string이 아니면 제외', () => {
      const bad = { ...cand('A', '분석'), strength_link: null as unknown as string };
      const out = sanitizeCandidates([bad, cand('B', '전략')], TOP5, LIMIT);
      expect(out.map((c) => c.title)).toEqual(['B']);
    });
    it('빈 Top5 집합이면 전부 제외 (어떤 strength_link도 통과 못 함)', () => {
      const out = sanitizeCandidates([cand('A', '분석'), cand('B', '전략')], new Set(), LIMIT);
      expect(out).toEqual([]);
    });
    it('Top5 내 모든 강점은 통과', () => {
      const out = sanitizeCandidates(
        [cand('A', '분석'), cand('B', '전략'), cand('C', '공감')],
        TOP5,
        LIMIT,
      );
      expect(out.map((c) => c.title)).toEqual(['A', 'B', 'C']);
    });
  });

  describe('limit slice', () => {
    it('limit개로 자른다 (초과분 폐기)', () => {
      const many = Array.from({ length: 8 }, (_, i) => cand(`A${i}`, '분석'));
      const out = sanitizeCandidates(many, TOP5, 3);
      expect(out).toHaveLength(3);
      expect(out.map((c) => c.title)).toEqual(['A0', 'A1', 'A2']);
    });
    it('limit이 0이면 빈 배열', () => {
      const out = sanitizeCandidates([cand('A', '분석')], TOP5, 0);
      expect(out).toEqual([]);
    });
    it('항목 수 < limit이면 전부 유지', () => {
      const out = sanitizeCandidates([cand('A', '분석'), cand('B', '전략')], TOP5, 5);
      expect(out).toHaveLength(2);
    });
    it('필터로 줄어든 뒤 slice — 유효분만 세어 limit 적용', () => {
      const mixed = [
        cand('A', '분석'),
        cand('BAD', '리더십'), // Top5 밖 → 제외
        cand('B', '전략'),
        cand('C', '공감'),
      ];
      const out = sanitizeCandidates(mixed, TOP5, 2);
      // 필터 후 [A, B, C] → slice(0,2) → [A, B]
      expect(out.map((c) => c.title)).toEqual(['A', 'B']);
    });
  });

  describe('원본 객체 보존(참조 동일)', () => {
    it('통과한 후보는 그대로(map하지 않음)', () => {
      const c = cand('A', '분석');
      const out = sanitizeCandidates([c], TOP5, LIMIT);
      expect(out[0]).toBe(c);
    });
  });
});
