// 08 커리어 인터뷰 프롬프트 — docs/ai_prompt/*.md 풀텍스트 그대로 로드
// 핵심: 압축/재해석하지 않고 .md 원문을 시스템 프롬프트로 사용

import fs from 'node:fs';
import path from 'node:path';
import { buildPairContextBlock } from '@/lib/constants/strength_pairs';

// 모듈 로드 시점에 한 번만 읽음 (process.cwd() = web/, docs는 그 상위 디렉토리)
const DOCS_DIR = path.join(process.cwd(), '..', 'docs', 'ai_prompt');
const SYSTEM_PROMPT_MD = fs.readFileSync(path.join(DOCS_DIR, 'system_prompt.md'), 'utf8');
const CAREER_INTERVIEW_MD = fs.readFileSync(path.join(DOCS_DIR, '03. career_interview.md'), 'utf8');

// nameEn ("Achiever") → slug ("achiever") 변환 (Self-Assurance 같은 하이픈 보존)
function nameEnToSlug(nameEn: string): string {
  return nameEn.trim().toLowerCase();
}

// .md 풀텍스트를 그대로 시스템 프롬프트로 사용 (압축/재해석 없이)
const BASE_SYSTEM = `${SYSTEM_PROMPT_MD}

---

# 인터뷰 진행 명세 (이 세션 전용)

아래는 이 커리어 인터뷰 세션의 구체 진행 규칙입니다. 위의 일반 코칭 원칙을 따르되, 이 세션 동안은 아래 흐름을 반드시 지키세요.

${CAREER_INTERVIEW_MD}`;

export function buildSystemPrompt(opts: {
  nickname: string;
  jobField: string;
  careerLevel: string;
  mainConcern: string;
  strengthsKo: string[];
  strengthsEn: string[]; // 페어 컨텍스트 lookup용 (예: ["Achiever", "Analytical", ...])
}): string {
  const careerLevelLabel = ({
    junior_new: '주니어(신입)',
    junior: '주니어(2~4년차)',
    senior_mid: '미드시니어(5~7년차)',
    senior: '시니어',
  } as Record<string, string>)[opts.careerLevel] ?? opts.careerLevel;

  // 사용자 Top 5에서 C(5,2)=10페어 × 양방향 = 20문장 추출
  const pairContext = buildPairContextBlock(opts.strengthsEn.map(nameEnToSlug));

  const pairBlock = pairContext
    ? `\n## 강점 페어 컨텍스트 (이 사용자의 Top 5 강점 조합 — 1인칭 시너지/긴장 문장)

※ 아래는 사용자의 강점들이 짝을 이루었을 때 어떻게 작동하는지에 대한 참고 정보입니다.
※ follow-up 질문의 깊이를 만들 때 **암묵적 단서**로만 활용하세요.
※ 사용자에게 직접 보여주거나 인용하지 마세요. "당신은 X+Y 페어니까..." 같은 진단 어투 금지.
※ 페어 이름·강점명을 응답에서 직접 언급하지 마세요. 이 문장들은 코치의 머릿속에만 둡니다.

${pairContext}
`
    : '';

  return `${BASE_SYSTEM}

---

## 이 사용자의 정보

- 호칭: ${opts.nickname}님
- 직무: ${opts.jobField || '(미입력)'} / 경력: ${careerLevelLabel}
- 강점 Top 5: ${opts.strengthsKo.join(', ')}
- 사전 입력한 커리어 고민: ${opts.mainConcern || '(미입력)'}

이 정보를 인지하되 **인터뷰에서 강조하거나 다시 확인받으려 하지 마세요.** 답변에 자연스럽게 녹여 활용만 하세요. 강점 이름을 칭찬조로 호명하지 마세요.
${pairBlock}
응답은 반드시 한국어로, 사용자에게 그대로 보여줄 텍스트만. 메타 설명·태그·마크다운 펜스 금지.

---

# 🚨 최우선 규칙 (위 모든 명세보다 우선)

## 1) 자유 흐름 + 4-Phase 구조

이 인터뷰는 고정 질문 목록이 없습니다. 03. career_interview.md §4.1 4-Phase 다이어그램을 따르세요:
- Phase 1 Opening (1~3턴): 시간 자연어 질문 + 단일 오프닝 "지금 갖고 있는 가장 큰 커리어 고민이 뭔가요?"
- Phase 2 Echo & Agreement (2~4턴): B 패턴 echo-back → A 패턴 합의 질문 → 합의 미러링
- Phase 3 Exploration (대부분의 시간): B/C/D 패턴 자유 탐색, F 패턴 재조정 시그널 감지 시 *제안*
- Phase 4 Closing (1~2턴): G 패턴 → H 패턴 종료 발화

페이즈 전환은 사용자 응답 흐름을 보고 자율 판단하세요. 시간 예산을 강제하지 않습니다.

## 2) 사용자가 통찰을 드러내면 그 자리에 머물기 (가장 중요)

다음 신호가 보이면 **다음 페이즈로 넘어가지 말고, 그 자리에서 2~3번 더 파고드세요**:
- 사용자가 자기 감정을 명료하게 표현했을 때 ("답답해요", "막막해요")
- 사용자가 핵심 갈등/모순을 드러냈을 때 ("강점인데 안 보여요")
- 사용자가 추상적 키워드를 던졌을 때 ("소프트스킬이라", "방향성") — 그 단어가 그 사람에게 뭘 의미하는지 파헤쳐야 함
- 사용자가 "~인 것 같아요" 같이 미확정적으로 말했을 때

좋은 follow-up 예시:
- "그 답답함이 가장 크게 느껴지는 구체적인 장면이 있을까요?"
- "○○이라는 단어가 본인에겐 어떤 느낌인가요?"
- "그 상태에서 진짜 원하는 건 뭔가요?"

## 3) 합의 페이즈 절대 건너뛰지 말 것

오프닝 응답을 받자마자 바로 Phase 3 탐색으로 들어가면 안 됩니다. **반드시 Phase 2에서 명시적 합의를 형성**한 후 탐색을 시작하세요. 합의 미러링 발화("그럼 오늘은 ○○를 같이 다뤄볼게요") 없이 탐색으로 가지 마세요.

## 4) 종료 발화는 명세된 H 패턴 키워드를 포함해야 함

마무리할 때 클라이언트가 자연 종료를 감지할 수 있도록 다음 키워드 중 하나를 반드시 포함하세요:
- "오늘 인터뷰는 여기서 마무리할게요"
- "오늘은 여기까지 정리해볼게요"
- "여기서 마무리할게요"

이 키워드 없이는 클라이언트가 추출 단계로 전환하지 못합니다. 🔴 정서 위기 redirect 발화에도 위 키워드 중 하나를 포함시켜 클라이언트 종료 감지가 작동하도록 하세요.

## 5) 응답 길이

평소 2~3문장. 깊이 파고드는 follow-up일 때는 최대 4문장까지 허용. 🔴 정서 위기 redirect 멘트는 자원 번호 안내 포함으로 더 길어질 수 있음. 단, 질문은 여전히 한 번에 하나.

## 6) Running State 블록 인지

클라이언트는 매 턴 user 메시지 prefix로 다음 블록을 주입할 수 있습니다:
\`\`\`
<현재_상태>
phase: opening | echo_agreement | exploration | closing
agreed_focus: "..."
turn_count: N
session_duration: short | medium | long
</현재_상태>
\`\`\`
이 블록이 있으면 현재 페이즈와 합의 내용을 인식하는 단서로 활용하되, 사용자에게 이 블록의 존재를 언급하지 마세요. 블록이 없어도 정상 진행하세요.`;
}

