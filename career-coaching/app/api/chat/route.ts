import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { OnboardingData } from "@/lib/types";

const MCC_BASE_PROMPT = `# 커리어 코칭 AI 시스템 프롬프트
> ICF 핵심역량 평가표(MCC 기준) 기반

## 역할 정의

당신은 커리어 코칭 앱의 AI 코치입니다.
당신의 역할은 사용자에게 **답을 주는 것이 아니라, 사용자가 스스로 답을 찾도록 돕는 것**입니다.
컨설턴트처럼 해결책을 제시하거나, 상담사처럼 과거의 감정을 파고들지 않습니다.
사용자가 이미 가진 잠재력과 자원을 꺼낼 수 있도록 질문하고, 반영하고, 공간을 만들어 주세요.

## 핵심 원칙 (ICF MCC 기준)

1. **고객 주도**: 사용자가 말한 것에서 출발. AI가 먼저 방향을 정하지 않음.
2. **미래 지향**: "왜 못했나요?"보다 "다음엔 어떻게 해보고 싶으세요?"
3. **열린 질문**: What/How 중심, 한 번에 하나의 질문만, Yes/No 질문 금지.
4. **사용자의 언어 사용**: 사용자가 쓴 단어와 표현을 그대로 반영.
5. **완전한 존재로 대하기**: 사용자는 이미 자신의 답을 갖고 있는 완전한 존재.

## 응답 형식

- **길이**: 짧게. 공감 1문장(선택) + 질문 1문장.
- **절대 금지**: 두 개 이상의 질문, 일방적인 해결책 제시, 과도한 칭찬.
- **어조**: 따뜻하되, 진정성 있는 관심. "정말 잘 하고 계세요!" 금지.

## 경계선

- ✅ 업무, 역할, 목표, 성장, 관계(직장 내), 의사결정, 실행
- ❌ 심리 치료, 정신건강 위기, 재정 조언, 의료 조언

심리적 어려움이 감지되면: "지금 말씀하신 것이 꽤 무겁게 느껴지네요. 전문 상담사와 이야기해보시는 것도 도움이 될 수 있어요."`;

const PHASE_A_INSTRUCTION = `

## 현재 구간: 고민 명료화 (구간 A)

이 구간의 목표는 사용자가 자신의 커리어 고민을 스스로 언어화하도록 돕는 것입니다.

- 사용자가 "고민이 해결됐어요" 버튼을 누를 때까지 대화를 이어갑니다.
- AI가 먼저 고민을 정의하거나 결론 내리지 않습니다.
- 반복되는 단어, 감정, 욕구에 주목하고 이를 되물어 주세요.
- 첫 응답은 "오늘 가장 다루고 싶은 것이 무엇인가요?"로 시작하세요.`;

const PHASE_B_INSTRUCTION = `

## 현재 구간: 액션아이템 도출 (구간 B)

구간 A에서 명료화된 고민을 바탕으로, 사용자가 이번 주 실천할 수 있는 액션아이템 1개를 스스로 도출하도록 돕습니다.

### 이 구간의 원칙

- AI가 먼저 액션아이템을 제안하지 않습니다. 질문으로 탐색을 유도합니다.
- 액션아이템은 반드시 1개로 확정합니다. 복수 제시 금지.
- 이번 주 안에 실천 가능한 수준으로 설계를 돕습니다.
- 실행 방식에 대해 물어볼 때: "사람들과 이야기하면서 아이디어를 얻는 편인가요, 아니면 혼자 생각을 정리하는 게 더 편하세요?" 처럼 자연스럽게 탐색합니다.

### 구간 B 전환 첫 발화

구간 B로 전환될 때 첫 응답은 반드시 다음과 같이 시작하세요:
"고민이 조금 더 선명해지셨군요. 그럼 이제 그 고민을 바탕으로, 이번 한 주 동안 실제로 해볼 수 있는 것 하나를 찾아볼까요?"`;

function buildSystemPrompt(phase: "A" | "B"): string {
  return MCC_BASE_PROMPT + (phase === "A" ? PHASE_A_INSTRUCTION : PHASE_B_INSTRUCTION);
}

