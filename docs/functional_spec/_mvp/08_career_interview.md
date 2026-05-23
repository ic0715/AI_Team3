# 08. 커리어 인터뷰 (AI 채팅 v2)

> 강점 결과를 컨텍스트로 받은 AI 코치와 **자유 흐름**으로 대화하며 커리어 고민과 방향을 탐색.
> 고정 질문 목록 없음. 4-Phase(Opening → Echo & Agreement → Exploration → Closing) 자율 진행.
>
> 기준 문서: `docs/CAREER_INTERVIEW_V2_DECISIONS.md` / DB 스키마: `docs/schema/spec-schema.md` v0.9

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 08_career_interview |
| 페이즈 | DIRECTION |
| 역할 | AI 인터뷰 v2로 커리어 방향 데이터 수집 |
| 이전 화면 | 07 커리어 인터뷰 인트로 |
| 다음 화면 | 09 커리어 방향 결과 (Path A/B), Path C 시 자원 안내 후 종료 |

---

## 2. 진입 조건

- 07에서 "시작하기" 클릭
- 또는 sessionStorage에 진행 중인 대화가 남아 있고 이어하기 선택 (브라우저 내에서만 복원 가능)

---

## 3. UI 구성

### 3.1 인터뷰 시작 — 시간 선택 (Phase 1 Opening) `v0.9 신규`

> 본 단계에서 `career_interview_results.session_duration_choice` (schema v0.9 신규 컬럼, NOT NULL DEFAULT 'medium')가 결정됨.

코치의 자연어 질문으로 사용자 가용 시간 수집:

- 코치 첫 발화 예시: **"오늘 시간은 어느 정도 가능해요?"**
- 사용자 응답 텍스트에서 `classifySessionDuration()` 함수로 추출:

| 키워드 패턴 | 분류 | 시간 범위 |
| --- | --- | --- |
| "15분", "20분", "짧게", "급해" | `short` | 15~25분 |
| "30분", "40분", "보통" | `medium` | 30~45분 |
| "1시간", "충분히", "시간 많" | `long` | 50분+ |
| 모호 / 미언급 | `medium` (기본값) | 30~45분 |

- 추출 결과는 **Running State 블록의 `session_duration`으로 매 턴 주입**되어 AI 컨텍스트로 활용 (4.3 참조)
- finalize 시점 DB 저장: `career_interview_results.session_duration_choice` (코드 구현: `web/app/api/career-interview/finalize/route.ts`)

시간 선택 후 단일 오프닝 질문으로 이어짐:
- **"지금 갖고 있는 가장 큰 커리어 고민이 뭔가요?"**

### 3.2 4-Phase 흐름 (자유 흐름) `v2 핵심`

> 고정 질문 목록 없음. AI가 사용자 응답 흐름을 보고 자율 판단으로 페이즈 전환.

| Phase | 역할 | 턴 범위 | 주요 활동 |
| --- | --- | --- | --- |
| Phase 1 Opening | 시간 + 첫 질문 | 1~3턴 | 시간 자연어 질문 + 단일 오프닝 "지금 갖고 있는 가장 큰 커리어 고민이 뭔가요?" |
| Phase 2 Echo & Agreement | 합의 형성 | 2~4턴 | B 패턴 echo-back → A 패턴 합의 질문 → 합의 미러링 발화 ("그럼 오늘은 ○○를 같이 다뤄볼게요") |
| Phase 3 Exploration | 자유 탐색 | 대부분의 시간 | B/C/D 패턴 follow-up. 사용자가 통찰을 드러내면 그 자리에서 2~3번 더 파고듦. F 패턴 재조정 감지 시 *제안* |
| Phase 4 Closing | 마무리 | 1~2턴 | G 패턴 마무리 직전 질문 ("오늘 어떤 게 손에 잡혀요?" 등) → H 패턴 종료 발화 |

- 페이즈 전환은 AI 자율 판단 (시간 예산 강제 X)
- 클라이언트는 `inferPhase()` 함수로 코치 응답에서 페이즈 전환 추론 (`web/lib/constants/career-interview.ts`)

### 3.3 진행률 표시

- 4-Phase 기반 단순 인디케이터 (Phase X/4)
- ~~"Q3 / 6 + Progress Bar"~~ **v1 코어 질문 기반 표시는 v2에서 폐기**
- follow-up은 카운트 무의미 (자유 흐름)

