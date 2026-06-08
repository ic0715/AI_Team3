import { describe, it, expect } from 'vitest';
import { deterministicMatch, getCompetencyCode, type UserStrength } from './match';

// 강점 한글명 배열 → UserStrength[] (domain/name_en은 로직에 무관하므로 더미)
function strengths(...names: string[]): UserStrength[] {
  return names.map((name_ko, i) => ({ name_ko, name_en: '', domain: '', rank: i + 1 }));
}

// 결과를 [code, badge] 튜플 배열로 변환 (슬롯 순서 유지)
function codesAndBadges(result: ReturnType<typeof deterministicMatch>) {
  return result.map((s) => [getCompetencyCode(s.competencyId), s.badge] as const);
}

describe('deterministicMatch — 의도 우선(intent-first) 선택', () => {
  it('§8.1 일반 케이스: 의도 2개가 앞 슬롯, 강점 보충은 같은 점수 내 의도 도메인 우선', () => {
    const top5 = strengths('성취', '분석', '체계', '집중', '전략');
    const result = deterministicMatch(top5, ['T-2', 'I-2']);

    expect(codesAndBadges(result)).toEqual([
      ['T-2', 'user_interest'],  // 의도 1순위 (strategic)
      ['I-2', 'user_interest'],  // 의도 2순위 (influencing) — 강점 0점이어도 의도라 앞 슬롯
      // 마지막 슬롯은 강점 보충 1장. 점수3 동점 {E-3, T-3} 중,
      // 의도 도메인(strategic=T)과 같은 T-3가 새 도메인(E-3)보다 우선.
      ['T-3', 'strength_match'],
    ]);
  });

  it('§8.2 엣지: growth=[] 이면 전 슬롯 strength_match (점수순, 0점대에서 도메인 분산)', () => {
    const top5 = strengths('공감', '화합', '포용', '개별화', '긍정'); // 전부 R 도메인 강점
    const result = deterministicMatch(top5, []);

    expect(codesAndBadges(result)).toEqual([
      ['R-1', 'strength_match'], // 점수4
      ['R-3', 'strength_match'], // 점수4
      ['R-2', 'strength_match'], // 점수3
    ]);
    expect(result.every((s) => s.badge === 'strength_match')).toBe(true);
    expect(result.some((s) => s.badge === 'growth_potential')).toBe(false);
  });

  it('핵심 시나리오: 강점과 무관하게 "기르고 싶다"고 한 역량이 1번 슬롯에 노출된다', () => {
    // 사용자는 공감 강점이 강하지만, 대화에서 "비판적 사고(T-1)"를 기르고 싶다고 함.
    const top5 = strengths('공감', '화합', '포용', '개별화', '긍정');
    const result = deterministicMatch(top5, ['T-1']);

    expect(getCompetencyCode(result[0].competencyId)).toBe('T-1');
    expect(result[0].badge).toBe('user_interest');
    // 공감 강점(R-3 등)이 1번 슬롯을 가로채지 않음 — 의도가 우선.
    expect(getCompetencyCode(result[0].competencyId)).not.toBe('R-3');
  });

  it('강점 보충은 같은 점수 동점일 때 의도 도메인을 도메인 분산보다 우선한다', () => {
    // 의도 T-1(strategic) 1개 → 추천 1장 + 강점 보충 2장.
    // 강점은 전략 도메인에 몰려 있어 점수 동점 그룹에 strategic 후보가 존재.
    const top5 = strengths('분석', '전략', '수집', '지적사고', '회고'); // 모두 strategic 연계
    const result = deterministicMatch(top5, ['T-1']);

    // 1번 슬롯은 항상 추천(의도) — 강점 연계는 그 뒤(서브).
    expect(result[0].badge).toBe('user_interest');
    expect(getCompetencyCode(result[0].competencyId)).toBe('T-1');
    expect(result.slice(1).every((s) => s.badge === 'strength_match')).toBe(true);
    // 강점 보충 슬롯의 도메인이 의도 도메인(strategic)을 반영(분산 규칙에 밀려나지 않음).
    expect(result[1].domain).toBe('strategic');
  });

  it('의도가 슬롯 수 이상이면 전 슬롯 user_interest, 강점 보충 0장 (앞에서부터 채움)', () => {
    const top5 = strengths('성취', '분석', '체계', '집중', '전략');
    const result = deterministicMatch(top5, ['T-1', 'I-1', 'R-1', 'E-2', 'T-3']);

    expect(result.map((s) => s.badge)).toEqual(Array(3).fill('user_interest'));
    // 슬롯 수만큼만 채우므로 우선순위 앞 3개만 노출
    expect(codesAndBadges(result).map(([c]) => c)).toEqual(['T-1', 'I-1', 'R-1']);
  });

  it('중복·무효 코드는 건너뛰고, 슬롯 수보다 많으면 앞에서 슬롯 수만큼만 채운다', () => {
    const top5 = strengths('성취', '분석', '체계', '집중', '전략');
    // T-2 중복, "X-9" 무효 코드 포함, 총 의도 후보 다수
    const result = deterministicMatch(top5, ['T-2', 'T-2', 'X-9', 'I-2', 'R-1', 'E-1', 'T-1']);

    const codes = result.map((s) => getCompetencyCode(s.competencyId));
    expect(result).toHaveLength(3);
    expect(new Set(codes).size).toBe(3);            // 중복 없음
    expect(codes).not.toContain('X-9');              // 무효 코드 제거
    expect(codes).toEqual(['T-2', 'I-2', 'R-1']);    // 우선순위 순, T-2 1회만
    expect(result.every((s) => s.badge === 'user_interest')).toBe(true);
  });

  it('항상 정확히 슬롯 수만큼, slot 인덱스는 1부터 순차', () => {
    const result = deterministicMatch(strengths('성취', '분석', '체계', '집중', '전략'), ['T-2']);
    expect(result.map((s) => s.slot)).toEqual([1, 2, 3]);
  });
});

