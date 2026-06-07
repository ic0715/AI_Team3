// 액션 아이템 — C(생성) 모델: 사용자 인터뷰·강점에서 액션을 "직접 생성"하고,
// 별도 검증 게이트로 통과분만 노출한다. 부족분은 검증된 시드 풀(B+)로 보충(route).
//
// competency_action_map / 05_action_item은 "인용 강제"가 아니라
//   해당 역량의 "핵심 행동의 결"을 잡는 참고 자료로만 system 프롬프트에 둔다.
// system_prompt.md의 ICF 원칙 + 정서위기 가드레일(🔴/🟠/🟡)은 생성·검증 양쪽에 그대로 적용된다.
//
// 생성 콜과 검증 콜은 같은 ACTIONS_SYSTEM(캐시)을 공유한다 → 2번째 콜은 프롬프트 캐시 히트.

import fs from 'node:fs';
import path from 'node:path';
import { ACTION_DISPLAY_COUNT } from '@/lib/constants/seeds';

// 액션 생성·검증 전용 압축 시스템 프롬프트.
// 원본 3개 문서(system_prompt.md + 05_action_item.md + competency_action_map.md)에서
// C 생성 모델에 필요한 부분만 추출·압축한 버전.
// 원본 문서는 그대로 유지됨 — 다른 기능(인터뷰 등)에 영향 없음.
const ACTIONS_SYSTEM_MD = fs.readFileSync(
  path.join(process.cwd(), 'lib', 'prompts', 'career-actions-system.md'),
  'utf8',
);

// 후보 과생성 개수 — 게이트 탈락 여유분 확보(노출은 ACTION_DISPLAY_COUNT개).
// +3: 게이트가 엄격해 탈락이 잦으므로 통과분이 ACTION_DISPLAY_COUNT를 채울 여유를 넉넉히 둔다.
// (그 이상 키우면 생성 출력·게이트 입력이 함께 커져 지연·비용이 악화되므로 +3에서 멈춘다.)
export const GENERATE_CANDIDATE_COUNT = ACTION_DISPLAY_COUNT + 3;

export const ACTIONS_SYSTEM = ACTIONS_SYSTEM_MD;

// route의 풀 폴백/입력 형상(페이지가 보내는 시드 풀).
export interface ActionSeedInput {
  sourceSeedId: string;
  title: string;
  description: string;
  tags: string[];
}

interface GenContext {
  nickname: string;
  jobField: string;
  careerLevel: string;
  mainConcern: string;
  strengthsKo: string[];
  strengthBlocks: Record<string, string[]>; // Top5 강점 id → bullets
  interviewInsights: unknown;
  selectedGoal: { goal_title: string; competency_code: string };
}

function contextBlock(o: GenContext): string {
  const strengthGuide = Object.entries(o.strengthBlocks)
    .map(([id, bullets]) => `[${id}] ${bullets.slice(0, 3).join(' / ')}`)
    .join('\n');
  return `[사용자 컨텍스트]
- 닉네임: ${o.nickname}
- 직무: ${o.jobField} / 경력: ${o.careerLevel}
- Top5 강점: ${o.strengthsKo.join(', ')}
- 커리어 고민: ${o.mainConcern || '(미입력)'}
- 인터뷰 인사이트: ${JSON.stringify(o.interviewInsights, null, 2)}

[강점별 실행 가이드 (강점을 어떤 행동으로 번역할지)]
${strengthGuide}

[선택한 목표 역량]
- ${o.selectedGoal.goal_title} (${o.selectedGoal.competency_code})`;
}

// ── ① 생성 프롬프트 ─────────────────────────────────────────
export function buildGenerateUserPrompt(
  o: GenContext & { count?: number },
): string {
  const count = o.count ?? GENERATE_CANDIDATE_COUNT;
  return `${contextBlock(o)}

위 사용자에게 "${o.selectedGoal.goal_title}" 역량을 기르게 할 **실행 액션 후보 ${count}개**를 생성하라.
미리 정해진 목록에서 고르는 게 아니라, 이 사람의 인터뷰·고민·직무에서 출발해 새로 만든다.

각 액션이 반드시 지킬 것:
1. **강점 연계(필수)**: Top5 강점(${o.strengthsKo.join(', ')}) 중 **정확히 하나**를 발휘하는 행동이어야 한다.
   그 강점을 \`strength_link\`에 적는다. (제품의 핵심 — 강점을 내일의 업무 행동으로 번역)
2. **역량 직결**: "${o.selectedGoal.goal_title}"를 실제로 기르는 행동. 동떨어진 일반 자기계발 금지.
3. **직무 구체화**: ${o.jobField}의 실제 업무 맥락에서 내일 당장 할 수 있는 한 가지 행동.
4. **ICF 준수**: 행동 가능·미래지향. 훈계/지시("~해야 한다")·정답 주입·추상적 다짐 금지.
5. **안전**: 인터뷰에 정서적 위기 신호가 있으면 압박형 과제를 만들지 말 것(위 가드레일 준수).
6. 시간/형식 다양하게(짧은 것·깊은 것·매일 습관 섞어서).

description은 1~2문장, **최대 120자**. title은 한 줄(최대 60자 권장).
JSON 배열로만 응답(${count}개). 마크다운 펜스 금지. 형식:
[
  {
    "title": "...",
    "description": "...",
    "tags": ["⏱ 30분", "..."],
    "strength_link": "<Top5 강점 중 하나의 한글명>"
  }
]`;
}

