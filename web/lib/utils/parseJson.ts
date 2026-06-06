/**
 * LLM 응답 JSON 파싱 — 순수 로직(SDK 비의존).
 *
 * 기존 lib/anthropic.ts에 인라인돼 있던 extractFirstJson / parseJSONLoose를 분리.
 * anthropic.ts는 상단에서 Anthropic SDK 클라이언트를 인스턴스화하므로(API 키 필요),
 * 파싱 로직을 SDK-free 모듈로 떼어내야 단위 테스트에서 안전하게 import할 수 있다.
 * (lib/anthropic.ts는 parseJSONLoose를 re-export하여 import 호환 유지.)
 */

/**
 * 응답 문자열에서 첫 번째 "균형 잡힌" JSON 값([...] 또는 {...})만 추출.
 * 문자열 리터럴 안의 괄호/이스케이프를 인식해 오탐을 막는다. 못 찾으면 null.
 * (닫히지 않은/잘린 JSON도 null.)
 */
export function extractFirstJson(s: string): string | null {
  const a = s.indexOf('[');
  const o = s.indexOf('{');
  const start = a === -1 ? o : o === -1 ? a : Math.min(a, o);
  if (start === -1) return null;
  const open = s[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null; // 닫히지 않음(잘린 JSON 등)
}

/**
 * 마크다운 펜스 제거 후 JSON 파싱. 모델이 JSON 앞뒤에 잡텍스트를 붙여도 견고하게 동작.
 * 1) ```json ... ``` 펜스 제거 + trim 후 JSON.parse(빠른 경로).
 * 2) 실패 시 첫 균형 JSON 값만 떼어내 재파싱(예: "[...] 추가 설명" → "[...]").
 * 3) 둘 다 실패하면 최초 파싱 에러를 throw.
 */
export function parseJSONLoose<T = unknown>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T; // 깨끗한 경우 빠른 경로
  } catch (firstErr) {
    // 폴백: 응답에서 첫 균형 JSON 값만 떼어내 파싱 (예: "[...] 추가 설명" → "[...]").
    const extracted = extractFirstJson(cleaned);
    if (extracted !== null) return JSON.parse(extracted) as T;
    throw firstErr;
  }
}
