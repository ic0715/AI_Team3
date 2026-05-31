import { describe, expect, it } from 'vitest';
import { localISODate } from './localDate';

// new Date(year, monthIndex, day, ...)는 "로컬 timezone" 기준 Date를 만들고,
// localISODate는 getFullYear/getMonth/getDate(로컬 기준)로 읽으므로
// 테스트 러너의 timezone과 무관하게 결정적이다.
describe('localISODate', () => {
  describe('기본 포맷 YYYY-MM-DD', () => {
    it('정규식 매칭 (인자 없이 호출)', () => {
      expect(localISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('인자 없이 호출 == new Date() 주입', () => {
      const now = new Date();
      expect(localISODate()).toBe(localISODate(now));
    });
  });

  describe('월/일 zero-padding', () => {
    it('1월 5일 → 0 패딩', () => {
      expect(localISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('6월 1일 (한 자리 월/일) → 패딩', () => {
      expect(localISODate(new Date(2026, 5, 1))).toBe('2026-06-01');
    });

    it('6월 9일 → 일 패딩', () => {
      expect(localISODate(new Date(2026, 5, 9))).toBe('2026-06-09');
    });

    it('12월 25일 (두 자리) → 패딩 없음', () => {
      expect(localISODate(new Date(2026, 11, 25))).toBe('2026-12-25');
    });

    it('monthIndex 11 → "12" (월 +1 변환)', () => {
      expect(localISODate(new Date(2026, 11, 1))).toBe('2026-12-01');
    });
  });

  describe('연/월 경계', () => {
    it('연말 마지막 순간 (12/31 23:59) → 그 해 12-31', () => {
      expect(localISODate(new Date(2025, 11, 31, 23, 59, 59))).toBe('2025-12-31');
    });

    it('연초 첫 순간 (1/1 00:00) → 새해 01-01', () => {
      expect(localISODate(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01');
    });
  });

  describe('UTC 버그 회피 — 로컬 자정 직후', () => {
    it('로컬 6/1 00:30은 (UTC가 무엇이든) 로컬 달력 날짜 2026-06-01', () => {
      // toISOString()을 썼다면 +TZ 환경에서 5/31이 나올 수 있는 지점.
      // localISODate는 로컬 컴포넌트만 읽으므로 항상 로컬 달력 날짜를 반환.
      expect(localISODate(new Date(2026, 5, 1, 0, 30))).toBe('2026-06-01');
    });
  });
});
