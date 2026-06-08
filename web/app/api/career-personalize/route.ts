import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText, parseJSONLoose } from '@/lib/anthropic';
import {
  PERSONALIZE_SYSTEM,
  buildPersonalizeUserPrompt,
} from '@/lib/prompts/career-personalize';
import {
  validatePersonalizedResponse,
  mergePersonalizedSlots,
} from '@/lib/career/personalizeMerge';

export const runtime = 'nodejs';

interface PersonalizeRequestBody {
  userStrengths: Array<{ name_ko: string; name_en: string; domain: string; rank?: number }>;
  userProfile: {
    nickname: string;
    jobField: string;
    careerLevel: string;
    mainConcern: string;
  };
  interviewInsights: unknown;
  aiSummary?: string;
  matchedSlots: Array<{
    slot: number;
    competencyId: string;
    goalTitle: string;
    domain: string;
    badge: string;
    fitLabel: string;
    tags: string[];
    emoji: string;
  }>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PersonalizeRequestBody;
    const { userStrengths, userProfile, interviewInsights, aiSummary, matchedSlots } = body;

    const userPrompt = buildPersonalizeUserPrompt({
      nickname: userProfile.nickname,
      jobField: userProfile.jobField,
      careerLevel: userProfile.careerLevel,
      mainConcern: userProfile.mainConcern,
      strengths: userStrengths.map((s) => ({ name_ko: s.name_ko, domain: s.domain })),
      interviewInsights,
      aiSummary,
      matchedSlots: matchedSlots.map((m) => ({
        slot: m.slot,
        goalTitle: m.goalTitle,
        badge: m.badge,
        domain: m.domain,
      })),
    });

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: 'text', text: PERSONALIZE_SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = extractText(message);
    const parsed = parseJSONLoose<Array<{ slot: number; personalizedText: string }>>(raw);

    validatePersonalizedResponse(parsed, matchedSlots.length);

    // matchedSlots에 personalizedText 머지
    const slots = mergePersonalizedSlots(matchedSlots, parsed);

    return NextResponse.json({ slots });
  } catch (e) {
    console.error('[career-personalize] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
