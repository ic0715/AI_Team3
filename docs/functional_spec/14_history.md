# 14. 히스토리

> 과거 강점·커리어 방향·액션·패턴·인사이트를 아카이브 형태로 조회하며 성장을 확인.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 14_history |
| 페이즈 | MAINTAIN |
| 역할 | 주차별 인사이트 누적 표시 |
| 진입 경로 | 탭바 "히스토리" |
| 다음 화면 | 카드 탭 시 상세 모달 |

## 2. 진입 조건

- 사용자 상태 = ACTIVE 또는 COMPLETED
- 탭바 "히스토리" 선택

## 3. UI 구성

### 3.1 상단 바

- 페이지 타이틀: "히스토리"

### 3.2 헤더

- "Archive 📚"
- 설명: "지난 코칭에서 발견한 핵심만 정리되어 쌓여요"

### 3.3 필터 (선택)

- 전체 / 현재 사이클 / 이전 사이클
- 강점별 필터

### 3.4 인사이트 리스트 (아카이브 카드)

각 카드:

- 주차 + 날짜 (예: "W3 · 4/23")
- 패턴 (Pattern)
- 액션 (Action)
- 강점 연결 (Strength Reference)
- 인사이트 (Insight)
- 정렬: 최신 주차 우선 (날짜 역순)

### 3.5 빈 상태

- "아직 쌓인 인사이트가 없어요"
- "첫 주를 마치면 이곳에 인사이트가 쌓여요"

### 3.6 사이클 종료 카드

- 12주 완주 시: 사이클 요약 (NEW03과 연계)

### 3.7 하단 탭바 (히스토리 active)

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 인사이트 로드 | `coaching_insights` 조회 (RLS로 본인 것만 자동 필터) |
| 목표 이력 로드 | `goals` WHERE `status IN ('completed', 'abandoned')` 조회 |
| 정렬 | `week_number` 내림차순 |
| 필터 | 사이클/강점 |
| 카드 탭 | 상세 모달 (해당 주차의 액션, 메모 개수, 회고 일자 등) |
| 강점 태그 클릭 | 해당 강점 상세로 이동 (추후) |
| 무한 스크롤 | 20개씩 페이지네이션 |

## 5. 데이터

- 코칭 인사이트: `coaching_insights` (13 회고 코칭 완료 시 자동 저장)
  - 컬럼: `week_number`, `topic`, `pattern_insight`, `next_action_title`, `next_action_reason`, `strength_link`
- 목표 이력: `goals` (status='completed' 또는 'abandoned')
  - 컬럼: `goal_title`, `goal_category`, `status`, `started_at`, `ended_at`, `final_completion_rate`
  - `final_completion_rate`가 종료 시 이미 저장되어 있어 JOIN 없이 조회 가능
- 사이클별 그룹핑 가능 (`goals.id` 기준)
- 개인정보 최소화: 대화 원문은 저장 안 함, 요약 컬럼만 표시

> ⚠️ **schema 불일치 수정**:
> - `insight_history` → `coaching_insights` (테이블명)
> - 필드명: `week_num`→`week_number`, `pattern`→`pattern_insight`, `action`→`next_action_title`, `strength_ref`→`strength_link`, `insight`→`topic`

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 데이터 없음 | Empty State 표시 |
| 로드 실패 | 재시도 버튼 |
| 데이터 누락 필드 | 해당 필드만 미표시, 카드 자체는 노출 |
| XSS | sanitize 처리 |

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| history_view | item_count |
| history_card_clicked | week_num |
| history_filter_changed | filter_type, value |

## 8. 접근성

- 카드 리스트는 <ul>/<li> 또는 role="list"
- 각 카드 키보드 접근 가능

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.1 | 2026-05-05 | schema 검증 반영: `insight_history`→`coaching_insights`(테이블명), 필드명 수정(`week_num`→`week_number`, `pattern`→`pattern_insight`, `action`→`next_action_title`, `strength_ref`→`strength_link`, `insight`→`topic`), 목표 이력(`goals` WHERE status IN ('completed','abandoned')) 및 `final_completion_rate` 조회 추가, RLS 자동 필터 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
