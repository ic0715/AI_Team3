# 11. 홈 (12주 코칭 대시보드)

> 유저가 매일 방문하여 12주 코칭 진행 현황·오늘의 액션·주간 타임라인을 확인하고 동기를 유지하는 메인 화면.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 11_home |
| 페이즈 | MAINTAIN |
| 역할 | 12주 여정 진행 상태 + 오늘 액션 + 회고 유도 |
| 진입 경로 | NEW02 시작 안내 통과, 탭바 "홈" 선택, 02 로그인 후 ACTIVE 사용자 |
| 다음 화면 | 12 회고 / 13 코칭 / 14 히스토리 / 15 프로필 / NEW03 (12주 완주 시) |

## 2. 진입 조건

- `goals` 테이블에 `status='active'` 또는 `status='paused'`인 목표가 있는 경우
- 탭바 "홈" 선택 시
- 또는 NEW02 시작 안내 통과 후

> PAUSED 상태인 경우: "중단됨" 배지 표시, 재개·포기 액션 제공

## 3. UI 구성

### 3.1 상단 바

- 좌: CareerPT 로고
- 우: 알림 아이콘 (미읽음 배지)
- 우: 프로필 아이콘 → 15

### 3.2 인사 영역

- "안녕하세요, {name}님 👋"
- "{date} ({weekday}) · {currentWeek}주차 진행 중"

### 3.3 12주 테마 카드

- 현재 목표 (`goals.goal_title`, `status='active'`)
- 진행 주차 표시 (`goals.current_week` / `goals.total_weeks` 예: "3 / 12 주")
- 다음 회고 코칭 일정 ("이번 주 일요일 저녁")
- 12주 dot indicator (완료/현재/예정 색상 구분)

### 3.4 오늘의 액션 카드

- "오늘의 액션" 라벨 + 요일
- 이번 주 진행률 (예: "3/5 완료") — `action_completions` 수 / `action_items` 수 기준
- 액션 항목 목록 (`action_items` WHERE week_number = current_week)
- 체크 토글 버튼 (오늘 완료 여부 → `action_completions` INSERT/DELETE)
- 주간 체크 인디케이터 (월~일, 오늘 강조, 과거는 완료/미완료, 미래는 비활성)

### 3.5 알림/유도 카드 (선택 노출)

- 회고 미작성 시: "이번 주 회고를 작성해볼까요?" → 12
- 메모 미작성 시: "오늘의 한 줄 메모를 남겨볼까요?" → 12 평일 모드
- 강점 분석 6개월 경과 시: "강점을 다시 분석해볼까요?"

### 3.6 12주 타임라인

1~12주 카드 가로 스크롤. 상태별 시각:

- done (완료된 과거 주차)
- current (이번 주차, 강조)
- future (예정 주차, 흐릿)

카드 정보:

- 주차 번호
- 액션 요약
- 강점 태그
- 완료율 (해당 주차 weekly_actions.daily_done 기반)
- "회고하기" 버튼 (done 상태이면서 회고 미작성 시)

### 3.7 하단 탭바

- 홈 (active) / 회고 / 히스토리 / 프로필

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 인사 표시 | `profiles.nickname` + `goals.current_week` 표시 |
| 주차 자동 전환 | 매주 월요일 자정 자동 (`goals.current_week` +1) — 앱 진입 시 current_week에 action_items 없으면 AI 생성 API 호출 |
| 오늘 체크 토글 | `action_completions` INSERT (완료) 또는 DELETE (취소) |
| 과거 일자 체크 | 7일 이내 과거만 수정 가능, 그 이전은 잠금 |
| 미래 일자 체크 | 차단 |
| 주간 진행률 | `action_completions` (이번 주) / `action_items` (이번 주) 기반 자동 계산 |
| 타임라인 클릭 | done → 해당 주차 회고/기록 보기, future → 미리보기 또는 비활성 |
| 회고 카드 클릭 | 12 회고 화면 |
| 12주 완료 시 | `goals.status='completed'`, `goals.ended_at` + `goals.final_completion_rate` 기록 → 다음 진입 시 NEW03으로 자동 라우팅 |
| PAUSED 표시 | `goals.status='paused'`이면 "중단됨" 배지 + 재개/포기 버튼 표시 |

## 5. 데이터

- `profiles` (nickname)
- `goals` (goal_title, goal_category, status, current_week, total_weeks, started_at)
- `action_items` (week_number = current_week)
- `action_completions` (이번 주 액션 완료 기록)
- `daily_memos` (이번 주 평일 메모 — 알림 카드 표시 판단)
- `coaching_insights` (최근 회고 요약 — 알림 카드 표시 판단)
- 주차 계산: `goals.started_at` 기준 자동 계산

> ⚠️ **schema 불일치 수정**:
> - `users.name` / `users.coaching_start_at` → `profiles.nickname` / `goals.started_at`
> - `career_focus` 테이블 없음 → `goals`
> - `career_results.selected_direction` 없음 → `goals.goal_title`
> - `weekly_actions` 테이블 없음 → `action_items` (week_number) + `action_completions`
> - `weekday_memos` → `daily_memos`
> - `insight_history` → `coaching_insights`

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| active goals 없음 | 10 액션 아이템으로 리디렉션 |
| current_week에 action_items 없음 | AI 액션아이템 생성 API 호출 → 로딩 화면 표시 → 실패 시 안내 |
| 12주 완주 직후 | NEW03 우선 노출 |
| 미래 일자 클릭 | 토스트 "오늘 이후는 체크할 수 없어요" |
| 7일 이전 일자 클릭 | 토스트 "지난 일주일까지만 수정할 수 있어요" |
| 체크 토글 저장 실패 | 낙관적 업데이트 후 실패 시 롤백 + 토스트 |
| 사용자 데이터 없음 | placeholder + 재로딩 |
| 새로고침 | DB에서 복원 |
| 알림 권한 미허용 | 알림 카드에 "알림 켜기" CTA |

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| home_view | week_num, today_action_done |
| daily_action_toggled | week_num, day_index, new_state, source=home |
| home_card_clicked | card_type |
| timeline_week_clicked | week_num, status |
| tab_changed | from_tab, to_tab |

## 8. 접근성

- 오늘 체크 토글은 키보드 접근 가능
- 완료/미완료 상태가 색상 외 텍스트/아이콘으로도 표시
- 타임라인 카드는 aria-label로 주차/상태/액션 명시

## 9. 성능

- 초기 렌더 ~1.5초
- 핵심 데이터 우선 로딩, 타임라인은 lazy

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.1 | 2026-05-05 | schema 검증 반영: 진입 조건 PAUSED 상태 추가, `career_focus`/`weekly_actions`→`goals`/`action_items` 수정, 오늘 체크 토글 `action_completions` INSERT/DELETE 방식 명시, 주차 자동 전환 로직 명시, 12주 완료 시 `ended_at`+`final_completion_rate` 기록 명시, 테이블명 전반 수정(`users`→`profiles`, `weekday_memos`→`daily_memos`, `insight_history`→`coaching_insights`) |
| v1.0 | 2026-05-04 | 최초 작성 |
