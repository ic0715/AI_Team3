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

  describe('정책 경계 — 단일 그림 이모지 1개만 제거 (계약 고정)', () => {
    it('앞에 그림 이모지가 2개 연달아 있으면 1개만 제거(나머지 1개는 보존)', () => {
      // 정책: 맨 앞 "그림 이모지 1개 + 공백"만 제거. 두 번째 이모지는 본문 시작으로 간주.
      expect(stripLeadingEmoji('🔥🔥 인기')).toBe('🔥 인기');
    });

    it('공백으로 분리된 두 이모지도 첫 이모지+공백만 제거', () => {
      expect(stripLeadingEmoji('🔥 🔥 인기')).toBe('🔥 인기');
    });

    it('키캡 숫자 이모지(1️⃣)는 제거하지 않음 — 숫자 시작 보호 정책 연장', () => {
      // 키캡은 ASCII 숫자 + U+FE0F + U+20E3 조합이라 첫 코드포인트가 Extended_Pictographic이 아님.
      expect(stripLeadingEmoji('1️⃣ 첫번째')).toBe('1️⃣ 첫번째');
    });

    it('지역 표시 깃발 이모지(🇰🇷)는 제거하지 않음 — regional indicator는 Extended_Pictographic 아님', () => {
      expect(stripLeadingEmoji('🇰🇷 한국')).toBe('🇰🇷 한국');
    });

    it('앞에 공백이 먼저 오면 이모지를 제거하지 않음 (정규식 ^ 앵커)', () => {
      expect(stripLeadingEmoji('  🔥 인기')).toBe('  🔥 인기');
    });

    it('이모지만 있는 문자열 → 빈 문자열', () => {
      expect(stripLeadingEmoji('🧠')).toBe('');
    });
  });

  describe('competencies.ts 실제 태그 회귀 (09 카드 렌더 경로)', () => {
    it('🗺️ 큰 그림 → 큰 그림', () => {
      expect(stripLeadingEmoji('🗺️ 큰 그림')).toBe('큰 그림');
    });

    it('⏱️ 시간관리 → 시간관리 (variation selector 포함)', () => {
      expect(stripLeadingEmoji('⏱️ 시간관리')).toBe('시간관리');
    });

    it('✅완료 → 완료 (공백 없는 변형)', () => {
      expect(stripLeadingEmoji('✅완료')).toBe('완료');
    });
  });
});