// ── ①-b 재작성 폴백 프롬프트 ────────────────────────────────
// 생성+게이트 통과분이 ACTION_DISPLAY_COUNT에 못 미칠 때, 부족분을 "날 시드"로 채우는 대신
// 검증된 시드를 출발점으로 인터뷰·강점 톤에 맞게 다시 쓴다(재해석).
//   → 모든 카드의 품질·형식·강점연계가 균질해지고, source_seed_id 추적성도 복원된다(시드에서 파생).
// seed_index로 원본 시드를 가리켜 라우트가 source_seed_id를 안전하게 부여한다(순서 신뢰 안 함).
export function buildRewriteUserPrompt(
  o: GenContext & { seeds: ActionSeedInput[] },
): string {
  const seedList = o.seeds
    .map((s, i) => `#${i} title: ${s.title}\n   description: ${s.description}`)
    .join('\n');
  return `${contextBlock(o)}

아래는 "${o.selectedGoal.goal_title}" 역량의 **검증된 액션 시드 ${o.seeds.length}개**다.
각 시드를 출발점으로, 이 사용자의 인터뷰·강점·직무 맥락에 맞게 **다시 써라**(재해석).
시드의 핵심 의도는 유지하되 표현·예시·강점 연계를 이 사람 맥락으로 바꾼다.

각 재작성이 반드시 지킬 것(생성과 동일):
1. **강점 연계(필수)**: Top5 강점(${o.strengthsKo.join(', ')}) 중 **정확히 하나**를 발휘. 그 강점명을 \`strength_link\`에.
2. **역량 직결**: "${o.selectedGoal.goal_title}"를 실제로 기르는 행동.
3. **직무 구체화**: ${o.jobField}의 실제 업무 맥락에서 내일 할 수 있는 한 가지 행동.
4. **ICF 준수**: 행동 가능·미래지향. 훈계/지시·정답 주입·추상적 다짐 금지.
5. **안전**: 정서 위기 신호가 있으면 압박형 과제 금지(가드레일 준수).

description은 1~2문장 **최대 120자**, title은 한 줄(최대 60자).

[재작성할 시드]
${seedList}

각 시드에 대응하는 재작성 결과를 JSON 배열로만 응답. \`seed_index\`로 원본 시드를 가리켜라.
마크다운 펜스 금지. 형식:
[
  { "seed_index": 0, "title": "...", "description": "...", "tags": ["⏱ 30분"], "strength_link": "<Top5 강점 중 하나>" }
]`;
}

// ── ② 검증 게이트 프롬프트 ──────────────────────────────────
export interface CandidateForReview {
  title: string;
  description: string;
  strength_link: string;
}

export function buildValidateUserPrompt(opts: {
  candidates: CandidateForReview[];
  strengthsKo: string[];
  selectedGoal: { goal_title: string; competency_code: string };
  interviewInsights: unknown;
}): string {
  const { candidates, strengthsKo, selectedGoal, interviewInsights } = opts;
  return `너는 코칭 액션 **검증 게이트**다. 아래 후보 액션들을 한 개씩 심사해 통과/탈락을 판정하라.
관대하게 통과시키지 말 것 — 하나라도 어기면 탈락이다.

[심사 기준 — 모두 충족해야 pass]
- 역량적합: "${selectedGoal.goal_title}"(${selectedGoal.competency_code})를 실제로 기르는 행동인가? (동떨어진 일반 활동이면 탈락)
- 강점연계: \`strength_link\`가 사용자 Top5(${strengthsKo.join(', ')})에 있고, 액션이 그 강점을 **실제로** 활용하는가?
- ICF: 행동 가능·미래지향이며, 훈계/지시형("~해야 한다")·정답 주입·추상적 다짐이 아닌가?
- 안전: 인터뷰의 정서 상태에 비춰 부적절한 압박·위험이 없는가? (위기 신호 시 압박형 과제는 탈락)
- 형식: 내일 실행 가능한 단일 행동이고, title ≤60·description ≤120자인가?

[사용자 인터뷰 인사이트]
${JSON.stringify(interviewInsights, null, 2)}

[심사 대상 후보]
${candidates.map((c, i) =>
  `#${i}
   title: ${c.title}
   description: ${c.description}
   strength_link: ${c.strength_link}`,
).join('\n\n')}

각 후보에 대해 JSON 배열로만 응답. 마크다운 펜스 금지. 형식:
[
  { "index": 0, "pass": true, "fail": [] },
  { "index": 1, "pass": false, "fail": ["역량", "강점"] }
]
(fail 코드: "역량" | "강점" | "ICF" | "안전" | "형식")`;
}
