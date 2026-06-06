import { describe, expect, it } from 'vitest';
import { careerLevelLabel, formatInsights } from './personalizePromptParts';

describe('careerLevelLabel', () => {
  it('알려진 코드 → 한글 라벨', () => {
    expect(careerLevelLabel('junior_new')).toBe('주니어(신입)');
    expect(careerLevelLabel('junior')).toBe('주니어(2~4년차)');
    expect(careerLevelLabel('senior_mid')).toBe('미드시니어(5~7년차)');
    expect(careerLevelLabel('senior')).toBe('시니어');
  });

  it('매핑에 없는 코드는 입력을 그대로 반환', () => {
    expect(careerLevelLabel('lead')).toBe('lead');
    expect(careerLevelLabel('')).toBe('');
  });

  it('이미 한글 라벨이 들어와도 그대로 통과 (이중 변환 없음)', () => {
    expect(careerLevelLabel('시니어')).toBe('시니어');
  });
});

describe('formatInsights', () => {
  describe('방어적 처리', () => {
    it('null → (인터뷰 인사이트 없음)', () => {
      expect(formatInsights(null)).toBe('(인터뷰 인사이트 없음)');
    });

    it('undefined → (인터뷰 인사이트 없음)', () => {
      expect(formatInsights(undefined)).toBe('(인터뷰 인사이트 없음)');
    });

    it('객체가 아닌 값(문자열/숫자) → (인터뷰 인사이트 없음)', () => {
      expect(formatInsights('blah')).toBe('(인터뷰 인사이트 없음)');
      expect(formatInsights(42)).toBe('(인터뷰 인사이트 없음)');
    });

    it('빈 객체 → (인터뷰 인사이트 비어있음)', () => {
      expect(formatInsights({})).toBe('(인터뷰 인사이트 비어있음)');
    });

    it('알려지지 않은 키만 있는 객체 → (인터뷰 인사이트 비어있음)', () => {
      expect(formatInsights({ unrelated: 'x' })).toBe('(인터뷰 인사이트 비어있음)');
    });

    it('모든 값이 빈 문자열이면 → (인터뷰 인사이트 비어있음)', () => {
      expect(
        formatInsights({ current_satisfaction: '', future_vision: '', values: '' }),
      ).toBe('(인터뷰 인사이트 비어있음)');
    });
  });

  describe('정상 포매팅', () => {
    it('단일 필드 → 해당 bullet 한 줄', () => {
      expect(formatInsights({ current_satisfaction: '몰입할 때' })).toBe(
        '- 일에서 에너지: 몰입할 때',
      );
    });

    it('여러 필드 → 정해진 순서대로 줄바꿈 결합', () => {
      const out = formatInsights({
        current_satisfaction: 'A',
        current_frustration: 'B',
        future_vision: 'C',
      });
      expect(out).toBe('- 일에서 에너지: A\n- 답답한 순간: B\n- 3~5년 비전: C');
    });

    it('values가 배열이면 ", "로 join', () => {
      expect(formatInsights({ values: ['성장', '자율', '영향력'] })).toBe(
        '- 핵심 가치: 성장, 자율, 영향력',
      );
    });

    it('values가 문자열이면 그대로', () => {
      expect(formatInsights({ values: '성장' })).toBe('- 핵심 가치: 성장');
    });

    it('values가 빈 배열이면 핵심 가치 줄은 생략', () => {
      // [].join(', ') === '' → falsy → filter로 제거
      expect(formatInsights({ values: [], dream: '창업' })).toBe('- 장기 꿈: 창업');
    });

    it('비어있는 중간 필드는 건너뛰고 채워진 필드만 출력 (순서 보존)', () => {
      const out = formatInsights({
        current_satisfaction: 'A',
        future_vision: 'C',
        career_concern: 'F',
      });
      expect(out).toBe('- 일에서 에너지: A\n- 3~5년 비전: C\n- 커리어 고민: F');
    });

    it('7개 필드 전부 채우면 7줄 (모든 라벨 포함)', () => {
      const out = formatInsights({
        current_satisfaction: 's',
        current_frustration: 'f',
        future_vision: 'v',
        work_style: 'w',
        values: ['x', 'y'],
        career_concern: 'c',
        dream: 'd',
      });
      expect(out.split('\n')).toHaveLength(7);
      expect(out).toContain('- 일하는 방식: w');
      expect(out).toContain('- 핵심 가치: x, y');
      expect(out).toContain('- 장기 꿈: d');
    });
  });
});
