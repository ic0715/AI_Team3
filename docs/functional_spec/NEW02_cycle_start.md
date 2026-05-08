# NEW02. 12주 여정 시작 안내 (신규)

> 10 액션 선택 완료 직후 1회 노출. 사용자가 선택한 강점·커리어 방향·액션을 종합 요약하고 본격 12주 시작을 알림.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | NEW02_cycle_start |
| 페이즈 | DO |
| 역할 | 12주 시작 동기 부여 + 첫 주 액션 확정 표시 |
| 진입 경로 | 10 액션 선택 완료 직후 |
| 다음 화면 | 11 홈 (또는 NEW04 푸시 권한 요청) |

---

## 2. 진입 조건

- 10 완료 직후 1회 노출
- `goals.started_at`이 막 기록된 시점
- 재방문 시 노출되지 않음

---

## 3. UI 구성

- 메인 타이틀: "준비 완료! 🎉 12주 여정을 시작해요"

### 3.1 요약 카드 `v1.2 수정 — 강점 chip 표시 방식·첫 주 액션 표시 변경`

- **강점**: Top 5 (Chip, 갤럽 34 테마)
  - 번호 배지 표시 (강점 1~5, 단순 넘버링)
  - 배지 스타일: 단일 스타일 통일 (번호 간 차등 없음)
  - ~~순위 배지~~ → 번호 배지로 변경 (06_strength_result.md v1.2 기준)
- 커리어 방향: `goals.goal_title`
- **첫 주 액션**: 선택한 `action_items` **단일 항목 1개**
  - ~~action_items 리스트~~ → 단일 항목 1개로 변경 (10_action_items.md v1.2 기준, 선택 개수 1개 확정)

### 3.2 일정 표시

- "📅 시작일: YYYY.MM.DD / 종료일: YYYY.MM.DD" 표시 (`goals.started_at` + 84일)

### 3.3 CTA

- "홈으로 가기 →"

---

## 4. 기능

- CTA 클릭 시 11 홈 이동 (또는 NEW04 푸시 권한 요청 화면 경유)
- 첫 주 `action_items` (week_number=1)는 10 완료 시 이미 생성되어 있음
- `goals.started_at` 기준 종료일 표시 (started_at + 84일)

---

## 5. 예외 처리

| 상황 | 처리 |
| --- | --- |
| `action_items` (week_number=1) 생성 실패 (10에서 누락) | 재시도 + 실패 시 고객센터 안내 |
| 요약 데이터 누락 | 가능한 데이터만 표시 + 안내 |

---

## 6. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `cycle_start_view` | `goals.started_at` |
| `cycle_start_cta_clicked` | `time_spent` |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.2 | 2026-05-07 | **3.1항 요약 카드 수정**: ① 강점 chip 표시 방식 — 순위 배지→번호 배지(강점 1~5) + 단일 스타일 통일 (06_strength_result.md v1.2 기준) / ② 첫 주 액션 표시 — "리스트"→"단일 항목 1개"로 변경 (10_action_items.md v1.2 선택 개수 1개 확정 기준) |
| v1.1 | 2026-05-05 | schema 검증 반영: `users.coaching_start_at`→`goals.started_at`, `selected_direction`→`goals.goal_title`, `weekly_actions`→`action_items`(week_number=1) |
| v1.0 | 2026-05-04 | 최초 작성 |
