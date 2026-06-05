import { describe, expect, it } from 'vitest';
import { CODE_TO_SLUG, competencyCodeToSlug } from './seedMapping';

describe('competencyCodeToSlug', () => {
  it('T-1 → critical-thinking', () => {
    expect(competencyCodeToSlug('T-1')).toBe('critical-thinking');
  });

  it('E-3 → self-management', () => {
    expect(competencyCodeToSlug('E-3')).toBe('self-management');
  });

  it('R-3 → empathy-comm', () => {
    expect(competencyCodeToSlug('R-3')).toBe('empathy-comm');
  });

  it('매핑에 없는 코드는 그대로 통과 (방어적 fallback)', () => {
    expect(competencyCodeToSlug('X-9')).toBe('X-9');
    expect(competencyCodeToSlug('critical-thinking')).toBe('critical-thinking');
  });

  it('null/undefined/빈 문자열 → 빈 문자열', () => {
    expect(competencyCodeToSlug(null)).toBe('');
    expect(competencyCodeToSlug(undefined)).toBe('');
    expect(competencyCodeToSlug('')).toBe('');
  });

  it('12역량 모두 매핑돼 있음', () => {
    expect(Object.keys(CODE_TO_SLUG)).toHaveLength(12);
    for (const slug of Object.values(CODE_TO_SLUG)) {
      expect(slug.length).toBeGreaterThan(0);
    }
  });
});
