# 12. 회고 (평일 메모 / 주말 회고)

> 기준 프로토타입: `home_0520.html` (p12)
> 작성일: 2026-05-18 / 최종 수정: 2026-05-20
> post-mvp 스펙(`_post_mvp/12_reflect.md`)과 구조는 유사하나 범위가 다름. 본 문서가 구현 기준.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 12_reflect |
| 페이즈 | MAINTAIN |
| 역할 | 한 주 회고 작성 + AI 코치와 다음 주 액션 정하기 진입 (v1.3 매일 동일 화면) |
| 진입 경로 | 탭바 [회고] / 11 홈 [회고하기] 버튼 / 11 홈 메모 유도 카드 |
| 다음 화면 | 11 홈 (탭바) / 13 회고 AI 코칭 (회고 저장 후 CTA 카드) / 15 프로필 (탭바) |

---

## 2. 진입 조건

- `goals` 테이블에 `status='active'` 목표가 존재
- 없으면 `/onboarding/action-items`로 리다이렉트

---

## 3. UI 구성

### 3.1 상단 바 (Topbar)

- 좌측: `CareerPT·` 브랜드
- 우측: `회고` pill

### 3.2 단일 회고 화면 `v1.3 — 평일/주말 분기 폐지`

요일과 무관하게 매일 동일한 화면을 표시. 기존 v1.2의 평일 모드(데일리 메모)와 주말 모드(위클리 회고) 구분은 제거됨.

- 헤더 서브타이틀: `"Week {current_week} 회고 · {요일}요일"`
- 메인 타이틀: `"한 주를 돌아봐요 🌙"` (돌아봐요 accent 강조)
- 단일 입력: 한 줄 회고 (weekly_retros)
- 회고 저장 완료 시 → AI 코치 CTA 카드 노출 → 13 진입

> v1.2 변경 사항: daily_memos UI 제거 (테이블은 schema에 유지되나 본 화면에서 사용 안 함). "데일리/위클리" 모드 분기 폐지.

---

### 3.3 회고 화면 구성 (단일, 매일 동일)

**헤더**
- 서브타이틀: `"Week {current_week} 회고 · {요일}요일"` (13px, weight 700)
- 메인 타이틀: `"한 주를 돌아봐요 🌙"` (28px, weight 800, "돌아봐요" accent 색상)

**안내 문구 카드**
- accent-tint 배경, 좌측 3px accent 보더, `border-radius 0 10px 10px 0`
- 상단: `"💡 이번 주를 돌아보고, 다음 주 액션도 함께 정해요"` (12px, accent, weight 700)
- 본문: `"잘 됐든 안 됐든, 그 이유를 들여다보는 것이 다음 주를 바꿔요. 솔직하게 한 줄 남기고, 다음 주에 이어갈 액션까지 코치와 함께 정해보세요."` (12px, ink-soft)

**이번 주 액션 요약 카드**
- card 스타일, bg-soft 배경, line 보더
- label: "이번 주 액션" (uppercase, 11px, ink-mute)
- `action_items.title` (17px, weight 500)
- 통계 chip 2개:
  - "목표 7회" (bg 배경, ink-soft, 999px pill)
  - "실제 {doneCount}회" (accent-tint 배경, accent 글씨, 999px pill)

**회고 입력**
- label: "한 주를 한 줄로 표현하면" (uppercase, 12px, ink-mute, weight 500)
- textarea: placeholder `"예: 야근이 많아서 1번밖에 못했어요."`, 3행, resize vertical
- 버튼: "회고 저장하기" (accent 배경, 흰색, 전체 너비, 12px border-radius)
- 이미 저장된 회고가 있으면 텍스트 프리필 + 버튼 disabled (`"✓ 저장 완료"`)

**회고 저장 후 안내 문구**
- 버튼 하단: `"회고를 저장하면, 다음 주 액션을 AI 코치와 함께 정해볼 수 있어요."` (12px, ink-mute, 중앙 정렬)

