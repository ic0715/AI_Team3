import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText } from '@/lib/anthropic';
import { buildChatSystemPrompt, type ReflectChatContext } from '@/lib/prompts/reflect-coach';

export const runtime = 'nodejs';

interface ChatRequestBody {
  messages: Array<{ role: 'coach' | 'user'; content: string }>;
  context: ReflectChatContext;
  questionIndex: number;     // 1~4 (페이지 UI 진행도 표시용)
  isRenegotiate: boolean;
}

interface ChatResponse {
  content: string;
  nextQuestionIndex: number;
  isComplete: boolean;
}

// 안전망: 메인 코칭 ~20턴, 재협의 ~10턴 넘으면 강제 종료
const HARD_COMPLETE_MAIN = 20;
const HARD_COMPLETE_RENEGOTIATE = 10;

// 06 §5.1 / 5.5 종료 키워드 — 클라이언트와 동일 감지
const ENDING_KEYWORDS = [
  '오늘 코칭은 여기서',
  '오늘은 여기까지',
  '여기서 마무리할게요',
  '여기서 마무리하겠습니다',
];

function detectEnding(text: string): boolean {
  return ENDING_KEYWORDS.some((k) => text.includes(k));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { messages, context, questionIndex, isRenegotiate } = body;

    const userMsgCount = messages.filter((m) => m.role === 'user').length;

    const system = buildChatSystemPrompt(context, isRenegotiate);

    // 페이지의 Message.role ('coach' | 'user') → Anthropic ('assistant' | 'user')
    const history = messages.map((m) => ({
      role: m.role === 'coach' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }));

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,           // 평시 2~3문장 + 🔴 정서 위기 redirect 멘트(자원 번호 포함) 여유
      temperature: 0.7,          // 06 v1.3: 자연스러운 대화체 변주
      system: [
        // Prompt Caching: 정적 부분 캐시 (~90% 입력 토큰 절감)
        { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
      ],
      messages: history,
    });

    const text = extractText(message).trim();

    const llmSignaledEnd = detectEnding(text);
    const threshold = isRenegotiate ? HARD_COMPLETE_RENEGOTIATE : HARD_COMPLETE_MAIN;
    const overThreshold = userMsgCount >= threshold;
    const isComplete = llmSignaledEnd || overThreshold;

    // questionIndex는 클라이언트가 화면 표시용으로 관리. 서버는 +1로 자연 진행만 도움.
    const nextQuestionIndex = isComplete
      ? Math.max(questionIndex, 5)
      : Math.min(questionIndex + 1, 4);

    const response: ChatResponse = {
      content: text,
      nextQuestionIndex,
      isComplete,
    };
    return NextResponse.json(response);
  } catch (e) {
    console.error('[reflect-coach/chat] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
