import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText, parseJSONLoose } from '@/lib/anthropic';
import {
  INTERVIEW_FINALIZE_SYSTEM,
  buildFinalizeUserPrompt,
} from '@/lib/prompts/career-interview';
import type {
  CareerInterviewKeyInsights,
  SessionDurationChoice,
} from '@/lib/types/database';
import { clipString, clipArray } from '@/lib/utils/clip';

export const runtime = 'nodejs';

interface FinalizeRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: {
    nickname: string;
    strengths: Array<{ name_ko: string }>;
  };
}

type Extraction = CareerInterviewKeyInsights;

interface FinalizeResponse {
  extraction: Extraction;
  session_duration_choice: SessionDurationChoice;
  ai_summary: string;
}

const VALID_COMPETENCY_CODES = [
  'T-1', 'T-2', 'T-3',
  'I-1', 'I-2', 'I-3',
  'R-1', 'R-2', 'R-3',
  'E-1', 'E-2', 'E-3',
] as const;

const VALID_DURATION: readonly SessionDurationChoice[] = ['short', 'medium', 'long'] as const;

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
      max_tokens: 6000,                                     // thinking.budget_tokens(4000) + 출력(2000) 여유. SDK 제약: max_tokens > budget_tokens
      temperature: 1,                                       // thinking 활성화 시 SDK가 1만 허용 (명세 §4.6.B는 0이나, 결정성은 thinking이 잡아줌)
      thinking: { type: 'enabled', budget_tokens: 4000 },   // 명세 §4.6.B
      system: [
        { type: 'text', text: INTERVIEW_FINALIZE_SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = extractText(message);

    if (!raw || raw.trim().length === 0) {
      console.error('[finalize] LLM 응답 text 블록 비어있음. message:', JSON.stringify(message.content));
      throw new Error('LLM 응답에 text 블록이 비어있음 (thinking만 반환되었을 가능성)');
    }

    const parts = raw.split(/\n---SUMMARY---\n/);
    if (parts.length !== 2) {
      console.error('[finalize] SUMMARY 구분자 누락. raw:', raw);
      throw new Error('LLM 응답에 ---SUMMARY--- 구분자가 정확히 1번 등장하지 않음');
    }
    const [jsonPart, summaryPart] = parts;

    let extraction: Record<string, unknown>;
    try {
      extraction = parseJSONLoose<Record<string, unknown>>(jsonPart);
    } catch {
      console.error('[finalize] JSON parse failed. raw:', jsonPart);
      throw new Error('LLM 응답 JSON 파싱 실패');
    }

    const aiSummary = summaryPart.trim();

    // session_duration_choice 검증 (enum 위반·누락 시 'medium' 강제)
    const sessionDuration: SessionDurationChoice =
      (VALID_DURATION as readonly string[]).includes(extraction.session_duration_choice as string)
        ? (extraction.session_duration_choice as SessionDurationChoice)
        : 'medium';

    // 신규 4키 (string clip)
    const presenting_issue = clipString(extraction.presenting_issue, 500);
    const agreed_focus = clipString(extraction.agreed_focus, 500);
    const agreement_evolution = clipString(extraction.agreement_evolution, 800);
    const user_takeaway = clipString(extraction.user_takeaway, 500);

    // 중첩 key_insights 7키 (전부 optional)
    const legacy = (extraction.key_insights ?? {}) as Record<string, unknown>;
    const key_insights = {
      current_satisfaction: clipString(legacy.current_satisfaction, 400),
      current_frustration:  clipString(legacy.current_frustration, 400),
      future_vision:        clipString(legacy.future_vision, 400),
      work_style:           clipString(legacy.work_style, 400),
      values:               clipArray(legacy.values, 5, 30),
      career_concern:       clipString(legacy.career_concern, 400),
      dream:                clipString(legacy.dream, 400),
    };

    // growth_competencies (기르고 싶은 역량, 우선순위 순)
    // enum 위반 제거 + 중복 제거(첫 등장 우선순위 유지) + 최대 5개
    const rawCompetencies = Array.isArray(extraction.growth_competencies)
      ? extraction.growth_competencies
      : [];
    const seen = new Set<string>();
    const cleanCompetencies = rawCompetencies
      .filter((c: unknown): c is string =>
        typeof c === 'string' && (VALID_COMPETENCY_CODES as readonly string[]).includes(c),
      )
      .filter((c) => (seen.has(c) ? false : (seen.add(c), true)))
      .slice(0, 5);

    const result: FinalizeResponse = {
      extraction: {
        presenting_issue,
        agreed_focus,
        agreement_evolution,
        user_takeaway,
        key_insights,
        growth_competencies: cleanCompetencies,
      },
      session_duration_choice: sessionDuration,
      ai_summary: clipString(aiSummary, 80) || '커리어 인터뷰가 완료되었습니다.',
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
