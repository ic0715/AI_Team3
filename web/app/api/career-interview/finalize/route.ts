import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText, parseJSONLoose } from '@/lib/anthropic';
import {
  INTERVIEW_FINALIZE_SYSTEM,
  buildFinalizeUserPrompt,
} from '@/lib/prompts/career-interview';

export const runtime = 'nodejs';

interface FinalizeRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: {
    nickname: string;
    strengths: Array<{ name_ko: string }>;
  };
}

interface FinalizeResult {
  key_insights: {
    current_satisfaction: string;
    current_frustration: string;
    future_vision: string;
    work_style: string;
    values: string[];
    career_concern: string;
    dream: string;
    mentioned_competencies: string[];
  };
  ai_summary: string;
}

const VALID_COMPETENCY_CODES = [
  'T-1', 'T-2', 'T-3',
  'I-1', 'I-2', 'I-3',
  'R-1', 'R-2', 'R-3',
  'E-1', 'E-2', 'E-3',
];

function clipString(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  return s.slice(0, max);
}

function clipArray(arr: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .slice(0, maxItems)
    .map((s) => s.slice(0, maxItemLen));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FinalizeRequestBody;
    const { messages, context } = body;

    const transcript = messages
      .map((m) => `${m.role === 'user' ? '사용자' : '코치'}: ${m.content}`)
      .join('\n\n');

    const userPrompt = buildFinalizeUserPrompt({
      nickname: context.nickname,
      strengthsKo: context.strengths.map((s) => s.name_ko),
      transcript,
    });

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [
        { type: 'text', text: INTERVIEW_FINALIZE_SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = extractText(message);
    let parsed: FinalizeResult;
    try {
      parsed = parseJSONLoose<FinalizeResult>(raw);
    } catch {
      console.error('[finalize] JSON parse failed. raw:', raw);
      throw new Error('LLM 응답 JSON 파싱 실패');
    }

    const ki = parsed.key_insights ?? ({} as FinalizeResult['key_insights']);

    // 검증·정리 (스펙 6.1)
    const cleanCompetencies = (Array.isArray(ki.mentioned_competencies) ? ki.mentioned_competencies : [])
      .filter((c): c is string => typeof c === 'string' && VALID_COMPETENCY_CODES.includes(c))
      .slice(0, 3);

    const result: FinalizeResult = {
      key_insights: {
        current_satisfaction: clipString(ki.current_satisfaction, 400),
        current_frustration: clipString(ki.current_frustration, 400),
        future_vision: clipString(ki.future_vision, 400),
        work_style: clipString(ki.work_style, 400),
        values: clipArray(ki.values, 5, 30),
        career_concern: clipString(ki.career_concern, 400),
        dream: clipString(ki.dream, 400),
        mentioned_competencies: cleanCompetencies,
      },
      ai_summary: clipString(parsed.ai_summary, 80) || '커리어 인터뷰가 완료되었습니다.',
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error('[career-interview/finalize] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
