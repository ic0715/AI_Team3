import { describe, expect, it } from 'vitest';
import {
  type AiAction,
  type MergeableSeed,
  buildSourceSeedId,
  CODE_TO_SLUG,
  competencyCodeToSlug,
  mergeAiActions,
} from './seedMapping';

describe('competencyCodeToSlug', () => {
  it('T-1 → critical-thinking', () => {
    expect(competencyCodeToSlug('T-1')).toBe('critical-thinking');
  });

  it('E-3 → self-management', () => {
    expect(competencyCodeToSlug('E-3')).toBe('self-management');
  });

  it('R-3 → empathy-comm', () => {
    expect(competencyCodeToSlug('R-3')).toBe('empathy-comm');
  });

  it('매핑에 없는 코드는 그대로 통과 (방어적 fallback)', () => {
    expect(competencyCodeToSlug('X-9')).toBe('X-9');
    expect(competencyCodeToSlug('critical-thinking')).toBe('critical-thinking');
  });

  it('null/undefined/빈 문자열 → 빈 문자열', () => {
    expect(competencyCodeToSlug(null)).toBe('');
    expect(competencyCodeToSlug(undefined)).toBe('');
    expect(competencyCodeToSlug('')).toBe('');
  });

  it('12역량 모두 매핑돼 있음', () => {
    expect(Object.keys(CODE_TO_SLUG)).toHaveLength(12);
    for (const slug of Object.values(CODE_TO_SLUG)) {
      expect(slug.length).toBeGreaterThan(0);
    }
  });
});

describe('buildSourceSeedId', () => {
  it('1-based index — idx 0 → -1', () => {
    expect(buildSourceSeedId('T-1', 'junior', 0)).toBe('T-1-junior-1');
  });

  it('idx 4 → -5 (5번째 시드)', () => {
    expect(buildSourceSeedId('T-1', 'junior', 4)).toBe('T-1-junior-5');
  });

  it('careerLevel 반영', () => {
    expect(buildSourceSeedId('E-2', 'senior', 2)).toBe('E-2-senior-3');
  });

  it('5개 시드 → 고유 키 5개', () => {
    const ids = Array.from({ length: 5 }, (_, i) =>
      buildSourceSeedId('I-1', 'mid', i),
    );
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual([
      'I-1-mid-1',
      'I-1-mid-2',
      'I-1-mid-3',
      'I-1-mid-4',
      'I-1-mid-5',
    ]);
  });
});

describe('mergeAiActions', () => {
  const baseSeeds: Array<MergeableSeed & { id: string }> = [
    {
      id: 'seed-a',
      sourceSeedId: 'T-1-junior-1',
      title: '원본 제목 A',
      description: '원본 설명 A',
      tags: ['원본'],
    },
    {
      id: 'seed-b',
      sourceSeedId: 'T-1-junior-2',
      title: '원본 제목 B',
      description: '원본 설명 B',
      tags: ['원본'],
    },
  ];

  it('aiActions null → baseSeeds 그대로(참조 동일)', () => {
    expect(mergeAiActions(baseSeeds, null)).toBe(baseSeeds);
  });

  it('aiActions undefined → baseSeeds 그대로', () => {
    expect(mergeAiActions(baseSeeds, undefined)).toBe(baseSeeds);
  });

  it('aiActions 빈 배열 → baseSeeds 그대로', () => {
    expect(mergeAiActions(baseSeeds, [])).toBe(baseSeeds);
  });

  it('매칭되는 시드만 title/description/tags 교체', () => {
    const ai: AiAction[] = [
      {
        sourceSeedId: 'T-1-junior-1',
        title: 'AI 제목 A',
        description: 'AI 설명 A',
        tags: ['AI', '개인화'],
      },
    ];
    const merged = mergeAiActions(baseSeeds, ai);
    expect(merged[0]).toEqual({
      id: 'seed-a',
      sourceSeedId: 'T-1-junior-1',
      title: 'AI 제목 A',
      description: 'AI 설명 A',
      tags: ['AI', '개인화'],
    });
    // 매칭 안 된 두 번째는 원본 유지
    expect(merged[1]).toEqual(baseSeeds[1]);
  });

  it('id 등 비-병합 필드는 보존 (화면 key 안정성)', () => {
    const ai: AiAction[] = [
      { sourceSeedId: 'T-1-junior-2', title: 'X', description: 'Y', tags: [] },
    ];
    const merged = mergeAiActions(baseSeeds, ai);
    expect(merged[1].id).toBe('seed-b');
  });

  it('AI에 baseSeeds에 없는 sourceSeedId가 와도 무시 (baseSeeds 길이 유지)', () => {
    const ai: AiAction[] = [
      { sourceSeedId: '존재하지-않음', title: 'X', description: 'Y', tags: [] },
    ];
    const merged = mergeAiActions(baseSeeds, ai);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(baseSeeds[0]);
    expect(merged[1]).toEqual(baseSeeds[1]);
  });

  it('중복 sourceSeedId가 AI에 있으면 첫 번째 매칭 사용 (find 동작)', () => {
    const ai: AiAction[] = [
      { sourceSeedId: 'T-1-junior-1', title: '첫번째', description: 'd1', tags: [] },
      { sourceSeedId: 'T-1-junior-1', title: '두번째', description: 'd2', tags: [] },
    ];
    const merged = mergeAiActions(baseSeeds, ai);
    expect(merged[0].title).toBe('첫번째');
  });

  it('원본 baseSeeds 배열을 변형하지 않음 (불변성)', () => {
    const ai: AiAction[] = [
      { sourceSeedId: 'T-1-junior-1', title: 'AI', description: 'AI', tags: ['x'] },
    ];
    mergeAiActions(baseSeeds, ai);
    expect(baseSeeds[0].title).toBe('원본 제목 A');
    expect(baseSeeds[0].tags).toEqual(['원본']);
  });
});
