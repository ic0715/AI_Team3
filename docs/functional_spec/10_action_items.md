# 10. 액션 아이템 선택

> 09에서 선택한 커리어 방향에 맞춰 AI가 추천한 실행 과제(액션) 중 1개를 선택하고 12주 코칭을 시작.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 10_action_items |
| 페이즈 | DO |
| 역할 | 12주 첫 주 액션 확정 + 12주 코칭 시작 |
| 이전 화면 | 09 커리어 방향 결과 |
| 다음 화면 | NEW02 12주 시작 안내 → 11 홈 |

---

## 2. 진입 조건

- 09에서 목표 선택 후 `goals` INSERT 완료된 상태
- `goals` 테이블에 `status='active'`인 목표가 있는 상태
- 해당 목표의 현재 주차(`current_week`)에 `action_items`가 아직 없는 경우 (AI 생성 전)

> ⚠️ **schema 불일치 수정 완료**: `career_results.selected_direction` 컬럼 없음 → `goals.goal_title` 사용.
> `users.coaching_start_at` 없음 → `goals.started_at`으로 대체.

---

## 3. UI 구성

### 3.1 상단 바

- 뒤로가기 → 09 (선택 변경 가능)
- 페이지 타이틀: "액션 아이템 선택"

### 3.2 상단 goal pill `v1.2 수정 — 선택 수 badge 추가`

> 프로토타입 기준으로 확정. 목표명 pill과 현재 선택 수 badge를 함께 표시.

- `goals.goal_title` 표시 (pill 형태, 예: "🎯 비판적 사고")
- 선택 수 badge: 선택된 액션 수 실시간 표시 (예: "1")
  - 미선택 시: badge 미표시 또는 "0"
  - 1개 선택 시: "1" (accent 색상)
- 부가 레이블: "12주 동안 키울 목표"

### 3.3 안내 패널 `v1.2 수정 — 선택 개수 확정`

- "지금 시작할 수 있는 작은 행동을 1개 골라주세요"
- "꾸준함이 중요해요. 매일/매주 부담 없이 할 수 있는 걸로!"

### 3.4 추천 액션 리스트 (3~5개)

각 카드:

- 선택 버튼 (단일 선택 — radio 패턴)
- 액션 제목 (예: "주 3회 30분, 비즈니스 케이스 스터디")
- 설명 (2~3문장)
- 메타 태그: 시간(예: "30분/일"), 난이도(쉬움/보통/도전적), 유형(읽기/쓰기/실습/대화)
- 상태: 기본 / hover / selected

### 3.5 커스텀 액션 영역 `v1.2 수정 — maxlength 확정`

- 텍스트 입력 **(5~50자)** — 기존 "5~80자"에서 수정
- "추가" 버튼
- 추가된 커스텀 항목 선택 시 기존 추천 선택 해제 (단일 선택 유지)
- 커스텀 항목 삭제 버튼

### 3.6 하단 summary 영역 `v1.2 수정 — 구성 프로토타입 기준으로 변경`

> 기존 "선택된 방향 + 액션 미리보기 + 12주 시작 준비 완료!" 구성에서 변경.

- 좌측: 목표명 pill (예: "🎯 비판적 사고")
- 우측: 선택 개수 badge (예: "1")

### 3.7 Bottom CTA

- **"홈으로 시작하기 🚀"** (1개 선택 시 활성화) → NEW02 시작 안내로 이동
- 미선택 시: disabled 상태 유지

---

## 4. 기능 `v1.2 수정 — 유저 선택 UX로 확정`

> **화면 성격 확정**: 유저가 AI 추천 목록에서 직접 1개를 선택하는 UX.
> 기존 v1.1의 "AI 자동 생성 로딩 화면" 정의는 삭제. 프로토타입 v6 기준으로 확정.
>
> AI 추천 액션 목록은 화면 진입 시 이미 생성된 상태로 표시됨.
> (백그라운드에서 09 목표 선택 직후 AI 생성 완료 → 10 진입 시 즉시 렌더링)

