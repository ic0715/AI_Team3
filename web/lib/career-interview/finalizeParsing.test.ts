import { describe, expect, it } from 'vitest';
import {
  splitFinalizeResponse,
  coerceSessionDuration,
  cleanGrowthCompetencies,
  VALID_COMPETENCY_CODES,
  VALID_DURATION,
} from './finalizeParsing';

// ─────────────────────────────────────────────────────────────
// splitFinalizeResponse — '---SUMMARY---' 구분자 기준 JSON/SUMMARY 분리
// ─────────────────────────────────────────────────────────────
describe('splitFinalizeResponse', () => {
  it('구분자가 정확히 1번이면 두 파트로 분리', () => {
    const raw = '{"a":1}\n---SUMMARY---\n오늘 인터뷰 요약';
    const { jsonPart, summaryPart } = splitFinalizeResponse(raw);
    expect(jsonPart).toBe('{"a":1}');
    expect(summaryPart).toBe('오늘 인터뷰 요약');
  });

  it('구분자가 없으면 throw', () => {
    expect(() => splitFinalizeResponse('{"a":1} 요약')).toThrow(/SUMMARY/);
  });

  it('구분자가 2번 이상이면 throw (파트 3개)', () => {
    const raw = 'a\n---SUMMARY---\nb\n---SUMMARY---\nc';
    expect(() => splitFinalizeResponse(raw)).toThrow(/SUMMARY/);
  });

  it('구분자는 앞뒤 개행이 정확히 있어야 매칭됨', () => {
    // '\n---SUMMARY---\n' 정확 매칭이 아니면 분리 안 됨 → throw
    expect(() => splitFinalizeResponse('a---SUMMARY---b')).toThrow();
  });

  it('summaryPart는 trim하지 않고 원본 그대로 반환 (호출부에서 trim)', () => {
    const { summaryPart } = splitFinalizeResponse('{}\n---SUMMARY---\n  공백 포함  ');
    expect(summaryPart).toBe('  공백 포함  ');
  });
});

// ─────────────────────────────────────────────────────────────
// coerceSessionDuration — enum 검증 (위반/누락 시 'medium')
// ─────────────────────────────────────────────────────────────
describe('coerceSessionDuration', () => {
  it('유효한 enum 값은 그대로', () => {
    expect(coerceSessionDuration('short')).toBe('short');
    expect(coerceSessionDuration('medium')).toBe('medium');
    expect(coerceSessionDuration('long')).toBe('long');
  });

  it('enum 위반 문자열 → medium', () => {
    expect(coerceSessionDuration('extra-long')).toBe('medium');
    expect(coerceSessionDuration('SHORT')).toBe('medium'); // 대소문자 구분
  });

  it('누락/비문자열(undefined/null/숫자/객체) → medium', () => {
    expect(coerceSessionDuration(undefined)).toBe('medium');
    expect(coerceSessionDuration(null)).toBe('medium');
    expect(coerceSessionDuration(30)).toBe('medium');
    expect(coerceSessionDuration({})).toBe('medium');
    expect(coerceSessionDuration('')).toBe('medium');
  });

  it('VALID_DURATION 상수는 short/medium/long', () => {
    expect(VALID_DURATION).toEqual(['short', 'medium', 'long']);
  });
});

// ─────────────────────────────────────────────────────────────
// cleanGrowthCompetencies — enum 필터 + dedup + slice(5)
// ─────────────────────────────────────────────────────────────
describe('cleanGrowthCompetencies', () => {
  it('유효 코드 배열을 순서 유지하며 반환', () => {
    expect(cleanGrowthCompetencies(['T-1', 'I-2', 'R-3'])).toEqual(['T-1', 'I-2', 'R-3']);
  });

  it('배열이 아니면 빈 배열', () => {
    expect(cleanGrowthCompetencies(undefined)).toEqual([]);
    expect(cleanGrowthCompetencies(null)).toEqual([]);
    expect(cleanGrowthCompetencies('T-1')).toEqual([]);
    expect(cleanGrowthCompetencies({ 0: 'T-1' })).toEqual([]);
  });

  it('enum 위반 코드 제거', () => {
    expect(cleanGrowthCompetencies(['T-1', 'X-9', 'Z-0', 'I-1'])).toEqual(['T-1', 'I-1']);
  });

  it('비문자열 항목 제거', () => {
    expect(cleanGrowthCompetencies(['T-1', 1, null, undefined, {}, 'E-2'])).toEqual(['T-1', 'E-2']);
  });

  it('중복 제거 — 첫 등장 우선순위 유지', () => {
    expect(cleanGrowthCompetencies(['T-1', 'I-2', 'T-1', 'I-2', 'R-3'])).toEqual([
      'T-1',
      'I-2',
      'R-3',
    ]);
  });

  it('최대 5개로 자른다 (정제 후)', () => {
    const out = cleanGrowthCompetencies([
      'T-1', 'T-2', 'T-3', 'I-1', 'I-2', 'I-3', 'R-1',
    ]);
    expect(out).toHaveLength(5);
    expect(out).toEqual(['T-1', 'T-2', 'T-3', 'I-1', 'I-2']);
  });

  it('정제(필터+dedup) 후 slice: 위반/중복이 5개 카운트를 채우지 않음', () => {
    // 'X-9'(위반), 'T-1' 중복은 제거되고, 유효 고유 코드 기준 5개.
    const out = cleanGrowthCompetencies([
      'T-1', 'X-9', 'T-1', 'I-1', 'I-2', 'I-3', 'R-1', 'R-2',
    ]);
    expect(out).toEqual(['T-1', 'I-1', 'I-2', 'I-3', 'R-1']);
  });

  it('빈 배열 → 빈 배열', () => {
    expect(cleanGrowthCompetencies([])).toEqual([]);
  });

  it('VALID_COMPETENCY_CODES 는 12개 (T/I/R/E × 1~3)', () => {
    expect(VALID_COMPETENCY_CODES).toHaveLength(12);
  });
});
