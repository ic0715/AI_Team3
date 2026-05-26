import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText, parseJSONLoose } from '@/lib/anthropic';
import { REFLECT_FINALIZE_SYSTEM, buildFinalizeUserPrompt } from '@/lib/prompts/reflect-coach';
import { clipString } from '@/lib/utils/clip';

export const runtime = 'nodejs';

interface FinalizeRequestBody {
  messages: Array<{ role: 'coach' | 'user'; content: string }>;
  context: {
    nickname: string;
    goal: { goal_title: string; current_week: number; competency_code: string };
    topStrength: string | null;
    doneCountWeek: number;
  };
}

interface FinalizeResponse {
  topic: string;
  pattern_insight: string;
  next_action_title: string;
  next_action_reason: string;
  strength_link: string;
  highlight: string;
  difficulty: string;
  change: string;
  next_action_raw: string;
  user_mentioned_change: boolean;
  ai_summary: string;
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
      goalTitle: context.goal.goal_title,
      currentWeek: context.goal.current_week,
      topStrength: context.topStrength,
      doneCountWeek: context.doneCountWeek,
      transcript,
    });

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0,            // 06 v1.3: 추출은 결정적
      system: [
        // Prompt Caching: 시스템 프롬프트(=06 명세서 전문) 캐시
        { type: 'text', text: REFLECT_FINALIZE_SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = extractText(message);
    if (!raw || raw.trim().length === 0) {
      throw new Error('LLM 응답이 비어있음');
    }

    const parts = raw.split(/\n---SUMMARY---\n/);
    if (parts.length !== 2) {
      console.error('[reflect-coach/finalize] SUMMARY 구분자 누락. raw:', raw);
      throw new Error('LLM 응답에 ---SUMMARY--- 구분자가 정확히 1번 등장하지 않음');
    }
    const [jsonPart, summaryPart] = parts;

    let ext: Record<string, unknown>;
    try {
      ext = parseJSONLoose<Record<string, unknown>>(jsonPart);
    } catch {
      console.error('[reflect-coach/finalize] JSON parse failed. raw:', jsonPart);
      throw new Error('LLM 응답 JSON 파싱 실패');
    }

    const topic = clipString(ext.topic, 15);
    const pattern_insight = clipString(ext.pattern_insight, 240);
    const next_action_title = clipString(ext.next_action_title, 60);
    const next_action_reason = clipString(ext.next_action_reason, 240);
    const strength_link = clipString(ext.strength_link, 30);
    const highlight = clipString(ext.highlight, 200);
    const difficulty = clipString(ext.difficulty, 200);
    const change = clipString(ext.change, 200);
    const next_action_raw = clipString(ext.next_action_raw, 200);
    const user_mentioned_change =
      typeof ext.user_mentioned_change === 'boolean' ? ext.user_mentioned_change : false;

    const result: FinalizeResponse = {
      topic: topic || '이번 주 회고',
      pattern_insight,
      next_action_title: next_action_title || (next_action_raw || `${context.goal.goal_title} — 다음 주 첫 실행`),
      next_action_reason: next_action_reason || pattern_insight,
      strength_link: strength_link || (context.topStrength ?? ''),
      highlight,
      difficulty,
      change,
      next_action_raw,
      user_mentioned_change,
      ai_summary: clipString(summaryPart.trim(), 60) || '회고 코칭이 완료되었습니다.',
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error('[reflect-coach/finalize] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
