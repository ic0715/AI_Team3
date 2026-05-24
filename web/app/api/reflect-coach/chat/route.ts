import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText } from '@/lib/anthropic';
import { buildChatSystemPrompt, type ReflectChatContext } from '@/lib/prompts/reflect-coach';

export const runtime = 'nodejs';

interface ChatRequestBody {
  // 페이지는 `history`로 보냄. 호환을 위해 둘 다 허용.
  history?: Array<{ role: 'coach' | 'user'; content: string }>;
  messages?: Array<{ role: 'coach' | 'user'; content: string }>;
  context: ReflectChatContext;
  /** @deprecated v1.4: 고정 4-주제 제거로 의미 없음. 페이지 backward-compat 차원에서 받지만 서버 사용 X */
  questionIndex?: number;
  /** @deprecated v1.4: 재협의가 메인 흐름에 통합됨. 페이지 backward-compat 차원에서 받지만 서버 사용 X */
  isRenegotiate?: boolean;
}

interface ChatResponse {
  content: string;
  /** @deprecated v1.4: 항상 입력값 그대로 반환 (페이지가 UI 표시 안 함) */
  nextQuestionIndex: number;
  isComplete: boolean;
}

// v1.4: 턴 가드 재설계
// - SOFT_CAP: 이 턴 수 넘으면 시스템 프롬프트에 "정리 단계로 부드럽게 유도" 힌트 주입.
//   강제 종료 아님. 사용자 의도 존중.
// - HARD_FAILSAFE: 진짜 무한 대화 방지용 안전판. 이 턴 넘으면 코치가 마무리 발화 의무.
const SOFT_CAP = 30;
const HARD_FAILSAFE = 50;

// 06 §5.1 종료 키워드 — 클라이언트와 동일 감지 (v1.4: 단일 모드라 변형 통일)
const ENDING_KEYWORDS = [
  '오늘 코칭은 여기서',
  '오늘은 여기까지',
  '여기서 마무리할게요',
  '여기서 마무리하겠습니다',
];

function detectEnding(text: string): boolean {
  return ENDING_KEYWORDS.some((k) => text.includes(k));
}

/** SOFT_CAP 초과 시 시스템 프롬프트 끝에 추가할 부드러운 마무리 힌트 */
function softWrapHint(userMsgCount: number): string {
  if (userMsgCount < SOFT_CAP) return '';
  if (userMsgCount >= HARD_FAILSAFE) {
    return `

---

# ⏱️ HARD FAILSAFE (${userMsgCount}/${HARD_FAILSAFE}턴)

대화가 매우 길어졌습니다. 지금까지 나눈 이야기에서 가장 명확한 다음 주 액션 1개를
사용자에게 미러링하며 "오늘 코칭은 여기서 마무리하겠습니다" 클로징으로 반드시 종료하세요.
`;
  }
  return `

---

# ⏱️ 정리 단계 부드러운 유도 (${userMsgCount}/${SOFT_CAP}턴)

대화가 충분히 깊어졌어요. 새로운 주제를 추가로 열지 말고, 지금까지 나온 이야기를
바탕으로 다음 주 액션 1개로 사용자가 스스로 수렴하도록 What/How 개방형 질문으로
부드럽게 유도하세요. (강제 종료 아님 — 사용자가 더 탐색하고 싶다고 표현하면 따라가세요.)
`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { context, questionIndex = 1 } = body;
    const messages = body.history ?? body.messages ?? [];

    const userMsgCount = messages.filter((m) => m.role === 'user').length;

    const baseSystem = buildChatSystemPrompt(context, false /* v1.4: isRenegotiate 무시 */);
    const system = baseSystem + softWrapHint(userMsgCount);

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
    const hardFailsafeHit = userMsgCount >= HARD_FAILSAFE;
    const isComplete = llmSignaledEnd || hardFailsafeHit;

    // v1.4: questionIndex 는 페이지 backward-compat. 서버는 변경하지 않고 그대로 반환
    // (페이지가 진행 UI 표시 안 함 — PR #87 에서 progress bar 제거됨).
    const response: ChatResponse = {
      content: text,
      nextQuestionIndex: questionIndex,
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
