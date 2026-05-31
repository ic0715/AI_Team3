import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateCurrentWeek } from './week';

describe('calculateCurrentWeek', () => {
  // 날짜를 고정시켜서 테스트가 항상 같은 결과를 내도록 함
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 엣지 케이스 ──────────────────────────────────────────────

  it('startedAt이 null이면 1주차를 반환한다', () => {
    expect(calculateCurrentWeek(null)).toBe(1);
  });

  it('startedAt이 undefined이면 1주차를 반환한다', () => {
    expect(calculateCurrentWeek(undefined)).toBe(1);
  });

  it('startedAt이 빈 문자열이면 1주차를 반환한다', () => {
    expect(calculateCurrentWeek('')).toBe(1);
  });

  it('startedAt이 유효하지 않은 날짜 문자열이면 1주차를 반환한다', () => {
    expect(calculateCurrentWeek('not-a-date')).toBe(1);
  });

  it('startedAt이 미래 날짜면 1주차를 반환한다', () => {
    vi.setSystemTime(new Date('2025-01-01'));
    expect(calculateCurrentWeek('2025-12-31')).toBe(1);
  });

  // ── 정상 케이스 ───────────────────────────────────────────────

  it('시작일 당일은 1주차다', () => {
    vi.setSystemTime(new Date('2025-01-01'));
    expect(calculateCurrentWeek('2025-01-01')).toBe(1);
  });

  it('시작일로부터 6일 후도 1주차다', () => {
    vi.setSystemTime(new Date('2025-01-07'));
    expect(calculateCurrentWeek('2025-01-01')).toBe(1);
  });

  it('시작일로부터 7일 후는 2주차다', () => {
    vi.setSystemTime(new Date('2025-01-08'));
    expect(calculateCurrentWeek('2025-01-01')).toBe(2);
  });

  it('시작일로부터 13일 후도 2주차다', () => {
    vi.setSystemTime(new Date('2025-01-14'));
    expect(calculateCurrentWeek('2025-01-01')).toBe(2);
  });

  it('시작일로부터 14일 후는 3주차다', () => {
    vi.setSystemTime(new Date('2025-01-15'));
    expect(calculateCurrentWeek('2025-01-01')).toBe(3);
  });

  // ── 클램핑 ───────────────────────────────────────────────────

  it('12주차를 초과해도 12주차로 클램프된다 (기본 totalWeeks)', () => {
    // 84일(12주) 이상 지난 경우
    vi.setSystemTime(new Date('2025-04-01')); // 2025-01-01 + 89일
    expect(calculateCurrentWeek('2025-01-01')).toBe(12);
  });

  it('totalWeeks를 4로 지정하면 4주차로 클램프된다', () => {
    vi.setSystemTime(new Date('2025-03-01')); // 한참 지난 날짜
    expect(calculateCurrentWeek('2025-01-01', 4)).toBe(4);
  });

  it('totalWeeks를 4로 지정하고 2주차일 때 2를 반환한다', () => {
    vi.setSystemTime(new Date('2025-01-09')); // 8일 후 = 2주차
    expect(calculateCurrentWeek('2025-01-01', 4)).toBe(2);
  });
});
