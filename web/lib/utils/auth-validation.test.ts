import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPasswordStrength, isOver14 } from './auth-validation';

describe('getPasswordStrength', () => {
  it('빈 문자열은 level 0', () => {
    const r = getPasswordStrength('');
    expect(r.level).toBe(0);
    expect(r.label).toBe('');
  });

  it('8자 미만은 약함 (level 1)', () => {
    expect(getPasswordStrength('abc123').level).toBe(1);
    expect(getPasswordStrength('a1').level).toBe(1);
    expect(getPasswordStrength('1234567').level).toBe(1);
  });

  it('영문만 8자 이상 → 약함 (level 1)', () => {
    expect(getPasswordStrength('abcdefgh').level).toBe(1);
    expect(getPasswordStrength('ABCDEFGHIJKLMNOP').level).toBe(1);
  });

  it('숫자만 8자 이상 → 약함 (level 1)', () => {
    expect(getPasswordStrength('12345678').level).toBe(1);
  });

  it('영문+숫자 8~11자 → 보통 (level 2)', () => {
    expect(getPasswordStrength('abc12345').level).toBe(2);
    expect(getPasswordStrength('abcdefg12345').level).toBe(3); // 12자 → 강함
    expect(getPasswordStrength('abcde12345').level).toBe(2); // 10자
  });

  it('영문+숫자 12자 이상 → 강함 (level 3)', () => {
    expect(getPasswordStrength('abcdefgh1234').level).toBe(3);
    expect(getPasswordStrength('Password12345').level).toBe(3);
  });

  it('레벨별 색상 코드가 일관됨', () => {
    expect(getPasswordStrength('abc123').color).toBe('#EF4444'); // 약함
    expect(getPasswordStrength('abc12345').color).toBe('#F59E0B'); // 보통
    expect(getPasswordStrength('abcdefgh1234').color).toBe('#10B981'); // 강함
  });
});

describe('isOver14', () => {
  beforeEach(() => {
    // 테스트의 결정성 확보 — 오늘 날짜를 고정
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('빈 문자열은 false', () => {
    expect(isOver14('')).toBe(false);
  });

  it('정확히 14년 전 같은 날 → true (만 14세)', () => {
    expect(isOver14('2012-05-28')).toBe(true);
  });

  it('14년 전이지만 생일이 아직 안 지남 → false (만 13세)', () => {
    expect(isOver14('2012-05-29')).toBe(false); // 내일이 생일
    expect(isOver14('2012-06-01')).toBe(false);
  });

  it('14년 전이지만 생일이 이미 지남 → true', () => {
    expect(isOver14('2012-05-27')).toBe(true); // 어제까지가 생일
    expect(isOver14('2012-01-01')).toBe(true);
  });

  it('15년 이상 전이면 항상 true', () => {
    expect(isOver14('2000-01-01')).toBe(true);
    expect(isOver14('1990-12-31')).toBe(true);
  });

  it('13년 전이면 항상 false', () => {
    expect(isOver14('2013-01-01')).toBe(false);
    expect(isOver14('2013-12-31')).toBe(false);
  });
});
