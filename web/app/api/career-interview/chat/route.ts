import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText } from '@/lib/anthropic';
import { buildSystemPrompt } from '@/lib/prompts/career-interview';

export const runtime = 'nodejs';

interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  context: {
    nickname: string;
    jobField: string;
    careerLevel: string;
    mainConcern?: string;
    strengths: Array<{ name_ko: string; name_en: string; domain: string }>;
  };
  coreQuestionIndex: number;
  isExtraMode: boolean;
}

// 안전망: 사용자 메시지가 너무 많으면 강제 완료 (실제로는 LLM의 종료 키워드로 끝남)
const HARD_COMPLETE_THRESHOLD = 24;

// LLM의 종료 신호 키워드 (03 spec §4.1)
const ENDING_KEYWORDS = [
  '오늘 인터뷰는 여기서',
  '충분히 들었어요',
  '마무리하겠습니다',
  '마무리할게요',
  '여기서 마무리',
  '커리어 방향을 분석',
];

function detectEnding(text: string): boolean {
  return ENDING_KEYWORDS.some((k) => text.includes(k));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { messages, context, isExtraMode } = body;

    const userMsgCount = messages.filter((m) => m.role === 'user').length;

    const system = buildSystemPrompt({
      nickname: context.nickname,
      jobField: context.jobField,
      careerLevel: context.careerLevel,
      mainConcern: context.mainConcern ?? '',
      strengthsKo: context.strengths.map((s) => s.name_ko),
      strengthsEn: context.strengths.map((s) => s.name_en),
    });

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
      ],
      messages: history,
    });

    const text = extractText(message).trim();

    // 완료 판단: LLM 종료 키워드 || 안전망(18턴)
    const llmSignaledEnd = detectEnding(text);
    const overThreshold = userMsgCount >= HARD_COMPLETE_THRESHOLD;
    const isComplete = !isExtraMode && (llmSignaledEnd || overThreshold);

    return NextResponse.json({
      content: text,
      // 진행률 표시: 사용자 답변 ÷ 3 ≈ 메인 주제 진행 (메인 1개당 ~3턴: 메인+follow-up 1~2)
      nextCoreQuestionIndex: Math.min(Math.ceil(userMsgCount / 3), 6),
      isInterviewComplete: isComplete,
    });
  } catch (e) {
    console.error('[career-interview/chat] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
