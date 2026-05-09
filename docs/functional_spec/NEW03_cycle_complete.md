# NEW03. 12주 완료 화면 (신규)

> 12주차를 완주한 사용자에게 노출되는 성취 페이지. 다음 사이클로의 자연스러운 전환 유도.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | NEW03_cycle_complete |
| 페이즈 | CYCLE END |
| 역할 | 12주 완주 축하 + 사이클 요약 + 다음 사이클 유도 |
| 진입 경로 | 12주차 완료 후 첫 로그인 |
| 다음 화면 | 07 (강점 유지) / 04 (강점부터 다시) / 03 (기본 정보 업데이트) / 14 (히스토리) |

---

## 2. 진입 조건

- `goals.status = 'completed'` (`current_week >= total_weeks` 달성 시 자동 전환)
- 완료 후 첫 로그인 시 1회 자동 노출
- 이후에도 15 프로필에서 재진입 가능

---

## 3. UI 구성

- 축하 애니메이션 (컨페티 등, reduce-motion 대응)
- 메인 타이틀: "12주 여정 완주를 축하해요 🎉"

### 3.1 성취 요약 `v1.2 수정 — 완료 일수 계산 기준 명시·강점 chip 표시 방식 변경`

| 항목 | 내용 | 계산 기준 |
| --- | --- | --- |
| 총 액션 완료 일수 | X / 84일 | X = `action_completions` 전체 건수 / 분모 84 = 12주 × 7일 고정 (11_home.md v1.2·12_reflect.md v1.2 진행률 기준과 정합) |
| 작성한 메모 | X개 | `daily_memos` 건수 |
| 완성한 회고 | X회 | `weekly_retros` 건수 |
| 가장 자주 활용한 강점 Top 5 | 강점 chip | 번호 배지 (강점 1~5, 단순 넘버링, 단일 스타일) — ~~순위 배지~~ → 번호 배지로 변경 (06_strength_result.md v1.2 기준) |
| 인사이트 키워드 워드클라우드 | 선택 노출 | `coaching_insights.strength_link` 기반 |

### 3.2 회고 카드

- "12주 동안 발견한 핵심 패턴 3가지" (`coaching_insights` 기반 AI 요약)

### 3.3 CTA `v1.3 수정 — [기본 정보 업데이트] 보조 카드 재도입`

- CTA 1차 (Primary): "새로운 12주 시작하기 →" → 07 커리어 인터뷰 재진입
- CTA 2차: "강점부터 다시 분석하기" → 04 강점 진단 재진입
- **CTA 보조 카드: "기본 정보 업데이트"** → 03 (수정 모드) → 변경된 필드만 `profiles` UPDATE → NEW03 복귀 + 토스트 "정보가 수정되었어요"
  - 강제 X, 권장 O — 새 12주 시작 전에 직군/고민/경력 변경사항을 반영할 기회 제공
  - 변경된 필드는 다음 12주의 AI 인터뷰(05/08/13) 시스템 프롬프트 컨텍스트에 즉시 반영됨
- CTA 3차: "히스토리로 돌아보기" → 14 히스토리

---

## 4. 기능

- 1회 자동 노출 후 15 프로필에서 재진입 가능
- 사이클 종료 판정: `goals.status = 'completed'` (11 홈에서 12주 완주 시 자동 UPDATE + `ended_at`, `final_completion_rate` 기록)
- 완주 보상(있을 경우): 배지 알림 처리

---

## 5. 데이터

- 참조: 해당 사이클의 모든 데이터 집계 (`action_completions`, `daily_memos`, `coaching_insights`, `goals`)
- `goals.status = 'completed'`, `goals.ended_at`, `goals.final_completion_rate` 기록 (11 홈에서 이미 처리)
- 다음 사이클 진입 시 새 `goals` INSERT (새 `goal_title`, `status='active'`, `started_at=today`)

---

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 데이터 집계 실패 | "통계를 불러오는 중 문제가 있어요. 다시 시도해주세요" + 재시도 |
| 일부 데이터 누락 | 가능한 데이터만 표시 |
| 축하 애니메이션 reduce-motion | 정적 표시 |

---

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `cycle_complete_view` | `goals.started_at`, `total_done_days`, `total_memos` |
| `cycle_complete_cta_clicked` | `cta_kind=new_cycle/redo_strength/update_basic_info/history` |
| `next_cycle_started` | `continue_strength=true/false` |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.3 | 2026-05-09 | 00_flow.md v1.8 / 00_common.md v1.9 정합성 정렬: **[기본 정보 업데이트] 보조 카드 재도입** — 1번 화면 개요 다음 화면 표에 "03 (기본 정보 업데이트)" 추가 / 3.3 CTA 영역에 보조 카드 신규 추가 (강제 X, 권장 O, 새 12주 시작 전 직군·고민·경력 반영 기회 제공) / 7번 분석 이벤트 `cta_kind`에 `update_basic_info` 값 추가. v1.7~v1.8 사이 미결 보류였던 NEW03 보조 카드 결정사항 ✅ 옵션 제공으로 재확정. |
| v1.2 | 2026-05-07 | **3.1항 성취 요약 수정**: ① 총 액션 완료 일수 계산 기준 명시 추가 — X = `action_completions` 전체 건수 / 분모 84 = 12주 × 7일 고정 (11_home.md v1.2·12_reflect.md v1.2 진행률 분모 7일 고정 기준과 정합) / ② 강점 chip 표시 방식 — 순위 배지→번호 배지(강점 1~5) + 단일 스타일 통일 (06_strength_result.md v1.2 기준) / 성취 요약 테이블에 계산 기준 컬럼 추가 |
| v1.1 | 2026-05-05 | schema 검증 반영: 진입 조건 `coaching_start_at + 84일` → `goals.status='completed'`, `career_focus`·`weekly_actions`·`weekday_memos`·`insight_history` → `goals`·`action_completions`·`daily_memos`·`coaching_insights`, 다음 사이클 시 새 `goals` INSERT |
| v1.0 | 2026-05-04 | 최초 작성 |
