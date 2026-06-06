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

### 3.2 단일 회고 화면 `v1.5 — 주간 회고 입력 영역 제거, AI 코치 CTA 항상 노출`

요일과 무관하게 매일 동일한 화면을 표시.

- 헤더 서브타이틀: `"Week {current_week} 회고 · {요일}요일"`
- 메인 타이틀: `"한 주를 돌아봐요 🌙"` (돌아봐요 accent 강조)
- 영역 구성 (위→아래 순서):
  1. 안내 카드 ("💡 오늘을 기록하면, 다음 주가 또렷해져요!")
  2. 이번 주 액션 요약 카드 (목표 7회 / 실제 {doneCount}회)
  3. **데일리 메모 입력 + 저장 버튼** (textarea, ink 배경 버튼)
  4. **이번 주 메모 리스트** (1개 이상 있을 때만 표시)
  5. 구분선
  6. **AI 코치 CTA 카드** (항상 노출, 진입 조건 없음)

> v1.4 → v1.5: "한 주를 한 줄로 표현하면" 주간 회고 textarea + "회고 저장하기" 버튼 + 안내 문구 모두 제거. **`weekly_retros` 저장이 더 이상 본 화면의 진입 조건이 아님**. AI 코치 CTA는 항상 클릭 가능하며, 누르면 곧바로 13 코칭 화면으로 진입. 13 코칭은 `weekly_retros` FK가 nullable로 처리되어 있어 회고 미저장 상태에서도 정상 작동.

---

### 3.3 회고 화면 구성 (단일, 매일 동일) `v1.5`

**헤더**
- 서브타이틀: `"Week {current_week} 회고 · {요일}요일"` (13px, weight 700)
- 메인 타이틀: `"한 주를 돌아봐요 🌙"` (28px, weight 800, "돌아봐요" accent 색상)

**안내 문구 카드** (v1.6 카피 변경)
- accent-tint 배경, 좌측 3px accent 보더, `border-radius 0 10px 10px 0`
- 상단: `"💡 오늘을 기록하면, 다음 주가 또렷해져요!"` (12px, accent, weight 700)
- 본문: `"오늘 액션을 실행하며 느낀 점을 가볍게 메모해두세요. 이 기록이 쌓이면, AI 코치와 다음 주 액션을 더 또렷하게 정할 수 있어요."` (12px, ink-soft)

**이번 주 액션 요약 카드**
- card 스타일, bg-soft 배경, line 보더
- label: "이번 주 액션" (uppercase, 11px, ink-mute)
- `action_items.title` (17px, weight 500)
- 통계 chip 2개:
  - "목표 7회" (bg 배경, ink-soft, 999px pill)
  - "실제 {doneCount}회" (accent-tint 배경, accent 글씨, 999px pill)

**데일리 메모 입력** (v1.4 신규)
- label: "오늘의 메모" (uppercase, 12px, ink-mute, weight 500)
- textarea: placeholder `"예: 오늘은 30분 읽고 3줄 메모 남김."`, 3행, resize vertical
- 버튼: "메모 저장" (ink 배경, 흰색 글씨, 전체 너비, 12px border-radius)
- 저장 시 `daily_memos` INSERT (다중 누적, schema v0.8)
- 같은 날에도 여러 번 저장 가능, 저장 후 textarea 초기화

**이번 주 메모 리스트** (1개 이상 있을 때만 표시)
- 섹션 타이틀: `"이번 주 메모 · {N}개"` (13px, weight 700, margin-top 28px)
- 각 row: 좌측 요일 레이블(day-letter) + 날짜(M.D) + 시간(HH:MM), 우측 메모 텍스트
  - 예: `[월 · 4.22 · 14:32]` | `"월요일은 의지가 강했음. 30분 읽고 3줄 메모 남김."`
- 정렬: `memo_date` 오름차순, 동일 날 `created_at` 오름차순 (시간 순)

**구분선** (메모 영역과 AI 코치 CTA 영역 분리)

**AI 코치 CTA 영역** (v1.5 — 항상 노출, 진입 조건 없음)

구분선 + `"다음 주 준비"` 레이블 (uppercase, 11px, ink-mute) 뒤에 CTA 카드 노출.

CTA 카드:
- 흰색 배경, 1.5px line-strong 보더, 18px radius
- 호버 시: accent 보더, box-shadow 전환
- 좌측: 🤖 아이콘 (46×46px, accent-tint 배경, 14px border-radius)
- 우측 텍스트:
  - 타이틀: `"AI 코치와 다음 주 액션 정하기"` (15px, weight 800)
  - 설명 (v1.6 변경): `"이번 주 회고를 바탕으로 다음 주 액션 아이템을 추천해드려요. (주말 시행 권장)"` (12px, ink-soft) — 문구 간결화
- 최우측: `›` (accent, 18px)
- 하단 태그 행 (점선 보더 위):
  - `"✦ 강점 기반 추천"` (accent-tint 배경, accent 글씨, 999px pill, 11px)
  - `"약 3–5분 소요"` (bg-soft 배경, ink-soft 글씨, 999px pill, 11px)
- 탭 시: `/reflect/coach` 진입 → 13 회고 AI 코칭으로 이동

---

### 3.5 탭바

홈 / 회고(active) / 프로필 — 3탭.

---

## 4. 기능 `v1.5 — 주간 회고 입력 영역 제거`

