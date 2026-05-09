# 09. 커리어 방향 결과

> AI가 도출한 커리어 방향 후보 5가지를 제시하고, 유저가 원하는 방향을 선택하게 함.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 09_career_result |
| 페이즈 | DIRECTION |
| 역할 | 커리어 방향 후보 중 1개 선택 |
| 이전 화면 | 08 커리어 인터뷰 |
| 다음 화면 | 10 액션 아이템 선택 |

---

## 2. 진입 조건

- 08 인터뷰 완료 + 분석 완료
- 또는 15에서 "커리어 방향 재설정" 후 08 재완료 시

---

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

### 3.4 목표 후보 카드 (5개 고정) `v1.3 수정 — schema v0.7.1 반영`

> ⚠️ **schema 구조**: 커리어 방향은 결정적 매칭 알고리즘으로 도출된 `recommended_competencies` 5개 슬롯으로 표시 (AI 자유 생성 아님).
> 유저가 선택 → `goals` 테이블에 INSERT.

각 카드 구성:

| 요소 | 내용 |
| --- | --- |
| 슬롯 순번 | 1~5 (`slot` 필드 기준) |
| 목표 제목 (`goal_title`) | `competency_code`에 매핑된 앱 상수 한글명 (예: "데이터 분석 능력 기르기", "리더십 역량 기르기") |
| 역량 코드 (`competency_code`) | 12개 고정값 중 하나 (예: `T-2`, `I-2`) |
| 도메인 (`domain`) | T/I/R/E 중 하나 |
| 설명 | AI가 생성한 개인화 문구 (`personalized_text`, DB 미저장) |
| 강점 연관 이유 | `match_score` 기반 — Top 5 강점과 역량 연계 강점의 교집합 수 |
| fit badge | `badge` 필드값 기반 (아래 허용값 참조) |
| 선택 체크 UI | 기본 / Hover / Selected 상태 |

**fit badge 허용값 (schema `badge` 필드 기준):**

| `badge` 값 | 표시 텍스트 | 스타일 | 슬롯 | 사용 조건 |
| --- | --- | --- | --- | --- |
| `strength_match` | "강점 연계 높음" | green badge | 1~3 | match_score 상위 3개 — 강점과 직접 연결되는 방향 |
| `user_interest` | "나의 관심 역량" | accent badge | 4 | 인터뷰에서 사용자가 언급한 역량 |
| `growth_potential` | "성장 잠재력 높음" | blue badge | 5 | 현재 도메인 외 확장 추천 |

> ⚠️ 카드는 항상 5개 고정 표시. `personalized_text`는 AI가 화면용으로만 생성하며 DB에 저장되지 않음.

### 3.5 Bottom CTA `v1.2 수정 — 텍스트 확정`

- Primary: **"액션 아이템 받기 →"** (1개 선택 시 활성화) → `goals` INSERT 후 10으로 이동
- Secondary: "원하는 방향이 없어요" → 08 재진입 (인터뷰 다시하기)

> ※ 프로토타입 v6 기준으로 확정. 기존 spec의 "이 목표로 시작하기 →"에서 변경.

---

## 4. 기능

> **⚠️ 중요 — 이 화면은 3단계로 분리된 흐름 (schema v0.7.1):**
> 1. 08 인터뷰 완료 직후: `career_interview_results` INSERT (`key_insights` + `mentioned_competencies` + `ai_summary` 저장)
> 2. 본 화면 진입 시: **[역량 방향 받기] 버튼 클릭** → Step1 결정적 매칭(코드, AI 미사용) → Step2 AI 카드 문구 개인화 → `career_interview_results.recommended_competencies` UPDATE → 카드 5개 표시
> 3. 유저 선택 확정 → `goals` INSERT
>
> 버튼 클릭 전까지 카드가 표시되지 않음. (08 완료 즉시 자동 표시 아님)
>
> ⚠️ **프로토타입 수정 필요**: 프로토타입 v6은 08 완료 후 카드를 즉시 표시(1단계)하는 방식으로 구현되어 있음. 다음 버전에서 "역량 방향 받기" 버튼 추가 및 3단계 흐름으로 수정 필요.

| 기능 | 동작 |
| --- | --- |
| "역량 방향 받기" 버튼 클릭 | Step1 결정적 매칭(코드) → Step2 AI 카드 개인화(로딩) → `career_interview_results.recommended_competencies` UPDATE → 카드 5개 표시 |
| 옵션 선택 | 단일 선택 (1개만), 카드 강조 |
| 선택 해제 | 동일 카드 재클릭 시 |
| "액션 아이템 받기" 클릭 | `goals` INSERT (`competency_code`, `domain`, `goal_title`, `career_interview_id`) → 10 이동 |
| "원하는 방향이 없어요" 클릭 | 확인 다이얼로그 → 08 재진입 |

---

## 5. 데이터

