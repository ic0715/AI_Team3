import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// 본 프로젝트에서 사용할 모델 ID (한 곳에서만 관리)
export const MODEL = 'claude-sonnet-4-6' as const;

// LLM 응답에서 text content 블록 추출
export function extractText(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('LLM 응답에 text content 없음');
  }
  return block.text;
}

// 응답 문자열에서 첫 번째 "균형 잡힌" JSON 값([...] 또는 {...})만 추출한다.
// 문자열 리터럴 안의 괄호/이스케이프를 인식해 오탐을 막는다. 못 찾으면 null.
function extractFirstJson(s: string): string | null {
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

// 마크다운 펜스 제거 후 JSON 파싱. 모델이 JSON 앞뒤에 잡텍스트를 붙여도 견고하게 동작.
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
