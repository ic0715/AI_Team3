import { describe, expect, it } from 'vitest';
import { stripLeadingEmoji } from './emoji';

describe('stripLeadingEmoji', () => {
  describe('방어적 처리 → 빈 문자열', () => {
    it('null → ""', () => {
      expect(stripLeadingEmoji(null)).toBe('');
    });

    it('undefined → ""', () => {
      expect(stripLeadingEmoji(undefined)).toBe('');
    });

    it('빈 문자열 → ""', () => {
      expect(stripLeadingEmoji('')).toBe('');
    });
  });

  describe('앞 이모지 제거', () => {
    it('시계 이모지 + 공백 제거', () => {
      expect(stripLeadingEmoji('⏱ 1~2시간')).toBe('1~2시간');
    });

    it('무료 이모지 + 공백 제거', () => {
      expect(stripLeadingEmoji('🆓 무료')).toBe('무료');
    });

    it('이모지 뒤 공백이 없어도 제거', () => {
      expect(stripLeadingEmoji('🔥인기')).toBe('인기');
    });

    it('variation selector(U+FE0F) 포함 이모지 제거', () => {
      // ❤️ = U+2764 U+FE0F
      expect(stripLeadingEmoji('❤️ 추천')).toBe('추천');
    });

    it('ZWJ 합성 이모지(가족) 한 덩어리로 제거', () => {
      // 👨‍👩‍👧 = 👨 ZWJ 👩 ZWJ 👧
      expect(stripLeadingEmoji('👨‍👩‍👧 가족')).toBe('가족');
    });
  });

  describe('회귀 방지 — 숫자/문자로 시작하는 태그는 변형 없이 통과', () => {
    it('숫자로 시작하는 태그는 앞자리가 잘리지 않음 (핵심 버그)', () => {
      expect(stripLeadingEmoji('3개월 챌린지')).toBe('3개월 챌린지');
    });

    it('숫자만 있는 태그도 그대로', () => {
      expect(stripLeadingEmoji('100점')).toBe('100점');
    });

    it('# 으로 시작하는 태그는 그대로 (키캡 구성요소 오인 방지)', () => {
      expect(stripLeadingEmoji('#해시태그')).toBe('#해시태그');
    });

    it('* 으로 시작하는 태그는 그대로', () => {
      expect(stripLeadingEmoji('*중요')).toBe('*중요');
    });

    it('한글로 시작하는 태그는 그대로', () => {
      expect(stripLeadingEmoji('성장 마인드셋')).toBe('성장 마인드셋');
    });

    it('영문으로 시작하는 태그는 그대로', () => {
      expect(stripLeadingEmoji('AI 활용')).toBe('AI 활용');
    });
  });

  describe('중간/끝 이모지는 건드리지 않음', () => {
    it('맨 앞 이모지만 제거하고 뒤 이모지는 보존', () => {
      expect(stripLeadingEmoji('🔥 인기 🔥')).toBe('인기 🔥');
    });

    it('이모지가 앞에 없으면 중간 이모지는 그대로', () => {
      expect(stripLeadingEmoji('인기 🔥')).toBe('인기 🔥');
    });
  });
});
