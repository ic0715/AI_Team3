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
}

interface ChatResponse {
  content: string;
  isInterviewComplete: boolean;
}

// ⚠️ 고정 턴 기반 '강제 종료'는 두지 않는다. 세션 완료(isComplete)는 오직 코치의
// 자연 종료 키워드(Path A) — 즉 코치의 '발화'로만 일어난다. turn_count 자체는 완료
// 신호가 아니다.
// 대신 63턴 이후부터는 매 턴 forceClose 지시를 프롬프트에 주입해, 코치가 §14에 따라
// 스스로 따뜻하게 마무리(§9 키워드)하도록 '강하게 유도'한다(끊는 게 아니라 유도).
// 프롬프트 흐름: 30~35 방향 점검 → 55~62 소프트 넛지 → 63+ 자연 종료 유도.
// 모든 단계는 turn_count가 아니라 🟢 일단락 신호가 보일 때만 발동(§12~14 공통).
const FORCE_CLOSE_FROM = 63;

// LLM의 종료 신호 키워드 — CONTRACT_v2.md §4.1 COACH_CLOSING_KEYWORDS와 정확히 동일
const ENDING_KEYWORDS = [
  '오늘 인터뷰는 여기서',
  '오늘은 여기까지',
  '여기서 마무리할게요',
];

function detectEnding(text: string): boolean {
  return ENDING_KEYWORDS.some((k) => text.includes(k));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { messages, context } = body;

    const userMsgCount = messages.filter((m) => m.role === 'user').length;

    // 상한 직전(63턴~)부터 코치가 §14에 따라 스스로 따뜻하게 닫도록 강제 종료 지시 주입.
    const forceClose = userMsgCount >= FORCE_CLOSE_FROM;

    const system = buildSystemPrompt({
      nickname: context.nickname,
      jobField: context.jobField,
      careerLevel: context.careerLevel,
      mainConcern: context.mainConcern ?? '',
      strengthsKo: context.strengths.map((s) => s.name_ko),
      strengthsEn: context.strengths.map((s) => s.name_en),
      forceClose,
    });

    // 히스토리 캐시 breakpoint: 현재 user 입력 직전 메시지에 cache_control을 달아
    // 이전 누적 대화도 캐시 히트 시키기. 시스템 프롬프트와 함께 TTL 1h 적용.
    const history = messages.map((m, i) => {
      if (i === messages.length - 2 && messages.length >= 2) {
        return {
          role: m.role,
          content: [
            {
              type: 'text' as const,
              text: m.content,
              cache_control: { type: 'ephemeral' as const, ttl: '1h' as const },
            },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,           // 평시 2~3문장 + 🔴 정서 위기 redirect 멘트(다중 줄 + 자원 번호) 여유 포함
      temperature: 0.7,          // 명세 §4.6.A
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: history,
    });

    const text = extractText(message).trim();

    // 완료는 오직 코치의 자연 종료 키워드(Path A)로만. turn_count로 강제 완료하지 않음.
    // 63턴~ forceClose 지시로 코치가 스스로 키워드를 내며 닫는 게 기대 동작.
    const isComplete = detectEnding(text);
    // 관측용: 매우 길어졌는데도 코치가 아직 안 닫은 경우 로그만 남김(완료 강제 아님).
    if (!isComplete && userMsgCount >= FORCE_CLOSE_FROM + 7) {
      console.warn(
        `[career-interview/chat] ${userMsgCount} user turns and still open — coach has not emitted a closing keyword despite forceClose`,
      );
    }

    const response: ChatResponse = {
      content: text,
      isInterviewComplete: isComplete,
    };
    return NextResponse.json(response);
  } catch (e) {
    console.error('[career-interview/chat] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
