import { describe, expect, it } from 'vitest';
import {
  DOMAIN_CODE_BY_NAME,
  domainToCode,
  extractGrowthCompetencies,
  hasStoredSlots,
  isRenderableSlot,
} from './resultMapping';

describe('domainToCode', () => {
  it('strategic → T', () => {
    expect(domainToCode('strategic')).toBe('T');
  });

  it('influencing → I', () => {
    expect(domainToCode('influencing')).toBe('I');
  });

  it('relationship → R', () => {
    expect(domainToCode('relationship')).toBe('R');
  });

  it('executing → E', () => {
    expect(domainToCode('executing')).toBe('E');
  });

  it('매핑에 없는 값은 그대로 통과 (방어적 fallback)', () => {
    expect(domainToCode('unknown-domain')).toBe('unknown-domain');
    // 이미 코드가 들어와도 통과 (이중 변환 방지)
    expect(domainToCode('T')).toBe('T');
  });

  it('null/undefined/빈 문자열 → 빈 문자열', () => {
    expect(domainToCode(null)).toBe('');
    expect(domainToCode(undefined)).toBe('');
    expect(domainToCode('')).toBe('');
  });

  it('4개 도메인 모두 단일 문자 코드로 매핑', () => {
    expect(Object.keys(DOMAIN_CODE_BY_NAME)).toHaveLength(4);
    for (const code of Object.values(DOMAIN_CODE_BY_NAME)) {
      expect(code).toMatch(/^[TIRE]$/);
    }
  });
});

describe('extractGrowthCompetencies', () => {
  describe('방어적 처리 → 빈 배열', () => {
    it('null → []', () => {
      expect(extractGrowthCompetencies(null)).toEqual([]);
    });

    it('undefined → []', () => {
      expect(extractGrowthCompetencies(undefined)).toEqual([]);
    });

    it('객체가 아닌 값(문자열/숫자) → []', () => {
      expect(extractGrowthCompetencies('T-1')).toEqual([]);
      expect(extractGrowthCompetencies(42)).toEqual([]);
    });

    it('growth_competencies 키 없음 → []', () => {
      expect(extractGrowthCompetencies({ other: 1 })).toEqual([]);
    });

    it('growth_competencies가 배열이 아님 → [] (malformed JSONB 방어)', () => {
      expect(extractGrowthCompetencies({ growth_competencies: 'T-1' })).toEqual([]);
      expect(extractGrowthCompetencies({ growth_competencies: 123 })).toEqual([]);
      expect(extractGrowthCompetencies({ growth_competencies: null })).toEqual([]);
    });

    it('빈 배열 → []', () => {
      expect(extractGrowthCompetencies({ growth_competencies: [] })).toEqual([]);
    });
  });

  describe('정상 추출', () => {
    it('코드 배열 → 그대로 (순서 보존)', () => {
      expect(
        extractGrowthCompetencies({ growth_competencies: ['T-1', 'I-2', 'E-3'] }),
      ).toEqual(['T-1', 'I-2', 'E-3']);
    });

    it('string이 아닌 원소는 제거 (number/null/객체 섞임)', () => {
      expect(
        extractGrowthCompetencies({
          growth_competencies: ['T-1', 123, null, 'I-2', { x: 1 }, undefined],
        }),
      ).toEqual(['T-1', 'I-2']);
    });

    it('다른 key가 함께 있어도 growth_competencies만 추출', () => {
      expect(
        extractGrowthCompetencies({
          summary: 'blah',
          growth_competencies: ['R-1'],
          strengths: ['x'],
        }),
      ).toEqual(['R-1']);
    });
  });
});

describe('hasStoredSlots', () => {
  it('null → false', () => {
    expect(hasStoredSlots(null)).toBe(false);
  });

  it('undefined → false', () => {
    expect(hasStoredSlots(undefined)).toBe(false);
  });

  it('빈 배열 → false', () => {
    expect(hasStoredSlots([])).toBe(false);
  });

  it('원소 1개 이상 → true', () => {
    expect(hasStoredSlots([{ slot: 1 }])).toBe(true);
    expect(hasStoredSlots([1, 2, 3])).toBe(true);
  });

  it('타입 가드로 동작 — true 분기에서 배열로 좁혀짐', () => {
    const value: Array<{ slot: number }> | null = [{ slot: 1 }, { slot: 2 }];
    if (hasStoredSlots(value)) {
      // 컴파일 + 런타임 모두 통과해야 함
      expect(value[0].slot).toBe(1);
    } else {
      throw new Error('should be truthy');
    }
  });
});

describe('isRenderableSlot', () => {
  // CompetencyCard 렌더에 필요한 최소 필드를 모두 갖춘 슬롯
  const valid = {
    slot: 1,
    goalTitle: '비판적 사고 기르기',
    personalizedText: '당신의 분석 강점을 살려...',
    fitLabel: '추천',
    badge: 'user_interest',
    tags: ['🔍 논리적 사고', '📌 근거 기반 판단'],
  };

  it('필수 필드를 모두 갖추면 true', () => {
    expect(isRenderableSlot(valid)).toBe(true);
  });

  it('tags가 빈 배열이어도 (string[]이면) true', () => {
    expect(isRenderableSlot({ ...valid, tags: [] })).toBe(true);
  });

  describe('방어적 처리 → false', () => {
    it('null / undefined / 원시값', () => {
      expect(isRenderableSlot(null)).toBe(false);
      expect(isRenderableSlot(undefined)).toBe(false);
      expect(isRenderableSlot('slot')).toBe(false);
      expect(isRenderableSlot(1)).toBe(false);
    });

    it('slot이 number가 아니면 false (문자열 "1")', () => {
      expect(isRenderableSlot({ ...valid, slot: '1' })).toBe(false);
    });

    it('goalTitle 누락 → false', () => {
      const { goalTitle: _omit, ...rest } = valid;
      expect(isRenderableSlot(rest)).toBe(false);
    });

    it('personalizedText 누락 → false (Step2 머지 실패한 구데이터 방어)', () => {
      const { personalizedText: _omit, ...rest } = valid;
      expect(isRenderableSlot(rest)).toBe(false);
    });

    it('badge / fitLabel 누락 → false', () => {
      const { badge: _b, ...noBadge } = valid;
      expect(isRenderableSlot(noBadge)).toBe(false);
      const { fitLabel: _f, ...noFit } = valid;
      expect(isRenderableSlot(noFit)).toBe(false);
    });

    it('tags가 배열이 아니면 false', () => {
      expect(isRenderableSlot({ ...valid, tags: '논리적 사고' })).toBe(false);
      expect(isRenderableSlot({ ...valid, tags: null })).toBe(false);
    });

    it('tags에 string 아닌 원소가 섞이면 false', () => {
      expect(isRenderableSlot({ ...valid, tags: ['ok', 123] })).toBe(false);
    });
  });
});