| 기능 | 동작 |
| --- | --- |
| 화면 진입 시 | AI가 생성한 추천 액션 목록 표시 (로딩이 필요한 경우 skeleton UI) |
| 추천 액션 선택 | 단일 선택 (radio 패턴). 선택 시 상단 badge +1, 다른 항목 자동 해제 |
| 커스텀 액션 추가 | `action_items` INSERT (`is_custom=true`). 추가 후 자동 선택 상태로 전환 |
| 커스텀 액션 삭제 | 해당 row 삭제. 선택 상태이던 경우 선택 해제 |
| "홈으로 시작하기" 클릭 | 선택된 액션 `action_items` INSERT (week_number=1) → `goals.started_at` 기록 → NEW02 이동 |

---

## 5. 데이터

- 읽기: `goals` (active, goal_title, goal_category, current_week), `profiles` (job_field, career_level)
- 쓰기: 선택된 `action_items` INSERT (week_number=1, is_custom=false)
- 커스텀 추가 시: `action_items` INSERT (is_custom=true)
- 전체 작업은 트랜잭션으로 처리 (실패 시 롤백)

> ⚠️ **schema 불일치 수정 완료**:
> - `career_focus` 테이블 없음 → `goals` 테이블로 대체
> - `weekly_actions` 테이블 없음 → `action_items` 테이블로 대체 (week_number 컬럼으로 주차 구분)
> - `action_items.items JSONB` 구조 없음 → 각 액션아이템이 별도 row (title, description, tags, is_custom 컬럼)
> - `users.coaching_start_at` 없음 → `goals.started_at`으로 대체

---

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 미선택 상태 CTA 클릭 | CTA disabled |
| 커스텀 입력 공백/5자 미만 | 인라인 에러, 저장 불가 |
| 커스텀 입력 50자 초과 | maxlength로 입력 차단 |
| 커스텀 욕설 감지 | 인라인 에러, 저장 불가 |
| 선택값 저장 실패 | 토스트 + 재시도 |
| action_items 생성 실패 | 트랜잭션 롤백, 재시도 |
| 추천 액션 목록 로드 실패 | fallback 추천 액션 3개 표시 + 안내 |
| 새로고침 | DB 복원 |
| 중복 클릭 | 첫 클릭 시 disabled |

---

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `action_selection_view` | — |
| `action_option_selected` | `action_id`, `kind=recommended/custom` |
| `custom_action_added` | — |
| `cycle_started` | `direction_title`, `goal_category`, `time_from_signup` |

---

## 8. 접근성

- 추천 액션 카드는 radio group 패턴 (`role="radiogroup"`)
- 커스텀 입력 라벨 명확 (`aria-label`)
- 선택 결과 badge는 `aria-live="polite"`로 즉시 알림
- CTA 활성/비활성 상태는 `aria-disabled`로 명시

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 반영: **① 화면 성격 확정** — "AI 자동 생성 로딩 화면" 정의 삭제, 유저가 직접 1개 선택하는 UX로 확정 / **② 선택 개수 1개로 확정** (프로토타입 기준) — 3.3 안내 패널·3.4 카드·3.7 CTA 전반 수정 / **③ 커스텀 maxlength 5~50자로 확정** (기존 5~80자에서 수정) / **④ 하단 summary 영역 프로토타입 기준으로 변경** — "12주 시작 준비 완료!" 문구 삭제, 목표명 pill + 선택 수 badge 구성으로 변경 / **⑤ 상단 goal pill 선택 수 badge 명세 추가** (3.2항 신규) |
| v1.1 | 2026-05-05 | schema 검증 반영: 화면 역할 재정의(유저 선택→AI 자동 생성 로딩 화면), `career_results.selected_direction`→`goals.goal_title`, `career_focus`·`weekly_actions` 테이블 없음(→`goals`·`action_items`), `action_items.items JSONB`→별도 row 구조, `users.coaching_start_at`→`goals.started_at` 수정 |
| v1.0 | 2026-05-04 | 최초 작성 |