### 3.4 Running State 블록 (`<현재_상태>` prefix) `v2 신규`

매 턴 사용자 메시지의 prefix로 다음 블록을 자동 주입 (`buildRunningStatePrefix()` 함수):

```
<현재_상태>
phase: opening | echo_agreement | exploration | closing
agreed_focus: "..."
turn_count: N
session_duration: short | medium | long
</현재_상태>
```

- AI가 이 블록으로 현재 페이즈와 합의 내용을 인지 (단서로만 활용)
- 사용자에게는 표시되지 않음 (`displayContent` 필드로 원본 분리)
- 블록이 없어도 AI는 정상 진행 (방어적 설계)

### 3.5 종료 분기 — Path A / B / C `v0.9 핵심 신규`

종료 감지는 3가지 경로로 분기되며, **클라이언트가 텍스트 매칭으로 감지**.

#### Path A — 코치 자연 종료 (정상 흐름)

코치의 H 패턴 종료 발화에 다음 키워드 중 하나 포함:
- "오늘 인터뷰는 여기서 마무리할게요"
- "오늘은 여기까지 정리해볼게요"
- "여기서 마무리할게요"

→ `detectCoachClosing()` 감지 → 입력창 disable + finalize API 호출 → 추출 결과를 `career_interview_results` INSERT → 09로 이동

#### Path B — 사용자 주도 종료

사용자 메시지에 다음 키워드 중 하나 포함:
- "여기까지 할게요"
- "그만하고 싶어요"
- "이제 됐어요"
- "오늘은 여기까지"

→ `detectUserExit()` 감지 → 코치가 자연스럽게 마무리 발화 + H 패턴 키워드 포함 → 이후는 Path A와 동일

#### Path C — 정서 위기 redirect

사용자 메시지에 위기 키워드 포함:
- "죽고 싶다", "사라지고 싶다", "끝내고 싶다"
- "이 세상에서 없어졌으면", "스스로 다치게", "해치고 싶다"

→ `detectCrisisRed()` 감지 → 코치가 자원 안내 멘트(생명의전화 1393 등) + H 패턴 키워드 함께 출력 → **추출 단계 건너뜀** → `career_interview_results` INSERT 시 `key_insights = NULL`로 저장 → 09로 자동 이동하지 않고 자원 안내 화면 유지

> ⚠️ 위기 키워드 감지는 클라이언트 측 백업 가드이며, AI 시스템 프롬프트(`docs/ai_prompt/03. career_interview.md`)에서도 위기 신호 감지 로직이 별도로 동작함. 이중 안전망.

---

## 4. 인터뷰 완료 시 동작 (v2 추출, schema v0.9)

Path A 또는 B 종료 감지 시 finalize API 호출 → AI가 대화 전체를 분석해 **새로운 v2 추출 스키마**로 인사이트 반환 → DB INSERT.

### 4.1 `career_interview_results` INSERT 필드

| 컬럼 | 값 | 비고 |
| --- | --- | --- |
| `user_id` | 현재 사용자 ID | — |
| `session_duration_choice` | `short` / `medium` / `long` | **v0.9 신규**, NOT NULL DEFAULT 'medium'. enum 위반·미언급 시 'medium' 강제 |
| `key_insights` | JSONB (아래 구조) | v0.9 신규 4키 + 기존 7키 중첩. Path C 시 NULL |
| `ai_summary` | text (≤80자) | 종합 한 줄 요약 |
| `recommended_competencies` | NULL | 09에서 별도 UPDATE |

### 4.2 `key_insights` JSONB 구조 (v0.9)

```jsonc
{
  // 신규 4키 (v0.9)
  "presenting_issue": "...",     // 필수 — 사용자가 처음 가져온 표면 이슈 (≤500자)
  "agreed_focus": "...",         // 필수 — 최종 합의된 다루기로 한 주제 (≤500자, 미합의 시 presenting_issue 복사)
  "agreement_evolution": "...",  // optional — 합의 재조정 흐름 (≤800자, 없으면 "")
  "user_takeaway": "...",        // 필수 — 사용자의 마무리 인사이트 (≤500자, Phase 4 미도달 시 "")

  // 기존 7키 (모두 optional, 중첩 객체로 이동)
  "key_insights": {
    "current_satisfaction": "...",
    "current_frustration":  "...",
    "future_vision":        "...",
    "work_style":           "...",
    "values":               ["성장", "인정", "자율"],
    "career_concern":       "...",
    "dream":                "..."
  },

  // 역량 추출 (v0.7.1 유지)
  "mentioned_competencies": ["I-2", "T-1"]  // 12역량 enum, 0~3개
}
```

