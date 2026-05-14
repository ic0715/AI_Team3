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

### 3.2 결과 배너 `v1.5 수정 — 카피 변경`

다크 네이비 그라데이션 배경(#111827 → #1f2f5a) + 흰색 텍스트.

- Eyebrow: **"🎯 AI 분석 완료"** (uppercase, 작은 글씨, 흐릿한 흰색)
- 메인 타이틀: **"지금 집중해야 할 역량 목표예요"**
- 서브: **"강점 · 가치관 · 현재 상황을 종합 분석한 결과예요"**

### 3.3 선택 안내 `v1.5 수정 — 카피 변경`

- 섹션 타이틀: **"키우고 싶은 역량을 1개 골라주세요"** (역량 중심 표현으로 통일)
- 12주 표현이 들어간 보조 안내는 제거됨

### 3.4 목표 후보 카드 (5개 고정) `v1.5 수정 — 슬롯 번호 UI 명세 + badge 라벨 변경`

> ⚠️ **schema 구조**: 커리어 방향은 결정적 매칭 알고리즘으로 도출된 `recommended_competencies` 5개 슬롯으로 표시 (AI 자유 생성 아님).
> 유저가 선택 → `goals` 테이블에 INSERT.

각 카드 구성:

| 요소 | 내용 |
| --- | --- |
| **슬롯 번호 사각 배지 (좌측)** | 1~5 (`slot` 필드 기준). 28×28px, 보라/accent 배경, 흰색 폰트 (`.career-num`) |
| 목표 제목 (`goal_title`) | `competency_code`에 매핑된 앱 상수 한글명 (예: "비판적 사고 기르기", "데이터 분석 능력 기르기") |
| 역량 코드 (`competency_code`) | 12개 고정값 중 하나 (예: `T-1`, `T-2`, `E-1`, `I-2`, `R-1`) |
| 도메인 (`domain`) | T/I/R/E 중 하나 |
| 설명 | AI가 생성한 개인화 문구 (`personalized_text`, DB 미저장) |
| 강점 연관 이유 | `match_score` 기반 — 도메인(T/I/R/E) 기준 어느 강점과 연관되는지 |
| 태그 (3개) | 카테고리·시간·난이도 등 짧은 키워드 chip (예: "🔍 논리적 사고", "📌 근거 기반 판단", "💡 문제 정의력") |
| fit badge (우측 상단) | `badge` 필드값 기반 (아래 허용값 참조) |
| 선택 체크 UI | 우측 상단 ✓ 인디케이터, 기본 / Hover / Selected 상태 |

**fit badge 허용값 (schema `badge` 필드 기준):**

| `badge` 값 | 표시 텍스트 | 스타일 | 슬롯 | 사용 조건 |
| --- | --- | --- | --- | --- |
| `strength_match` | **"강점에 잘 맞아요"** | 초록 badge (#ECFDF5 / #059669) | 1~3 | match_score 상위 3개 — 강점과 직접 연결되는 방향 |
| `user_interest` | **"직접 언급하셨어요"** | accent badge (var(--accent-light) / var(--accent)) | 4 | 인터뷰에서 사용자가 언급한 역량 |
| `growth_potential` | **"도전해 볼 만해요"** | 인디고 badge (#EFF6FF / #2563EB) | 5 | 현재 도메인 외 확장 추천 |

> ⚠️ 카드는 항상 5개 고정 표시. `personalized_text`는 AI가 화면용으로만 생성하며 DB에 저장되지 않음.

### 3.5 Bottom CTA `v1.5 수정 — Secondary CTA 라벨 변경`

- Primary: **"액션 아이템 받기 →"** (1개 선택 시 활성화) → `goals` INSERT 후 10으로 이동
- Secondary: **"원하는 목표가 없어요! 커리어 인터뷰 다시하기"** → 08 재진입 (인터뷰 다시하기)
  - 위치: Primary 아래, 점선 구분선 위. 텍스트 버튼(밑줄 + 회색 글씨)

---

## 4. 기능 `v1.5 수정 — 3단계 흐름 → 2단계 자동 흐름`

> **⚠️ 중요 — 본 화면은 2단계 자동 흐름 (schema v0.7.1):**
> 1. 08 인터뷰 완료 직후: `career_interview_results` INSERT (`key_insights` + `mentioned_competencies` + `ai_summary` 저장) — *08에서 처리*
> 2. **본 화면 진입 시 자동 트리거**: Step1 결정적 매칭(코드, AI 미사용) → Step2 AI 카드 문구 개인화(로딩 상태 노출) → `career_interview_results.recommended_competencies` UPDATE → 카드 5개 표시
> 3. 유저 선택 확정 → `goals` INSERT
>
> ※ v1.4의 명시적 **[역량 방향 받기] 버튼은 v1.5에서 제거**됨. 09 진입 시 자동 트리거로 변경 (탭 1회 절감 + 자연스러운 UX). 매칭·개인화 백엔드 로직은 동일하게 유지.

| 기능 | 동작 |
| --- | --- |
| 화면 진입 시 | (자동) Step1 결정적 매칭 → Step2 AI 카드 개인화(로딩 skeleton) → `career_interview_results.recommended_competencies` UPDATE → 카드 5개 페이드인 |
| 옵션 선택 | 단일 선택 (1개만), 카드 강조 + 체크 인디케이터 활성화 |
| 선택 해제 | 동일 카드 재클릭 시 |
| "액션 아이템 받기" 클릭 | `goals` INSERT (`competency_code`, `domain`, `goal_title`, `career_interview_id`) → 10 이동 |
| "원하는 목표가 없어요…" 클릭 | 확인 다이얼로그 → 08 재진입 |

---

## 5. 데이터

- 읽기: `career_interview_results` (최신 1개 — `key_insights`, `ai_summary`, `recommended_competencies`)
- 쓰기 1: `career_interview_results.recommended_competencies` UPDATE (화면 진입 시 자동 — 5개 슬롯, badge 3종)
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
| 매칭/개인화 진행 중(로딩) | skeleton UI 노출. 사용자 인터랙션 차단 |
| 매칭/개인화 실패 | "다시 분석하기" 버튼 노출 → Step2만 재시도, 또는 08 재진입 |
| 옵션 5개 미만 생성 (Step1 매칭 결과 부족) | 가능한 옵션만 표시 + "인터뷰 다시하기" 유도 안내 |
| 저장 실패 (goals INSERT) | 토스트 + 재시도 |
| 페이지 이동 실패 | 토스트 |
| 중복 클릭 | 첫 클릭 후 disabled |
| 새로고침 | `recommended_competencies` 이미 저장되어 있으면 DB에서 즉시 복원(Step2 재실행 없음), 선택 상태도 유지 |

---

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `career_result_view` | — |
| `career_recommendation_generated` | `time_spent_ms`, `competency_codes` (5개 array) — Step2 완료 시점 |
| `career_option_selected` | `card_index`, `goal_title`, `competency_code`, `badge` |
| `career_option_deselected` | — |
| `career_result_confirmed` | `selected_index`, `competency_code`, `badge` |
| `career_reinterview_requested` | — |

---

## 8. 접근성

- 카드는 radio group 패턴 (`role="radiogroup"`)
- 키보드 화살표로 옵션 이동 가능
- 선택 상태가 색상 외 체크 아이콘으로도 명확
- fit badge는 `aria-label`로 의미 전달 (예: "강점에 잘 맞아요. 강점과 직접 연결되는 방향이에요")
- 슬롯 번호 사각 배지는 시각적 보조용이므로 `aria-hidden="true"` 처리 (스크린 리더 중복 회피)
- 로딩 skeleton은 `aria-busy="true"`로 알림

---

## ✅ Option B (rank 제거) 확정 반영 완료

> **확정 (2026-05-09)**: 강점 번호는 표시하되 순위(rank)는 아님. 카드의 "강점 연관 이유"는 "도메인(T/I/R/E) 기준 어느 강점과 연관되는지"로 표현.

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.5 | 2026-05-11 | 프로토타입 v4 정합성 정렬: **3.2 결과 배너** 메인 타이틀 "지금 집중할 수 있는 커리어 방향이에요" → "지금 집중해야 할 역량 목표예요", 서브 카피 미세 정렬, Eyebrow "🎯 AI 분석 완료" 명시. **3.3 선택 안내** "원하는 방향을 1개 골라주세요" → "키우고 싶은 역량을 1개 골라주세요"로 통일 (역량 중심 표현). 12주 표현 보조 안내 제거. **3.4 fit badge 라벨 3종 모두 변경**: `strength_match` "강점 연계 높음" → "강점에 잘 맞아요", `user_interest` "나의 관심 역량" → "직접 언급하셨어요", `growth_potential` "성장 잠재력 높음" → "도전해 볼 만해요". 카드 좌측 슬롯 번호(1~5) 사각 배지 UI 명세 추가, 태그 3개 표시 명세. **3.5 Secondary CTA** "원하는 방향이 없어요" → "원하는 목표가 없어요! 커리어 인터뷰 다시하기"로 변경. **4번 기능 — 3단계 흐름 → 2단계 자동 흐름**: [역량 방향 받기] 명시 버튼 제거, 09 진입 시 자동 트리거(skeleton 로딩 상태)로 변경. 매칭·개인화 백엔드 로직은 동일 유지. v1.3에 명시되었던 "프로토타입 수정 필요" 주석 해제. **7번 분석 이벤트** `career_recommendation_generated` 신규 추가(Step2 완료 시점 추적). |
| v1.4 | 2026-05-09 | 팀 결정사항 반영: **Option B 확정** — 강점 번호 표시, 랭킹(순위) 아님. **3.4항** "강점 연관 이유" → "도메인(T/I/R/E) 기준 어느 강점과 연관되는지"로 수정. "Option B 확정 시 추가 수정 사항" 섹션 → 확정 완료로 전환 |
| v1.3 | 2026-05-07 | schema v0.7.1 반영: **3.4항 목표 후보 카드** — `goal_category`(7개 대분류) → `competency_code`(12개 역량 코드)+`domain`(T/I/R/E) 구조로 변경, `recommended_goal_categories` → `recommended_competencies`, 카드 5개 고정, fit badge 3종 schema `badge` 필드값으로 확정 (`strength_match`/`user_interest`/`growth_potential`) / **4번 기능** — 2단계 흐름 → 3단계 흐름으로 수정 ("목표 추천받기" → "역량 방향 받기" 버튼) / **5번 데이터** — `goal_category` → `competency_code`+`domain`, `recommended_goal_categories` → `recommended_competencies` / **7번 분석 이벤트** — `goal_category` → `competency_code` |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 반영: **3.4항 fit badge 허용값 3종 신규 추가** (강점 연계 높음/성장 잠재력 높음/추천, 스타일 및 사용 조건 명세) / **3.5항 CTA 텍스트 "액션 아이템 받기 →"로 확정** (프로토타입 기준, 기존 "이 목표로 시작하기 →"에서 변경) / 4번 기능 항목에 프로토타입 수정 권고 주석 추가 (2단계 흐름 미구현) / 7번 분석 이벤트에서 rank 속성 제거 후 `card_index`/`selected_index`로 선반영 / Option B 확정 시 추가 수정 사항 별도 섹션으로 명시 |
| v1.1 | 2026-05-05 | schema 검증 반영: 화면 흐름 2단계 분리 명시(버튼 클릭 후 AI 분석 시작), 방향 5개→목표 후보 3~5개로 수정, `career_results`→`career_interview_results`, `directions`/`selected_direction` 컬럼 없음 명시, 목표 선택 시 `goals` INSERT 구조 명시, `users.coaching_start_at`→`goals.started_at` 수정 |
| v1.0 | 2026-05-04 | 최초 작성 |
