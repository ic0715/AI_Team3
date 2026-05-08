# 11. 홈 (12주 코칭 대시보드)

> 유저가 매일 방문하여 12주 코칭 진행 현황·오늘의 액션·주간 타임라인을 확인하고 동기를 유지하는 메인 화면.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 11_home |
| 페이즈 | MAINTAIN |
| 역할 | 12주 여정 진행 상태 + 오늘 액션 + 회고 유도 |
| 진입 경로 | NEW02 시작 안내 통과, 탭바 "홈" 선택, 02 로그인 후 ACTIVE 사용자 |
| 다음 화면 | 12 회고 / 13 코칭 / 14 히스토리 / 15 프로필 / NEW03 (12주 완주 시) |

---

## 2. 진입 조건

- `goals` 테이블에 `status='active'` 또는 `status='paused'`인 목표가 있는 경우
- 탭바 "홈" 선택 시
- 또는 NEW02 시작 안내 통과 후

> PAUSED 상태 처리는 v2 구현 대상 (아래 3.1항 참조)

---

## 3. UI 구성

### 3.1 상단 바 `v1.2 수정 — 프로토타입 수정 권고 주석 추가`

- 좌: CareerPT 로고
- 우: 알림 아이콘 (미읽음 시 빨간 dot badge) → (v2 구현)
- 우: 프로필 아이콘 (avatar 또는 이니셜 원형) → 15 프로필

> ⚠️ **프로토타입 수정 필요**: 프로토타입 v6에 알림 아이콘·프로필 아이콘 미구현.
> 15 프로필의 유일한 진입점이므로 다음 버전에서 반드시 추가 필요.

### 3.2 인사 영역

- "안녕하세요, {name}님 👋"
- "{date} ({weekday}) · {currentWeek}주차 진행 중"

### 3.3 12주 테마 카드 `v1.2 수정 — 레이블 계산 방식 확정`

- **테마 카드 레이블**: "Q{n} · 12주 테마" 형태로 표시
  - `n` = 동일 `user_id`의 `goals` 전체 row 중 현재 목표의 순번 (프론트 계산)
  - 예: 첫 번째 목표 → "Q1 · 12주 테마", 두 번째 목표 → "Q2 · 12주 테마"
  - DB 컬럼 추가 없이 클라이언트에서 `goals` row 순번으로 계산
- 현재 목표 (`goals.goal_title`, `status='active'`)
- 진행 주차 표시 (`goals.current_week` / `goals.total_weeks` 예: "3 / 12 주")
- 다음 회고 코칭 일정 ("이번 주 일요일 저녁")
- 12주 dot indicator (완료/현재/예정 색상 구분)

### 3.4 오늘의 액션 카드 `v1.2 수정 — 진행률 분모·액션 표시 방식 확정`

- "오늘의 액션" 라벨 + 오늘 요일
- **이번 주 진행률**: "N / 7 완료" — 이번 주(월~일) 중 완료 체크한 날 수 / 7일 고정
  - N = `action_completions` WHERE `action_item_id` = 현재 액션 AND `completed_date` IN 이번 주 월~일
  - 분모는 7일 고정 (액션 아이템이 1개이므로 "며칠 실행"이 진행률의 기준)
- **액션 텍스트**: 단일 항목 1개 표시 (`action_items` WHERE `week_number = current_week`, 10에서 1개 선택)
- 체크 토글 버튼 (오늘 완료 여부 → `action_completions` INSERT/DELETE)
- **주간 체크 인디케이터**: 7칸 그리드 (월~일)
  - 각 칸: 요일 텍스트 + 완료 여부 도트
  - 오늘: 강조 표시
  - 과거: 완료(filled dot) / 미완료(empty dot)
  - 미래: 비활성 (회색)

### 3.5 알림/유도 카드 (조건부 노출)

아래 조건 중 해당하는 경우에만 노출. 조건 없으면 미노출.

| 조건 | 문구 | 이동 |
| --- | --- | --- |
| 이번 주 회고 미작성 (주말) | "이번 주 회고를 작성해볼까요?" | 12 주말 모드 |
| 오늘 메모 미작성 (평일) | "오늘의 한 줄 메모를 남겨볼까요?" | 12 평일 모드 |
| 강점 분석 6개월 경과 | "강점을 다시 분석해볼까요?" | 04 |

### 3.6 12주 타임라인 `v1.2 수정 — 완료율 데이터 소스 수정`

1~12주 카드 가로 스크롤. 상태별 시각:

- done (완료된 과거 주차)
- current (이번 주차, 강조)
- future (예정 주차, 흐릿)

카드 정보:

- 주차 번호
- 액션 요약
- 강점 태그
- **완료율**: 해당 주차 `action_completions` 건수 / 7일 기반 계산
  - ~~`weekly_actions.daily_done` 기반~~ → `action_completions` 기반으로 수정 (schema 정합)
- "회고하기" 버튼 (done 상태이면서 회고 미작성 시)

### 3.7 PAUSED 상태 UI `v1.2 수정 — v2 구현 대상 명시`

> ⚠️ **v2 구현 대상**: 프로토타입 v6 미구현. v1에서는 PAUSED 상태를 별도 UI로 표시하지 않음.

v2 구현 내용:
- 테마 카드에 "중단됨" 주황색 배지 표시
- 하단에 [재개하기] [포기하기] 버튼 추가

### 3.8 하단 탭바

- 홈 (active) / 회고 / 히스토리 / 프로필

