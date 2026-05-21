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
| 역할 | 평일: 일일 메모 작성 / 주말: 주간 회고 작성 + AI 코칭 진입 |
| 진입 경로 | 탭바 [회고] / 11 홈 [회고하기] 버튼 / 11 홈 메모 유도 카드 |
| 다음 화면 | 11 홈 (탭바) / 13 회고 AI 코칭 (주말 회고 저장 후 CTA 카드) / 15 프로필 (탭바) |

---

## 2. 진입 조건

- `goals` 테이블에 `status='active'` 목표가 존재
- 없으면 `/onboarding/action-items`로 리다이렉트

---

## 3. UI 구성

### 3.1 상단 바 (Topbar)

- 좌측: `CareerPT·` 브랜드
- 우측: `회고` pill

### 3.2 모드 분기

현재 날짜(요일) 기준으로 자동 분기:
- 월~금 → **평일 모드** (`reflectWeekday` 표시)
- 토~일 → **주말 모드** (`reflectWeekend` 표시)

> 프로토타입에는 시연용 토글(평일/주말 버튼)이 있으나, 실제 구현에서는 제거하고 날짜 기반 자동 분기만 적용.

---

### 3.3 평일 모드

**헤더**
- 서브타이틀: `"매일의 메모 · {요일}요일"` (13px, weight 700)
- 메인 타이틀: `"오늘은 어땠어요? 🌱"` (28px, weight 800, "어땠어요?" accent 색상)

**안내 문구 카드**
- accent-tint 배경, 좌측 3px accent 보더, `border-radius 0 10px 10px 0`
- 상단: `"💡 오늘 기록이 주말 회고의 재료가 돼요"` (12px, accent, weight 700)
- 본문: `"오늘 액션을 실행하면서 어떤 느낌이었는지 짧게 기록해두세요. 잘 됐든 안 됐든, 솔직한 한 줄이면 충분해요."` (12px, ink-soft)

**이번 주 액션 표시**
- 배경: bg-soft(`#f5f7fa`), 점선(`dashed`) 보더, 18px radius, 패딩 20px
- label: "이번 주 액션" (uppercase, 11px, ink-mute, letter-spacing .1em)
- 내용: `action_items.title` (현재 주차, 16px, weight 500)

**메모 입력**
- label: "오늘의 메모" (uppercase, 12px, ink-mute, weight 500)
- textarea: placeholder `"예: 오늘은 30분 읽고 3줄 메모 남김."`, 4행, min-height 100px, resize vertical
- 버튼: "메모 저장" (ink 배경, 흰색 글씨, 전체 너비, 12px border-radius)

**이번 주 메모 리스트** (메모 1개 이상 존재 시 노출)
- 섹션 타이틀: `"이번 주 메모 · {N}개"` (13px, weight 700, margin-top 28px)
- 각 메모 카드: 좌측 요일 레이블(day-letter) + 날짜(day-date) + **시간(HH:MM, v1.2 신규)**, 우측 메모 텍스트
  - 예: `[월 / 4/22 / 14:32]` | `"월요일은 의지가 강했음. 30분 읽고 3줄 메모 남김."`
- 정렬: `memo_date` 우선, 동일 날짜 내에서는 `created_at` 오름차순 (시간 순)
- 메모 없음: 리스트 영역 미노출

> **v1.2 정책 변경: 같은 날에도 메모 여러 개 누적 저장 가능.**
> 기존 UPSERT(1일 1메모, 덮어쓰기) → INSERT(다중 누적). 시간 표시로 구분.

---

### 3.4 주말 모드

**헤더**
- 서브타이틀: `"Week {n} 위클리 회고 · {토/일}요일"` (13px, weight 700)
- 메인 타이틀: `"한 주를 마감해요 🌙"` (28px, weight 800, "마감해요" accent 색상)

**안내 문구 카드**
- accent-tint 배경, 좌측 3px accent 보더, `border-radius 0 10px 10px 0`
- 상단: `"💡 이번 주를 돌아보고, 다음 주 액션도 함께 정해요"` (12px, accent, weight 700)
- 본문: `"잘 됐든 안 됐든, 그 이유를 들여다보는 것이 다음 주를 바꿔요. 평일 메모를 참고해서 한 주를 솔직하게 돌아보고, 다음 주에 이어갈 액션까지 정해보세요."` (12px, ink-soft)

