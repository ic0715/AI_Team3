import { describe, expect, it } from 'vitest';
import {
  sanitizeRewrites,
  buildRewrittenActions,
  type RewriteCandidate,
} from './rewriteFallback';
import type { Verdict } from './passedVerdicts';
import type { ActionSeedInput } from '@/lib/prompts/career-actions';

const TOP5 = new Set(['분석', '전략', '공감']);

const rw = (seed_index: number, title: string, strength: string) => ({
  seed_index,
  title,
  description: `${title} 설명`,
  tags: ['⏱ 30분'],
  strength_link: strength,
});

const seeds: ActionSeedInput[] = [
  { sourceSeedId: 'seed-a', title: 'A', description: 'a', tags: [] },
  { sourceSeedId: 'seed-b', title: 'B', description: 'b', tags: [] },
  { sourceSeedId: 'seed-c', title: 'C', description: 'c', tags: [] },
];

describe('sanitizeRewrites', () => {
  it('배열 아님 → []', () => {
    expect(sanitizeRewrites(null, TOP5, 3)).toEqual([]);
    expect(sanitizeRewrites({ seed_index: 0 } as unknown, TOP5, 3)).toEqual([]);
  });

  it('seed_index 비정수/범위 밖 제외', () => {
    const raw = [
      rw(0, 'ok', '분석'),
      { ...rw(1, 'float', '전략'), seed_index: 1.5 },
      rw(3, 'oob', '공감'), // seedCount=3 → index 3 범위 밖
      rw(-1, 'neg', '분석'),
    ];
    const out = sanitizeRewrites(raw, TOP5, 3);
    expect(out.map((c) => c.title)).toEqual(['ok']);
  });

  it('title 공백/비문자열 제외', () => {
    const raw = [rw(0, '   ', '분석'), { ...rw(1, 'x', '전략'), title: 123 }, rw(2, 'good', '공감')];
    const out = sanitizeRewrites(raw, TOP5, 3);
    expect(out.map((c) => c.title)).toEqual(['good']);
  });

  it('strength_link 정규화 — 변형은 정식명으로, Top5 밖은 제외', () => {
    const raw = [rw(0, '변형', '분석적 사고'), rw(1, '영문', 'Empathy'), rw(2, '밖', '리더십')];
    const out = sanitizeRewrites(raw, TOP5, 3);
    expect(out.map((c) => [c.title, c.strength_link])).toEqual([
      ['변형', '분석'],
      ['영문', '공감'],
    ]);
  });

  it('description 비문자열 → 빈 문자열, tags 비배열 방어', () => {
    const raw = [{ seed_index: 0, title: 'x', description: null, tags: 'nope', strength_link: '분석' }];
    const out = sanitizeRewrites(raw, TOP5, 3);
    expect(out[0].description).toBe('');
    expect(out[0].tags).toEqual([]);
  });
});

describe('buildRewrittenActions', () => {
  const cands: RewriteCandidate[] = [
    rw(0, 'A1', '분석'),
    rw(1, 'B1', '전략'),
    rw(2, 'C1', '공감'),
  ];

  it('게이트 통과분만, seed_index로 source_seed_id 부여', () => {
    const verdicts: Verdict[] = [
      { index: 0, pass: true },
      { index: 1, pass: false, fail: ['역량'] },
      { index: 2, pass: true },
    ];
    const out = buildRewrittenActions(cands, verdicts, seeds, 5);
    expect(out.map((a) => [a.title, a.source_seed_id])).toEqual([
      ['A1', 'seed-a'],
      ['C1', 'seed-c'],
    ]);
  });

  it('remaining 한도까지만', () => {
    const verdicts: Verdict[] = [
      { index: 0, pass: true },
      { index: 1, pass: true },
      { index: 2, pass: true },
    ];
    const out = buildRewrittenActions(cands, verdicts, seeds, 2);
    expect(out.map((a) => a.title)).toEqual(['A1', 'B1']);
  });

  it('통과 없음 → []', () => {
    const verdicts: Verdict[] = [{ index: 0, pass: false }, { index: 1, pass: false }];
    expect(buildRewrittenActions(cands, verdicts, seeds, 5)).toEqual([]);
  });

  it('title/description 클램프 적용', () => {
    const long = [rw(0, 'T'.repeat(80), '분석')];
    long[0].description = 'D'.repeat(200);
    const out = buildRewrittenActions(long, [{ index: 0, pass: true }], seeds, 5);
    expect(out[0].title.length).toBe(60);
    expect(out[0].description.length).toBe(120);
  });

  it('seed_index가 가리키는 시드가 없으면 source_seed_id null (방어)', () => {
    const c: RewriteCandidate[] = [rw(2, 'X', '분석')];
    const out = buildRewrittenActions(c, [{ index: 0, pass: true }], seeds.slice(0, 1), 5);
    // seeds에 index 2가 없음 → null
    expect(out[0].source_seed_id).toBeNull();
  });
});