> ⚠️ JSONB는 schema-less이므로 ALTER 불필요. AI 출력 JSON이 통째로 저장됨.
> ⚠️ **Path C 시 추출 단계 건너뛰고 `key_insights = NULL`로 저장**.

코드 구현 검증 위치: `web/app/api/career-interview/finalize/route.ts` + `web/lib/prompts/career-interview.ts` (`INTERVIEW_FINALIZE_SYSTEM` 상수).

---

## 5. AI 시스템 프롬프트 설계

- **베이스 페르소나**: `docs/ai_prompt/system_prompt.md` (코칭 원칙, MCC 코칭 모델)
- **인터뷰 명세**: `docs/ai_prompt/03. career_interview.md` (v2 자유 흐름 + 4-Phase + Path A/B/C + 추출 스키마)
- **출력 형식 (대화 중)**: 한국어 자연어 텍스트만. 메타 설명·태그·마크다운 펜스 금지.
- **출력 형식 (finalize 시)**: 순수 JSON 객체 + `---SUMMARY---` 구분자 + 한 줄 요약 (코드: `INTERVIEW_FINALIZE_SYSTEM` 명세).
- **응답 길이**: 평소 2~3문장. 깊이 파고드는 follow-up일 때 최대 4문장. 위기 redirect 멘트는 자원 안내 포함으로 길어질 수 있음.

---

## 6. 컨텍스트 (AI prompt에 자동 포함)

- `strength_analyses.strengths` (is_latest=true, Top 5 강점 JSONB) — 배열 순서는 도메인 순(E→I→R→T), rank 필드 없음 (Option B 확정)
- `profiles` (job_field, career_level, main_concern, nickname)
- **강점 페어 컨텍스트** (Top 5에서 C(5,2)=10페어 × 양방향 = 20문장) — `web/lib/constants/strength_pairs.ts`에서 슬라이스. 페어 이름·강점명은 응답에서 직접 언급 금지(암묵적 단서로만 활용).

---

## 7. 그 외 동작

자동 저장(sessionStorage), 재개, PII 검출, 분석 이벤트, 접근성, 성능은 v1과 동일.

대화 원문은 DB 저장하지 않음. sessionStorage에서만 관리 후 finalize 시 추출 결과만 DB 저장.

---

## 8. 데이터

### 8.1 읽기

| 테이블 | 필드 | 용도 |
| --- | --- | --- |
| `strength_analyses` (is_latest=true) | `strengths` (JSONB) | Top 5 강점 컨텍스트, 페어 슬라이스 lookup |
| `profiles` | `nickname`, `job_field`, `career_level`, `main_concern` | 사용자 정보 컨텍스트 |

### 8.2 쓰기

| 테이블 | 동작 | 시점 |
| --- | --- | --- |
| `career_interview_results` | INSERT | Path A/B 종료 시 (Path C 시 `key_insights=NULL`로 저장) |

대화 원문은 sessionStorage에만 (브라우저 메모리), DB 미저장.

---

## 9. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `interview_started` | `type=career`, `session_duration_choice` (Phase 1 종료 후) |
| `interview_phase_transition` | `from_phase`, `to_phase`, `turn_count` |
| `interview_completed` | `path=A|B`, `session_duration_choice`, `key_insights_keys` (어떤 키가 채워졌는지) |
| `interview_crisis_redirect` | (Path C 발생 시 별도 이벤트) |

---

## 10. 코드 구현 참조