**이번 주 평일 메모 요약**
- 배경: bg-soft(`#f5f7fa`), 1px line 보더, 14px radius, 패딩 14px 16px
- label: `"✏️ 이번 주 메모"` (uppercase, 11px, ink-mute, weight 700)
- 메모 있음: 요일 chip(accent-light 배경, accent 글씨, 999px pill) + 메모 텍스트 목록 (각 행 하단 1px line 보더), 하단 `"총 N개의 메모"` (11px, ink-mute)
- 메모 없음: `"평일 메모가 없어요. 데일리 회고 탭에서 기록해보세요."` (12px, ink-mute)

**이번 주 액션 요약 카드**
- card 스타일, bg-soft 배경, line 보더
- label: "이번 주 액션" (uppercase, 11px, ink-mute)
- `action_items.title` (17px, weight 500)
- 통계 chip 2개:
  - "목표 7회" (bg 배경, ink-soft, 999px pill)
  - "실제 {doneCount}회" (accent-tint 배경, accent 글씨, 999px pill)

**주간 회고 입력**
- label: "한 주를 한 줄로 표현하면" (uppercase, 12px, ink-mute, weight 500)
- textarea: placeholder `"예: 야근이 많아서 1번밖에 못했어요."`, 3행, resize vertical
- 버튼: "회고 저장하기" (accent 배경, 흰색, 전체 너비, 12px border-radius)

**회고 저장 후 안내 문구**
- 버튼 하단: `"위클리 회고를 저장하면, 다음 주 액션을 AI 코치와 함께 정해볼 수 있어요."` (12px, ink-mute, 중앙 정렬)

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
- 탭 시: `nav('p13', 'weekly_retro')` → 13 회고 AI 코칭으로 이동

---

### 3.5 탭바

홈 / 회고(active) / 프로필 — 3탭.

---

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 모드 자동 분기 | 오늘 요일 기준. 월~금=평일, 토~일=주말 |
| 평일 메모 저장 | textarea 입력 후 "메모 저장" → `daily_memos` **INSERT (누적, v1.2)** → textarea 초기화 + 메모 리스트 append. 11 홈 타임라인 메모 요약은 v1.2에서 제거됨 (renderTimeline 호출 불필요) |
| 주말 회고 저장 | "회고 저장하기" → `weekly_retros` INSERT → 버튼 2초간 "✓ 저장 완료" 표시 후 복원 → **`nextWeekCta` 영역 표시** |
| 주말 완료 횟수 집계 | 저장 시 `action_completions` (이번 주) 건수를 프론트에서 집계해 `completion_count`에 저장. `target_count = 7` 고정 |
| 메모 리스트 | 이번 주 월~금 메모 전체 표시 (저장 순서 아닌 요일 순) |
| 주말 메모 요약 | 이번 주 평일 메모를 요일 chip과 함께 표시 |
| AI 코칭 진입 CTA | 주말 회고 저장 완료 후 CTA 카드 노출 → 탭 시 13 회고 AI 코칭으로 이동 |

---

## 5. 데이터

### 5.1 읽기

| 테이블 | 필드 | 용도 |
| --- | --- | --- |
| `goals` (status='active') | `id`, `current_week` | 메모/회고 저장 시 goal_id, week_number |
| `action_items` (week_number=current_week) | `title` | 액션 텍스트 표시 (평일·주말 모두) |
| `action_completions` (이번 주) | `completed_date` | 주말 실제 완료 횟수 집계 |
| `daily_memos` (이번 주) | `content`, `memo_date` | 평일 메모 리스트, 주말 메모 요약 |

### 5.2 쓰기

| 테이블 | 동작 | 시점 |
| --- | --- | --- |
| `daily_memos` | **INSERT (다중 누적, v1.2)** | 평일 "메모 저장" 클릭 — 같은 날에도 새 row 추가 |
| `weekly_retros` | INSERT | 주말 "회고 저장하기" 클릭 |

**`daily_memos` INSERT 필드:**
```
goal_id:      현재 active goals.id
memo_date:    오늘 날짜 (date)
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
