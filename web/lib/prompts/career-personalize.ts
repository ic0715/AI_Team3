// 09 커리어 방향 결과 — Step2 개인화 텍스트 생성
// docs/ai_prompt/04.competency_analysis.md 풀텍스트 그대로 로드

import fs from 'node:fs';
import path from 'node:path';

const DOCS_DIR = path.join(process.cwd(), '..', 'docs', 'ai_prompt');
const SYSTEM_PROMPT_MD = fs.readFileSync(path.join(DOCS_DIR, 'system_prompt.md'), 'utf8');
const COMPETENCY_ANALYSIS_MD = fs.readFileSync(path.join(DOCS_DIR, '04.competency_analysis.md'), 'utf8');

export const PERSONALIZE_SYSTEM = `${SYSTEM_PROMPT_MD}

---

# 역량 방향 결과 카드 생성 명세 (이 세션 전용)

위의 일반 코칭 원칙을 따르되, 지금은 5개 역량 카드 각각의 추천 메모(personalizedText)를 생성합니다. 아래 명세를 그대로 따르세요.

${COMPETENCY_ANALYSIS_MD}

---

# 출력 형식 (강제)

JSON 배열로만 응답. 다른 설명·서두·코드블록·마크다운 펜스 금지.
형식:
[
  {"slot": 1, "personalizedText": "..."},
  {"slot": 2, "personalizedText": "..."},
  {"slot": 3, "personalizedText": "..."},
  {"slot": 4, "personalizedText": "..."},
  {"slot": 5, "personalizedText": "..."}
]

각 personalizedText는 2~3문장, 80~140자.`;

interface KeyInsights {
  current_satisfaction?: string;
  current_frustration?: string;
  future_vision?: string;
  work_style?: string;
  values?: string[] | string;
  career_concern?: string;
  dream?: string;
}

function formatInsights(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '(인터뷰 인사이트 없음)';
  const ki = raw as KeyInsights;
  const valuesStr = Array.isArray(ki.values)
    ? ki.values.join(', ')
    : (ki.values ?? '');
  const lines = [
    ki.current_satisfaction && `- 일에서 에너지: ${ki.current_satisfaction}`,
    ki.current_frustration && `- 답답한 순간: ${ki.current_frustration}`,
    ki.future_vision && `- 3~5년 비전: ${ki.future_vision}`,
    ki.work_style && `- 일하는 방식: ${ki.work_style}`,
    valuesStr && `- 핵심 가치: ${valuesStr}`,
    ki.career_concern && `- 커리어 고민: ${ki.career_concern}`,
    ki.dream && `- 장기 꿈: ${ki.dream}`,
  ].filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : '(인터뷰 인사이트 비어있음)';
}

export function buildPersonalizeUserPrompt(opts: {
  nickname: string;
  jobField: string;
  careerLevel: string;
  mainConcern: string;
  strengths: Array<{ name_ko: string; domain: string }>;
  interviewInsights: unknown;
  aiSummary?: string;
  matchedSlots: Array<{ slot: number; goalTitle: string; badge: string; domain: string }>;
}): string {
  const { nickname, jobField, careerLevel, mainConcern, strengths, interviewInsights, aiSummary, matchedSlots } = opts;

  const careerLevelLabel = ({
    junior_new: '주니어(신입)',
    junior: '주니어(2~4년차)',
    senior_mid: '미드시니어(5~7년차)',
    senior: '시니어',
  } as Record<string, string>)[careerLevel] ?? careerLevel;

  return `<사용자_프로필>
닉네임: ${nickname}
직무/분야: ${jobField || '(미입력)'}
경력 단계: ${careerLevelLabel}
사전 입력한 커리어 고민: ${mainConcern || '(미입력)'}
</사용자_프로필>

<사용자_Top5_강점>
${strengths.map((s, i) => `${i + 1}위: ${s.name_ko} (${s.domain})`).join('\n')}
</사용자_Top5_강점>

<커리어_인터뷰_요약>
${aiSummary ? `한 줄 요약: ${aiSummary}\n` : ''}${formatInsights(interviewInsights)}
</커리어_인터뷰_요약>

<추천_카드_5장>
${matchedSlots.map(s =>
  `[카드 ${s.slot}] goal="${s.goalTitle}" badge=${s.badge} domain=${s.domain}`
).join('\n')}
</추천_카드_5장>

위 5개 슬롯 각각의 personalizedText를 슬롯 순서대로 작성하세요.`;
}