| 책임 | 파일 |
| --- | --- |
| 페이지 UI | `web/app/onboarding/career-interview/page.tsx` |
| 채팅 API | `web/app/api/career-interview/chat/route.ts` |
| 추출 API (finalize) | `web/app/api/career-interview/finalize/route.ts` |
| 시스템 프롬프트 빌더 | `web/lib/prompts/career-interview.ts` |
| 키워드 감지 / Phase 추론 / Running State | `web/lib/constants/career-interview.ts` |
| 타입 정의 | `web/lib/types/database.ts` (`CareerInterviewKeyInsights`, `SessionDurationChoice`) |
| AI 명세 (코칭 페르소나) | `docs/ai_prompt/system_prompt.md` |
| AI 명세 (인터뷰 v2) | `docs/ai_prompt/03. career_interview.md` |
| 결정 근거 | `docs/CAREER_INTERVIEW_V2_DECISIONS.md` |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v2.0 | 2026-05-23 | **[전면 재작성 — schema v0.9 / 커리어 인터뷰 v2 개편 반영]** v1.4의 고정 6질문 모델을 폐기하고 v2 자유 흐름 4-Phase 구조로 전면 재작성. 신규 항목: **3.1 시간 선택** (session_duration_choice, v0.9 신규 컬럼), **3.2 4-Phase 흐름** (Opening/Echo & Agreement/Exploration/Closing), **3.4 Running State 블록** (매 턴 prefix 주입), **3.5 종료 분기** Path A(코치 자연 종료)/B(사용자 주도)/C(정서 위기 redirect), **4.2 key_insights JSONB** v0.9 신규 4키(presenting_issue/agreed_focus/agreement_evolution/user_takeaway) + 기존 7키 중첩 구조. **10번 코드 구현 참조** 섹션 신규 추가(실제 구현 파일 매핑). 기존 §3.2 코어 질문 Q1~Q6, §3.3 "Q3/6" 진행률, §3.5 인터뷰 더하기 모드, Option B 미결 섹션 모두 제거. |
| v1.4 | 2026-05-10 | NEW 프로토타입 v1 정합성 정렬: **3.5 인터뷰 완료 후 버튼 패턴** — 인터뷰 더하기 모드의 동작 정의 명확화. (1) "💬 인터뷰 더하기" 클릭 시 입력창을 enable + focus 처리해야 한다는 원칙 명시 (단순 display 토글로는 disabled 상태가 풀리지 않는 버그 방지). (2) 추가 입력 모드에서는 코어 질문 흐름이 종료된 상태이므로 매 메시지 전송 시 짧은 ack만 응답. (3) 추가 모드 진입 후에는 "💬 인터뷰 더하기" 버튼을 숨기고 "진단 완료하기" 버튼만 유지하여 사용자가 마무리할 수 있는 단일 진로 제공. 상태 표에 "인터뷰 더하기 모드 진입" / "추가 입력 후" 두 행 신규 추가. |
| v1.3 | 2026-05-09 | schema v0.7.1/v0.7.2 정합성 정렬: **3.4항 인터뷰 완료 시 동작** — (1) `recommended_goal_categories` → `recommended_competencies`로 환원 (v0.7.1 변경 누락분 처리, 09번 v1.3과 정합) / (2) `key_insights` JSONB 설명에 **`mentioned_competencies`** 키 추가 (v0.7.2 신규 — 인터뷰에서 사용자가 직접 언급한 12역량 코드 배열, 09번 결정적 매칭의 입력으로 사용됨) / (3) `recommended_competencies` 저장 시점 안내 — "09 화면에서 별도 버튼으로 생성" → "09 [역량 방향 받기] 버튼 클릭 시 결정적 매칭 + AI 카드 문구 개인화 후 별도 UPDATE"로 흐름 명시. |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 반영: 3.2항 코어 질문 공식 확정 순서 명시 주석 추가 / 3.3항 follow-up 카운트 제외 원칙 추가 / **3.5항 완료 감지 조건 및 UI 전환 동작 확정** (코어 질문 카운터 6 도달 시 입력창 숨김 + 버튼 영역 노출, 상태 전환 테이블 신규 추가) / Option B 확정 시 추가 수정 사항 별도 섹션으로 명시 |
| v1.1 | 2026-05-05 | schema 검증 반영: `coaching_sessions` 삭제됨 명시, 이어하기 sessionStorage 기반 수정, `users`→`profiles` 정정, `career_results`→`career_interview_results`, 저장구조 `directions`→`key_insights`+`ai_summary`, `recommended_goal_categories` 미저장(09에서 처리) 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