function buildContextPreamble(data: OnboardingData): string {
  const parts = [
    `## 사용자 기본 정보`,
    `- 이름: ${data.name}`,
    `- 현재 역할: ${data.currentRole}`,
    `- 현재 고민 (사용자 직접 작성): ${data.concerns}`,
  ];
  if (data.emotions.length > 0) {
    parts.push(`- 현재 감정: ${data.emotions.join(", ")}`);
  }
  if (data.directText) {
    parts.push(`\n## 사용자 직접 입력 자료\n${data.directText}`);
  }
  return parts.join("\n");
}

const MOCK_RESPONSES_A = [
  "오늘 가장 다루고 싶은 것이 무엇인가요?",
  "그렇군요. 그 부분에서 지금 가장 마음에 걸리는 것은 무엇인가요?",
  "그 상황에서 본인이 원하는 것을 한 문장으로 표현한다면 어떻게 될까요?",
  "지금 말씀하신 것 중에 어떤 부분이 가장 중요하게 느껴지세요?",
  "그 경험에서 본인이 발휘한 것이 무엇이었다고 생각하세요?",
  "만약 지금 상황에서 한 가지만 바꿀 수 있다면, 무엇을 바꾸고 싶으세요?",
];

const MOCK_RESPONSES_B = [
  "고민이 조금 더 선명해지셨군요. 그럼 이제 그 고민을 바탕으로, 이번 한 주 동안 실제로 해볼 수 있는 것 하나를 찾아볼까요?",
  "스스로 해보고 싶은 것이 있나요? 어떤 것이 떠오르시나요?",
  "사람들과 이야기하면서 아이디어를 얻는 편인가요, 아니면 혼자 생각을 정리하는 게 더 편하세요?",
  "그 행동을 이번 주 안에 한다면, 구체적으로 언제, 어디서 할 수 있을 것 같으세요?",
  "그 액션아이템이 완료됐을 때 어떤 느낌이 들 것 같으세요?",
];

function getMockResponse(phase: "A" | "B", turnCount: number): string {
  if (phase === "A") {
    const idx = Math.min(turnCount - 1, MOCK_RESPONSES_A.length - 1);
    return MOCK_RESPONSES_A[idx];
  }
  const idx = Math.min(turnCount - 1, MOCK_RESPONSES_B.length - 1);
  return MOCK_RESPONSES_B[idx];
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type GeminiMessage = { role: "user" | "model"; parts: GeminiPart[] };

function buildHistory(
  incomingMessages: { role: "ai" | "user"; text: string }[],
  data: OnboardingData
): { history: GeminiMessage[]; lastUserText: string } {
  const contextText = buildContextPreamble(data);
  const firstUserMsg = incomingMessages[0];

  const firstParts: GeminiPart[] = [{ text: contextText }];
  for (const f of data.files) {
    if (f.content && f.mimeType) {
      firstParts.push({ inlineData: { mimeType: f.mimeType, data: f.content } });
    }
  }
  firstParts.push({ text: firstUserMsg?.text ?? "" });

  if (incomingMessages.length === 1) {
    return {
      history: [],
      lastUserText: contextText + "\n\n" + (firstUserMsg?.text ?? ""),
    };
  }

  const history: GeminiMessage[] = [{ role: "user", parts: firstParts }];
  for (let i = 1; i < incomingMessages.length - 1; i++) {
    const msg = incomingMessages[i];
    history.push({
      role: msg.role === "ai" ? "model" : "user",
      parts: [{ text: msg.text }],
    });
  }

  const lastMsg = incomingMessages[incomingMessages.length - 1];
  return { history, lastUserText: lastMsg.text };
}

export async function POST(req: NextRequest) {
  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const { messages, data, turnCount, phase = "A" } = await req.json() as {
      messages: { role: "ai" | "user"; text: string }[];
      data: OnboardingData;
      turnCount: number;
      phase?: "A" | "B";
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "메시지가 없습니다." }, { status: 400 });
    }

    const { history, lastUserText } = buildHistory(messages, data);

    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: buildSystemPrompt(phase),
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastUserText);
      const reply = result.response.text().trim();

      return NextResponse.json({ reply });
    } catch {
      return NextResponse.json({ reply: getMockResponse(phase, turnCount) });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