---

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 인사 표시 | `profiles.nickname` + `goals.current_week` 표시 |
| Q{n} 레이블 계산 | 동일 `user_id`의 `goals` row 순번을 프론트에서 계산 (DB 컬럼 추가 없음) |
| 주차 자동 전환 | 매주 월요일 자정 자동 (`goals.current_week` +1) — 앱 진입 시 `current_week`에 `action_items` 없으면 AI 생성 API 호출 |
| 오늘 체크 토글 | `action_completions` INSERT (완료) 또는 DELETE (취소) |
| 과거 일자 체크 | 7일 이내 과거만 수정 가능, 그 이전은 잠금 |
| 미래 일자 체크 | 차단 |
| 주간 진행률 계산 | `action_completions` (이번 주 월~일) 건수 / 7 |
| 타임라인 클릭 | done → 해당 주차 회고/기록 보기, future → 비활성 |
| 회고 카드 클릭 | 12 회고 화면 |
| 12주 완료 시 | `goals.status='completed'`, `goals.ended_at` + `goals.final_completion_rate` 기록 → 다음 진입 시 NEW03으로 자동 라우팅 |
| PAUSED 표시 | v2 구현 대상 (현재 미구현) |

---

## 5. 데이터

- `profiles` (nickname)
- `goals` (goal_title, competency_code, domain, status, current_week, total_weeks, started_at)
- `goals` 전체 row (Q{n} 순번 계산용, user_id 기준)
- `action_items` (week_number = current_week, 단일 항목)
- `action_completions` (이번 주 완료 기록 — 진행률·체크 인디케이터 기준)
- `daily_memos` (오늘 메모 작성 여부 — 알림 카드 노출 판단)
- `coaching_insights` (최근 회고 요약 — 알림 카드 노출 판단)
- 주차 계산: `goals.started_at` 기준 자동 계산

> ⚠️ **schema 불일치 수정 완료**:
> - `users.name` / `users.coaching_start_at` → `profiles.nickname` / `goals.started_at`
> - `career_focus` → `goals`
> - `career_results.selected_direction` → `goals.goal_title`
> - `weekly_actions` → `action_items` (week_number) + `action_completions`
> - `weekly_actions.daily_done` → `action_completions` (완료율 계산 기준)
> - `weekday_memos` → `daily_memos`
> - `insight_history` → `coaching_insights`

---

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| active goals 없음 | 10 액션 아이템으로 리디렉션 |
| current_week에 action_items 없음 | AI 액션아이템 생성 API 호출 → skeleton UI 표시 → 실패 시 안내 |
| 12주 완주 직후 | NEW03 우선 노출 |
| 미래 일자 클릭 | 토스트 "오늘 이후는 체크할 수 없어요" |
| 7일 이전 일자 클릭 | 토스트 "지난 일주일까지만 수정할 수 있어요" |
| 체크 토글 저장 실패 | 낙관적 업데이트 후 실패 시 롤백 + 토스트 |
| 사용자 데이터 없음 | skeleton placeholder + 재로딩 |
| 새로고침 | DB에서 복원 |
| 알림 권한 미허용 | 알림 카드에 "알림 켜기" CTA |

---

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `home_view` | `week_num`, `today_action_done` |
| `daily_action_toggled` | `week_num`, `day_index`, `new_state`, `source=home` |
| `home_card_clicked` | `card_type` |
| `timeline_week_clicked` | `week_num`, `status` |
| `tab_changed` | `from_tab`, `to_tab` |

---

## 8. 접근성

- 오늘 체크 토글은 키보드 접근 가능
- 완료/미완료 상태가 색상 외 텍스트/아이콘으로도 표시
- 타임라인 카드는 `aria-label`로 주차/상태/액션 명시
- 주간 체크 인디케이터 각 칸은 `aria-label="월요일, 완료"` 형태로 명시

---

## 9. 성능

- 초기 렌더 ~1.5초
- 핵심 데이터 우선 로딩, 타임라인은 lazy

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.3 | 2026-05-07 | schema v0.7.1 반영: **5번 데이터** — `goals.goal_category` → `goals.competency_code, domain` |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 반영: **① 테마 카드 레이블 "Q{n} · 12주 테마" 확정** — DB 컬럼 추가 없이 프론트에서 goals row 순번 계산 / **② 상단 바 프로토타입 수정 권고 주석 추가** (알림·프로필 아이콘 미구현) / **③ PAUSED UI v2 구현 대상으로 명시** (3.7항 신설) / **④ 오늘의 액션 카드 진행률 분모 7일 고정으로 확정** — "N/7 완료" 형태, action_completions 날짜 기준 / **⑤ 액션 표시 방식 "목록"→"단일 항목 1개"로 수정** (10에서 1개 선택 구조 반영) / **⑥ 타임라인 완료율 데이터 소스 수정** — weekly_actions.daily_done → action_completions 기반 / **⑦ 알림 카드 조건부 노출 규칙 표로 명세** |
| v1.1 | 2026-05-05 | schema 검증 반영: 진입 조건 PAUSED 상태 추가, `career_focus`/`weekly_actions`→`goals`/`action_items` 수정, 오늘 체크 토글 `action_completions` INSERT/DELETE 방식 명시, 주차 자동 전환 로직 명시, 12주 완료 시 `ended_at`+`final_completion_rate` 기록 명시, 테이블명 전반 수정 |
| v1.0 | 2026-05-04 | 최초 작성 |
