# 08. 커리어 인터뷰 (AI 채팅)

> 강점 결과를 컨텍스트로 받은 AI 코치와 대화하며 커리어 고민과 방향을 탐색. 코어 6개 + 동적 follow-up 구조.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 08_career_interview |
| 페이즈 | DIRECTION |
| 역할 | AI 인터뷰로 커리어 방향 데이터 수집 |
| 이전 화면 | 07 커리어 인터뷰 인트로 |
| 다음 화면 | 09 커리어 방향 결과 (분석 완료 후) |

---

## 2. 진입 조건

- 07에서 "시작하기" 클릭
- 또는 sessionStorage에 진행 중인 대화가 남아 있고 이어하기 선택 (브라우저 내에서만 복원 가능)

---

## 3. 05와의 차이점

UI 구조와 자동 저장/재개 정책은 05와 동일. 다음 차이점만 별도 정의.

### 3.1 컨텍스트 (AI prompt에 자동 포함)

- `strength_analyses.strengths` (is_latest=true, Top 5 강점 JSONB)
- `profiles` (job_field, career_level, main_concern, nickname)

### 3.2 코어 질문 (커리어 인터뷰용 6개)

> 아래 6개는 공식 확정 순서임. AI는 이 순서를 기본으로 하되,
> 사용자 답변 내용에 따라 follow-up을 삽입할 수 있음.

| Q | 질문 |
| --- | --- |
| Q1 | 지금 직장 생활에서 만족스러운 점과 그렇지 않은 점은? |
| Q2 | 5년 후, 어떤 모습이 되어 있길 바라나요? |
| Q3 | 일할 때 어떤 가치관을 중요하게 여기나요? |
| Q4 | 어떤 환경에서 가장 좋은 성과를 내는 편인가요? |
| Q5 | 강점 중 첫 번째 강점에 가장 공감되시나요? 그 강점을 어디서 느꼈나요? |
| Q6 | 시간/돈 제약이 없다면, 1년 동안 무엇을 시도해 보고 싶나요? |

### 3.3 진행률 표시

- "Q3 / 6" + Progress Bar (코어 질문 기준)
- follow-up 질문은 카운트에 포함하지 않음

### 3.4 인터뷰 완료 시 동작

- AI가 대화에서 핵심 인사이트 추출 → `career_interview_results` INSERT
  - `key_insights` (JSONB): 현재 만족/불만, 미래 비전, 가치관, 업무 스타일 + **`mentioned_competencies`** (인터뷰에서 사용자가 직접 언급한 12역량 코드 배열, schema v0.7.2 신규 키) 등
  - `ai_summary` (text): 인터뷰 종합 한 줄 요약
  - `recommended_competencies`는 **이 단계에서 저장하지 않음** (09 화면에서 [역량 방향 받기] 버튼 클릭 시 결정적 매칭 + AI 카드 문구 개인화 후 별도 UPDATE)
- 분석 시작 (예상 5~12초, 로딩 메시지 노출)
- 분석 완료 시 09로 자동 이동

> ⚠️ **schema 불일치 수정 완료**: `career_results` → `career_interview_results` (테이블명)
> 저장 구조: `directions JSONB` → `key_insights JSONB` + `ai_summary text`로 변경.
> 커리어 방향 추천은 09에서 별도 요청.

### 3.5 인터뷰 완료 후 버튼 패턴 `v1.2 수정 — 완료 감지 조건 및 UI 전환 동작 확정`

> **완료 감지 조건**: AI가 코어 질문 6개를 모두 전달하고 마지막 응답을 반환한 시점.
> 프론트는 코어 질문 카운터가 6에 도달했을 때 완료 상태로 전환한다.

**완료 감지 후 UI 전환 순서:**

1. 채팅 입력창(textarea + 전송 버튼) `display: none` 처리
2. 하단에 버튼 영역 노출:
   - Primary: "진단 완료하기 →" → 클릭 시 분석 로딩 시작 → `career_interview_results` INSERT → 09 이동
   - Secondary: "💬 인터뷰 더하기" → 클릭 시 입력창 재노출, 추가 답변 가능 (완료 상태 해제)

