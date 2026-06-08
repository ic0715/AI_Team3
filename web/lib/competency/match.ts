// Step1: 역량 선택 (코드, AI 미사용) — "기르고 싶은 역량(의도)" 우선, 부족분만 강점으로 보충.
//   의도(growthCodes): 인터뷰에서 추출한 기르고 싶은 역량 코드, 우선순위 순 (0~5).
//     → 우선순위 순서대로 슬롯을 채운다. badge='user_interest', 화면 상단에 먼저 노출.
//   강점 보충(서브): 의도가 슬롯 수(COMPETENCY_DISPLAY_COUNT) 미만일 때만 남은 뒤 슬롯을 채운다.
//     강점 점수가 1순위, 같은 점수 안에서는 "의도 도메인 우선 → 도메인 분산 → 코드순" 타이브레이커.
//     badge='strength_match'. (추천이 늘 앞 슬롯을 먼저 차지하므로 강점 연계는 항상 추천 뒤에 온다.)
//   match_score = 사용자 Top 5 강점 ∩ 역량 연계 강점 5개 (0~5) — 보충 정렬에만 사용.
//   ⚠ 강점은 "무엇을 기를지" 선택에 주도적으로 쓰이지 않는다. 강점 활용은 다음 단계(액션 아이템)의 몫.
//   의도가 0개면 자연히 전부 강점 보충으로 채워진다(안전한 fallback).
import { COMPETENCIES, COMPETENCY_BY_ID, COMPETENCY_DISPLAY_COUNT } from '@/lib/constants/competencies';
import type { Domain } from '@/lib/constants/strengths';

export type BadgeKey = 'strength_match' | 'user_interest' | 'growth_potential';
export type FitLabel = '추천' | '강점 연계 높음' | '성장 잠재력 높음';

export interface UserStrength {
  name_ko: string;
  name_en: string;
  domain: string;
  rank?: number;
}

export interface MatchedSlot {
  slot: number; // 1 ~ COMPETENCY_DISPLAY_COUNT
  competencyId: string;
  goalTitle: string;
  domain: Domain;
  badge: BadgeKey;
  fitLabel: FitLabel;
  tags: string[];
  emoji: string;
}

// 의도 기반 카드 → user_interest('추천'), 강점 보충 카드 → strength_match('강점 연계 높음').
// growth_potential은 과거 로직 잔재(저장된 구 데이터 렌더 호환용)로 남겨둠 — 신규 선택에서는 생성되지 않음.
export const BADGE_TO_FIT: Record<BadgeKey, FitLabel> = {
  strength_match: '강점 연계 높음',
  user_interest: '추천',
  growth_potential: '성장 잠재력 높음',
};

// 슬러그(competencies.ts id) → DB CHECK constraint 코드 매핑
export function getCompetencyCode(id: string): string {
  return COMPETENCY_BY_ID[id]?.code ?? id;
}

export function deterministicMatch(
  userStrengths: UserStrength[],
  growthCodes: string[],
): MatchedSlot[] {
  // 사용자 강점 한글명 set (예: {"화합", "절친", ...})
  const userStrengthNames = new Set(userStrengths.map((s) => s.name_ko));

  // 12역량 각각의 강점 연계 score 계산
  type Scored = {
    competencyId: string;
    code: string;
    goalTitle: string;
    domain: Domain;
    tags: string[];
    emoji: string;
    score: number;
  };
  const scored: Scored[] = COMPETENCIES.map((c) => ({
    competencyId: c.id,
    code: c.code,
    goalTitle: c.title,
    domain: c.domain,
    tags: c.tags,
    emoji: c.emoji,
    score: c.linkedStrengths.filter((name) => userStrengthNames.has(name)).length,
  }));
  const byCode = new Map(scored.map((s) => [s.code, s]));

  // 강점 점수 내림차순, 동점 시 code 사전순 (보충용 사전 정렬)
  const strengthSorted = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.code.localeCompare(b.code);
  });

  const chosen: Array<Scored & { badge: BadgeKey }> = [];
  const chosenCodes = new Set<string>();
  const usedDomains = new Set<Domain>();

  // 1) 의도 우선: growthCodes 우선순위 순으로 채움 (중복·무효 코드는 건너뜀)
  for (const code of growthCodes) {
    if (chosen.length === COMPETENCY_DISPLAY_COUNT) break;
    const item = byCode.get(code);
    if (!item || chosenCodes.has(code)) continue;
    chosen.push({ ...item, badge: 'user_interest' });
    chosenCodes.add(code);
    usedDomains.add(item.domain);
  }

  // 보충 시작 전 "의도 도메인" 스냅샷: 이 시점 chosen은 1)에서 채운 user_interest뿐이므로
  // 그 도메인 집합 = 사용자가 기르고 싶다고 한 의도의 도메인이다.
  // 강점 보충에서 같은 강점 점수 안의 동점 타이브레이커로 쓴다(의도가 0개면 빈 집합 → 무영향).
  const intentDomains = new Set(chosen.map((s) => s.domain));

  // 2) 부족분 강점 보충: 강점 점수가 1순위(= '강점 연계' 배지 신뢰도 보존),
  //    같은 점수 안에서는 (a) 의도 도메인 우선 → (b) 도메인 분산 → (c) 코드 사전순.
  //    추천(user_interest)은 1)에서 이미 앞 슬롯을 차지했고, 여기서는 뒤 슬롯만 채운다.
  //    (0점짜리 다른 도메인 역량이 고점짜리 같은 도메인 역량을 밀어내지 않도록 점수가 먼저)
  while (chosen.length < COMPETENCY_DISPLAY_COUNT) {
    const remaining = strengthSorted.filter((s) => !chosenCodes.has(s.code));
    if (remaining.length === 0) break;
    const topScore = remaining[0].score; // strengthSorted가 점수 내림차순이므로 첫 항목이 최고점
    const topGroup = remaining.filter((s) => s.score === topScore);
    // (a) 의도 도메인과 같은 역량이 같은 점수 안에 있으면 분산보다 먼저 고른다.
    const intentMatch = topGroup.filter((s) => intentDomains.has(s.domain));
    const fresh = topGroup.filter((s) => !usedDomains.has(s.domain));
    // topGroup은 코드 사전순 유지 → 각 후보군의 [0]은 결정적
    const pick = (intentMatch.length > 0 ? intentMatch : fresh.length > 0 ? fresh : topGroup)[0];
    chosen.push({ ...pick, badge: 'strength_match' });
    chosenCodes.add(pick.code);
    usedDomains.add(pick.domain);
  }

  return chosen.map((s, i) => ({
    slot: i + 1,
    competencyId: s.competencyId,
    goalTitle: s.goalTitle,
    domain: s.domain,
    badge: s.badge,
    fitLabel: BADGE_TO_FIT[s.badge],
    tags: s.tags,
    emoji: s.emoji,
  }));
}
