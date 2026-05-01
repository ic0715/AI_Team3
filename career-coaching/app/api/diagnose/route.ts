import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { OnboardingData } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const data: OnboardingData = await req.json();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `당신은 전문 커리어 코치입니다. 아래 사용자 정보를 바탕으로 깊이 있는 커리어 진단을 JSON 형식으로 제공해주세요.

## 사용자 정보
- 이름: ${data.name}
- 나이: ${data.age}세
- 회사: ${data.company}
- 재직기간: ${data.tenure}
- 현재 역할: ${data.currentRole}
- 현재 고민: ${data.concerns}
- 현재 감정 상태: ${data.emotions.join(", ")}

## 인터뷰 답변
${data.interviewAnswers.map((a, i) => `Q${i + 1}. ${a.question}\nA: ${a.answer}`).join("\n\n")}

## 추가 자료
${data.directText || "(없음)"}

다음 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{
  "summary": "2-3문장의 핵심 진단 요약",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4"],
  "strengths": ["강점1", "강점2", "강점3"],
  "improvements": ["개선점1", "개선점2", "개선점3"],
  "goals": [
    { "period": "1년 후", "description": "목표 설명" },
    { "period": "3년 후", "description": "목표 설명" },
    { "period": "5년 후", "description": "목표 설명" }
  ],
  "competencies": [
    { "name": "의사결정 & 실행력", "current": 27, "target": 80 },
    { "name": "커뮤니케이션 & 영향력", "current": 41, "target": 75 },
    { "name": "리더십 & 팀빌딩", "current": 37, "target": 70 },
    { "name": "도메인 전문성", "current": 57, "target": 85 }
  ]
}

competencies의 current 값은 인터뷰 답변을 분석해 0-100 사이로 추정하고, target은 사용자 목표에 맞게 설정해주세요.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid JSON response");
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
