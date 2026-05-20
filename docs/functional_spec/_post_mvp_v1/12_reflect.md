# 12. 회고 (평일/주말)

> 평일에는 일일 메모를 작성하고, 주말에는 한 주 메모를 기반으로 주간 회고를 완성.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 12_reflect |
| 페이즈 | MAINTAIN |
| 역할 | 평일 메모 + 주말 회고 |
| 진입 경로 | 탭바 "회고", 11 알림 카드 |
| 다음 화면 | 13 회고 코칭 (주말 회고 후) |

---

## 2. 진입 조건

- `goals` 테이블에 `status='active'`인 목표가 있는 경우
- 탭바 "회고" 선택
- 자동 분기: 토/일 = 주말 모드, 그 외 = 평일 모드 (수동 토글 가능)

> ⚠️ **schema 정책**: `daily_memos.goal_id` NOT NULL이므로 active 목표가 없으면 메모/회고 화면 접근 불가.
> PAUSED 상태(active 없음)에서는 "목표를 먼저 설정해주세요" 안내 표시.

---

## 3. UI 구성

### 3.1 공통 상단 바

- 페이지 타이틀: "회고"
- 우측: 평일/주말 모드 수동 토글

### 3.2 평일 모드

#### 헤더

- "오늘은 어땠어요?"
- 오늘 요일 표시

#### 이번 주 액션 카드

- 현재 주차 액션 텍스트 (단일 항목) + 이번 주 진행률 ("N/7 완료")

#### 메모 입력

- textarea (최대 500자, 글자수 실시간 표시)
- "저장" 버튼

#### 메모 리스트 (이번 주, 월~금)

- 요일 + 날짜 + 내용
- 수정/삭제 버튼: 3일 이내만 노출, 그 이후는 읽기 전용

> ⚠️ **v1 미구현**: 프로토타입 v6에서 메모 리스트는 읽기 전용으로만 표시됨 (수정/삭제 버튼 없음).
> v2에서 3일 이내 수정/삭제 기능 추가 예정.

#### 회고 코칭 카드 (평일 중 약하게 노출)

- "이번 주 회고를 미리 시작해볼까요?" → 13

### 3.3 주말 모드 `v1.2 수정 — 시각화 방식·완료 기준 확정`

#### 헤더

- "한 주를 마감해요"
- 주차 + 요일

#### 이번 주 액션 요약 카드

- **완료 현황**: "N / 7 완료" (N = 이번 주 `action_completions` 건수, 분모 7일 고정)
- **시각화: 가로 막대 그래프** (확정)
  - 전체 너비 = 7일 기준
  - 완료 날 수만큼 accent 색상으로 채움
  - CSS 기반 구현 (SVG 불필요)
  - 예: 3일 완료 시 → 막대 3/7 채워진 상태

#### 평일 메모 컨텍스트

- 이번 주 평일(월~금) 메모 리스트 자동 노출
- 메모 없는 날: "메모 없음" 표시

#### 회고 입력

- 한 주 회고 textarea (최대 1000자, 글자수 실시간 표시)
- 가이드 prompt (선택 노출): "이번 주 어떤 점이 좋았나요?"

#### 저장 + CTA `v1.2 수정 — v1 미구현 주석 추가`

- Secondary: "저장만 하기" → 회고 저장 후 11 홈 복귀

> ⚠️ **v1 미구현**: 프로토타입 v6에 "저장만 하기" 버튼 없음. 다음 버전에서 추가 필요.

- Primary: "코치와 이야기 나누기 →" → 회고 저장 + 13 회고 코칭 진입

---

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 모드 자동 분기 | 토/일 = 주말, 그 외 = 평일 (사용자 토글로 변경 가능) |
| 메모 저장 | `daily_memos` INSERT (`goal_id`, `memo_date`, `content`, `week_number`) |
| 메모 수정 | 3일 이내만 가능, 그 외 읽기 전용 (v2 구현) |
| 메모 삭제 | 확인 다이얼로그 (v2 구현) |
| 주간 회고 저장 | `weekly_retros` INSERT (`goal_id`, `week_number`, `retro_date`, `summary_one_line`, `completion_count`, `target_count`) |
| 완료 횟수 자동 집계 | 이번 주 `action_completions` 건수 → `completion_count` / `target_count = 7` (7일 고정) 프론트에서 계산 후 함께 저장 |
| "저장만 하기" 클릭 | `weekly_retros` INSERT → 11 홈 복귀 (코칭 미진입) |
| "코치와 이야기 나누기" 클릭 | `weekly_retros` INSERT → 13 회고 코칭 진입 |

> ⚠️ **schema 불일치 수정 완료**:
> - `weekday_memos` → `daily_memos` (테이블명)
> - 저장 컬럼: `week_num`/`day_of_week` → `memo_date(date)` + `week_number(int)`
> - `weekly_actions.reflection` → `weekly_retros` 별도 row INSERT
> - `weekly_retros.target_count`: `action_items` 수 기준 → **7 고정** (11_home.md 진행률 기준과 정합)

---

## 5. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 메모 미작성 상태로 주간 회고 시도 | "최소 1개 메모를 작성해주세요" 안내 |
| 메모 미입력 저장 | 차단, 포커스 유지 |
| 메모 500자 초과 | 입력 제한 |
| 주간 회고 저장 실패 | 로컬 임시 저장 후 재전송 유도 |
| 회고 1000자 초과 | 입력 제한 |
| 모드 강제 변경 | 토글로 가능 (예: 토요일에 평일 메모 작성) |
| HTML 입력 | XSS 방지 위해 escape 후 저장 |

---

## 6. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `reflect_view` | `mode=weekday/weekend` |
| `memo_saved` | `week_number`, `day_of_week`, `length` |
| `memo_edited` | — |
| `memo_deleted` | — |
| `weekly_reflection_saved` | `week_number`, `length`, `via=save_only/coaching` |
| `coaching_initiated_from_reflect` | — |

---

## 7. 접근성

- textarea는 적절한 레이블링 (`aria-label`)
- 저장 성공/실패는 `aria-live="polite"`로 알림
- 모드 토글은 토글 버튼 ARIA 패턴 (`aria-pressed`)
- 막대 그래프는 `aria-label="7일 중 N일 완료"` 텍스트로 대체 제공

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 반영: **① 주말 모드 시각화 방식 가로 막대 그래프로 확정** (CSS 기반, SVG 불필요 — 11_home.md 7칸 그리드와 시각 언어 통일) / **② 완료 기준 7일 고정으로 확정** — target_count = 7 고정 (action_items 수 기준에서 변경, 11_home.md 진행률 기준과 정합) / **③ "저장만 하기" v1 미구현 주석 추가** (다음 버전 구현 필요) / **④ 메모 수정/삭제 v2 구현 대상 명시** (v1 프로토타입은 읽기 전용) / weekly_reflection_saved 이벤트에 `via` 속성 추가 (저장만/코칭 경로 구분) |
| v1.1 | 2026-05-05 | schema 검증 반영: 진입 조건 PAUSED/active 없음 시 접근 불가 명시, `weekday_memos`→`daily_memos`, 저장 컬럼 수정(memo_date+week_number), `weekly_actions.reflection`→`weekly_retros` INSERT, completion_count/target_count 프론트 집계 방식 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
