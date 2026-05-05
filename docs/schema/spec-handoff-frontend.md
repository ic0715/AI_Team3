# CareerPT — 프론트 개발 담당 핸드오프

> 기준 문서: `spec-schema.md v0.6`  
> 작성일: 2026-05-04  
> 대상: 프론트엔드 개발 담당

---

## 전체 테이블 한눈에 보기

| # | 테이블명 | 역할 |
|---|----------|------|
| 1 | `profiles` | 유저 기본 정보 (Supabase Auth와 1:1 연결) |
| 2 | `strength_analyses` | 강점 인터뷰 또는 갤럽 업로드 결과 |
| 3 | `career_interview_results` | 커리어 인터뷰 핵심 인사이트 + AI 목표 추천 결과 |
| 4 | `goals` | 유저 역량 목표 (한 번에 active 1개) |
| 5 | `action_items` | 목표별 주차별 AI 추천 액션 과제 |
| 6 | `action_completions` | 날짜별 액션 완료 체크 기록 |
| 7 | `daily_memos` | 평일 짧은 메모 |
| 8 | `weekly_retros` | 주말 한 줄 회고 |
| 9 | `coaching_insights` | AI 코칭 세션 결과 요약 |

---

## 화면별 연결 테이블

| 화면 | 읽는 테이블 | 쓰는 테이블 |
|------|------------|------------|
| 온보딩 (기본정보 입력) | — | `profiles` |
| 강점 인터뷰 | `profiles` | `strength_analyses` |
| 커리어 인터뷰 | `strength_analyses` | `career_interview_results` |
| 목표 추천 화면 | `career_interview_results` | `career_interview_results` (UPDATE), `goals` |
| 홈 (주차별 액션) | `goals`, `action_items`, `action_completions` | `action_completions` |
| 평일 메모 | `goals` | `daily_memos` |
| 주말 회고 | `daily_memos`, `action_completions`, `action_items` | `weekly_retros` |
| 코칭 세션 | — | `coaching_insights` |
| 마이페이지 | `profiles`, `strength_analyses`, `career_interview_results` | `profiles` |
| 히스토리 | `goals` (전체 status) | — |

---

## 꼭 알아야 할 화면 동작 규칙

### ① 커리어 인터뷰 → 목표 추천은 2단계로 분리됨

인터뷰가 끝난다고 바로 목표 추천이 뜨지 않습니다.  
유저가 별도로 버튼을 눌러야 AI 분석이 시작됩니다.

```
인터뷰 완료
  ↓
인터뷰 저장 완료 화면 표시
  ↓
[목표 추천받기] 버튼 클릭
  ↓
AI 분석 중... (로딩)
  ↓
목표 선택 화면 (3~5개 카드로 표시)
  ↓
유저가 1개 선택 → goals INSERT
```

> 버튼을 누르는 시점에 `career_interview_results.recommended_goal_categories`가 UPDATE됩니다.

---

### ② 앱 열 때마다 액션아이템 존재 여부 체크 필요

주차는 **매주 월요일 자정에 자동으로 넘어갑니다.** 그 시점에 액션아이템이 아직 없을 수 있어요.

```
앱 진입 시:
  1. active goals 조회
  2. 현재 current_week에 action_items 있는지 확인
  3-a. 없으면 → AI 액션아이템 생성 API 호출 → 로딩 화면 표시
  3-b. 있으면 → 바로 홈 화면 표시
```

> 회고를 작성하지 않아도 다음 주 액션아이템이 추천됩니다. 회고는 액션아이템 생성의 필수 조건이 아닙니다.

---

### ③ 메모·회고 화면은 active 목표 없으면 비활성

`daily_memos.goal_id`는 NOT NULL입니다.  
활성 목표가 없는 상태에서 메모 화면에 접근하면 "목표를 먼저 설정해주세요" 안내를 보여줘야 합니다.

| 상태 | 메모·회고 화면 |
|------|--------------|
| active 목표 있음 | 정상 표시 |
| active 목표 없음 (온보딩 전, 목표 완료 후 공백기) | 접근 불가 + 안내 메시지 |

---

### ④ 주말 회고 제출 시 완료 횟수 자동 계산