- 읽기: `career_interview_results` (최신 1개 — `key_insights`, `ai_summary`, `recommended_competencies`)
- 쓰기 1: `career_interview_results.recommended_competencies` UPDATE (버튼 클릭 시 — 5개 슬롯, badge 3종)
- 쓰기 2: `goals` INSERT (목표 선택 확정 시)
  - `competency_code`: 선택한 역량 코드 (12개 고정값 중 하나)
  - `domain`: 코드 prefix (T/I/R/E)
  - `goal_title`: `competency_code`에 매핑된 앱 상수 한글명
  - `career_interview_id`: 연결된 인터뷰 ID
  - `status`: `'active'`
  - `started_at`: 오늘 날짜

> ⚠️ **schema 불일치 수정 완료 (v0.7.1)**:
> - `goal_category` (7개 대분류) → `competency_code` (12개 역량 코드) + `domain` (T/I/R/E)
> - `recommended_goal_categories (text[])` → `recommended_competencies (JSONB, 5개 고정 슬롯)`
> - `goal_title`은 AI 자유 생성 → 앱 상수(코드 매핑 한글명)로 변경
> - `users.coaching_start_at` → schema에 없음. `goals.started_at`으로 대체

---

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 옵션 미선택 상태 CTA 클릭 | 차단 (CTA disabled) |
| 옵션 3개 미만 생성 | 가능한 옵션만 표시 + "인터뷰 다시하기" 유도 안내 |
| 분석 실패 | "다시 분석하기" 버튼 노출 → 분석만 재시도 또는 08 재진입 |
| 저장 실패 | 토스트 + 재시도 |
| 페이지 이동 실패 | 토스트 |
| 중복 클릭 | 첫 클릭 후 disabled |
| 새로고침 | DB에서 복원, 선택 상태도 유지 |

---

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `career_result_view` | — |
| `career_option_selected` | `card_index`, `goal_title` |
| `career_option_deselected` | — |
| `career_result_confirmed` | `selected_index`, `competency_code` |
| `career_reinterview_requested` | — |

> ※ Option B (rank 제거) 확정 시 `rank`, `selected_rank` 속성은 위와 같이 `card_index`, `selected_index`로 대체됨. 현재는 미결 사항이므로 위 내용으로 선반영.

---

## 8. 접근성

- 카드는 radio group 패턴 (`role="radiogroup"`)
- 키보드 화살표로 옵션 이동 가능
- 선택 상태가 색상 외 아이콘으로도 명확
- fit badge는 `aria-label`로 의미 전달

---

## Option B (rank 제거) 확정 시 추가 수정 사항

> ⚠️ **미결 사항 — 팀 결정 후 반영**
> 강점 rank 제거(Option B) 확정 시 본 파일에서 아래 항목을 추가 수정할 것.

| 위치 | 현행 | 수정 내용 |
| --- | --- | --- |
| 3.4항 카드 구성 "강점 연관 이유" | Top 5 중 어느 강점과 연관되는지 | "도메인(E/I/R/T) 기준 어느 강점과 연관되는지"로 표현 변경 |
| 7번 분석 이벤트 | `card_index`, `selected_index` | 이미 rank 미참조로 선반영 완료 — 추가 수정 없음 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.3 | 2026-05-07 | schema v0.7.1 반영: **3.4항 목표 후보 카드** — `goal_category`(7개 대분류) → `competency_code`(12개 역량 코드)+`domain`(T/I/R/E) 구조로 변경, `recommended_goal_categories` → `recommended_competencies`, 카드 5개 고정, fit badge 3종 schema `badge` 필드값으로 확정 (`strength_match`/`user_interest`/`growth_potential`) / **4번 기능** — 2단계 흐름 → 3단계 흐름으로 수정 ("목표 추천받기" → "역량 방향 받기" 버튼) / **5번 데이터** — `goal_category` → `competency_code`+`domain`, `recommended_goal_categories` → `recommended_competencies` / **7번 분석 이벤트** — `goal_category` → `competency_code` |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 반영: **3.4항 fit badge 허용값 3종 신규 추가** (강점 연계 높음/성장 잠재력 높음/추천, 스타일 및 사용 조건 명세) / **3.5항 CTA 텍스트 "액션 아이템 받기 →"로 확정** (프로토타입 기준, 기존 "이 목표로 시작하기 →"에서 변경) / 4번 기능 항목에 프로토타입 수정 권고 주석 추가 (2단계 흐름 미구현) / 7번 분석 이벤트에서 rank 속성 제거 후 `card_index`/`selected_index`로 선반영 / Option B 확정 시 추가 수정 사항 별도 섹션으로 명시 |
| v1.1 | 2026-05-05 | schema 검증 반영: 화면 흐름 2단계 분리 명시(버튼 클릭 후 AI 분석 시작), 방향 5개→목표 후보 3~5개로 수정, `career_results`→`career_interview_results`, `directions`/`selected_direction` 컬럼 없음 명시, 목표 선택 시 `goals` INSERT 구조 명시, `users.coaching_start_at`→`goals.started_at` 수정 |
| v1.0 | 2026-05-04 | 최초 작성 |
