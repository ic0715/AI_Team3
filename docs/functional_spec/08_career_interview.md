# 08. 커리어 인터뷰 (AI 채팅)

> 강점 결과를 컨텍스트로 받은 AI 코치와 대화하며 커리어 고민과 방향을 탐색. 코어 6개 + 동적 follow-up 구조.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 08_career_interview |
| 페이즈 | DIRECTION |
| 역할 | AI 인터뷰로 커리어 방향 데이터 수집 |
| 이전 화면 | 07 커리어 인터뷰 인트로 |
| 다음 화면 | 09 커리어 방향 결과 (분석 완료 후) |

## 2. 진입 조건

- 07에서 "시작하기" 클릭
- 또는 sessionStorage에 진행 중인 대화가 남아 있고 이어하기 선택 (브라우저 내에서만 복원 가능)

## 3. 05와의 차이점

UI 구조와 자동 저장/재개 정책은 05와 동일. 다음 차이점만 별도 정의.

### 3.1 컨텍스트 (AI prompt에 자동 포함)

- `strength_analyses.strengths` (is_latest=true, Top 5 강점 JSONB)
- `profiles` (job_field, career_level, main_concern, nickname)

### 3.2 코어 질문 (커리어 인터뷰용 6개)

| Q | 질문 |
| --- | --- |
| Q1 | 지금 직장 생활에서 만족스러운 점과 그렇지 않은 점은? |
| Q2 | 5년 후, 어떤 모습이 되어 있길 바라나요? |
| Q3 | 일할 때 어떤 가치관을 중요하게 여기나요? |
| Q4 | 어떤 환경에서 가장 좋은 성과를 내는 편인가요? |
| Q5 | 강점 중 [Top1]에 가장 공감되시나요? 그 강점을 어디서 느꼈나요? |
| Q6 | 시간/돈 제약이 없다면, 1년 동안 무엇을 시도해 보고 싶나요? |

### 3.3 진행률 표시

- "Q3 / 6" + Progress Bar (코어 질문 기준)

### 3.4 인터뷰 완료 시 동작

- AI가 대화에서 핵심 인사이트 추출 → `career_interview_results` INSERT
  - `key_insights` (JSONB): 현재 만족/불만, 미래 비전, 가치관, 업무 스타일 등
  - `ai_summary` (text): 인터뷰 종합 한 줄 요약
  - `recommended_goal_categories`는 **이 단계에서 저장하지 않음** (09 화면에서 별도 버튼으로 생성)
- 분석 시작 (예상 5~12초, 로딩 메시지 노출)
- 분석 완료 시 09로 자동 이동

> ⚠️ **schema 불일치 수정**: `career_results` → `career_interview_results` (테이블명)  
> 저장 구조: `directions JSONB` (5개 방향) → `key_insights JSONB` + `ai_summary text`로 변경  
> AI가 직접 커리어 방향 5개를 제시하는 구조 → key_insights(인터뷰 핵심 정보)만 저장, 방향 추천은 09에서 별도 요청

### 3.5 Final CTA (인터뷰 완료 후)

- Primary: "진단 완료하기 →"
- Secondary: "💬 인터뷰 더하기" (선택, 답변 추가 가능)

## 4. AI 시스템 프롬프트 설계

- **코칭 모드**: GENERAL (일반 코칭) — 3-Phase 흐름: 주제 명료화 → 강점 기반 액션 → 정리·확인
- **컨텍스트 계층**: 기본정보(03) → 강점결과(06) → 대화 히스토리 순으로 누적
- **MCC 코칭 원칙** 유지
- **출력 형식**: 인터뷰 종료 시 JSON 반환 [{title, description, fit_reason, related_strengths}]
- **커리어 방향 개수**: 5개 추천
- **시간 정책**: 즉시 적용 — 선택된 방향은 10에서 액션 선택 후 W1부터 시작

## 5. 그 외 동작

자동 저장, 재개, 위기 신호 처리, PII 검출, 분석 이벤트, 접근성, 성능은 모두 05와 동일.

## 6. 데이터

- 읽기: `strength_analyses` (is_latest=true), `profiles`
- 쓰기: `career_interview_results` INSERT (`key_insights`, `ai_summary`)
- 대화 원문: DB 저장 없음. sessionStorage에서만 관리 (브라우저 메모리 기반)

> ⚠️ **schema 불일치 수정**:
> - `coaching_sessions` 삭제됨 (v0.2, 대화 원문 미저장 정책)
> - `career_results` → `career_interview_results` (테이블명)
> - `directions JSONB` → `key_insights JSONB` + `ai_summary text`

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.1 | 2026-05-05 | schema 검증 반영: `coaching_sessions` 삭제됨 명시, 이어하기 sessionStorage 기반 수정, `users`→`profiles` 정정, `career_results`→`career_interview_results`, 저장구조 `directions`→`key_insights`+`ai_summary`, `recommended_goal_categories` 미저장(09에서 처리) 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