**회고 저장 후 CTA 영역** (`nextWeekCta` — 저장 완료 시 표시)

구분선 + `"다음 주 준비"` 레이블 (uppercase, 11px, ink-mute) 뒤에 CTA 카드 노출.

CTA 카드:
- 흰색 배경, 1.5px line-strong 보더, 18px radius
- 호버 시: accent 보더, box-shadow 전환
- 좌측: 🤖 아이콘 (46×46px, accent-tint 배경, 14px border-radius)
- 우측 텍스트:
  - 타이틀: `"AI 코치와 다음 주 액션 정하기"` (15px, weight 800)
  - 설명: `"이번 주 회고를 바탕으로, 코치가 다음 주에 맞는 액션 아이템을 추천해드려요."` (12px, ink-soft)
- 최우측: `›` (accent, 18px)
- 하단 태그 행 (점선 보더 위):
  - `"✦ 강점 기반 추천"` (accent-tint 배경, accent 글씨, 999px pill, 11px)
  - `"약 3–5분 소요"` (bg-soft 배경, ink-soft 글씨, 999px pill, 11px)
- 탭 시: `/reflect/coach` 진입 → 13 회고 AI 코칭으로 이동

> v1.3 제거 항목: 평일 데일리 메모 입력 + 이번 주 메모 리스트 + 이번 주 평일 메모 요약 카드. daily_memos 테이블은 schema에 남기지만 본 화면에서 사용 안 함.

---

### 3.5 탭바

홈 / 회고(active) / 프로필 — 3탭.

---

## 4. 기능 `v1.3 — 단일 화면으로 단순화`

| 기능 | 동작 |
| --- | --- |
| 진입 시 회고 로드 | `weekly_retros` (user_id, goal_id, current_week) SELECT — 이미 저장된 회고 있으면 textarea 프리필 + 버튼 disabled + CTA 카드 노출 |
| 회고 저장 | "회고 저장하기" → `weekly_retros` INSERT → 버튼 "✓ 저장 완료"로 전환 → **`nextWeekCta` 영역 표시**. UNIQUE 위반(중복 저장 시도) 시 자동으로 저장된 상태로 동기화 |
| 완료 횟수 집계 | 저장 시 `action_completions` (이번 주) 건수를 프론트에서 집계해 `completion_count`에 저장. `target_count = 7` 고정 |
| AI 코칭 진입 CTA | 회고 저장 완료 후 CTA 카드 노출 → 탭 시 `/reflect/coach` 진입 |

---

## 5. 데이터

### 5.1 읽기

| 테이블 | 필드 | 용도 |
| --- | --- | --- |
| `goals` (status='active') | `id`, `current_week` | 회고 저장 시 goal_id, week_number |
| `action_items` (week_number=current_week) | `title` | 이번 주 액션 표시 |
| `action_completions` (이번 주) | `completed_date` | 실제 완료 횟수 집계 |
| `weekly_retros` (user, goal, current_week) | `id`, `summary_one_line` | 이미 저장된 회고 프리필용 (v1.3 신규 — 중복 INSERT 방지) |

### 5.2 쓰기

| 테이블 | 동작 | 시점 |
| --- | --- | --- |
| `weekly_retros` | INSERT | "회고 저장하기" 클릭 |

> v1.3 변경: `daily_memos` UI 폐지로 본 화면에서 daily_memos 읽기/쓰기 없음. 테이블은 schema에 유지 (post-MVP에서 다른 화면이 활용 가능).

**`weekly_retros` INSERT 필드:**
```
goal_id:          현재 active goals.id
week_number:      goals.current_week
retro_date:       오늘 날짜 (date)
summary_one_line: textarea 입력값
completion_count: action_completions 이번 주 건수 (프론트 집계)
target_count:     7 (고정)
```

