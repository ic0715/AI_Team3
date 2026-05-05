# 09. 커리어 방향 결과

> AI가 도출한 커리어 방향 후보 5가지를 제시하고, 유저가 원하는 방향을 선택하게 함.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 09_career_result |
| 페이즈 | DIRECTION |
| 역할 | 5개 커리어 방향 후보 중 1개 선택 |
| 이전 화면 | 08 커리어 인터뷰 |
| 다음 화면 | 10 액션 아이템 선택 |

## 2. 진입 조건

- 08 인터뷰 완료 + 분석 완료
- 또는 15에서 "커리어 방향 재설정" 후 08 재완료 시

## 3. UI 구성

### 3.1 상단 바

- 뒤로가기 → 08
- 페이지 타이틀: "커리어 방향 결과"

### 3.2 결과 배너

- "AI 분석 완료"
- 메인 타이틀: "지금 집중할 수 있는 커리어 방향이에요"
- 서브: "강점·가치관·현재 상황을 종합 분석했어요"

### 3.3 선택 안내

- 섹션 타이틀: "원하는 방향을 1개 골라주세요"
- 보조 안내: "선택한 방향이 12주 동안의 목표가 돼요. 시작 후에도 변경할 수 있어요"

### 3.4 목표 후보 카드 (3~5개)

> ⚠️ **schema 구조 수정**: 커리어 방향 5개가 아니라 AI 추천 `goal_title` 후보 3~5개를 표시.  
> 유저가 선택 → `goals` 테이블에 INSERT.

각 카드 구성:

| 요소 | 내용 |
| --- | --- |
| 순번 | 1~5 (AI 추천 순) |
| 목표 제목 (`goal_title`) | 예: "데이터 분석 능력 기르기", "팀 리더십 역량 키우기" |
| 목표 카테고리 (`goal_category`) | 7개 고정값 중 하나 (예: `technical`, `leadership`) |
| 설명 | 2~3문장 |
| 강점 연관 이유 | Top 5 중 어느 강점과 연관되는지 |
| 선택 체크 UI | 기본 / Hover / Selected 상태 |

### 3.5 Bottom CTA

- Primary: "이 목표로 시작하기 →" (선택 시 활성화) → `goals` INSERT 후 10으로 이동
- Secondary: "원하는 방향이 없어요" → 08 재진입 (인터뷰 다시하기)

## 4. 기능

> **⚠️ 중요 — 이 화면은 2단계로 분리된 흐름:**
> 1. 08 인터뷰 완료 직후: `career_interview_results` INSERT (`key_insights`, `ai_summary`만 저장)
> 2. 본 화면 진입 시: **[목표 추천받기] 버튼 클릭** → AI 분석 시작 → `career_interview_results.recommended_goal_categories` UPDATE → 목표 후보 카드 표시
>
> 버튼 클릭 전까지 카드가 표시되지 않음. (08 완료 즉시 자동 표시가 아님)

| 기능 | 동작 |
| --- | --- |
| "목표 추천받기" 버튼 클릭 | AI 분석 시작 (로딩) → `career_interview_results.recommended_goal_categories` UPDATE → 카드 3~5개 표시 |
| 옵션 선택 | 단일 선택, 카드 강조 |
| 선택 해제 | 동일 카드 재클릭 시 |
| 다음 클릭 | `goals` INSERT (`goal_category`, `goal_title`, `career_interview_id`) → 10 이동 |
| 인터뷰 다시하기 | 확인 다이얼로그 → 08 재진입 |

## 5. 데이터

- 읽기: `career_interview_results` (최신 1개 — `key_insights`, `ai_summary`, `recommended_goal_categories`)
- 쓰기 1: `career_interview_results.recommended_goal_categories` UPDATE (버튼 클릭 시)
- 쓰기 2: `goals` INSERT (목표 선택 확정 시)
  - `goal_category`: AI가 추천한 7개 고정값 중 하나
  - `goal_title`: AI가 생성한 자유 텍스트
  - `career_interview_id`: 연결된 인터뷰 ID
  - `status`: `'active'`
  - `started_at`: 오늘 날짜

> ⚠️ **schema 불일치 수정**:
> - `career_results.directions JSONB` / `career_results.selected_direction` → 해당 컬럼/테이블 없음
> - 실제: `career_interview_results.recommended_goal_categories (text[])` + 별도 `goals` INSERT
> - `users.coaching_start_at` → schema에 없음. `goals.started_at`으로 대체

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 옵션 미선택 상태 CTA 클릭 | 차단 (CTA disabled) |
| 옵션 5개 미만 생성 | 가능한 옵션만 표시 + 안내 |
| 분석 실패 | "다시 분석하기" 버튼 노출 → 08 재진입 또는 분석만 재시도 |
| 저장 실패 | 토스트 + 재시도 |
| 페이지 이동 실패 | 토스트 |
| 중복 클릭 | 첫 클릭 후 disabled |
| 새로고침 | DB에서 복원, 선택 상태도 유지 |

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| career_result_view | - |
| career_option_selected | rank, direction_title |
| career_option_deselected | - |
| career_result_confirmed | selected_rank |
| career_reinterview_requested | - |

## 8. 접근성

- 카드는 radio group 패턴 (role="radiogroup")
- 키보드 화살표로 옵션 이동 가능
- 선택 상태가 색상 외 아이콘으로도 명확

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.1 | 2026-05-05 | schema 검증 반영: 화면 흐름 2단계 분리 명시(버튼 클릭 후 AI 분석 시작), 방향 5개→목표 후보 3~5개로 수정, `career_results`→`career_interview_results`, `directions`/`selected_direction` 컬럼 없음 명시, 목표 선택 시 `goals` INSERT 구조 명시, `users.coaching_start_at`→`goals.started_at` 수정 |
| v1.0 | 2026-05-04 | 최초 작성 |
