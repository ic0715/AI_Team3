import { describe, expect, it } from 'vitest';
import { computeBadgeAndComment, nextCoachingWeek } from './weeklyOutcome';

describe('computeBadgeAndComment', () => {
  describe('🔥 구간 (7+)', () => {
    it('7 → 🔥', () => {
      expect(computeBadgeAndComment(7)).toEqual({
        badge: '🔥',
        comment: '완벽한 한 주!',
      });
    });

    it('8 → 🔥', () => {
      expect(computeBadgeAndComment(8).badge).toBe('🔥');
    });

    it('극단값 100도 🔥', () => {
      expect(computeBadgeAndComment(100).badge).toBe('🔥');
    });
  });

  describe('👍 구간 (5,6)', () => {
    it('5 → 👍 (boundary)', () => {
      expect(computeBadgeAndComment(5)).toEqual({
        badge: '👍',
        comment: '꾸준함이 쌓이고 있어요',
      });
    });

    it('6 → 👍', () => {
      expect(computeBadgeAndComment(6).badge).toBe('👍');
    });
  });

  describe('😊 구간 (3,4)', () => {
    it('3 → 😊 (boundary)', () => {
      expect(computeBadgeAndComment(3)).toEqual({
        badge: '😊',
        comment: '절반을 해냈어요',
      });
    });

    it('4 → 😊', () => {
      expect(computeBadgeAndComment(4).badge).toBe('😊');
    });
  });

  describe('🌱 구간 (0~2 + 음수)', () => {
    it('0 → 🌱', () => {
      expect(computeBadgeAndComment(0)).toEqual({
        badge: '🌱',
        comment: '다음 주를 기대해요',
      });
    });

    it('2 → 🌱 (boundary 직전)', () => {
      expect(computeBadgeAndComment(2).badge).toBe('🌱');
    });

    it('-1 (음수 방어적 처리) → 🌱', () => {
      expect(computeBadgeAndComment(-1).badge).toBe('🌱');
    });
  });

  describe('Boundary transition', () => {
    it('2→3 경계: 2는 🌱, 3은 😊', () => {
      expect(computeBadgeAndComment(2).badge).toBe('🌱');
      expect(computeBadgeAndComment(3).badge).toBe('😊');
    });

    it('4→5 경계: 4는 😊, 5는 👍', () => {
      expect(computeBadgeAndComment(4).badge).toBe('😊');
      expect(computeBadgeAndComment(5).badge).toBe('👍');
    });

    it('6→7 경계: 6은 👍, 7은 🔥', () => {
      expect(computeBadgeAndComment(6).badge).toBe('👍');
      expect(computeBadgeAndComment(7).badge).toBe('🔥');
    });
  });
});

describe('nextCoachingWeek', () => {
  it('1주차 코칭 후 → 2주차', () => {
    expect(nextCoachingWeek(1)).toBe(2);
  });

  it('5주차 → 6주차', () => {
    expect(nextCoachingWeek(5)).toBe(6);
  });

  it('11주차 → 12주차', () => {
    expect(nextCoachingWeek(11)).toBe(12);
  });

  it('12주차에서 클램프 — 13이 아닌 12', () => {
    expect(nextCoachingWeek(12)).toBe(12);
  });

  it('이미 12 초과 입력도 12로 클램프 (방어적)', () => {
    expect(nextCoachingWeek(15)).toBe(12);
  });

  it('totalWeeks=4로 지정하면 4에서 클램프', () => {
    expect(nextCoachingWeek(4, 4)).toBe(4);
    expect(nextCoachingWeek(3, 4)).toBe(4);
  });

  it('totalWeeks=4에서 2주차 → 3주차', () => {
    expect(nextCoachingWeek(2, 4)).toBe(3);
  });

  it('0주차 (이론상 안 발생) → 1', () => {
    expect(nextCoachingWeek(0)).toBe(1);
  });
});
