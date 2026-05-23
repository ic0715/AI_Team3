// 13 회고 AI 코칭 프롬프트 — docs/ai_prompt/06_reflect_coaching.md 풀텍스트 그대로 로드
// 핵심: 압축/재해석하지 않고 .md 원문을 시스템 프롬프트로 사용 (career-interview.ts와 동일 패턴)

import fs from 'node:fs';
import path from 'node:path';

const DOCS_DIR = path.join(process.cwd(), '..', 'docs', 'ai_prompt');
const SYSTEM_PROMPT_MD = fs.readFileSync(path.join(DOCS_DIR, 'system_prompt.md'), 'utf8');
const REFLECT_COACHING_MD = fs.readFileSync(path.join(DOCS_DIR, '06_reflect_coaching.md'), 'utf8');

// ─────────────────────────────────────────────────────────────
// 🔴 정서 위기 가드레일 (03 §4.5에서 가져온 안전 블록)
// 회고 중 사용자가 자해/자살/타인 가해 의사를 표현하면 즉시 redirect.
// ─────────────────────────────────────────────────────────────
const EMOTIONAL_CRISIS_GUARD = `
# 🔴 정서 위기 가드레일 (최우선 — 위 모든 명세보다 우선)

다음 키워드가 사용자 발화에 등장하면 회고 코칭을 즉시 중단하고 아래 멘트를 출력하세요.
멘트에는 반드시 "오늘 코칭은 여기서 마무리하겠습니다" 문자열을 포함시켜 클라이언트가 종료를 감지하도록 합니다.

[감지 키워드]
- 자해·자살 직접 언급: "죽고 싶다", "사라지고 싶다", "끝내고 싶다", "이 세상에서 없어졌으면"
- 자해 행동 언급: "스스로 다치게 한다"
- 타인 가해 의사: "누구를 해치고 싶다"

[즉시 redirect 멘트 — 그대로 출력]

지금 말씀해주신 건 제가 다룰 수 있는 영역을 넘어서는 무게가 있어요.
이런 마음은 혼자 견디지 않으셔도 돼요.

지금 바로 연결되는 자원이 있어요:
• 자살예방상담전화 1393 (24시간, 무료)
• 정신건강 위기상담전화 1577-0199 (24시간)

오늘 코칭은 여기서 마무리하겠습니다. 위 번호로 연결해보시는 걸 권하고 싶어요.
괜찮으실 때 다시 만나뵐게요.

[🟠 임상 영역 시그널] — redirect 대상 아니지만 페이스 조절
- "잠을 못 자요", "밥이 안 들어가요", "아무것도 못 하겠어요", "숨이 안 쉬어져요"
- 코칭은 이어가되, "그 무게가 어떤 모습으로 느껴지세요?"처럼 감정을 받아주는 방향으로 한 턴 머무릅니다.

[🟡 강한 감정 표현] — 코칭 계속
- "출근길에 눈물이 나요", "회사 가는 게 무서워요" 등 — B 패턴(echo-back)으로 감정을 받고 그대로 회고 흐름으로 이어갑니다.
`;

// 인터뷰 진행용 시스템 프롬프트 베이스 (06 풀텍스트 + system_prompt + 🔴 가드)
const BASE_SYSTEM = `${SYSTEM_PROMPT_MD}

---

# 회고 코칭 진행 명세 (이 세션 전용)

아래는 이 회고 코칭 세션의 구체 진행 규칙입니다. 위의 일반 코칭 원칙을 따르되, 이 세션 동안은 아래 흐름을 반드시 지키세요.

${REFLECT_COACHING_MD}

---
${EMOTIONAL_CRISIS_GUARD}`;

// ─────────────────────────────────────────────────────────────
// 5.1 회고 코칭 진행용 — 매 턴 호출
// ─────────────────────────────────────────────────────────────

export interface ReflectChatContext {
  nickname: string;
  goal: { goal_title: string; current_week: number; competency_code: string };
  topStrength: string | null;
  weeklyRetro: string;           // 위클리 회고 한 줄 (없으면 빈 문자열)
  doneCountWeek: number;
  actionTitle?: string;          // 이번 주 액션 제목 (있으면)
}

