import { describe, expect, it } from 'vitest';
import { CONFIRM_WORDS, isConfirmation } from './confirmation';

describe('isConfirmation', () => {
  describe('falsy 입력', () => {
    it('null → false', () => {
      expect(isConfirmation(null)).toBe(false);
    });

    it('undefined → false', () => {
      expect(isConfirmation(undefined)).toBe(false);
    });

    it('빈 문자열 → false', () => {
      expect(isConfirmation('')).toBe(false);
    });

    it('공백만 → false', () => {
      expect(isConfirmation('   ')).toBe(false);
      expect(isConfirmation('\n\t  ')).toBe(false);
    });
  });

  describe('단일 키워드 일치', () => {
    it('"확정" 단어 단독 매칭', () => {
      expect(isConfirmation('확정')).toBe(true);
    });

    it('"좋아요" 매칭', () => {
      expect(isConfirmation('좋아요')).toBe(true);
    });

    it('"네" 짧은 단어도 매칭', () => {
      expect(isConfirmation('네')).toBe(true);
    });

    it('"OK" (대문자) 매칭', () => {
      expect(isConfirmation('OK')).toBe(true);
    });

    it('"ok" (소문자) 매칭', () => {
      expect(isConfirmation('ok')).toBe(true);
    });
  });

  describe('substring 매칭 (긴 문장 안)', () => {
    it('"그걸로 확정할게요" → 매칭 (확정 포함)', () => {
      expect(isConfirmation('그걸로 확정할게요')).toBe(true);
    });

    it('"네 좋아요" → 매칭 (네/좋아요 둘 다 포함)', () => {
      expect(isConfirmation('네 좋아요')).toBe(true);
    });

    it('"응 그거 괜찮은 것 같아요" → 매칭 (응/괜찮 포함)', () => {
      expect(isConfirmation('응 그거 괜찮은 것 같아요')).toBe(true);
    });

    it('"이걸로 가겠어요" → 매칭 (이걸로 포함)', () => {
      expect(isConfirmation('이걸로 가겠어요')).toBe(true);
    });
  });

  describe('앞뒤 공백/줄바꿈 처리', () => {
    it('앞뒤 공백 있어도 trim 후 매칭', () => {
      expect(isConfirmation('   확정   ')).toBe(true);
    });

    it('앞뒤 줄바꿈 trim', () => {
      expect(isConfirmation('\n좋아요\n')).toBe(true);
    });
  });

  describe('매칭 실패 케이스', () => {
    it('관련 없는 일반 문장은 false', () => {
      expect(isConfirmation('아직 잘 모르겠어요')).toBe(false);
    });

    it('"확실" — "확정"의 일부분이지만 정확히 "확정"이 없으므로 false', () => {
      expect(isConfirmation('확실히 알겠어요')).toBe(false);
    });

    it('"좋다" — "좋아요"와 다르므로 false', () => {
      expect(isConfirmation('좋다고 생각해요')).toBe(false);
    });

    it('"Ok" (혼합 대소문자)는 CONFIRM_WORDS에 없으므로 false', () => {
      expect(isConfirmation('Ok')).toBe(false);
    });

    it('이모지만 → false', () => {
      expect(isConfirmation('🤔')).toBe(false);
    });
  });

  describe('정책 — 한국어 부분 일치가 의도된 동작', () => {
    it('"맞아요" → 매칭 (맞아 포함)', () => {
      expect(isConfirmation('맞아요')).toBe(true);
    });

    it('"맞아맞아!" → 매칭', () => {
      expect(isConfirmation('맞아맞아!')).toBe(true);
    });
  });

  describe('CONFIRM_WORDS 상수 안정성', () => {
    it('readonly 상수 — 키워드 9개 등록', () => {
      expect(CONFIRM_WORDS.length).toBe(9);
    });

    it('모든 키워드가 비어있지 않음', () => {
      for (const w of CONFIRM_WORDS) {
        expect(w.length).toBeGreaterThan(0);
      }
    });

    it('OK와 ok 모두 등록 (대소문자 둘 다 처리)', () => {
      expect(CONFIRM_WORDS).toContain('OK');
      expect(CONFIRM_WORDS).toContain('ok');
    });
  });
});
