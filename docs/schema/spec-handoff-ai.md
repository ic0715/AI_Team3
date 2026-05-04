# CareerPT — AI 개발 담당 핸드오프

> 기준 문서: `spec-schema.md v0.6`  
> 작성일: 2026-05-04  
> 대상: AI 기능 개발 담당

---

## 핵심 원칙

대화 원문은 DB에 저장하지 않습니다.  
**브라우저 메모리에서 대화 진행 → 세션 종료 시 AI가 구조화된 결과만 DB에 저장.**

---

## 7개 AI 터치포인트 — DB 입출력 전체 구조

| # | 기능 | DB에서 읽어야 할 것 | DB에 써야 할 것 |
|---|------|-------------------|----------------|
| 1 | 강점 인터뷰 | `profiles.nickname`, `job_field`, `career_level` | `strength_analyses` INSERT |
| 2 | 커리어 인터뷰 | `strength_analyses.strengths` (최신 1개) | `career_interview_results` INSERT (`key_insights`, `ai_summary`) |
| 3 | 역량 방향 도출 | `strength_analyses.strengths` + `career_interview_results.key_insights`, `ai_summary` | `career_interview_results` UPDATE (`recommended_goal_categories`) |
| 4 | 액션아이템 생성 | `goals` + `profiles` (필수) / `coaching_insights` 최근 1~3개 (선택) | `action_items` INSERT 3~5건 |
| 5 | 코칭 컨텍스트 주입 | `daily_memos` (이번 주) + `action_completions` (이번 주) + `weekly_retros` (이번 주) + `coaching_insights` (최근 3주) | 저장 없음 — 프롬프트 구성용 |
| 6 | 회고 코칭 | #5에서 만든 System Prompt | 저장 없음 |
| 7 | 인사이트 요약 | #6 대화 내용 (브라우저 메모리) | `coaching_insights` INSERT + `action_items` INSERT (다음 주) |

---

## 터치포인트별 상세

### #1 강점 인터뷰

```
입력: profiles.nickname, job_field, career_level
  ↓
[대화 진행 — 브라우저 메모리]
  ↓
출력: strength_analyses INSERT
```

**저장 포맷 — `strength_analyses.strengths` (JSONB):**

반드시 아래 구조를 지켜야 합니다. rank 1~5, 총 5개 배열.

```json
[
  { "rank": 1, "name_ko": "전략", "name_en": "Strategic", "description": "복잡한 상황에서도 최적의 경로를 빠르게 찾아내요." },
  { "rank": 2, "name_ko": "분석", "name_en": "Analytical", "description": "데이터와 근거를 바탕으로 깊이 생각해요." },
  { "rank": 3, "name_ko": "성취", "name_en": "Achiever", "description": "끊임없이 뭔가를 이루고 싶은 강한 내면의 불꽃이 있어요." },
  { "rank": 4, "name_ko": "배움", "name_en": "Learner", "description": "새로운 지식과 기술을 습득하는 과정 자체에서 에너지를 얻어요." },
  { "rank": 5, "name_ko": "책임", "name_en": "Responsibility", "description": "한번 맡은 일은 반드시 완수하는 강한 책임감이 있어요." }
]
```

> ⚠️ `is_latest` 갱신은 DB 트리거가 자동 처리합니다. 코드에서 따로 업데이트하지 마세요.

---

### #2 커리어 인터뷰

```
입력: strength_analyses.strengths (최신 1개 — is_latest = true 조회)
  ↓
[대화 진행 — 브라우저 메모리]
  ↓
출력: career_interview_results INSERT
  - key_insights  (JSONB)
  - ai_summary    (text)
  ※ 이 단계에서 recommended_goal_categories는 저장하지 않음
```

**저장 포맷 — `key_insights` (JSONB):**

대화 흐름에 따라 키가 달라질 수 있지만, 아래 7개를 기본으로 추출 시도합니다.  
해당 내용이 대화에 없으면 키 자체를 생략해도 됩니다.

```json
{
  "current_satisfaction": "팀원들과 협업할 때 에너지를 얻어요",
  "current_frustration": "방향이 불명확해요",
  "future_vision": "3~5년 안에 팀을 이끄는 리더가 되고 싶어요",
  "work_style": "자율성이 보장되는 소규모 팀 선호",
  "values": ["성장", "인정", "자율"],
  "career_concern": "이직 vs 현 직장 성장 고민",
  "dream": "나만의 팀을 만들어 제품을 만들고 싶어요"
}
```

---

### #3 역량 방향 도출

> **트리거:** 유저가 인터뷰 완료 후 **"목표 추천받기" 버튼을 눌렀을 때** 실행됩니다.  
> 인터뷰 완료 즉시 자동 실행되지 않습니다.

