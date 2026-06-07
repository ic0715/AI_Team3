import { NextResponse } from 'next/server';
import { anthropic, MODEL, extractText, parseJSONLoose } from '@/lib/anthropic';
import { resolveStrengthBlocks } from '@/lib/actionItems/strengthGuide';
import { clamp } from '@/lib/actionItems/clamp';
import { sanitizeCandidates, type GenCandidate } from '@/lib/actionItems/sanitizeCandidates';
import { passedIndexSet, type Verdict } from '@/lib/actionItems/passedVerdicts';
import { ACTION_DISPLAY_COUNT } from '@/lib/constants/seeds';
import {
  ACTIONS_SYSTEM,
  GENERATE_CANDIDATE_COUNT,
  buildGenerateUserPrompt,
  buildValidateUserPrompt,
  buildRewriteUserPrompt,
  type ActionSeedInput,
} from '@/lib/prompts/career-actions';
import {
  sanitizeRewrites,
  buildRewrittenActions,
  type RewrittenAction,
} from '@/lib/actionItems/rewriteFallback';

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
  seedPool?: ActionSeedInput[]; // 부족분 재작성용 검증된 시드 풀(페이지가 전달). 없으면 재작성 생략.
}

// 클라이언트로 내보내는 액션. 생성·게이트 통과분(source_seed_id=null) +
// 부족분 재작성 통과분(source_seed_id=원본 시드 id). 최종 날 풀 폴백은 페이지가 담당.
interface ResponseAction {
  title: string;
  description: string;
  tags: string[];
  strength_link: string | null;
  source_seed_id: string | null; // 생성분 null, 재작성분은 파생 시드 id(추적성)
}

/**
 * C(생성) + 검증 게이트 (+ 부족분 재작성 폴백).
 *  ① 생성: 인터뷰·강점에서 후보 N개 직접 생성(각자 Top5 강점 1개 발휘).
 *  ② 게이트: 별도 콜로 후보별 통과 판정(역량적합·강점연계·ICF·정서위기안전·형식).
 *  ③ 통과분(P)이 ACTION_DISPLAY_COUNT 미만이고 seedPool이 있으면 → 부족분만큼 검증된 시드를
 *     인터뷰·강점 톤으로 재작성(①-b)하고 게이트(②)를 다시 통과시켜 보충. 재작성분엔 원본
 *     시드의 source_seed_id를 부여(추적성 복원). 재작성은 1회만 시도(재시도 캡).
 *  ④ P + 재작성 통과분을 반환(최대 ACTION_DISPLAY_COUNT). 그래도 부족하거나 콜 실패 시
 *     최종 "날 풀 폴백"은 페이지가 담당.
 *
 * 안전 원칙: 모든 노출 액션은 게이트를 통과한다. 생성/게이트 콜·파싱 실패는 throw → 페이지 풀 폴백.
 *   재작성 콜·파싱 실패는 내부에서 흡수(생성 통과분 P는 보존) → 페이지가 부족분만 날 풀로 보충.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ActionsRequestBody;
    const { userProfile, userStrengths, interviewInsights, selectedGoal, seedPool } = body;

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
      max_tokens: 3200,                                       // 한글 후보 8개(=COUNT)가 잘리지 않도록 상향. 상한일 뿐 실제 출력분만 과금.
      system: [{ type: 'text', text: ACTIONS_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildGenerateUserPrompt(genContext) }],
    });
    const candidatesRaw = parseJSONLoose<GenCandidate[]>(extractText(genMsg));

    // 생성 위생: 배열·필수필드·강점연계(Top5 내)만 통과. (강점 연계는 제품 핵심 — 여기서 1차 강제)
    const candidates = sanitizeCandidates(candidatesRaw, strengthSet, GENERATE_CANDIDATE_COUNT);

    if (candidates.length === 0) {
      // 생성이 비었음 → 페이지가 풀 폴백하도록 빈 배열 반환(에러 아님).
      return NextResponse.json({ actions: [] as ResponseAction[] });
    }

    // ── ② 검증 게이트 (같은 system → 프롬프트 캐시 히트) ──────
    const valMsg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1280,                                       // 후보 8개(=COUNT) verdict 배열 여유. verdict는 짧아 영향 작음.
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
    const passed = passedIndexSet(verdicts);

    // ── ③ 생성 통과분(P) 조립 (최대 ACTION_DISPLAY_COUNT) ─────
    const actions: ResponseAction[] = [];
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

    // ── ③-b 부족분 재작성 폴백 (검증된 시드 → 인터뷰·강점 톤 재해석) ──
    // 통과분이 모자라고 시드 풀이 있을 때만. 재작성은 1회 시도(재시도 캡), 실패는 흡수.
    const remaining = ACTION_DISPLAY_COUNT - actions.length;
    if (remaining > 0 && Array.isArray(seedPool) && seedPool.length > 0) {
      try {
        // 게이트 탈락 여유분(+2)을 두되 풀 크기를 넘지 않게. 라우트가 시드를 고른다.
        const toRewrite: ActionSeedInput[] = seedPool.slice(0, remaining + 2);

        const rewriteMsg = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 3200,
          system: [{ type: 'text', text: ACTIONS_SYSTEM, cache_control: { type: 'ephemeral' } }],
          messages: [
            { role: 'user', content: buildRewriteUserPrompt({ ...genContext, seeds: toRewrite }) },
          ],
        });
        const rewriteCands = sanitizeRewrites(
          parseJSONLoose<unknown>(extractText(rewriteMsg)),
          strengthSet,
          toRewrite.length,
        );

        if (rewriteCands.length > 0) {
          // 재작성분도 게이트를 통과해야 노출(생성 경로와 동일한 안전 불변식).
          const rwValMsg = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 1280,
            system: [{ type: 'text', text: ACTIONS_SYSTEM, cache_control: { type: 'ephemeral' } }],
            messages: [
              {
                role: 'user',
                content: buildValidateUserPrompt({
                  candidates: rewriteCands.map((c) => ({
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
          const rwVerdicts = parseJSONLoose<Verdict[]>(extractText(rwValMsg));
          const rewritten: RewrittenAction[] = buildRewrittenActions(
            rewriteCands,
            Array.isArray(rwVerdicts) ? rwVerdicts : [],
            toRewrite,
            remaining,
          );
          actions.push(...rewritten);
        }
      } catch (rewriteErr) {
        // 재작성 실패는 흡수 — 생성 통과분(P)은 보존, 부족분은 페이지가 날 풀로 보충.
        console.error('[career-actions] rewrite fallback failed (생성 통과분은 보존):', rewriteErr);
      }
    }

    // P + 재작성분을 반환. 여전히 ACTION_DISPLAY_COUNT 미만이면 페이지가 날 풀로 최종 보충.
    return NextResponse.json({ actions });
  } catch (e) {
    console.error('[career-actions] error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
