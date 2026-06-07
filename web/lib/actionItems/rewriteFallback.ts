/**
 * 재작성 폴백 — LLM 재작성 출력 위생 + 게이트 적용 + source_seed_id 부여 (순수 로직).
 *
 * career-actions route에서 생성+게이트 통과분이 ACTION_DISPLAY_COUNT에 못 미칠 때,
 * 검증된 시드를 인터뷰·강점 톤으로 다시 쓴 결과(buildRewriteUserPrompt 응답)를 처리한다.
 *
 * 두 순수 함수:
 *  - `sanitizeRewrites`     : 재작성 후보의 형식·seed_index·강점연계를 검증/정규화.
 *  - `buildRewrittenActions`: 게이트 verdict를 적용해 통과분만 남기고, seed_index로
 *                             원본 시드의 source_seed_id를 부여(LLM 출력 순서를 신뢰하지 않음).
 *
 * 안전 원칙(생성 경로와 동일한 fail-closed):
 *  - seed_index가 정수이고 시드 범위 안일 때만 통과(범위 밖/비정수 거부).
 *  - strength_link는 normalizeStrengthLink로 Top5 정식명 복원, 실패 시 탈락.
 *  - 게이트 미통과분은 절대 포함하지 않음.
 *  - 재작성분은 "검증된 시드에서 파생"이므로 source_seed_id로 추적 가능(추적성 복원).
 */
import { normalizeStrengthLink } from './strengthLink';
import { passedIndexSet, type Verdict } from './passedVerdicts';
import { clamp } from './clamp';
import type { ActionSeedInput } from '@/lib/prompts/career-actions';

// 재작성 후보(LLM 출력) — seed_index로 원본 시드를 가리킨다.
export interface RewriteCandidate {
  seed_index: number;
  title: string;
  description: string;
  tags: string[];
  strength_link: string; // 정규화된 정식 한글명
}

// 최종 재작성 액션 — 생성분과 같은 응답 형상. source_seed_id로 추적.
export interface RewrittenAction {
  title: string;
  description: string;
  tags: string[];
  strength_link: string | null;
  source_seed_id: string | null;
}

/**
 * 재작성 raw 출력을 위생 필터링한다.
 * @param raw         LLM 파싱 결과(배열 아닐 수 있음 → 방어).
 * @param strengthSet 사용자 Top5 강점(name_ko) 집합.
 * @param seedCount   재작성 대상 시드 개수(seed_index 상한, 미만이어야 함).
 */
export function sanitizeRewrites(
  raw: unknown,
  strengthSet: Set<string>,
  seedCount: number,
): RewriteCandidate[] {
  const out: RewriteCandidate[] = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    if (!Number.isInteger(r.seed_index)) continue;
    const idx = r.seed_index as number;
    if (idx < 0 || idx >= seedCount) continue;
    if (typeof r.title !== 'string' || r.title.trim().length === 0) continue;
    const canonical = normalizeStrengthLink(r.strength_link, strengthSet);
    if (!canonical) continue;
    out.push({
      seed_index: idx,
      title: r.title,
      description: typeof r.description === 'string' ? r.description : '',
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
      strength_link: canonical,
    });
  }
  return out;
}

/**
 * 게이트 verdict를 적용해 통과한 재작성분만 최종 액션으로 조립한다.
 * - verdict의 index는 cands 배열 위치(0..cands.length-1) 기준.
 * - 통과분에 seed_index로 원본 시드의 sourceSeedId를 부여(추적성).
 * - 최대 `remaining`개까지만(부족분 보충 한도).
 * @param cands     sanitizeRewrites 결과.
 * @param verdicts  게이트 판정 배열.
 * @param seeds     재작성 대상 시드(seed_index가 가리키는 원본).
 * @param remaining 채워야 할 부족분 개수.
 */
export function buildRewrittenActions(
  cands: RewriteCandidate[],
  verdicts: Verdict[],
  seeds: ActionSeedInput[],
  remaining: number,
): RewrittenAction[] {
  const passed = passedIndexSet(verdicts);
  const out: RewrittenAction[] = [];
  for (let i = 0; i < cands.length; i++) {
    if (out.length >= remaining) break;
    if (!passed.has(i)) continue;
    const c = cands[i];
    const seed = seeds[c.seed_index];
    out.push({
      title: clamp(c.title, 60),
      description: clamp(c.description, 120),
      tags: c.tags.slice(0, 4),
      strength_link: c.strength_link,
      source_seed_id: seed ? seed.sourceSeedId : null,
    });
  }
  return out;
}