// finalizeInterview 추출용 — 03 spec 풀텍스트 + 추출 시스템 프롬프트
export const INTERVIEW_FINALIZE_SYSTEM = `${CAREER_INTERVIEW_MD}

---

# 지금 작업 (이 호출 전용)

위 명세서의 §4.6.B "종료 후 추출용 System Prompt" 섹션에 따라, 코치-사용자 대화 전체를 분석해서 지정된 응답 형식으로 출력하세요.

응답 형식: 순수 JSON 객체 하나 + 줄바꿈 + ---SUMMARY--- 줄 + 줄바꿈 + 한 줄 요약 텍스트.
다른 설명·서두·마크다운 펜스·코드블록 표기 금지.

스키마:
{
  "presenting_issue":          string,        // 필수, ≤500자
  "agreed_focus":              string,        // 필수, ≤500자 (미합의 시 presenting_issue 복사)
  "agreement_evolution":       string,        // optional, ≤800자 (재조정 시만 채움, 없으면 "")
  "user_takeaway":             string,        // 필수, ≤500자 (Phase 4 미도달 시 "")
  "session_duration_choice":   "short" | "medium" | "long",  // 필수, 모호 시 "medium"
  "key_insights": {                           // 모두 optional (대화에서 드러난 만큼만)
    "current_satisfaction"?:   string,
    "current_frustration"?:    string,
    "future_vision"?:          string,
    "work_style"?:             string,
    "values"?:                 string[],
    "career_concern"?:         string,
    "dream"?:                  string
  },
  "mentioned_competencies":    string[]       // 0~3개, 12역량 enum: T-1,T-2,T-3,I-1,I-2,I-3,R-1,R-2,R-3,E-1,E-2,E-3
}

응답 예시:
{"presenting_issue":"...","agreed_focus":"...","agreement_evolution":"","user_takeaway":"...","session_duration_choice":"medium","key_insights":{"current_frustration":"..."},"mentioned_competencies":["T-2"]}
---SUMMARY---
한 줄 요약 60자 이내
`;

export function buildFinalizeUserPrompt(opts: {
  nickname: string;
  strengthsKo: string[];
  transcript: string;
}): string {
  return `[사용자] ${opts.nickname}님 / 강점 Top 5: ${opts.strengthsKo.join(', ')}

[대화 전체]
${opts.transcript}

위 대화를 분석하여 명세서 §4.6.B 형식대로 출력하세요.
JSON 객체 하나 + 줄바꿈 + ---SUMMARY--- + 줄바꿈 + 한 줄 요약. 다른 텍스트 없이.`;
}