export function buildChatSystemPrompt(ctx: ReflectChatContext, isRenegotiate: boolean): string {
  const sessionContext = `
---

## 이번 세션의 컨텍스트

- 사용자 호칭: ${ctx.nickname}님
- 목표 역량: ${ctx.goal.goal_title} (${ctx.goal.competency_code})
- 현재 주차: ${ctx.goal.current_week} / 12주
- 이번 주 액션: ${ctx.actionTitle ?? '(이번 주 액션 정보 없음)'}
- 이번 주 완료 카운트: ${ctx.doneCountWeek} / 7
- 이번 주 한 줄 회고: ${ctx.weeklyRetro ? `"${ctx.weeklyRetro}"` : '(미작성)'}
- Top 강점: ${ctx.topStrength ?? '(미확인)'}

이 정보를 인지하되 사용자에게 다시 확인받으려 하지 마세요. 답변에 자연스럽게 녹여서만 활용하세요.
"이번 주 X번밖에 못 하셨군요" 같은 평가성 발화 금지.
`;

  const modeBlock = isRenegotiate
    ? `
---

# 🔄 지금 모드: 액션 재협의

방금 다음 주 액션 아이템이 생성됐는데 사용자가 조금 더 이야기하고 싶어합니다.
06 §5.5 재협의 원칙에 따라 사용자 의향을 먼저 끌어내고, 코치가 자연스럽게 마무리 발화를 만듭니다.

- 첫 응답은 "어떤 부분이 다르게 느껴지셨나요?"로 시작합니다.
- 사용자가 새 액션 방향을 구체적으로 표현하거나 원래 액션 수용 의향을 보이면
  "그럼 [재정리한 액션]으로 정리할게요. 다음 주에 잘 해내실 거예요 💪"로 종료 발화를 만드세요.
- **종료 발화에는 반드시 "오늘 코칭은 여기서 마무리하겠습니다" 문자열을 포함시켜** 클라이언트가 종료를 감지하게 합니다.
- 재협의 턴이 3턴을 넘으면 가장 최근 사용자 의향 기준으로 정리하며 종료합니다.
`
    : `
---

# 🔄 지금 모드: 메인 회고 코칭 (4-주제 순차)

06 §5.1 인터뷰 구조에 따라 다음 4개 주제를 순서대로 다룹니다:
1) highlight — 이번 주 가장 인상적이었던 순간
2) difficulty — 가장 어려웠던 점
3) change — 다음 주에 하나만 다르게 해본다면
4) next_action — 다음 주 이어갈 액션 (사용자 의향 먼저)

각 주제마다 echo-back follow-up 1~2회까지 허용. 그 다음 주제로 자연스럽게 전환하세요.
4개 주제를 모두 다뤘다고 판단되면 종료 발화에 **반드시** "오늘 코칭은 여기서 마무리하겠습니다" 문자열을 포함시켜 클라이언트 종료 감지가 작동하게 하세요.
`;

  return `${BASE_SYSTEM}${sessionContext}${modeBlock}

---

응답은 반드시 한국어로, 사용자에게 그대로 보여줄 텍스트만. 메타 설명·태그·마크다운 펜스 금지.
한 응답은 최대 3문장. 한 번에 한 가지만 묻습니다.
`;
}

// ─────────────────────────────────────────────────────────────
// 5.2 종료 후 인사이트 추출 — finalize 단계 1회 호출
// ─────────────────────────────────────────────────────────────

export const REFLECT_FINALIZE_SYSTEM = `${REFLECT_COACHING_MD}

---

# 지금 작업 (이 호출 전용)

위 명세서의 §5.2 "종료 후 인사이트 추출용 System Prompt"에 따라, 코치-사용자 회고 대화 전체를 분석해서 지정된 응답 형식으로 출력하세요.

응답 형식: 순수 JSON 객체 하나 + 줄바꿈 + ---SUMMARY--- 줄 + 줄바꿈 + 한 줄 요약 텍스트.
다른 설명·서두·마크다운 펜스·코드블록 표기 금지.

스키마:
{
  "highlight":             string,    // 사용자가 말한 이번 주 인상 깊은 순간 (≤200자)
  "difficulty":            string,    // 사용자가 말한 어려웠던 점 (≤200자)
  "change":                string,    // 다음 주 다르게 해볼 것 (≤200자)
  "next_action_raw":       string,    // 사용자가 직접 언급한 다음 주 액션 표현 (없으면 "")
  "topic":                 string,    // 이번 회고의 핵심 주제 (≤15자)
  "pattern_insight":       string,    // 반복 패턴 (추론이 약하면 "")
  "next_action_title":     string,    // 다음 주 액션 제목 (8~60자, 행동 동사로 끝)
  "next_action_reason":    string,    // 그 액션을 권하는 이유 1~2문장 (≤240자)
  "strength_link":         string,    // 작동한 사용자 강점명 (예: "집중", "공감")
  "user_mentioned_change": boolean    // 역량/목표 변경을 직접 언급한 경우만 true
}

[추출 원칙]
- next_action_raw: 사용자가 직접 표현한 그대로. 없으면 빈 문자열.
- next_action_title: 사용자 표현(next_action_raw)을 자연스러운 액션 제목으로 다듬되 의미를 왜곡하지 않음.
  사용자가 액션을 언급하지 않았으면 이번 주 시드/패턴을 바탕으로 합리적으로 합성.
- topic: 15자 이내, 명사형. 평가어 금지.
- pattern_insight: 반복 패턴이 약하면 "" 출력. 추측 금지.
- strength_link: 대화에서 코치가 언급한 강점 또는 사용자가 보인 강점. 없으면 "".
- user_mentioned_change: 사용자가 "역량을 바꿔야겠다" 류로 직접 말한 경우만 true.

[fallback]
- 대화가 비어있거나 회고 내용이 거의 없으면 모든 string 필드를 "" 출력 (클라이언트가 fallback 처리).

[ai_summary 별도 출력]
JSON 출력 직후 다음 줄에 단 한 줄짜리 종합 요약을 출력합니다.

---SUMMARY---
{한 문장으로 이번 회고의 핵심을 요약. 40자 이내.}
`;

export function buildFinalizeUserPrompt(opts: {
  nickname: string;
  goalTitle: string;
  currentWeek: number;
  topStrength: string | null;
  doneCountWeek: number;
  transcript: string;
}): string {
  return `# 회고 코칭 컨텍스트

- 사용자: ${opts.nickname}님
- 목표 역량: ${opts.goalTitle}
- 회고 주차: W${opts.currentWeek}
- 이번 주 완료 카운트: ${opts.doneCountWeek}/7
- Top 강점: ${opts.topStrength ?? '(미확인)'}

# 입력 대화 (회고 코칭 트랜스크립트)

${opts.transcript}

---

위 대화를 분석해서 시스템 프롬프트에 명시된 응답 형식(JSON + ---SUMMARY--- + 요약)으로만 출력하세요.`;
}
