import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { OnboardingData, SummaryCard } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { messages, data } = await req.json() as {
      messages: { role: "ai" | "user"; text: string }[];
      data: OnboardingData;
    };

    const conversationText = messages
      .map((m) => `${m.role === "ai" ? "코치" : "사용자"}: ${m.text}`)
      .join("\n");

    const prompt = `당신은 ICF 커리어 코치입니다. 아래 코칭 대화를 분석하여 사용자의 핵심 고민을 요약해주세요.

## 사용자 기본 정보
- 이름: ${data.name}
- 현재 역할: ${data.currentRole}
- 초기 고민: ${data.concerns}

## 코칭 대화 전문
${conversationText}

## 요청

위 대화에서 사용자가 **직접 사용한 언어와 표현**을 기반으로 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):

{
  "coreIssue": "사용자가 실제로 쓴 언어 기반으로 핵심 고민을 1~2문장으로 요약. AI의 해석이 아닌 사용자의 목소리를 반영.",
  "emotionKeywords": ["대화에서 반복 등장한 감정 단어 또는 욕구 키워드 3~5개"],
  "strengthConnection": "대화에서 사용자가 자신의 강점이나 에너지를 언급한 경우에만 1문장으로 포함. 언급이 없으면 null."
}

중요 원칙:
- coreIssue는 반드시 사용자가 쓴 단어와 표현을 포함해야 합니다.
- emotionKeywords는 사용자가 실제로 쓴 감정 단어를 우선합니다.
- strengthConnection이 없으면 null로 응답하세요 (문자열 "null" 아닌 JSON null).`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON response");

    const raw = JSON.parse(jsonMatch[0]);
    const summary: SummaryCard = {
      coreIssue: raw.coreIssue ?? data.concerns,
      emotionKeywords: Array.isArray(raw.emotionKeywords) ? raw.emotionKeywords : [],
      strengthConnection: raw.strengthConnection ?? undefined,
    };

    return NextResponse.json({ summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
