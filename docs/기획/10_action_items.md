# 10. 액션 아이템 선택

> 09에서 선택한 커리어 방향에 맞춰 AI가 추천한 실행 과제(액션) 중 1개 이상을 선택하고 12주 코칭을 시작.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 10_action_items |
| 페이즈 | DO |
| 역할 | 12주 첫 주 액션 확정 + 12주 코칭 시작 |
| 이전 화면 | 09 커리어 방향 결과 |
| 다음 화면 | NEW02 12주 시작 안내 → 11 홈 |

## 2. 진입 조건

- 09에서 방향 선택 후 진입
- growth_cycles 레코드 생성됨 (status=pending)

## 3. UI 구성

### 3.1 상단 바

- 뒤로가기 → 09 (선택 변경 가능)
- 페이지 타이틀: "액션 아이템 선택"

### 3.2 방향 배너

- selected_direction 표시 (pill 형태)
- 부가: "12주 동안 키울 방향"

### 3.3 안내 패널

- "지금 시작할 수 있는 작은 행동을 골라주세요 (1개 이상)"
- "꾸준함이 중요해요. 매일/매주 부담 없이 할 수 있는 걸로!"

### 3.4 추천 액션 리스트 (5~7개)

각 카드:

- 체크 박스
- 액션 제목 (예: "주 3회 30분, 비즈니스 케이스 스터디")
- 설명 (2~3문장)
- 메타 태그: 시간(예: "30분/일"), 난이도(쉬움/보통/도전적), 유형(읽기/쓰기/실습/대화)
- 상태: 기본 / hover / selected

### 3.5 커스텀 액션 영역

- 텍스트 입력 (5~80자)
- "추가" 버튼
- 추가된 커스텀 항목 리스트 + 삭제
- 추천 + 커스텀 모두 다중 선택 가능 (1개 이상)

### 3.6 하단 요약

- 선택된 방향 + 액션 미리보기
- 선택 개수 표시 (예: "2개 선택됨")
- "12주 시작 준비 완료!"

### 3.7 Bottom CTA

- "홈으로 시작하기 🚀" (1개 이상 선택 시 활성화) → NEW02 시작 안내로

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 액션 다중 선택 | 체크박스 토글 |
| 커스텀 입력 | 5자 미만 시 추가 버튼 disabled, 공백 제출 차단 |
| 커스텀 추가 | 리스트에 추가, 다중 선택 가능 |
| 시작 클릭 | action_items 저장 + growth_cycles.status=active + cycle started_at(coaching_start_at) 기록 + 첫 주 weekly_plan 자동 생성 → NEW02 |

## 5. 데이터

- 액션 옵션 생성: selected_direction + 강점 + 인터뷰 답변 → AI 추천 또는 사전 정의 목록
- 저장 위치: action_items 테이블 (items JSONB: [{title, detail, is_custom}])
- 첫 주 weekly_plans 자동 생성: week_index=1, action_items 매핑
- users.coaching_start_at에 timestamptz 기록
- 전체 작업은 트랜잭션으로 처리 (실패 시 롤백)

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 미선택 상태 시작 클릭 | CTA disabled |
| 커스텀 욕설/짧음/공백 | 인라인 에러, 저장 불가 |
| 선택값 저장 실패 | 토스트 + 재시도 |
| weekly_plan 생성 실패 | 트랜잭션 롤백, 재시도 |
| 새로고침 | DB 복원 |
| 중복 클릭 | 첫 클릭 시 disabled |
| 액션 데이터 없음 | fallback 추천 액션 5개 표시 + 안내 |

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| action_selection_view | - |
| action_option_selected | action_id, kind=recommended/custom |
| custom_action_added | - |
| cycle_started | direction_title, action_count, time_from_signup |

## 8. 접근성

- 체크박스는 native + 충분한 hit area
- 커스텀 입력 라벨 명확
- 선택 결과 요약은 aria-live로 즉시 알림
