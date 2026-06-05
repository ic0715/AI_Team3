// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';

// lib/anthropic는 모듈 로드 시 Anthropic 클라이언트를 생성한다(키 필요).
// 순수 함수 parseJSONLoose만 테스트하므로, 더미 키를 넣고 동적 import 한다.
let parseJSONLoose: typeof import('./anthropic').parseJSONLoose;

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
  ({ parseJSONLoose } = await import('./anthropic'));
});

describe('parseJSONLoose — 견고한 JSON 추출', () => {
  it('깨끗한 배열은 그대로 파싱(빠른 경로)', () => {
    expect(parseJSONLoose('[{"a":1},{"a":2}]')).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('마크다운 펜스 제거', () => {
    expect(parseJSONLoose('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });

  it('JSON 뒤 잡텍스트가 붙어도 배열만 추출 (실제 500 케이스)', () => {
    const raw = '[{"title":"A"}]\n\n위 액션들은 사용자에게 도움이 됩니다.';
    expect(parseJSONLoose(raw)).toEqual([{ title: 'A' }]);
  });

  it('JSON 앞 잡텍스트가 붙어도 추출', () => {
    const raw = '다음과 같습니다:\n[{"title":"A"},{"title":"B"}]';
    expect(parseJSONLoose(raw)).toEqual([{ title: 'A' }, { title: 'B' }]);
  });

  it('문자열 값 안의 대괄호/중괄호에 속지 않는다', () => {
    const raw = '[{"description":"목록[1] 정리 {중요}"}] 끝.';
    expect(parseJSONLoose(raw)).toEqual([{ description: '목록[1] 정리 {중요}' }]);
  });

  it('이스케이프된 따옴표가 있는 문자열도 정확히 경계 인식', () => {
    const raw = '[{"t":"그는 \\"왜?\\"라고 물었다"}] trailing';
    expect(parseJSONLoose(raw)).toEqual([{ t: '그는 "왜?"라고 물었다' }]);
  });

  it('객체 응답도 추출', () => {
    expect(parseJSONLoose('잡담 {"ok":true} 잡담')).toEqual({ ok: true });
  });

  it('JSON이 전혀 없으면 throw (fail-closed 유지)', () => {
    expect(() => parseJSONLoose('완전 헛소리, JSON 없음')).toThrow();
  });

  it('잘린(닫히지 않은) JSON은 throw', () => {
    expect(() => parseJSONLoose('[{"a":1}, {"a":2')).toThrow();
  });
});
