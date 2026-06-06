import { describe, expect, it } from 'vitest';
import { extractFirstJson, parseJSONLoose } from './parseJson';

// ─────────────────────────────────────────────────────────────
// extractFirstJson — 균형 괄호 추출
// ─────────────────────────────────────────────────────────────
describe('extractFirstJson', () => {
  it('객체/배열을 그대로 추출', () => {
    expect(extractFirstJson('{"a":1}')).toBe('{"a":1}');
    expect(extractFirstJson('[1,2,3]')).toBe('[1,2,3]');
  });

  it('앞뒤 잡텍스트를 잘라내고 균형 JSON만 반환', () => {
    expect(extractFirstJson('설명: {"a":1} 끝')).toBe('{"a":1}');
    expect(extractFirstJson('결과 [1,2] 입니다')).toBe('[1,2]');
  });

  it('더 먼저 등장하는 괄호([ vs {)를 시작점으로 선택', () => {
    expect(extractFirstJson('x [1] y {2} z')).toBe('[1]');
    expect(extractFirstJson('x {"a":1} y [2] z')).toBe('{"a":1}');
  });

  it('중첩 구조를 끝까지 포함', () => {
    expect(extractFirstJson('{"a":{"b":[1,2]},"c":3}')).toBe('{"a":{"b":[1,2]},"c":3}');
    expect(extractFirstJson('[{"a":1},{"b":2}]')).toBe('[{"a":1},{"b":2}]');
  });

  it('문자열 리터럴 안의 괄호는 무시(오탐 방지)', () => {
    expect(extractFirstJson('{"t":"} ] 괄호"}')).toBe('{"t":"} ] 괄호"}');
    expect(extractFirstJson('{"t":"a{b[c"}')).toBe('{"t":"a{b[c"}');
  });

  it('이스케이프된 따옴표를 문자열 종료로 오인하지 않음', () => {
    expect(extractFirstJson('{"t":"a\\"b"}')).toBe('{"t":"a\\"b"}');
  });

  it('괄호가 없으면 null', () => {
    expect(extractFirstJson('no json here')).toBeNull();
    expect(extractFirstJson('')).toBeNull();
  });

  it('닫히지 않은(잘린) JSON은 null', () => {
    expect(extractFirstJson('{"a":1')).toBeNull();
    expect(extractFirstJson('[1,2,')).toBeNull();
  });

  it('첫 균형 그룹만 반환(뒤의 추가 값 무시)', () => {
    expect(extractFirstJson('{"a":1}{"b":2}')).toBe('{"a":1}');
  });
});

// ─────────────────────────────────────────────────────────────
// parseJSONLoose — 펜스 제거 + 빠른 경로 + 폴백
// ─────────────────────────────────────────────────────────────
describe('parseJSONLoose', () => {
  it('깨끗한 JSON(객체/배열) 파싱', () => {
    expect(parseJSONLoose('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' });
    expect(parseJSONLoose('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('앞뒤 공백 trim 후 파싱', () => {
    expect(parseJSONLoose('   {"a":1}   ')).toEqual({ a: 1 });
  });

  it('마크다운 펜스 제거(```json / ``` / 대문자 JSON)', () => {
    expect(parseJSONLoose('```json\n[1,2,3]\n```')).toEqual([1, 2, 3]);
    expect(parseJSONLoose('```\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJSONLoose('```JSON\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('JSON 뒤에 설명 텍스트가 붙어도 폴백으로 파싱', () => {
    expect(parseJSONLoose('[1,2,3] 위 결과입니다.')).toEqual([1, 2, 3]);
    expect(parseJSONLoose('{"a":1} 라고 답합니다')).toEqual({ a: 1 });
  });

  it('JSON 앞에 잡텍스트(괄호 없음)가 붙어도 폴백으로 파싱', () => {
    expect(parseJSONLoose('결과는 다음과 같습니다: {"a":1}')).toEqual({ a: 1 });
  });

  it('펜스 + 앞뒤 텍스트 혼합도 처리', () => {
    expect(parseJSONLoose('```json\n{"a":[1,2],"b":"x"}\n```')).toEqual({ a: [1, 2], b: 'x' });
  });

  it('문자열 안 괄호가 있어도 폴백 추출이 안전', () => {
    expect(parseJSONLoose('답: {"t":"} ] 끝"} 이상')).toEqual({ t: '} ] 끝' });
  });

  it('제네릭 타입으로 반환', () => {
    const r = parseJSONLoose<{ a: number }>('{"a":42}');
    expect(r.a).toBe(42);
  });

  it('JSON이 전혀 없으면 최초 파싱 에러를 throw', () => {
    expect(() => parseJSONLoose('완전히 일반 텍스트')).toThrow();
  });

  it('잘린(닫히지 않은) JSON은 throw', () => {
    expect(() => parseJSONLoose('{"a":1')).toThrow();
  });
});
