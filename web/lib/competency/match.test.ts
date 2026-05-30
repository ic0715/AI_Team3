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
  it('§8.1 일반 케이스: 의도 2개가 앞 슬롯, 나머지는 강점 점수순(같은 점수 내 도메인 분산)', () => {
    const top5 = strengths('성취', '분석', '체계', '집중', '전략');
    const result = deterministicMatch(top5, ['T-2', 'I-2']);

    expect(codesAndBadges(result)).toEqual([
      ['T-2', 'user_interest'],  // 의도 1순위
      ['I-2', 'user_interest'],  // 의도 2순위 (강점 0점이어도 의도라 앞 슬롯)
      ['E-3', 'strength_match'], // 점수3, 새 도메인 E
      ['T-3', 'strength_match'], // 점수3 (도메인 T 중복이지만 점수가 우선)
      ['E-1', 'strength_match'], // 점수2
    ]);
  });

  it('§8.2 엣지: growth=[] 이면 5장 전부 strength_match (점수순, 0점대에서 도메인 분산)', () => {
    const top5 = strengths('공감', '화합', '포용', '개별화', '긍정'); // 전부 R 도메인 강점
    const result = deterministicMatch(top5, []);

    expect(codesAndBadges(result)).toEqual([
      ['R-1', 'strength_match'], // 점수4
      ['R-3', 'strength_match'], // 점수4
      ['R-2', 'strength_match'], // 점수3
      ['I-1', 'strength_match'], // 점수1 (긍정이 I-1 연계 강점) → 0점보다 우선
      ['E-1', 'strength_match'], // 점수0, 새 도메인 E
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

  it('의도가 5개면 5장 전부 user_interest, 강점 보충 0장', () => {
    const top5 = strengths('성취', '분석', '체계', '집중', '전략');
    const result = deterministicMatch(top5, ['T-1', 'I-1', 'R-1', 'E-2', 'T-3']);

    expect(result.map((s) => s.badge)).toEqual(Array(5).fill('user_interest'));
    expect(codesAndBadges(result).map(([c]) => c)).toEqual(['T-1', 'I-1', 'R-1', 'E-2', 'T-3']);
  });

  it('중복·무효 코드는 건너뛰고, 6개 이상이면 앞에서 5개만 채운다', () => {
    const top5 = strengths('성취', '분석', '체계', '집중', '전략');
    // T-2 중복, "X-9" 무효 코드 포함, 총 의도 후보 다수
    const result = deterministicMatch(top5, ['T-2', 'T-2', 'X-9', 'I-2', 'R-1', 'E-1', 'T-1']);

    const codes = result.map((s) => getCompetencyCode(s.competencyId));
    expect(result).toHaveLength(5);
    expect(new Set(codes).size).toBe(5);            // 중복 없음
    expect(codes).not.toContain('X-9');              // 무효 코드 제거
    expect(codes.slice(0, 5)).toEqual(['T-2', 'I-2', 'R-1', 'E-1', 'T-1']); // 우선순위 순, T-2 1회만
    expect(result.every((s) => s.badge === 'user_interest')).toBe(true);
  });

  it('항상 정확히 5개 슬롯, slot 인덱스는 1~5', () => {
    const result = deterministicMatch(strengths('성취', '분석', '체계', '집중', '전략'), ['T-2']);
    expect(result.map((s) => s.slot)).toEqual([1, 2, 3, 4, 5]);
  });
});
