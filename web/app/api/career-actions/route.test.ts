import { describe, it, expect, beforeEach, vi } from 'vitest';

// anthropic 클라이언트만 모킹(2콜: 생성→게이트). extractText/parseJSONLoose는 실제와 동일하게 둔다.
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@/lib/anthropic', () => ({
  anthropic: { messages: { create } },
  MODEL: 'test-model',
  extractText: (m: { content: Array<{ type: string; text?: string }> }) =>
    m.content.find((b) => b.type === 'text')?.text ?? '',
  parseJSONLoose: (raw: string) =>
    JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()),
}));

import { POST } from './route';

const msg = (text: string) => ({ content: [{ type: 'text', text }] });

const BODY = {
  userProfile: { nickname: '지우', jobField: '마케터', careerLevel: 'senior', mainConcern: '사고력' },
  userStrengths: [
    { id: 'analytical', name_ko: '분석', name_en: 'Analytical', domain: 'T' },
    { id: 'strategic', name_ko: '전략', name_en: 'Strategic', domain: 'T' },
  ],
  interviewInsights: { summary: '회의에서 반박이 두렵다' },
  selectedGoal: { goal_title: '비판적 사고 기르기', competency_code: 'T-1' },
};

function callRoute() {
  return POST(
    new Request('http://localhost/api/career-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(BODY),
    }),
  );
}

const cand = (title: string, strength: string) => ({
  title,
  description: `${title} 설명`,
  tags: ['⏱ 30분'],
  strength_link: strength,
  competency_fit: 'fit',
});

beforeEach(() => create.mockReset());

describe('career-actions route (C: 생성+게이트)', () => {
  it('게이트 탈락분은 제외하고 통과분만 반환한다', async () => {
    create
      .mockResolvedValueOnce(msg(JSON.stringify([cand('A', '분석'), cand('B', '전략'), cand('C', '분석')])))
      .mockResolvedValueOnce(
        msg(JSON.stringify([
          { index: 0, pass: true, fail: [] },
          { index: 1, pass: false, fail: ['역량'] },
          { index: 2, pass: true, fail: [] },
        ])),
      );
    const res = await callRoute();
    const { actions } = await res.json();
    expect(actions.map((a: { title: string }) => a.title)).toEqual(['A', 'C']);
    // 생성분은 시드 인용이 아니므로 source_seed_id = null
    for (const a of actions) expect(a.source_seed_id).toBeNull();
  });

  it('강점 연계가 Top5 밖이면 생성 단계에서 폐기된다(게이트 이전)', async () => {
    create
      .mockResolvedValueOnce(msg(JSON.stringify([cand('X', '리더십'), cand('Y', '분석')]))) // 리더십 ∉ Top5
      .mockResolvedValueOnce(msg(JSON.stringify([{ index: 0, pass: true, fail: [] }])));
    const res = await callRoute();
    const { actions } = await res.json();
    expect(actions).toHaveLength(1);
    expect(actions[0].title).toBe('Y');
    expect(actions[0].strength_link).toBe('분석');
  });

  it('생성이 비면 게이트 호출 없이 빈 배열 반환(페이지가 풀 폴백)', async () => {
    create.mockResolvedValueOnce(msg('[]'));
    const res = await callRoute();
    const { actions } = await res.json();
    expect(actions).toEqual([]);
    expect(create).toHaveBeenCalledTimes(1); // 게이트 미호출
  });

  it('게이트 응답 파싱 실패 → 500 (검증 안 된 생성분은 절대 노출 안 함)', async () => {
    create
      .mockResolvedValueOnce(msg(JSON.stringify([cand('A', '분석')])))
      .mockResolvedValueOnce(msg('이건 JSON이 아님'));
    const res = await callRoute();
    expect(res.status).toBe(500);
  });

  it('게이트가 배열이 아닌 JSON(객체)을 줘도 → 500 (fail-closed)', async () => {
    create
      .mockResolvedValueOnce(msg(JSON.stringify([cand('A', '분석')])))
      .mockResolvedValueOnce(msg(JSON.stringify({ pass: true }))); // 배열 아님
    const res = await callRoute();
    expect(res.status).toBe(500);
  });

  it('게이트가 존재하지 않는 index를 통과시켜도 주입되지 않는다(out-of-range)', async () => {
    create
      .mockResolvedValueOnce(msg(JSON.stringify([cand('A', '분석')]))) // 후보 1개(index 0뿐)
      .mockResolvedValueOnce(msg(JSON.stringify([{ index: 5, pass: true }]))); // 없는 index
    const res = await callRoute();
    const { actions } = await res.json();
    expect(actions).toEqual([]);
  });

  it('통과분이 5개를 넘으면 최대 5개로 자른다', async () => {
    const seven = Array.from({ length: 7 }, (_, i) => cand(`A${i}`, i % 2 ? '전략' : '분석'));
    create
      .mockResolvedValueOnce(msg(JSON.stringify(seven)))
      .mockResolvedValueOnce(msg(JSON.stringify(seven.map((_, i) => ({ index: i, pass: true })))));
    const res = await callRoute();
    const { actions } = await res.json();
    expect(actions).toHaveLength(5);
  });

  it('title/description 길이를 클램프한다', async () => {
    const long = { title: 'ㄱ'.repeat(200), description: 'ㄴ'.repeat(300), tags: [], strength_link: '분석' };
    create
      .mockResolvedValueOnce(msg(JSON.stringify([long])))
      .mockResolvedValueOnce(msg(JSON.stringify([{ index: 0, pass: true }])));
    const res = await callRoute();
    const { actions } = await res.json();
    expect(actions[0].title.length).toBeLessThanOrEqual(60);
    expect(actions[0].description.length).toBeLessThanOrEqual(120);
  });
});
