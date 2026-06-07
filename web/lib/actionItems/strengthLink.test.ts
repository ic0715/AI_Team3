import { describe, expect, it } from 'vitest';
import { normalizeStrengthLink } from './strengthLink';

// 실제 갤럽 매핑: 분석=Analytical, 전략=Strategic, 공감=Empathy.
const TOP5 = new Set(['분석', '전략', '공감']);

describe('normalizeStrengthLink', () => {
  describe('타입/빈값 방어 → null', () => {
    it('string 아님 → null', () => {
      expect(normalizeStrengthLink(null, TOP5)).toBeNull();
      expect(normalizeStrengthLink(undefined, TOP5)).toBeNull();
      expect(normalizeStrengthLink(123 as unknown, TOP5)).toBeNull();
    });
    it('빈 문자열/공백만 → null', () => {
      expect(normalizeStrengthLink('', TOP5)).toBeNull();
      expect(normalizeStrengthLink('   ', TOP5)).toBeNull();
    });
  });

  describe('① 정확 일치', () => {
    it('Top5 원소 그대로 → 그 값', () => {
      expect(normalizeStrengthLink('분석', TOP5)).toBe('분석');
      expect(normalizeStrengthLink('공감', TOP5)).toBe('공감');
    });
  });

  describe('② 공백 차이 흡수', () => {
    it('앞뒤 공백 → trim 후 일치', () => {
      expect(normalizeStrengthLink('  전략  ', TOP5)).toBe('전략');
    });
  });

  describe('③ 영문명 → 한글명', () => {
    it('Analytical → 분석 (대소문자 무시)', () => {
      expect(normalizeStrengthLink('Analytical', TOP5)).toBe('분석');
      expect(normalizeStrengthLink('analytical', TOP5)).toBe('분석');
    });
    it('Empathy → 공감', () => {
      expect(normalizeStrengthLink('Empathy', TOP5)).toBe('공감');
    });
    it('영문명이 실재하지만 Top5 밖이면 → null (리더십 계열 등)', () => {
      // Strategic은 Top5에 있지만, Top5 밖 강점의 영문명은 매칭 안 됨.
      expect(normalizeStrengthLink('Leadership', TOP5)).toBeNull();
      expect(normalizeStrengthLink('Harmony', TOP5)).toBeNull(); // 화합=Harmony, Top5 밖
    });
  });

  describe('④ 정식명이 raw에 부분 포함', () => {
    it('"분석적 사고" → 분석', () => {
      expect(normalizeStrengthLink('분석적 사고', TOP5)).toBe('분석');
    });
    it('"전략 수립" → 전략', () => {
      expect(normalizeStrengthLink('전략 수립', TOP5)).toBe('전략');
    });
  });

  describe('매칭 실패 → null (보수적 탈락)', () => {
    it('Top5와 무관한 강점명 → null', () => {
      expect(normalizeStrengthLink('리더십', TOP5)).toBeNull();
      expect(normalizeStrengthLink('커뮤니케이션', TOP5)).toBeNull();
    });
    it('빈 Top5면 무엇이든 → null', () => {
      expect(normalizeStrengthLink('분석', new Set())).toBeNull();
      expect(normalizeStrengthLink('Analytical', new Set())).toBeNull();
    });
  });
});
