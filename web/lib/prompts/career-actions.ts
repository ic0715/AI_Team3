// 10 액션 아이템 — Hybrid 모델 (시드 5개 + 사용자 맥락 → AI 변형)
// docs/ai_prompt/05_action_item.md + competency_action_map.md 풀텍스트 사용

import fs from 'node:fs';
import path from 'node:path';

const DOCS_DIR = path.join(process.cwd(), '..', 'docs', 'ai_prompt');
const SYSTEM_PROMPT_MD = fs.readFileSync(path.join(DOCS_DIR, 'system_prompt.md'), 'utf8');
const ACTION_ITEM_MD = fs.readFileSync(path.join(DOCS_DIR, '05_action_item.md'), 'utf8');
const ACTION_MAP_MD = fs.readFileSync(path.join(DOCS_DIR, 'competency_action_map.md'), 'utf8');

export const ACTIONS_SYSTEM = `${SYSTEM_PROMPT_MD}

---

# 액션 아이템 생성 명세 (이 세션 전용)

위의 일반 코칭 원칙을 따르되, 지금은 시드 5개를 사용자 맥락에 맞춰 다시 쓰는 작업입니다. 아래 명세를 그대로 따르세요.

${ACTION_ITEM_MD}

---

# 12역량 × 연계 강점 매핑 참고

${ACTION_MAP_MD}`;

export interface ActionSeedInput {
  sourceSeedId: string;
  title: string;
  description: string;
  tags: string[];
}

export function buildActionsUserPrompt(opts: {
  nickname: string;
  jobField: string;
  careerLevel: string;
  mainConcern: string;
  strengthsKo: string[];
  strengthBlocks: Record<string, string[]>; // Top 5 강점만 포함된 부분 맵 (id → bullets)
  interviewInsights: unknown;
  selectedGoal: { goal_title: string; competency_code: string };
  seeds: ActionSeedInput[];
}): string {
  const {
    nickname, jobField, careerLevel, mainConcern,
    strengthsKo, strengthBlocks, interviewInsights, selectedGoal, seeds,
  } = opts;

  // 강점별 가이드를 간략하게 (각 강점 bullet 최대 3개만)
  const strengthGuide = Object.entries(strengthBlocks)
    .map(([id, bullets]) => `[${id}] ${bullets.slice(0, 3).join(' / ')}`)
    .join('\n');

  return `[사용자 컨텍스트]
- 닉네임: ${nickname}
- 직무: ${jobField} / 경력: ${careerLevel}
- 강점: ${strengthsKo.join(', ')}
- 커리어 고민: ${mainConcern || '(미입력)'}
- 인터뷰 인사이트: ${JSON.stringify(interviewInsights, null, 2)}

[강점별 실행 가이드 (참고용 — 어떤 톤으로 풀어줄지)]
${strengthGuide}

[선택한 목표]
- ${selectedGoal.goal_title} (${selectedGoal.competency_code})

[베이스 시드 5개 — 이것들을 다시 써]
${seeds.map((s, i) =>
  `${i + 1}. id=${s.sourceSeedId}
   title: ${s.title}
   description: ${s.description}
   tags: [${s.tags.join(', ')}]`
).join('\n\n')}

위 5개 시드를 본 사용자에게 맞춰 재작성. JSON 배열로만 응답 (5개, 입력 순서 유지). 마크다운 펜스 금지.

형식:
[
  {
    "sourceSeedId": "...",
    "title": "...",
    "description": "...",
    "tags": ["...", "...", "..."],
    "isAiModified": true
  },
  ...
]`;
}
