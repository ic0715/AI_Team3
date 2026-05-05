# NEW03. 12주 완료 화면 (신규)

> 12주차를 완주한 사용자에게 노출되는 성취 페이지. 다음 사이클로의 자연스러운 전환 유도.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | NEW03_cycle_complete |
| 페이즈 | MAINTAIN → 다음 사이클 |
| 역할 | 12주 완주 축하 + 사이클 요약 + 다음 사이클 유도 |
| 진입 경로 | 12주차 완료 후 첫 로그인 |
| 다음 화면 | 07 (강점 유지) / 04 (강점부터 다시) / 14 (히스토리) |

## 2. 진입 조건

- growth_cycles.status = completed
- 12주차 일요일 자정 자동 변경
- 완료 후 첫 로그인 시 1회 자동 노출
- 이후에도 15 프로필에서 재진입 가능

## 3. UI 구성

- 축하 애니메이션 (컨페티 등, reduce-motion 대응)
- 메인 타이틀: "12주 여정 완주를 축하해요 🎉"

### 3.1 성취 요약

| 항목 | 예시 |
| --- | --- |
| 총 액션 완료 일수 | X / 84일 |
| 작성한 메모 | X개 |
| 완성한 회고 | X회 |
| 가장 자주 활용한 강점 Top 3 | 강점 chip |
| 인사이트 키워드 워드클라우드 | 선택 노출 |

### 3.2 회고 카드

- "12주 동안 발견한 핵심 패턴 3가지" (history_records 기반 AI 요약)

### 3.3 CTA

- CTA 1차 (Primary): "새로운 12주 시작하기 →" → 07 커리어 인터뷰 재진입
- CTA 2차: "강점부터 다시 분석하기" → 04 강점 진단 재진입
- CTA 3차: "히스토리로 돌아보기" → 14 히스토리

## 4. 기능

- 1회 자동 노출 후 15 프로필에서 재진입 가능
- 사이클 종료 시 자동으로 status = completed 변경
- 완주 보상(있을 경우): 배지 알림 처리

## 5. 데이터

- 참조: 해당 사이클의 모든 데이터 집계 (weekly_plans, daily_checks, weekly_memos, history_records)
- 저장: cycle 결과 요약은 별도 cycle_summaries 테이블에 저장 (선택)

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 데이터 집계 실패 | "통계를 불러오는 중 문제가 있어요. 다시 시도해주세요" + 재시도 |
| 일부 데이터 누락 | 가능한 데이터만 표시 |
| 축하 애니메이션 reduce-motion | 정적 표시 |

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| cycle_complete_view | cycle_id, total_done_days, total_memos |
| cycle_complete_cta_clicked | cta_kind=new_cycle/redo_strength/history |
| next_cycle_started | continue_strength=true/false |