| 상태 | 조건 | UI |
| --- | --- | --- |
| 진행 중 | 코어 질문 카운터 < 6 | 입력창 활성, 버튼 영역 숨김 |
| 완료 감지 | 코어 질문 카운터 = 6 | 입력창 숨김, 버튼 영역 노출 |
| 추가 입력 | "인터뷰 더하기" 클릭 후 | 입력창 재노출, 버튼 영역 유지 |

---

## 4. AI 시스템 프롬프트 설계

- **코칭 모드**: GENERAL (일반 코칭) — 3-Phase 흐름: 주제 명료화 → 강점 기반 액션 → 정리·확인
- **컨텍스트 계층**: 기본정보(03) → 강점결과(06) → 대화 히스토리 순으로 누적
- **MCC 코칭 원칙** 유지
- **출력 형식**: 인터뷰 종료 시 JSON 반환 `[{title, description, fit_reason, related_strengths}]`
- **커리어 방향 개수**: 5개 추천
- **시간 정책**: 즉시 적용 — 선택된 방향은 10에서 액션 선택 후 W1부터 시작

---

## 5. 그 외 동작

자동 저장, 재개, 위기 신호 처리, PII 검출, 분석 이벤트, 접근성, 성능은 모두 05와 동일.

---

## 6. 데이터

- 읽기: `strength_analyses` (is_latest=true), `profiles`
- 쓰기: `career_interview_results` INSERT (`key_insights`, `ai_summary`)
- 대화 원문: DB 저장 없음. sessionStorage에서만 관리 (브라우저 메모리 기반)

> ⚠️ **schema 불일치 수정 완료**:
> - `coaching_sessions` 삭제됨 (v0.2, 대화 원문 미저장 정책)
> - `career_results` → `career_interview_results` (테이블명)
> - `directions JSONB` → `key_insights JSONB` + `ai_summary text`

---

## Option B (rank 제거) 확정 시 추가 수정 사항

> ⚠️ **미결 사항 — 팀 결정 후 반영**
> 강점 rank 제거(Option B) 확정 시 본 파일에서 아래 항목을 추가 수정할 것.

| 위치 | 현행 | 수정 내용 |
| --- | --- | --- |
| 3.2항 Q5 질문 | `강점 중 [Top1]에 가장 공감되시나요?` | `강점 중 [strengths[0].name_ko]에 가장 공감되시나요?` 로 변경. rank 기반 "1위" 참조 제거. |
| 3.1항 컨텍스트 | `Top 5 강점 JSONB` | `Top 5 강점 JSONB (배열 순서: 도메인 순 E→I→R→T, rank 필드 없음)` 주석 추가. |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.3 | 2026-05-09 | schema v0.7.1/v0.7.2 정합성 정렬: **3.4항 인터뷰 완료 시 동작** — (1) `recommended_goal_categories` → `recommended_competencies`로 환원 (v0.7.1 변경 누락분 처리, 09번 v1.3과 정합) / (2) `key_insights` JSONB 설명에 **`mentioned_competencies`** 키 추가 (v0.7.2 신규 — 인터뷰에서 사용자가 직접 언급한 12역량 코드 배열, 09번 결정적 매칭의 입력으로 사용됨) / (3) `recommended_competencies` 저장 시점 안내 — "09 화면에서 별도 버튼으로 생성" → "09 [역량 방향 받기] 버튼 클릭 시 결정적 매칭 + AI 카드 문구 개인화 후 별도 UPDATE"로 흐름 명시. |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 반영: 3.2항 코어 질문 공식 확정 순서 명시 주석 추가 / 3.3항 follow-up 카운트 제외 원칙 추가 / **3.5항 완료 감지 조건 및 UI 전환 동작 확정** (코어 질문 카운터 6 도달 시 입력창 숨김 + 버튼 영역 노출, 상태 전환 테이블 신규 추가) / Option B 확정 시 추가 수정 사항 별도 섹션으로 명시 |
| v1.1 | 2026-05-05 | schema 검증 반영: `coaching_sessions` 삭제됨 명시, 이어하기 sessionStorage 기반 수정, `users`→`profiles` 정정, `career_results`→`career_interview_results`, 저장구조 `directions`→`key_insights`+`ai_summary`, `recommended_goal_categories` 미저장(09에서 처리) 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
