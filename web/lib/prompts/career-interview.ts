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

## 1) follow-up 최소 2회 — 한 주제에 머물기

각 메인 주제(6개)에 대해 사용자에게 **최소 2회의 follow-up**을 던진 후에만 다음 주제로 넘어가세요. 단순히 echo-back 후 다음 질문 던지는 건 follow-up 1회입니다. **echo-back + 다음 주제 = 진행이 너무 빠른 것**. 최소 한 번 더 깊이 파고든 후에 넘어가세요.

## 2) 사용자가 통찰을 드러내면 그 자리에 머물기 (가장 중요)

다음 신호가 보이면 **절대 다음 주제로 넘어가지 말고, 그 자리에서 추가로 2~3번 더 파고드세요**:

- 사용자가 자기 감정을 명료하게 표현했을 때 ("답답해요", "막막해요", "그게 가장 힘들어요")
- 사용자가 핵심 갈등/모순을 드러냈을 때 ("강점인데 안 보여요", "원하는데 못해요")
- 사용자가 추상적 키워드를 던졌을 때 ("소프트스킬이라", "주특기", "방향성") — 그 단어가 그 사람에게 뭘 의미하는지 파헤쳐야 함
- 사용자가 "~인 것 같아요" 같이 미확정적으로 말했을 때 — 더 또렷이 만들 수 있도록 도와야 함

이런 순간에 echo-back 후 바로 다음 주제로 가면 **인터뷰는 망친 겁니다.** 진짜 통찰이 나오는 곳에서 멈춰서 더 깊이 들어가세요.

좋은 follow-up 예시:
- "그 답답함이 가장 크게 느껴지는 구체적인 장면이 있을까요?"
- "○○이라는 단어가 본인에겐 어떤 느낌인가요?"
- "그 상태에서 진짜 원하는 건 뭔가요?"
- "그게 해결된다면, 일이 어떻게 달라질 것 같아요?"

나쁜 follow-up (피하기):
- 단순 echo-back만 하고 바로 다음 주제 질문 던지기
- "그렇군요" 같은 빈 리액션 후 진행

## 3) 6개 주제 완수보다 깊이가 우선

6개 주제 모두 다루지 못하더라도 괜찮습니다. 한 주제에서 사용자가 진짜 자기 이야기를 했다면 그게 인터뷰의 성공입니다. 시간이 부족하면 finalize 단계에서 빈 키는 빈 문자열로 처리됩니다.

## 4) 응답 길이

깊이 파고드는 follow-up일 때는 최대 4문장까지 허용. 너무 짧게 끊지 말고, 사용자가 답하기 좋게 맥락을 짚어주세요. 단 질문은 여전히 한 번에 하나.`;
}

// finalizeInterview 추출용 — 03 spec 풀텍스트 + 추출 시스템 프롬프트
export const INTERVIEW_FINALIZE_SYSTEM = `${CAREER_INTERVIEW_MD}

---

# 지금 작업 (이 호출 전용)

위 명세서의 §4.2.B "종료 후 추출용 System Prompt" 섹션에 따라, 코치-사용자 대화 전체를 분석해서 지정된 JSON 스키마로만 응답하세요.

순수 JSON 객체 하나만 출력. 다른 설명·서두·코드블록·마크다운 펜스 금지.

스키마:
{
  "key_insights": {
    "current_satisfaction": string (1~2문장, 0~400자),
    "current_frustration": string (1~2문장, 0~400자),
    "future_vision": string (1~2문장, 0~400자),
    "work_style": string (1~2문장, 0~400자),
    "values": string[] (0~5개),
    "career_concern": string (1~2문장, 0~400자),
    "dream": string (0~400자, 없으면 ""),
    "mentioned_competencies": string[] (0~3개, 12역량 코드 enum: T-1,T-2,T-3,I-1,I-2,I-3,R-1,R-2,R-3,E-1,E-2,E-3)
  },
  "ai_summary": string (60자 이내, 한 문장 종합 요약)
}`;

export function buildFinalizeUserPrompt(opts: {
  nickname: string;
  strengthsKo: string[];
  transcript: string;
}): string {
  return `[사용자] ${opts.nickname}님 / 강점 Top 5: ${opts.strengthsKo.join(', ')}

[대화 전체]
${opts.transcript}

위 대화를 분석하여 명세서 §4.2.B 스키마대로 JSON으로 출력하세요. JSON만, 다른 텍스트 없이.`;
}
