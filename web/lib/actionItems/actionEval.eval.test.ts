/**
 * 액션 생성(C: 생성+검증 게이트) 크로스벤더 eval 하니스.
 *
 * 목적: 단위 테스트(모킹)로는 못 잡는 "실제 생성·게이트 품질"을 라이브 호출로 검증한다.
 *   1) 개수       — ACTION_DISPLAY_COUNT 이하(게이트가 엄격하면 더 적을 수 있음 — 부족분은 런타임에 풀이 보충).
 *   2) 강점연계   — 모든 액션의 strength_link가 사용자 Top5 안에 있다(제품 핵심: 강점→행동 번역).
 *   3) source_seed_id — 생성분은 전부 null(시드 인용이 아님).
 *   4) 클램프     — title ≤80, description ≤120.
 *   5) 다양성     — 같은 역량·다른 인터뷰 페르소나는 서로 다른 액션을 받는다(인터뷰 반영).
 *   6) 게이트품질 — (judge 키 있을 때) 생성 액션이 (a)역량을 실제로 기르고 (b)claimed 강점을 발휘하는지
 *                   다른 벤더(OpenAI) judge가 채점. ← 게이트가 통과시킨 것의 실질 품질 검증.
 *
 * 크로스벤더(AGENTS.md §6): 생성·게이트 = Anthropic, judge = OpenAI(≠Anthropic).
 *
 * 실행 (기본 skip — 일반 `npm test`엔 영향 없음):
 *   PowerShell:
 *     $env:RUN_ACTION_EVAL='1'; $env:ANTHROPIC_API_KEY='sk-ant-...'; $env:OPENAI_API_KEY='sk-...'
 *     npx vitest run lib/actionItems/actionEval.eval
 *   ⚠ 실제 API 호출 → 비용 발생(페르소나 3명 × 생성+게이트 2콜 + judge 콜).
 *   ⚠ .env.local의 키를 코드가 읽지 않는다(§4). 위처럼 셸 env로 주입할 것.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ACTION_DISPLAY_COUNT, ACTION_SEEDS_BY_COMPETENCY } from '@/lib/constants/seeds';
import { competencyCodeToSlug } from '@/lib/actionItems/seedMapping';

// ── 풀 유사도(novelty) — 생성물이 기존 시드 풀과 얼마나 겹치나 ──────────
// 글자 bigram Jaccard. judge 키 없이도 "풀스러운가"를 정량화한다.
function bigrams(s: string): Set<string> {
  const t = s.replace(/\s+/g, '');
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}
function maxPoolSimilarity(text: string, code: string): number {
  const items = ACTION_SEEDS_BY_COMPETENCY[competencyCodeToSlug(code)]?.items ?? [];
  if (items.length === 0) return 0;
  const g = bigrams(text);
  return Math.max(...items.map((p) => jaccard(g, bigrams(`${p.title} ${p.description}`))));
}

const RUN = process.env.RUN_ACTION_EVAL === '1';
const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY;
const HAS_JUDGE = !!process.env.OPENAI_API_KEY;

interface Persona {
  name: string;
  competency_code: string;
  goal_title: string;
  careerLevel: string;
  jobField: string;
  strengths: Array<{ id: string; name_ko: string; name_en: string; domain: string }>;
  mainConcern: string;
  interviewInsights: unknown;
}

const PERSONAS: Persona[] = [
  {
    name: '지우(마케터·회의에서 반박 두려움)',
    competency_code: 'T-1',
    goal_title: '비판적 사고 기르기',
    careerLevel: 'senior',
    jobField: '마케터',
    strengths: [
      { id: 'analytical', name_ko: '분석', name_en: 'Analytical', domain: 'T' },
      { id: 'strategic', name_ko: '전략', name_en: 'Strategic', domain: 'T' },
    ],
    mainConcern: 'AI한테 분석을 다 맡기다 보니 사고력이 무뎌지는 느낌',
    interviewInsights: {
      summary: '회의에서 남의 결론을 그대로 수용. 데이터를 보면서도 왜를 안 물음. 팀 의사결정에 기여하고 싶지만 반박이 두렵다.',
    },
  },
  {
    name: '하늘(주니어 개발자·정보 과신)',
    competency_code: 'T-1',
    goal_title: '비판적 사고 기르기',
    careerLevel: 'junior',
    jobField: '백엔드 개발자',
    strengths: [
      { id: 'learner', name_ko: '배움', name_en: 'Learner', domain: 'T' },
      { id: 'input', name_ko: '수집', name_en: 'Input', domain: 'T' },
    ],
    mainConcern: '읽은 자료를 그대로 믿고 옮기는 편이라 내 판단이 없다는 생각',
    interviewInsights: {
      summary: '기술 문서를 많이 읽지만 비판 없이 수용. 사실과 의견을 잘 구분 못 함. 혼자 학습 시간이 많고 회의 발언은 적다.',
    },
  },
  {
    name: '준(PM·실행 지연)',
    competency_code: 'E-1',
    goal_title: '실행력·추진력 기르기',
    careerLevel: 'senior',
    jobField: 'PM',
    strengths: [
      { id: 'activator', name_ko: '행동', name_en: 'Activator', domain: 'I' },
      { id: 'focus', name_ko: '집중', name_en: 'Focus', domain: 'E' },
    ],
    mainConcern: '팀 프로젝트가 자꾸 지연되는데 어디서 막히는지 못 짚음',
    interviewInsights: { summary: '계획은 잘 세우지만 실행 착수가 늦음. 팀 병목을 방치하는 경향.' },
  },
];

type ActionOut = {
  title: string;
  description: string;
  tags: string[];
  strength_link: string | null;
  source_seed_id: string | null;
};

async function callRoute(p: Persona): Promise<ActionOut[]> {
  const { POST } = await import('@/app/api/career-actions/route');
  const body = {
    userProfile: { nickname: p.name, jobField: p.jobField, careerLevel: p.careerLevel, mainConcern: p.mainConcern },
    userStrengths: p.strengths,
    interviewInsights: p.interviewInsights,
    selectedGoal: { goal_title: p.goal_title, competency_code: p.competency_code },
  };
  const res = await POST(
    new Request('http://localhost/api/career-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  if (!res.ok) throw new Error(`route ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { actions: ActionOut[] };
  return data.actions;
}

// 다른 벤더(OpenAI) judge — 생성 액션이 역량을 기르고 claimed 강점을 발휘하는지 1~5 채점.
async function judgeQuality(
  goalTitle: string,
  action: ActionOut,
): Promise<{ competencyFit: number; strengthUse: number; reason: string }> {
  const prompt = `너는 코칭 액션 평가자다. 아래 액션을 두 축으로 1~5 채점하라.
- competencyFit: 이 액션이 "${goalTitle}" 역량을 실제로 기르는가?
- strengthUse: 이 액션이 명시된 강점("${action.strength_link}")을 실제로 발휘하게 하는가?
액션:
- ${action.title}
- ${action.description}
JSON으로만: {"competencyFit": 1~5, "strengthUse": 1~5, "reason": "한 문장"}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`judge ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return JSON.parse(j.choices[0].message.content);
}

describe.runIf(RUN && HAS_ANTHROPIC)('C 액션 생성 eval (live)', () => {
  const results = new Map<string, ActionOut[]>();

  beforeAll(async () => {
    for (const p of PERSONAS) results.set(p.name, await callRoute(p));
  }, 180_000);

  it.each(PERSONAS)('[$name] 개수·강점연계·source_seed_id·클램프', async (p) => {
    const actions = results.get(p.name)!;
    const top5 = new Set(p.strengths.map((s) => s.name_ko));

    expect(actions.length).toBeLessThanOrEqual(ACTION_DISPLAY_COUNT);
    for (const a of actions) {
      expect(a.source_seed_id).toBeNull();                       // 생성분
      expect(a.strength_link && top5.has(a.strength_link)).toBe(true); // 강점 연계(제품 핵심)
      expect(a.title.length).toBeLessThanOrEqual(80);
      expect(a.description.length).toBeLessThanOrEqual(120);
    }
    console.log(`\n[${p.name}] (${actions.length}개):`,
      actions.map((a) => `「${a.strength_link}」 ${a.title}`));
  });

  it('풀 유사도(novelty) — 생성물이 기존 시드 풀과 얼마나 겹치나', () => {
    // 이 테스트의 목적은 측정·출력이다(통과/실패보다 수치를 본다).
    // sim 0=완전 새로움, 1=풀과 동일. 0.6↑ = 풀스러움 의심.
    let sum = 0;
    let n = 0;
    for (const p of PERSONAS) {
      for (const a of results.get(p.name)!) {
        if (a.source_seed_id !== null) continue; // 폴백분(시드)은 제외, 생성분만 측정
        const sim = maxPoolSimilarity(`${a.title} ${a.description}`, p.competency_code);
        const flag = sim >= 0.6 ? '⚠️풀스러움' : sim >= 0.4 ? '~유사' : '✓새로움';
        console.log(`  novelty ${sim.toFixed(2)} ${flag} — ${a.title}`);
        sum += sim;
        n += 1;
      }
    }
    if (n > 0) console.log(`\n생성분 평균 풀 유사도: ${(sum / n).toFixed(2)} (n=${n}, 낮을수록 새로움)`);
    expect(n).toBeGreaterThanOrEqual(0); // 측정 전용(하드 실패 없음)
  });

  it('같은 역량·다른 인터뷰 페르소나는 서로 다른 액션을 받는다(인터뷰 반영)', () => {
    const a = results.get(PERSONAS[0].name)!.map((x) => x.title);
    const b = results.get(PERSONAS[1].name)!.map((x) => x.title);
    const overlap = a.filter((t) => b.includes(t)).length;
    expect(overlap).toBeLessThan(Math.min(a.length, b.length)); // 완전 동일이 아님
  });

  it.runIf(HAS_JUDGE)('게이트 통과분이 역량·강점을 실제로 충족한다(크로스벤더 judge ≥4/5)', async () => {
    let cFit = 0;
    let sUse = 0;
    let n = 0;
    for (const p of PERSONAS) {
      for (const a of results.get(p.name)!) {
        const v = await judgeQuality(p.goal_title, a);
        console.log(`  judge [${a.strength_link}] ${a.title}: 역량 ${v.competencyFit}/5, 강점 ${v.strengthUse}/5 — ${v.reason}`);
        expect(v.competencyFit).toBeGreaterThanOrEqual(3);
        expect(v.strengthUse).toBeGreaterThanOrEqual(3);
        cFit += v.competencyFit;
        sUse += v.strengthUse;
        n += 1;
      }
    }
    console.log(`\n역량적합 평균 ${(cFit / n).toFixed(2)}/5, 강점활용 평균 ${(sUse / n).toFixed(2)}/5 (n=${n})`);
    expect(cFit / n).toBeGreaterThanOrEqual(4);
    expect(sUse / n).toBeGreaterThanOrEqual(4);
  }, 180_000);
});

describe.runIf(RUN && !HAS_ANTHROPIC)('C eval 스킵 안내', () => {
  it('ANTHROPIC_API_KEY 미설정 → eval 스킵', () => {
    console.warn('[eval] ANTHROPIC_API_KEY가 없어 live eval을 건너뜀. 셸 env에 키를 주입할 것.');
    expect(true).toBe(true);
  });
});