---

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 메모 빈 텍스트 저장 시도 | textarea 포커스 유지, 저장 안 함 |
| 주말 회고 빈 텍스트 저장 시도 | textarea 포커스 유지, 저장 안 함 |
| 저장 실패 | 토스트 "저장에 실패했어요. 다시 시도해주세요" |
| active goals 없음 | `/onboarding/action-items`로 리다이렉트 |
| 같은 날 메모 중복 저장 | **다중 INSERT 허용 (v1.2)** — `(user_id, memo_date)` UNIQUE 제약 제거됨. 정렬은 `(memo_date, created_at)` 시간순 |
| `nextWeekCta` 재진입 시 | 이미 `weekly_retros` 레코드가 존재하면 화면 진입 시점에 CTA 노출 상태로 초기화 |

---

## 7. 미결 사항 (Post-MVP)

| 항목 | 내용 |
| --- | --- |
| 메모 수정/삭제 | 3일 이내 수정 허용 |
| 주말에도 평일 메모 수동 작성 | 탭 토글로 평일/주말 수동 전환 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.0 | 2026-05-18 | home_0518.html p12 기준으로 최초 작성. 시연용 토글 제거, 날짜 기반 자동 분기로 정의. 13 회고 코칭 진입 Post-MVP로 명시. |
| v1.1 | 2026-05-20 | **[HTML 미반영 항목 반영]** **1.** 다음 화면에 "13 회고 AI 코칭 (주말 회고 저장 후 CTA 카드)" 추가. **3.4** 위클리 안내 문구를 HTML 기준으로 수정("이번 주를 돌아보고, 다음 주 액션도 함께 정해요"). 회고 저장 후 안내 문구("위클리 회고를 저장하면…") 추가. CTA 영역(`nextWeekCta`) 전체 UI 상세 명시 — 카드 구조·아이콘·태그 chip·동작(p13 weekly_retro 모드 진입). **4.** AI 코칭 진입 CTA 기능 행 추가. **7.** "13 회고 코칭 진입 Post-MVP" 항목 제거 (MVP 구현으로 승격). `nextWeekCta` 재진입 예외 처리 추가. |
| v1.2 | 2026-05-21 | **[feature/12 구현 반영 — 다중 메모 정책 + schema v0.8 정합]** **3.3** 평일 메모 — 같은 날에도 메모 여러 개 누적 저장 가능으로 정책 변경. UPSERT(1일 1메모, 덮어쓰기) → INSERT(다중 누적). 메모 리스트에 시간(HH:MM) 표시 추가, `(memo_date, created_at)` 시간순 정렬. **4.** 평일 메모 저장 동작 INSERT 누적으로 갱신. 11 홈 타임라인 메모 요약은 v1.2에서 제거됨에 따라 renderTimeline 호출 불필요. **5.2** daily_memos UPSERT → INSERT (다중 누적). **6.** 같은 날 메모 중복 저장 예외 처리 변경 — UPSERT 처리 → 다중 INSERT 허용 (`UNIQUE(user_id, memo_date)` 제약 제거됨, schema v0.8). |
| v1.3 | 2026-05-23 | **[단일 회고 화면으로 단순화 — 평일/주말 분기 폐지]** **1.** 역할: "평일: 일일 메모 / 주말: 주간 회고" → "한 주 회고 작성 + AI 코치 진입 (매일 동일 화면)". **3.2** 모드 분기 제거 → "단일 회고 화면" 명세로 변경. **3.3** 평일 모드 섹션 제거. **3.4** 주말 모드 섹션 제거 후 단일 회고 UI 구성으로 통합 (헤더/안내/이번 주 액션 요약/회고 입력/CTA). 헤더 카피 "한 주를 마감해요" → "한 주를 돌아봐요"로 일반화 (주말 한정 어휘 제거). **4.** 기능 표 단순화 — 평일 메모 저장, 주말 모드, 메모 리스트 모두 제거. 진입 시 weekly_retros 프리필 + UNIQUE 위반 대응 명시. **5.1** 읽기에서 daily_memos 제거, weekly_retros 추가. **5.2** 쓰기에서 daily_memos 제거. daily_memos 테이블은 schema에 유지하되 본 화면에서 사용 안 함 (post-MVP에서 다른 화면이 활용 가능). |
