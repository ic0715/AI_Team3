import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText, parseJSONLoose } from '@/lib/anthropic';
import { STRENGTH_BLOCKS } from '@/lib/constants/strength_blocks';
import {
  ACTIONS_SYSTEM,
  buildActionsUserPrompt,
  type ActionSeedInput,
} from '@/lib/prompts/career-actions';

export const runtime = 'nodejs';

interface ActionsRequestBody {
  userProfile: {
    nickname: string;
    jobField: string;
    careerLevel: string;
    mainConcern: string;
  };
  userStrengths: Array<{ id: string; name_ko: string; name_en: string; domain: string }>;
  interviewInsights: unknown;
  selectedGoal: { goal_title: string; competency_code: string };
  seeds: ActionSeedInput[];
}

interface AIAction {
  sourceSeedId: string;
  title: string;
  description: string;
  tags: string[];
  isAiModified: boolean;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ActionsRequestBody;
    const { userProfile, userStrengths, interviewInsights, selectedGoal, seeds } = body;

    if (!Array.isArray(seeds) || seeds.length === 0) {
      throw new Error('seeds 배열이 비어있음');
    }

    // 모든 시드가 placeholder(title 비어있음)면 "처음부터 생성" 모드
    const isFreshMode = seeds.every((s) => !s.title || s.title.trim() === '');

    // 사용자 Top 5 강점에 해당하는 블록만 추출
    const strengthBlocks: Record<string, string[]> = {};
    for (const s of userStrengths) {
      if (STRENGTH_BLOCKS[s.id]) {
        strengthBlocks[s.id] = STRENGTH_BLOCKS[s.id];
      }
    }

    const baseUserPrompt = buildActionsUserPrompt({
      nickname: userProfile.nickname,
      jobField: userProfile.jobField,
      careerLevel: userProfile.careerLevel,
      mainConcern: userProfile.mainConcern,
      strengthsKo: userStrengths.map((s) => s.name_ko),
      strengthBlocks,
      interviewInsights,
      selectedGoal,
      seeds,
    });

    const userPrompt = isFreshMode
      ? `${baseUserPrompt}

[중요] 위 시드들의 title/description이 비어 있습니다 (해당 역량의 시드 데이터가 아직 준비되지 않음).
"재작성"이 아니라 **처음부터 5개 액션을 생성**해주세요. 다음 조건을 지키세요:
- 5개 모두 ${selectedGoal.goal_title}와 직접 연결된 액션.
- 사용자의 직무·강점·인터뷰 인사이트를 반영.
- 각 액션의 sourceSeedId는 입력 그대로 유지 (1:1 순서 매핑).
- 시간/형식 다양하게 — 30분짜리 짧은 것 1~2개, 1~2시간짜리 깊은 것 1~2개, 매일 습관 1개.
- 모든 액션에 isAiModified: true.`
      : baseUserPrompt;

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        { type: 'text', text: ACTIONS_SYSTEM, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = extractText(message);
    const parsed = parseJSONLoose<AIAction[]>(raw);

    if (!Array.isArray(parsed) || parsed.length !== seeds.length) {
      throw new Error(`LLM이 ${seeds.length}개 액션을 반환하지 않음: ${parsed?.length ?? 0}개`);
    }

    // sourceSeedId 검증 — 입력 시드 ID 집합 내에서만 허용
    // isFreshMode일 때 AI 응답이 매칭 실패하면 fallback할 시드 자체가 비어있음 → 에러로 처리.
    const validIds = new Set(seeds.map((s) => s.sourceSeedId));
    const actions = seeds.map((seed, i) => {
      // 같은 인덱스의 parsed 항목을 우선 시도 (sourceSeedId 매칭 실패 안전망)
      const found =
        parsed.find((p) => p.sourceSeedId === seed.sourceSeedId) ??
        parsed[i];
      if (!found) {
        if (isFreshMode) throw new Error(`슬롯 ${i + 1}: AI가 fresh 액션 생성 실패`);
        // 시드 모드: 원본 그대로 패스
        return {
          sourceSeedId: seed.sourceSeedId,
          title: seed.title,
          description: seed.description,
          tags: seed.tags,
          isAiModified: false,
        };
      }
      // fresh 모드에서는 sourceSeedId를 강제로 원본으로 교정 (LLM이 다른 id 만들었을 경우 대비)
      return {
        sourceSeedId: seed.sourceSeedId,
        title: found.title ?? seed.title,
        description: found.description ?? seed.description,
        tags: Array.isArray(found.tags) && found.tags.length > 0 ? found.tags : seed.tags,
        isAiModified: isFreshMode ? true : !!found.isAiModified,
      };
    });
    void validIds;

    return NextResponse.json({ actions });
  } catch (e) {
    console.error('[career-actions] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