`weekly_retros`의 `completion_count`와 `target_count`는 **프론트에서 집계해서 함께 저장**합니다.  
유저가 직접 입력하는 값이 아닙니다.

```javascript
// 회고 제출 버튼 클릭 시

// 이번 주 action_items 목록 조회
const actionItems = await getActionItems(goalId, currentWeek)

// 이번 주 완료된 항목 수 집계
const actionCompletions = await getCompletions(actionItems.map(i => i.id), thisWeekRange)

// weekly_retros INSERT
{
  goal_id: currentGoalId,
  week_number: currentWeek,
  retro_date: today,
  summary_one_line: userInput,
  completion_count: actionCompletions.length,   // 자동 집계
  target_count: actionItems.length              // 자동 집계
}
```

---

### ⑤ 목표 상태 4가지와 화면 처리

| status | 표시 방법 | 가능한 유저 액션 |
|--------|----------|----------------|
| `active` | 홈 화면 정상 표시 | 일시중단, 포기 |
| `paused` | 홈 화면에 "중단됨" 배지 | 재개, 포기 |
| `completed` | 히스토리에 달성률과 함께 표시 | 없음 (읽기 전용) |
| `abandoned` | 히스토리에 "중도 종료"로 표시 | 없음 (읽기 전용) |

**paused 관련 동작:**
- `paused` 목표가 있어도 새 `active` 목표를 만들 수 있습니다
- 재개(`paused` → `active`)하면 `current_week`는 중단 시점 그대로 이어집니다
- 일시중단 시 사유 입력 UI 제공 (선택 사항, `pause_reason` 컬럼에 저장)

> ⚠️ `completed_at` 컬럼은 없습니다. **`ended_at`** 으로 바뀌었습니다.  
> `completed`와 `abandoned` 두 경우 모두 `ended_at`에 날짜를 기록합니다.

---

### ⑥ 강점 분석 최신 결과 조회 방법

재진단 시 새 row가 추가되므로 `is_latest = true` 조건으로 조회합니다.

```javascript
// 최신 강점 분석 1개 조회
const { data } = await supabase
  .from('strength_analyses')
  .select('*')
  .eq('is_latest', true)
  .single()
```

---

### ⑦ 데이터 조회 시 user_id 필터 필요 없음

Supabase RLS(Row Level Security)가 설정돼 있어서 로그인한 유저의 데이터만 자동으로 반환됩니다.  
`WHERE user_id = ...` 조건을 직접 붙이지 않아도 됩니다.

```javascript
// ✅ 이렇게 해도 됩니다 — RLS가 자동으로 본인 것만 필터링
const { data } = await supabase.from('goals').select('*').eq('status', 'active')

// ❌ 이렇게 하지 않아도 됩니다
const { data } = await supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active')
```

> 단, Supabase 클라이언트가 로그인 세션을 가지고 있어야 합니다. (`supabase.auth.getSession()` 확인)

---

## 주요 컬럼 타입 정리

자주 헷갈리는 컬럼 타입 정리입니다.

| 테이블 | 컬럼 | 타입 | 특이사항 |
|--------|------|------|----------|
| `strength_analyses` | `strengths` | `jsonb` | 배열 구조, rank 1~5 |
| `career_interview_results` | `key_insights` | `jsonb` | 객체 구조 |
| `career_interview_results` | `recommended_goal_categories` | `text[]` | 문자열 배열, 최대 3개 |
| `goals` | `goal_category` | `text` | 7개 고정값 중 하나 |
| `goals` | `started_at`, `ended_at` | `date` | timestamptz 아님 |
| `action_items` | `tags` | `text[]` | 문자열 배열 |
| `action_completions` | `completed_date` | `date` | row 존재 = 완료, 삭제 = 미완료 |
| `coaching_insights` | `weekly_retro_id` | `uuid` | nullable FK |

---

## 히스토리 화면 조회 예시

이전 목표 이력 표시 시 JOIN 없이 `goals` 테이블 단독 조회로 가능합니다.  
(`final_completion_rate`가 종료 시 이미 저장돼 있기 때문)

```javascript
const { data } = await supabase
  .from('goals')
  .select('goal_title, goal_category, status, started_at, ended_at, final_completion_rate')
  .in('status', ['completed', 'abandoned'])
  .order('ended_at', { ascending: false })
```
