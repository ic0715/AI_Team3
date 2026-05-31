import { describe, expect, it } from 'vitest';
import {
  CUSTOM_MAX,
  CUSTOM_MIN,
  isCustomActionReady,
  validateCustomAction,
} from './customAction';

describe('validateCustomAction', () => {
  describe('falsy / 공백 입력 → MIN 미달', () => {
    it('null → 실패 (5자 이상 안내)', () => {
      expect(validateCustomAction(null)).toEqual({
        ok: false,
        error: '5자 이상 입력해주세요.',
      });
    });

    it('undefined → 실패', () => {
      expect(validateCustomAction(undefined).ok).toBe(false);
    });

    it('빈 문자열 → 실패', () => {
      expect(validateCustomAction('').ok).toBe(false);
    });

    it('공백만 → trim 후 0자 → 실패', () => {
      expect(validateCustomAction('     ').ok).toBe(false);
      expect(validateCustomAction('\n\t  ').ok).toBe(false);
    });
  });

  describe('MIN 경계 (5자)', () => {
    it('4자 → 실패', () => {
      const r = validateCustomAction('가나다라');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('5자 이상 입력해주세요.');
    });

    it('5자 (boundary) → 통과', () => {
      expect(validateCustomAction('가나다라마')).toEqual({
        ok: true,
        value: '가나다라마',
      });
    });

    it('trim 후 정확히 5자 → 통과', () => {
      expect(validateCustomAction('  가나다라마  ')).toEqual({
        ok: true,
        value: '가나다라마',
      });
    });

    it('trim 후 4자 (공백 제외하면 미달) → 실패', () => {
      expect(validateCustomAction('  가나다라  ').ok).toBe(false);
    });
  });

  describe('MAX 경계 (50자)', () => {
    it('50자 (boundary) → 통과', () => {
      const s = 'a'.repeat(50);
      expect(validateCustomAction(s)).toEqual({ ok: true, value: s });
    });

    it('51자 → 실패 (50자 이하 안내)', () => {
      const s = 'a'.repeat(51);
      const r = validateCustomAction(s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('50자 이하로 입력해주세요.');
    });

    it('trim 후 50자 (앞뒤 공백 포함 52자) → 통과', () => {
      const s = `  ${'a'.repeat(50)}  `;
      expect(validateCustomAction(s)).toEqual({ ok: true, value: 'a'.repeat(50) });
    });
  });

  describe('정상 케이스', () => {
    it('한글 문장 → 통과 + trim된 값 반환', () => {
      expect(validateCustomAction('매일 아침 회의록 정리하기')).toEqual({
        ok: true,
        value: '매일 아침 회의록 정리하기',
      });
    });

    it('중간 공백은 보존, 앞뒤만 trim', () => {
      const r = validateCustomAction('  데이터 분석 강의 듣기  ');
      expect(r).toEqual({ ok: true, value: '데이터 분석 강의 듣기' });
    });
  });

  describe('UTF-16 길이 정책 (이모지 surrogate pair)', () => {
    it('이모지 2개(=4 code unit) + 글자 1 → 5 code unit → 통과', () => {
      // "👍👍a" = 2+2+1 = 5 code units (기존 String.length 동작 보존)
      const r = validateCustomAction('👍👍a');
      expect(r.ok).toBe(true);
    });
  });
});

describe('isCustomActionReady', () => {
  it('null/undefined/빈값 → false', () => {
    expect(isCustomActionReady(null)).toBe(false);
    expect(isCustomActionReady(undefined)).toBe(false);
    expect(isCustomActionReady('')).toBe(false);
  });

  it('4자 → false (MIN 미달)', () => {
    expect(isCustomActionReady('가나다라')).toBe(false);
  });

  it('5자 (boundary) → true', () => {
    expect(isCustomActionReady('가나다라마')).toBe(true);
  });

  it('trim 후 5자 → true', () => {
    expect(isCustomActionReady('   가나다라마   ')).toBe(true);
  });

  it('MAX 초과(51자)여도 ready=true — 버튼은 MIN만 본다', () => {
    // validate에서는 실패하지만, 버튼 활성화 판정은 MIN 기준이라는 정책 확인
    expect(isCustomActionReady('a'.repeat(51))).toBe(true);
    expect(validateCustomAction('a'.repeat(51)).ok).toBe(false);
  });
});

describe('상수 안정성', () => {
  it('CUSTOM_MIN=5, CUSTOM_MAX=50', () => {
    expect(CUSTOM_MIN).toBe(5);
    expect(CUSTOM_MAX).toBe(50);
  });
});
