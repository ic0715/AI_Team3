import { describe, expect, it } from 'vitest';
import {
  evaluateStrength,
  STRENGTH_COLOR,
  STRENGTH_LABEL,
  type StrengthLevel,
} from './passwordStrength';

// ─────────────────────────────────────────────────────────────
// evaluateStrength — 비밀번호 강도 평가
// ─────────────────────────────────────────────────────────────
describe('evaluateStrength', () => {
  it('8자 미만 → weak (특수문자/숫자 섞여도)', () => {
    expect(evaluateStrength('')).toBe('weak');
    expect(evaluateStrength('a1!')).toBe('weak');
    expect(evaluateStrength('Ab1@xy')).toBe('weak'); // 6자
    expect(evaluateStrength('Ab1@xyz')).toBe('weak'); // 7자 (8자 미만 경계)
  });

  it('8자 정확히 + 영문+숫자 → medium (경계값)', () => {
    expect(evaluateStrength('abcd1234')).toBe('medium'); // 8자, 영문+숫자
  });

  it('8자 이상이지만 영문 또는 숫자 한 종류만 → weak', () => {
    expect(evaluateStrength('abcdefgh')).toBe('weak'); // 영문만
    expect(evaluateStrength('12345678')).toBe('weak'); // 숫자만
    expect(evaluateStrength('!@#$%^&*')).toBe('weak'); // 특수문자만
  });

  it('영문+숫자(특수문자 없음 또는 12자 미만) → medium', () => {
    expect(evaluateStrength('abc12345')).toBe('medium'); // 8자
    expect(evaluateStrength('abc12345!@#')).toBe('medium'); // 11자(12자 미만이라 strong 아님)
    expect(evaluateStrength('Abcdef123456')).toBe('medium'); // 12자지만 특수문자 없음
  });

  it('12자 이상 + 영문+숫자+특수문자 → strong (경계값)', () => {
    expect(evaluateStrength('Abcdef123!@#')).toBe('strong'); // 12자 정확히
    expect(evaluateStrength('MyP@ssw0rd123!')).toBe('strong');
  });

  it('11자 + 영문+숫자+특수문자 → medium (12자 경계 미달)', () => {
    expect(evaluateStrength('Abcde123!@#')).toBe('medium'); // 11자
  });

  it('모든 반환값이 StrengthLevel 유니온', () => {
    const valid: StrengthLevel[] = ['weak', 'medium', 'strong'];
    for (const pwd of ['', 'abcd1234', 'Abcdef123!@#', '!!!', 'aaaaaaaaaaaa']) {
      expect(valid).toContain(evaluateStrength(pwd));
    }
  });
});

// ─────────────────────────────────────────────────────────────
// STRENGTH_LABEL / STRENGTH_COLOR — 라벨/색상 매핑
// ─────────────────────────────────────────────────────────────
describe('STRENGTH_LABEL / STRENGTH_COLOR', () => {
  it('모든 레벨에 라벨/색상이 정의됨', () => {
    const levels: StrengthLevel[] = ['weak', 'medium', 'strong'];
    for (const lvl of levels) {
      expect(STRENGTH_LABEL[lvl]).toBeTruthy();
      expect(STRENGTH_COLOR[lvl]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('라벨 값 회귀 방지', () => {
    expect(STRENGTH_LABEL.weak).toBe('약함');
    expect(STRENGTH_LABEL.medium).toBe('보통');
    expect(STRENGTH_LABEL.strong).toBe('강함');
  });
});
