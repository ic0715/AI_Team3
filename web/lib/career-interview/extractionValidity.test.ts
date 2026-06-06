import { describe, expect, it } from 'vitest';
import { isExtractionInvalid } from './extractionValidity';

// ─────────────────────────────────────────────────────────────
// isExtractionInvalid — CONTRACT_v2 §7 세션 무효 게이트
//   핵심 3키(presenting_issue/agreed_focus/user_takeaway)가 모두 비면 무효(true)
//   → 결과 페이지 진입 차단, '결과 불가' 안내
// ─────────────────────────────────────────────────────────────
describe('isExtractionInvalid', () => {
  it('핵심 3키가 모두 빈 문자열이면 무효(true)', () => {
    expect(
      isExtractionInvalid({
        presenting_issue: '',
        agreed_focus: '',
        user_takeaway: '',
      }),
    ).toBe(true);
  });

  it('핵심 3키가 모두 undefined여도 무효(true)', () => {
    expect(isExtractionInvalid({})).toBe(true);
  });

  it('presenting_issue 하나만 있어도 유효(false)', () => {
    expect(
      isExtractionInvalid({
        presenting_issue: '성장 정체감',
        agreed_focus: '',
        user_takeaway: '',
      }),
    ).toBe(false);
  });

  it('agreed_focus 하나만 있어도 유효(false)', () => {
    expect(
      isExtractionInvalid({
        presenting_issue: '',
        agreed_focus: '이직 방향',
        user_takeaway: '',
      }),
    ).toBe(false);
  });

  it('user_takeaway 하나만 있어도 유효(false)', () => {
    expect(
      isExtractionInvalid({
        presenting_issue: '',
        agreed_focus: '',
        user_takeaway: '내 강점을 다시 봤다',
      }),
    ).toBe(false);
  });

  it('세 키가 모두 채워지면 유효(false)', () => {
    expect(
      isExtractionInvalid({
        presenting_issue: 'a',
        agreed_focus: 'b',
        user_takeaway: 'c',
      }),
    ).toBe(false);
  });

  it('agreement_evolution(비핵심 4번째 키)만 채워져도 무효(true) — 핵심 3키만 본다', () => {
    // §7 게이트는 핵심 3키만 본다. agreement_evolution은 게이트에 포함되지 않음.
    expect(
      isExtractionInvalid({
        presenting_issue: '',
        agreed_focus: '',
        user_takeaway: '',
        agreement_evolution: '합의가 한 번 바뀜',
      }),
    ).toBe(true);
  });
});
