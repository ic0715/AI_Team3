import { describe, expect, it } from 'vitest';
import { clipString, clipArray } from './clip';

// ─────────────────────────────────────────────────────────────
// clipString — finalize 라우트가 LLM의 비정형 출력을 안전하게 문자열로 클립
// ─────────────────────────────────────────────────────────────
describe('clipString', () => {
  it('문자열은 max 길이로 자른다', () => {
    expect(clipString('abcdef', 3)).toBe('abc');
  });

  it('max보다 짧으면 그대로 반환', () => {
    expect(clipString('ab', 10)).toBe('ab');
  });

  it('정확히 max 길이면 그대로 반환 (경계)', () => {
    expect(clipString('abc', 3)).toBe('abc');
  });

  it('빈 문자열은 빈 문자열', () => {
    expect(clipString('', 5)).toBe('');
  });

  it('문자열이 아닌 값(undefined/null/숫자/객체/배열)은 빈 문자열', () => {
    expect(clipString(undefined, 5)).toBe('');
    expect(clipString(null, 5)).toBe('');
    expect(clipString(42, 5)).toBe('');
    expect(clipString({ a: 1 }, 5)).toBe('');
    expect(clipString(['a', 'b'], 5)).toBe('');
    expect(clipString(true, 5)).toBe('');
  });

  it('max=0 이면 빈 문자열', () => {
    expect(clipString('abc', 0)).toBe('');
  });

  it('한글(멀티바이트) 문자도 코드유닛 기준으로 자른다', () => {
    expect(clipString('가나다라', 2)).toBe('가나');
  });
});

// ─────────────────────────────────────────────────────────────
// clipArray — LLM의 비정형 배열을 안전하게 문자열 배열로 클립
//   비문자열·빈문자열 제거 + 최대 maxItems + 각 항목 maxItemLen
// ─────────────────────────────────────────────────────────────
describe('clipArray', () => {
  it('정상 배열을 그대로 (항목 길이/개수 한도 내) 반환', () => {
    expect(clipArray(['a', 'b', 'c'], 5, 10)).toEqual(['a', 'b', 'c']);
  });

  it('maxItems 개수로 자른다 (앞에서부터)', () => {
    expect(clipArray(['a', 'b', 'c', 'd'], 2, 10)).toEqual(['a', 'b']);
  });

  it('각 항목을 maxItemLen 길이로 자른다', () => {
    expect(clipArray(['abcdef', 'xy'], 5, 3)).toEqual(['abc', 'xy']);
  });

  it('배열이 아닌 값은 빈 배열', () => {
    expect(clipArray(undefined, 5, 10)).toEqual([]);
    expect(clipArray(null, 5, 10)).toEqual([]);
    expect(clipArray('not array', 5, 10)).toEqual([]);
    expect(clipArray(42, 5, 10)).toEqual([]);
    expect(clipArray({ 0: 'a', length: 1 }, 5, 10)).toEqual([]);
  });

  it('비문자열 항목(숫자/null/객체/undefined)을 제거', () => {
    expect(clipArray(['a', 1, null, 'b', undefined, {}], 10, 10)).toEqual(['a', 'b']);
  });

  it('빈 문자열 항목을 제거', () => {
    expect(clipArray(['', 'a', '', 'b'], 10, 10)).toEqual(['a', 'b']);
  });

  it('빈 배열 입력 → 빈 배열', () => {
    expect(clipArray([], 5, 10)).toEqual([]);
  });

  it('필터링이 slice보다 먼저 적용됨 (제거 후 maxItems 카운트)', () => {
    // 빈 문자열/비문자열을 먼저 제거하므로, 유효 항목 기준 2개만 남는다.
    expect(clipArray(['', 'a', null, 'b', 'c'], 2, 10)).toEqual(['a', 'b']);
  });

  it('필터 → slice → map(clip) 순서: 잘라낸 뒤 각 항목 길이 제한', () => {
    expect(clipArray(['hello', 'world', 'foo'], 2, 3)).toEqual(['hel', 'wor']);
  });
});
