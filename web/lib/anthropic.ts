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

// 마크다운 펜스 제거 후 JSON 파싱
export function parseJSONLoose<T = unknown>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}