```
입력: strength_analyses.strengths
    + career_interview_results.key_insights, ai_summary
  ↓
[AI가 강점 × 커리어 인사이트 종합 분석]
  ↓
출력 1: career_interview_results UPDATE
  - recommended_goal_categories = ["thinking", "technical"]  (최대 3개)

출력 2: 유저에게 goal_title 선택지 3~5개 제시 (DB 저장 아님, UI 표시용)
  → 유저가 1개 선택 → goals INSERT
```

**`goals` INSERT 시 반드시 두 값을 함께 저장:**

```json
{
  "goal_category": "technical",
  "goal_title": "SQL과 데이터 분석 능력 기르기"
}
```

**`goal_category` 허용값 (이 7개 외 다른 값 사용 불가):**

| 코드 | 의미 | `goal_title` 예시 |
|------|------|-----------------|
| `thinking` | 사고력 | 비판적 사고 기르기, 논리적 사고력 향상 |
| `technical` | 기술·전문성 | SQL 익히기, 파이썬으로 업무 자동화하기 |
| `communication` | 소통·표현 | 발표력 향상, 설득력 있는 글쓰기 |
| `leadership` | 리더십·관리 | 팀 코칭 역량 키우기, 의사결정력 높이기 |
| `execution` | 실행·습관 | 꾸준한 실행 습관 만들기, 마감 관리 |
| `career` | 커리어 탐색 | 이직 준비하기, 포트폴리오 만들기 |
| `wellness` | 멘탈·에너지 | 번아웃 없이 일하는 방법 찾기 |

> 애매한 경우: 가장 가까운 카테고리로 매핑. 정말 모르면 `wellness` 사용.

---

### #4 액션아이템 개인화 생성

> **트리거:** 매주 월요일 자정 주차 자동 전환 후, 또는 유저가 앱 재접속 시 해당 주차 액션아이템이 없으면 실행.

```
입력 (필수): goals.goal_category + goals.goal_title + goals.current_week
           + profiles.job_field, career_level
입력 (선택): coaching_insights 최근 1~3개 (있으면 이전 주 패턴 참고)
  ↓
[AI가 이번 주에 맞는 액션 아이템 3~5개 생성]
  ↓
출력: action_items INSERT (여러 건)
  - week_number = current_week
  - is_custom   = false
  - title, description, tags
```

**폴백 규칙 — 회고 없는 경우:**

`coaching_insights`가 없어도 오류를 내면 안 됩니다.  
첫 주이거나 회고를 작성하지 않은 경우 `goals + profiles`만으로 생성합니다.

| 상황 | 사용할 컨텍스트 |
|------|--------------|
| `coaching_insights` 있음 | `goals + profiles + coaching_insights` (최근 1~3개) |
| `coaching_insights` 없음 | `goals + profiles`만으로 생성 |

---

### #5 회고 코칭 컨텍스트 주입

DB 조회만 하고 저장은 없습니다. System Prompt를 조립해 #6에 주입하는 단계입니다.

```
조회 범위:
  - daily_memos       WHERE goal_id = 현재목표 AND week_number = 현재주차
  - action_completions WHERE action_item_id IN (이번 주 action_items)
  - weekly_retros     WHERE goal_id = 현재목표 AND week_number = 현재주차
  - coaching_insights WHERE goal_id = 현재목표 ORDER BY week_number DESC LIMIT 3
```

---

### #6 회고 코칭

```
입력: #5에서 조립한 System Prompt
  ↓
[대화 진행 — 브라우저 메모리]
  ↓
출력: 없음 (대화 원문 미저장)
     → 대화 종료 후 바로 #7 실행
```

---

### #7 인사이트 요약

```
입력: #6 대화 내용 전체 (브라우저 메모리)
  ↓
[AI가 핵심만 추출해 구조화]
  ↓
출력 1: coaching_insights INSERT
  - topic             = 이번 주 코칭 주제
  - pattern_insight   = 발견된 행동 패턴 (nullable)
  - next_action_title = 다음 주 추천 액션 제목
  - next_action_reason = 추천 이유 (nullable)
  - strength_link     = 연결된 강점 (nullable)

출력 2: action_items INSERT (다음 주 항목)
  - week_number = current_week + 1
  - is_custom   = false
  - #4 방식과 동일하게 생성
```

---

## 전체 데이터 흐름 요약

```
[온보딩]
profiles          ← 기본 정보 입력
strength_analyses ← #1 강점 인터뷰 결과
career_interview_results ← #2 커리어 인터뷰 결과
career_interview_results ← #3 역량 방향 도출 (recommended_goal_categories UPDATE)
goals             ← 유저가 목표 선택
action_items      ← #4 1주차 액션아이템 생성

[매주 반복]
daily_memos       ← 평일 메모 저장
action_completions ← 완료 체크 저장
weekly_retros     ← 주말 한 줄 회고 저장
                     ↓ (#5 컨텍스트 주입)
회고 코칭 대화    (#6, 미저장)
                     ↓
coaching_insights ← #7 인사이트 요약 저장
action_items      ← 다음 주 액션아이템 생성
```
