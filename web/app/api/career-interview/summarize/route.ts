// 커리어 인터뷰 대화 요약 — 백그라운드 작업
// finalize 완료 후 클라이언트가 fire-and-forget으로 호출.
// service_role key로 conversation_summary 컬럼을 UPDATE.
// ⚠️  SUPABASE_SERVICE_ROLE_KEY 환경변수가 .env.local에 설정되어 있어야 합니다.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { anthropic, MODEL, extractText } from '@/lib/anthropic';

export const runtime = 'nodejs';

interface SummarizeRequestBody {
  interviewId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const SUMMARIZE_SYSTEM = `당신은 커리어 코칭 인터뷰 기록 분석가입니다.
주어진 인터뷰 대화 전문을 읽고, 다음 인터뷰 세션에서 코치가 맥락을 파악할 수 있도록
아래 4가지 항목을 한국어로 작성해주세요.

출력 형식 (JSON만 출력, 마크다운 펜스 없이):
{
  "core_concern": "핵심 고민 — 이 인터뷰에서 사용자가 가져온 가장 핵심적인 고민 (1~2문장)",
  "agreed_theme": "합의된 주제 — 코치와 사용자가 최종적으로 다루기로 한 주제 (1문장)",
  "closing_insight": "마무리 인사이트 — 인터뷰 끝에 사용자가 얻거나 표현한 깨달음 (1~2문장)",
  "emotional_career_arc": "감정·커리어 방향 변화 흐름 — 인터뷰 시작부터 끝까지 사용자의 감정 상태와 커리어 방향 인식이 어떻게 변화했는지 (2~3문장)"
}`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SummarizeRequestBody;
    const { interviewId, messages } = body;

    if (!interviewId || !messages?.length) {
      return NextResponse.json({ error: 'interviewId and messages required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const transcript = messages
      .map((m) => `${m.role === 'user' ? '사용자' : '코치'}: ${m.content}`)
      .join('\n\n');

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      temperature: 0.3,
      system: SUMMARIZE_SYSTEM,
      messages: [{ role: 'user', content: `아래는 인터뷰 대화 전문입니다:\n\n${transcript}` }],
    });

    const raw = extractText(message).trim();

    let parsed: Record<string, string>;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match?.[0] ?? raw);
    } catch {
      console.error('[summarize] JSON parse failed:', raw);
      return NextResponse.json({ error: 'Summary parse failed' }, { status: 500 });
    }

    const lines: string[] = [];
    if (parsed.core_concern)       lines.push(`[핵심 고민] ${parsed.core_concern}`);
    if (parsed.agreed_theme)       lines.push(`[합의된 주제] ${parsed.agreed_theme}`);
    if (parsed.closing_insight)    lines.push(`[마무리 인사이트] ${parsed.closing_insight}`);
    if (parsed.emotional_career_arc) lines.push(`[감정·커리어 방향 변화 흐름] ${parsed.emotional_career_arc}`);

    const summaryText = lines.join('\n');

    const { error } = await supabaseAdmin
      .from('career_interview_results')
      .update({ conversation_summary: summaryText })
      .eq('id', interviewId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[career-interview/summarize] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