describe('deterministicMatch — 방어/엣지 (2257a16 회귀 대비)', () => {
  it('강점 배열이 비어 있어도 항상 슬롯 수만큼 (전부 strength_match, 코드 사전순)', () => {
    // 모든 역량 score=0 → topGroup이 12역량 전부 → 도메인 분산 우선, 같은 도메인 내 코드 사전순
    const result = deterministicMatch([], []);
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.badge === 'strength_match')).toBe(true);
    // 슬롯들은 서로 다른 역량
    const codes = result.map((s) => getCompetencyCode(s.competencyId));
    expect(new Set(codes).size).toBe(3);
    // 결정적이어야 함: 같은 입력 → 같은 출력
    const again = deterministicMatch([], []);
    expect(again.map((s) => s.competencyId)).toEqual(result.map((s) => s.competencyId));
  });

  it('0점 strength 보충은 도메인 분산을 우선해 서로 다른 도메인을 커버', () => {
    // 강점 없음 → 전부 0점 → 같은 점수 그룹 내에서 새 도메인 우선
    const result = deterministicMatch([], []);
    const domains = new Set(result.map((s) => s.domain));
    // 슬롯 수만큼 서로 다른 도메인 등장 (3슬롯 → 3도메인)
    expect(domains.size).toBe(3);
  });

  it('핵심 회귀: 최신 인터뷰 growth=["T-1","E-3"]면 강점 fallback(협업 R-1)이 1순위를 가로채지 않는다', () => {
    // 2257a16 버그 재현 방지: 옛 행을 읽으면 growth=[]라 강점 겹침으로 R-1(협업)이 1순위가 됐었음.
    // 최신 행을 읽으면 의도(T-1)가 1순위여야 한다.
    const top5 = strengths('화합', '포용', '개별화', '긍정', '절친'); // R-1(협업) 연계 강점 다수
    const stale = deterministicMatch(top5, []); // 옛 행(growth=[]) → 강점 fallback
    const latest = deterministicMatch(top5, ['T-1', 'E-3']); // 최신 행

    // 옛 행이었다면 1순위가 협업(R-1)
    expect(getCompetencyCode(stale[0].competencyId)).toBe('R-1');
    // 최신 행이면 의도 T-1이 1순위, E-3가 2순위, 둘 다 user_interest
    expect(getCompetencyCode(latest[0].competencyId)).toBe('T-1');
    expect(getCompetencyCode(latest[1].competencyId)).toBe('E-3');
    expect(latest[0].badge).toBe('user_interest');
    expect(latest[1].badge).toBe('user_interest');
    // 협업(R-1)은 의도가 아니라 1순위가 아니다 (강점 보충으로 뒤에 올 수는 있음)
    expect(getCompetencyCode(latest[0].competencyId)).not.toBe('R-1');
  });

  it('growth 코드 대소문자/공백이 정확히 일치하지 않으면 무시되고 강점 보충으로 채워짐', () => {
    // byCode는 정확한 코드("T-1")로만 매칭 → "t-1"/" T-1 "은 무효 취급
    const top5 = strengths('성취', '집중', '체계', '책임', '심사숙고'); // E-3 연계
    const result = deterministicMatch(top5, ['t-1', ' T-1 ', 'E-3']);
    const codes = result.map((s) => getCompetencyCode(s.competencyId));
    // 유효한 의도는 E-3 하나 → 1순위 user_interest
    expect(codes[0]).toBe('E-3');
    expect(result[0].badge).toBe('user_interest');
    // 무효 코드는 등장하지 않고 나머지는 강점 보충
    expect(result.slice(1).every((s) => s.badge === 'strength_match')).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('결과는 항상 서로 다른 역량(중복 코드 없음)이고 fitLabel은 badge와 일치', () => {
    const top5 = strengths('분석', '전략', '수집', '행동', '집중');
    const result = deterministicMatch(top5, ['T-1', 'T-1', 'X-9']); // 중복+무효 의도
    const codes = result.map((s) => getCompetencyCode(s.competencyId));
    expect(new Set(codes).size).toBe(3);
    for (const s of result) {
      if (s.badge === 'user_interest') expect(s.fitLabel).toBe('추천');
      if (s.badge === 'strength_match') expect(s.fitLabel).toBe('강점 연계 높음');
    }
  });
});

describe('getCompetencyCode — 슬러그 → DB 코드 매핑', () => {
  it('알려진 슬러그를 DB CHECK 코드로 변환', () => {
    expect(getCompetencyCode('critical-thinking')).toBe('T-1');
    expect(getCompetencyCode('collaboration')).toBe('R-1');
    expect(getCompetencyCode('self-management')).toBe('E-3');
  });

  it('알 수 없는 슬러그는 입력을 그대로 반환 (방어적 fallback)', () => {
    expect(getCompetencyCode('unknown-slug')).toBe('unknown-slug');
    expect(getCompetencyCode('')).toBe('');
  });

  it('deterministicMatch가 돌려준 competencyId는 항상 유효 코드로 변환된다', () => {
    const result = deterministicMatch(strengths('분석', '전략'), ['T-1']);
    for (const s of result) {
      // 모든 슬롯의 competencyId가 T-1 / R-2 같은 코드 형태로 매핑돼야 INSERT CHECK 통과
      expect(getCompetencyCode(s.competencyId)).toMatch(/^[TIRE]-\d$/);
    }
  });
});
