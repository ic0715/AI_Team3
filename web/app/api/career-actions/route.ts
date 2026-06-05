import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText, parseJSONLoose } from '@/lib/anthropic';
import { resolveStrengthBlocks } from '@/lib/actionItems/strengthGuide';
import { ACTION_DISPLAY_COUNT } from '@/lib/constants/seeds';
import {
  ACTIONS_SYSTEM,
  GENERATE_CANDIDATE_COUNT,
  buildGenerateUserPrompt,
  buildValidateUserPrompt,
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
}

// 생성 후보(LLM 출력)
interface GenCandidate {
  title: string;
  description: string;
  tags: string[];
  strength_link: string;
  competency_fit?: string;
}

// 게이트 판정(LLM 출력)
interface Verdict {
  index: number;
  pass: boolean;
  fail?: string[];
}

// 클라이언트로 내보내는 액션 (생성·게이트 통과분). 풀 보충은 페이지가 한다.
interface GeneratedAction {
  title: string;
  description: string;
  tags: string[];
  strength_link: string | null;
  source_seed_id: null; // 생성분은 시드 인용이 아니므로 null
}

const clamp = (s: unknown, max: number): string => {
  const str = typeof s === 'string' ? s : '';
  return str.length > max ? str.slice(0, max).trimEnd() : str;
};

/**
 * C(생성) + 검증 게이트.
 *  ① 생성: 인터뷰·강점에서 후보 N개 직접 생성(각자 Top5 강점 1개 발휘).
 *  ② 게이트: 별도 콜로 후보별 통과 판정(역량적합·강점연계·ICF·정서위기안전·형식).
 *  ③ 통과분만 반환(최대 ACTION_DISPLAY_COUNT). 부족분 보충/전멸 폴백은 페이지(검증된 풀)가 담당.
 *
 * 안전 원칙: 게이트 콜/파싱이 실패하면 통과시키지 않고 throw → 페이지가 풀 폴백.
 * (게이트를 통과하지 못한 생성 액션은 절대 사용자에게 노출되지 않는다.)
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ActionsRequestBody;
    const { userProfile, userStrengths, interviewInsights, selectedGoal } = body;

    const strengthsKo = userStrengths.map((s) => s.name_ko);
    const strengthSet = new Set(strengthsKo);

    // 사용자 Top5 강점 → 강점별 실행 가이드(강점→행동 번역).
    // 저장된 강점엔 id가 없으므로 이름으로 해소(resolveStrengthBlocks). 빈 결과여도 생성은 진행.
    const strengthBlocks = resolveStrengthBlocks(userStrengths);

    const genContext = {
      nickname: userProfile.nickname,
      jobField: userProfile.jobField,
      careerLevel: userProfile.careerLevel,
      mainConcern: userProfile.mainConcern,
      strengthsKo,
      strengthBlocks,
      interviewInsights,
      selectedGoal,
    };

    // ── ① 생성 ──────────────────────────────────────────────
    const genMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [{ type: 'text', text: ACTIONS_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildGenerateUserPrompt(genContext) }],
    });
    const candidatesRaw = parseJSONLoose<GenCandidate[]>(extractText(genMsg));

    // 생성 위생: 배열·필수필드·강점연계(Top5 내)만 통과. (강점 연계는 제품 핵심 — 여기서 1차 강제)
    const candidates = (Array.isArray(candidatesRaw) ? candidatesRaw : [])
      .filter(
        (c): c is GenCandidate =>
          !!c &&
          typeof c.title === 'string' &&
          c.title.trim().length > 0 &&
          typeof c.strength_link === 'string' &&
          strengthSet.has(c.strength_link),
      )
      .slice(0, GENERATE_CANDIDATE_COUNT);

    if (candidates.length === 0) {
      // 생성이 비었음 → 페이지가 풀 폴백하도록 빈 배열 반환(에러 아님).
      return NextResponse.json({ actions: [] as GeneratedAction[] });
    }

    // ── ② 검증 게이트 (같은 system → 프롬프트 캐시 히트) ──────
    const valMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: ACTIONS_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: buildValidateUserPrompt({
            candidates: candidates.map((c) => ({
              title: c.title,
              description: c.description,
              strength_link: c.strength_link,
            })),
            strengthsKo,
            selectedGoal,
            interviewInsights,
          }),
        },
      ],
    });
    // 게이트 파싱 실패는 throw로 흐른다 → catch → 500 → 페이지 풀 폴백(안전).
    const verdicts = parseJSONLoose<Verdict[]>(extractText(valMsg));
    if (!Array.isArray(verdicts)) {
      throw new Error('게이트 응답이 배열이 아님');
    }
    const passed = new Set(
      verdicts.filter((v) => v && v.pass === true && Number.isInteger(v.index)).map((v) => v.index),
    );

    // ── ③ 통과분 조립 (최대 ACTION_DISPLAY_COUNT) ────────────
    const actions: GeneratedAction[] = [];
    for (let i = 0; i < candidates.length; i++) {
      if (!passed.has(i)) continue;
      const c = candidates[i];
      actions.push({
        title: clamp(c.title, 60),
        description: clamp(c.description, 120),
        tags: Array.isArray(c.tags) ? c.tags.slice(0, 4) : [],
        strength_link: strengthSet.has(c.strength_link) ? c.strength_link : null,
        source_seed_id: null,
      });
      if (actions.length >= ACTION_DISPLAY_COUNT) break;
    }

    // 통과분이 ACTION_DISPLAY_COUNT 미만이어도 그대로 반환 — 부족분은 페이지가 검증된 풀로 보충.
    return NextResponse.json({ actions });
  } catch (e) {
    console.error('[career-actions] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