| 기능 | 동작 |
| --- | --- |
| 진입 시 데이터 로드 | 3가지 병렬 SELECT: `action_items` (이번 주차), `action_completions` (이번 주), `daily_memos` (이번 주 전체). `weekly_retros` 로드 제거 (v1.5) |
| 진입 시 메모 리스트 표시 | `daily_memos` 이번 주 결과를 시간 순으로 리스트 표시 (1개 이상일 때만) |
| 데일리 메모 저장 | "메모 저장" → `daily_memos` INSERT (다중 누적) → 로컬 리스트에 즉시 append + textarea 초기화 |
| AI 코칭 진입 CTA | CTA 카드 **항상 노출**. 탭 시 `/reflect/coach` 진입. (v1.5 — 주간 회고 저장 조건 제거) |

> v1.5 변경: 주간 회고 textarea + "회고 저장하기" 버튼이 화면에서 제거되었으므로 본 화면에서 `weekly_retros` 읽기/쓰기 없음. 13 코칭 페이지의 `coaching_insights.weekly_retro_id`는 schema상 nullable이라 회고 없이도 정상 작동.

---

## 5. 데이터

### 5.1 읽기

| 테이블 | 필드 | 용도 |
| --- | --- | --- |
| `goals` (status='active') | `id`, `current_week` | 메모 저장 시 goal_id, week_number |
| `action_items` (week_number=current_week) | `id`, `title` | 이번 주 액션 표시 |
| `action_completions` (이번 주) | `completed_date` | 실제 완료 횟수 집계 |
| `daily_memos` (user, goal, 이번 주 범위) | `id`, `memo_date`, `content`, `created_at` | 이번 주 메모 리스트 표시 |

### 5.2 쓰기

| 테이블 | 동작 | 시점 |
| --- | --- | --- |
| `daily_memos` | INSERT (다중 누적, schema v0.8) | "메모 저장" 클릭 — 같은 날에도 새 row 추가 가능 |

> v1.5 변경: `weekly_retros` 읽기/쓰기 모두 본 화면에서 제거. weekly_retros 테이블은 schema에 유지 (post-MVP에서 필요 시 활용).

**`daily_memos` INSERT 필드:**
```
user_id:      현재 user.id
goal_id:      현재 active goals.id
memo_date:    오늘 날짜 (date, YYYY-MM-DD)
week_number:  goals.current_week
content:      textarea 입력값
```

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
| v1.4 | 2026-05-24 | **[데일리 메모 부활 — 매일 다중 누적 + 리스트 표시]** v1.3에서 제거했던 데일리 메모 UI 복원. 평일/주말 분기는 v1.3 그대로 폐지 유지. 매일 동일 화면에 **데일리 메모(다중 누적)** + **주간 회고(1주 1개)** 두 영역 병행 노출. **3.2** 화면 구성에 데일리 메모 입력 + 이번 주 메모 리스트 추가. **3.3** 안내 카드 카피 "💡 매일 짧게 기록하고, 한 주를 마무리하며 정리해요"로 변경. **4.** 기능 표에 데일리 메모 저장 항목 추가, 진입 시 daily_memos SELECT 추가. **5.1** daily_memos 읽기 부활, **5.2** daily_memos INSERT (다중 누적, schema v0.8) 부활. **AI 코치 CTA 설명 문구 변경**: "이번 주 회고를 바탕으로, 코치가 다음 주에 맞는 액션 아이템을 추천해드려요." → "이번 주 회고를 바탕으로, 코치가 다음 주에 맞는 액션 아이템을 추천해드려요. **(주말 시행 권장)**". |
| v1.5 | 2026-05-24 | **[주간 회고 입력 영역 제거 + AI 코치 CTA 항상 노출]** **3.2 / 3.3** "한 주를 한 줄로 표현하면" textarea + "회고 저장하기" 버튼 + 저장 후 안내 문구 모두 제거. 안내 카드 카피 "💡 오늘의 느낌을 짧게 기록하고, 다음 주는 AI 코치와 함께 정해요"로 변경. **4.** 진입 시 weekly_retros SELECT 제거 (3가지 병렬 → action_items/action_completions/daily_memos만). 회고 저장 기능 행 제거. **AI 코치 CTA는 진입 조건 없이 항상 노출** (이전: 회고 저장 후 노출). **5.** weekly_retros 읽기/쓰기 모두 본 화면에서 제거. 13 코칭 페이지의 `coaching_insights.weekly_retro_id`는 schema상 nullable이라 회고 미저장 상태로도 코칭 진입 가능. weekly_retros 테이블은 schema에 유지 (post-MVP에서 필요 시 활용). |
| v1.6 | 2026-06-06 | **[안내 카드 + AI 코치 CTA 카피 정비 — 구현 정합]** **3.2 / 3.3 안내 문구 카드** 상단 "💡 오늘의 느낌을 짧게 기록하고, 다음 주는 AI 코치와 함께 정해요" → "**💡 오늘을 기록하면, 다음 주가 또렷해져요!**", 본문 "오늘 액션을 실행하면서 느낀 점을 메모로 남겨두세요. 한 주를 마무리할 때쯤 AI 코치와 다음 주 액션을 정해보세요." → "**오늘 액션을 실행하며 느낀 점을 가볍게 메모해두세요. 이 기록이 쌓이면, AI 코치와 다음 주 액션을 더 또렷하게 정할 수 있어요.**" **3.4 AI 코치 CTA 설명** "이번 주 회고를 바탕으로, 코치가 다음 주에 맞는 액션 아이템을 추천해드려요. (주말 시행 권장)" → "**이번 주 회고를 바탕으로 다음 주 액션 아이템을 추천해드려요. (주말 시행 권장)**" (문구 간결화). 동작/로직 변경 없음, 카피만 조정. |
