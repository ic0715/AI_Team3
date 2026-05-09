# CareerPT — 프론트 개발 담당 핸드오프

> 기준 문서: `spec-schema.md v0.7.2`
> 작성일: 2026-05-04
> 최종 수정: 2026-05-09 (schema v0.7.2 기준 전면 정렬 + 명칭 환원 정정)
> 대상: 프론트엔드 개발 담당

---

## 전체 테이블 한눈에 보기

| # | 테이블명 | 역할 |
|---|----------|------|
| 1 | `profiles` | 유저 기본 정보 (Supabase Auth와 1:1 연결) |
| 2 | `strength_analyses` | 강점 인터뷰 또는 갤럽 업로드 결과 |
| 3 | `career_interview_results` | 커리어 인터뷰 핵심 인사이트 + AI 추천 결과 |
| 4 | `goals` | 유저 역량 목표 (한 번에 active 1개) |
| 5 | `action_items` | 목표별 주차별 AI 추천 액션 과제 |
| 6 | `action_completions` | 날짜별 액션 완료 체크 기록 |
| 7 | `daily_memos` | 평일 짧은 메모 |
| 8 | `weekly_retros` | 주말 한 줄 회고 |
| 9 | `coaching_insights` | AI 코칭 세션 결과 요약 |
| 10 | `push_subscriptions` | 푸시 알림 구독 정보 |

---

## 화면별 연결 테이블

| 화면 | 읽는 테이블 | 쓰는 테이블 |
|------|------------|------------|
| 03 기본정보 입력 | — | `profiles` (`profile_completed = true`로 UPDATE) |
| 05 강점 인터뷰 | `profiles` | `strength_analyses` |
| 06 강점 결과 | `strength_analyses` (is_latest) | — |
| 08 커리어 인터뷰 | `strength_analyses` (is_latest) | `career_interview_results` (`key_insights`, `ai_summary` INSERT) |
| 09 커리어 방향 결과 | `career_interview_results` | `career_interview_results` (`recommended_competencies` UPDATE), `goals` (INSERT) |
| 10 액션 아이템 선택 | `goals` | `action_items` (W1) |
| 11 홈 | `goals`, `action_items`, `action_completions` | `action_completions` |
| 12 회고 (평일) | `goals` | `daily_memos` |
| 12 회고 (주말) | `daily_memos`, `action_completions`, `action_items` | `weekly_retros` |
| 13 회고 코칭 | `daily_memos`, `action_completions`, `weekly_retros`, `coaching_insights` | `coaching_insights`, `action_items` (W+1) |
| 14 히스토리 | `goals` (전체 status), `coaching_insights` | — |
| 15 프로필 | `profiles`, `strength_analyses`, `career_interview_results` | `profiles` |
| NEW03 12주 완료 | `goals` (status='completed'), `action_completions`, `daily_memos`, `coaching_insights` | — |
| NEW04 알림 설정 | `push_subscriptions` | `push_subscriptions` (UPSERT) |

---

## 꼭 알아야 할 화면 동작 규칙

### ① 09 커리어 방향 결과: 인터뷰 → 추천은 2단계로 분리됨

08 인터뷰가 끝난다고 바로 09 추천 카드가 뜨지 않습니다.
유저가 별도로 **"역량 방향 받기"** 버튼을 눌러야 매칭 로직이 실행됩니다.

```
08 커리어 인터뷰 완료
  ↓
인터뷰 저장 완료 화면 표시 (key_insights, ai_summary INSERT 완료)
  ↓
[역량 방향 받기] 버튼 클릭
  ↓
Step 1: 결정적 매칭 (코드 로직, AI 미사용)
        — Top 5 강점 ∩ 12개 역량 연계 강점 매칭으로 5개 슬롯 결정
  ↓
Step 2: AI 카드 문구 개인화 (1회 AI 호출, 메모리/세션 저장)
        — personalized_text 생성 (DB 저장 X)
  ↓
Step 3: career_interview_results.recommended_competencies UPDATE (DB 저장)
  ↓
09 화면 — 5개 옵션 카드 표시 (고정 5개)
  ↓
유저가 1개 선택 → goals INSERT
        — competency_code, domain, goal_title (앱 상수)
```

> **핵심 변경 (v0.7):** 옵션 개수는 **5개 고정**입니다. 3~5개 동적 아님.
> AI는 카드 문구만 만들고, 실제 매칭은 코드(결정적)로 처리합니다.

---

### ② 5개 옵션 슬롯 구조 (09 화면 카드 렌더링)

`recommended_competencies` JSONB의 5개 옵션은 슬롯별 **추천 근거(badge)** 가 다릅니다.
화면에서 각 카드에 badge를 표시해 추천 이유를 사용자에게 설명합니다.

| slot | badge | 의미 | 화면 표시 예시 |
|------|-------|------|--------------|
| 1, 2, 3 | `strength_match` | 결정적 매칭 상위 3개 — 강점과 가장 잘 맞는 역량 | "강점에 잘 맞아요" |
| 4 | `user_interest` | 인터뷰에서 사용자가 언급한 역량 | "직접 언급하셨어요" |
| 5 | `growth_potential` | 시야 확장용 다른 도메인 추천 | "도전해 볼 만해요" |

> 슬롯 4·5는 매칭 결과에 따라 fallback으로 `strength_match`가 될 수 있습니다 (스키마 #3 Step 1 로직 참고).

**JSONB 구조:**

```json
[
  { "code": "T-1", "match_score": 4, "badge": "strength_match", "slot": 1 },
  { "code": "I-1", "match_score": 3, "badge": "strength_match", "slot": 2 },
  { "code": "E-1", "match_score": 2, "badge": "strength_match", "slot": 3 },
  { "code": "I-2", "match_score": 1, "badge": "user_interest",   "slot": 4 },
  { "code": "R-2", "match_score": 0, "badge": "growth_potential","slot": 5 }
]
```

---

### ③ goals INSERT 시 필요한 3개 값

유저가 09에서 1개 옵션을 선택하면, 해당 `code` 기반으로 다음 3개를 함께 저장합니다.

```javascript
// 09 카드 선택 시
const selectedCode = 'T-1'  // 사용자가 고른 옵션의 code

// 앱 상수에서 매핑값 조회 (competency_action_map.md → JSON)
const goalTitle = COMPETENCY_TITLES[selectedCode]  // "비판적 사고 기르기"
const domain    = selectedCode.split('-')[0]       // "T"

await supabase.from('goals').insert({
  career_interview_id: currentInterviewId,
  competency_code: selectedCode,  // "T-1"
  domain:          domain,         // "T"
  goal_title:      goalTitle,      // "비판적 사고 기르기" (앱 상수)
  status:          'active',
  current_week:    1,
  total_weeks:     12,
  started_at:      today,
})
```

**12개 역량 코드 ↔ 한글명 매핑 (앱 상수):**

| code | domain | goal_title |
|------|--------|-----------|
| T-1 | T | 비판적 사고 기르기 |
| T-2 | T | 데이터 분석 능력 기르기 |
| T-3 | T | 기획력 기르기 |
| I-1 | I | 커뮤니케이션 능력 기르기 |
| I-2 | I | 리더십 역량 기르기 |
| I-3 | I | 설득·협상력 기르기 |
| R-1 | R | 협업 능력 기르기 |
| R-2 | R | 코칭·멘토링 역량 기르기 |
| R-3 | R | 공감 소통 기르기 |
| E-1 | E | 실행력·추진력 기르기 |
| E-2 | E | 문제해결력 기르기 |
| E-3 | E | 자기관리 역량 기르기 |

> ⚠️ `goal_title`은 LLM 자유 생성이 아닙니다. 반드시 앱 상수에서 조회한 한글명을 그대로 INSERT합니다.

---

### ④ 앱 진입 시 라우팅 — `profile_completed` 기반

`profiles.profile_completed`가 라우팅의 핵심 조건입니다.

```javascript
// 앱 진입 시 라우팅 로직
const { data: { session } } = await supabase.auth.getSession()
if (!session) return navigate('/01-landing')

const user = session.user
if (!user.email_confirmed_at) return navigate('/new01-email-verify')

const { data: profile } = await supabase.from('profiles').select('*').single()
if (!profile.profile_completed) return navigate('/03-basic-info')

// 강점 미분석
const { data: strength } = await supabase
  .from('strength_analyses').select('id').eq('is_latest', true).maybeSingle()
if (!strength) return navigate('/04-strength-method')

// 커리어 미분석 (goals 없음)
const { data: goals } = await supabase
  .from('goals').select('id, status').limit(1)
if (!goals.length) return navigate('/07-career-intro')

// 액션 미선택 (W1 action_items 없음)
const activeGoal = goals.find(g => ['active', 'paused'].includes(g.status))
if (activeGoal) {
  const { data: w1Actions } = await supabase
    .from('action_items').select('id')
    .eq('goal_id', activeGoal.id).eq('week_number', 1)
  if (!w1Actions.length) return navigate('/10-action-select')
}

// 12주 완주
const completedGoal = goals.find(g => g.status === 'completed')
if (completedGoal && !activeGoal) return navigate('/new03-cycle-end')

return navigate('/11-home')
```

---

### ⑤ 앱 열 때마다 액션아이템 존재 여부 체크 필요

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

### ⑥ 메모·회고 화면은 active 목표 없으면 비활성

`daily_memos.goal_id`는 NOT NULL입니다.
활성 목표가 없는 상태에서 메모 화면에 접근하면 "목표를 먼저 설정해주세요" 안내를 보여줘야 합니다.

| 상태 | 메모·회고 화면 |
|------|--------------|
| active 목표 있음 | 정상 표시 |
| active 목표 없음 (온보딩 전, 목표 완료 후 공백기) | 접근 불가 + 안내 메시지 |

---

### ⑦ 주말 회고 제출 시 완료 횟수 자동 계산

`weekly_retros`의 `completion_count`와 `target_count`는 **프론트에서 집계해서 함께 저장**합니다.
유저가 직접 입력하는 값이 아닙니다.

```javascript
// 회고 제출 버튼 클릭 시

// 이번 주 action_items 목록 조회
const { data: actionItems } = await supabase
  .from('action_items').select('id')
  .eq('goal_id', goalId).eq('week_number', currentWeek)

// 이번 주 완료된 항목 수 집계 (이번 주 날짜 범위로 필터)
const { data: completions } = await supabase
  .from('action_completions').select('id')
  .in('action_item_id', actionItems.map(i => i.id))
  .gte('completed_date', weekStart)
  .lte('completed_date', weekEnd)

// weekly_retros INSERT
await supabase.from('weekly_retros').insert({
  goal_id: currentGoalId,
  week_number: currentWeek,
  retro_date: today,
  summary_one_line: userInput,
  completion_count: completions.length,    // 자동 집계
  target_count:     actionItems.length,    // 자동 집계
})
```

---

### ⑧ 목표 상태 4가지와 화면 처리

| status | 표시 방법 | 가능한 유저 액션 |
|--------|----------|----------------|
| `active` | 홈 화면 정상 표시 | 일시중단, 포기 |
| `paused` | 홈 화면에 "중단됨" 배지 | 재개, 포기 |
| `completed` | 히스토리에 달성률과 함께 표시 | 없음 (읽기 전용) |
| `abandoned` | 히스토리에 "중도 종료"로 표시 | 없음 (읽기 전용) |

**paused 관련 동작:**
- `paused` 목표가 있어도 새 `active` 목표를 만들 수 있습니다 (Partial Unique Index는 `active`만 제한)
- 재개(`paused` → `active`)하면 `current_week`는 중단 시점 그대로 이어집니다
- 일시중단 시 사유 입력 UI 제공 (선택 사항, `pause_reason` 컬럼에 저장)

> ⚠️ `completed_at` 컬럼은 없습니다. **`ended_at`** 으로 통일됐습니다.
> `completed`와 `abandoned` 두 경우 모두 `ended_at`에 날짜를 기록합니다.

---

### ⑨ 강점 분석 최신 결과 조회 방법

재진단 시 새 row가 추가되므로 `is_latest = true` 조건으로 조회합니다.

```javascript
// 최신 강점 분석 1개 조회
const { data } = await supabase
  .from('strength_analyses')
  .select('*')
  .eq('is_latest', true)
  .single()
```

> ⚠️ `is_latest` 갱신은 DB 트리거가 자동 처리합니다. 코드에서 따로 UPDATE하지 마세요.

---

### ⑩ 데이터 조회 시 user_id 필터 필요 없음

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

### ⑪ 푸시 알림 구독 (NEW04)

15 프로필의 [알림 설정] → NEW04 화면에서 진입.
`push_subscriptions`는 user_id 기준 1:1 (UNIQUE) — UPSERT로 처리합니다.

```javascript
// NEW04에서 [알림 받기] 클릭 시
const registration = await navigator.serviceWorker.ready
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_PUBLIC_KEY,
})

const { endpoint, keys } = subscription.toJSON()

await supabase.from('push_subscriptions').upsert({
  // user_id는 RLS가 자동 채움
  endpoint,
  keys: { p256dh: keys.p256dh, auth: keys.auth },
  daily_action:      true,
  weekly_review:     true,
  coaching_reminder: true,
  marketing:         false,  // 명시 동의 후에만 true
}, { onConflict: 'user_id' })
```

---

## 주요 컬럼 타입 정리

자주 헷갈리는 컬럼 타입 정리입니다.

| 테이블 | 컬럼 | 타입 | 특이사항 |
|--------|------|------|----------|
| `profiles` | `profile_completed` | `boolean` | NOT NULL default false. 03 완료 시 true로 UPDATE |
| `profiles` | `career_level` | `text` | CHECK enum (`junior_new`/`junior`/`senior_mid`/`senior`) |
| `profiles` | `birthdate` | `date` | nullable |
| `strength_analyses` | `strengths` | `jsonb` | 배열 구조, rank 1~5 |
| `strength_analyses` | `is_latest` | `boolean` | 트리거 자동 갱신 — 코드에서 UPDATE 금지 |
| `career_interview_results` | `key_insights` | `jsonb` | 객체 구조 (7개 의미 키 + `mentioned_competencies`) |
| `career_interview_results` | `recommended_competencies` | `jsonb` | **5개 슬롯 고정** ({code, match_score, badge, slot}) |
| `goals` | `competency_code` | `text` | CHECK 12개 (T-1~E-3) |
| `goals` | `domain` | `text` | CHECK 4개 (T/I/R/E) |
| `goals` | `goal_title` | `text` | 앱 상수 한글명 (LLM 자유 생성 X) |
| `goals` | `started_at`, `ended_at` | `date` | timestamptz 아님 |
| `goals` | `pause_reason` | `text` | nullable, 일시중단 사유 |
| `action_items` | `tags` | `text[]` | 문자열 배열 |
| `action_items` | `source_seed_id` | `text` | nullable, 시드 액션 추적용 (예: `T-1-junior-2`) |
| `action_completions` | `completed_date` | `date` | row 존재 = 완료, 삭제 = 미완료 |
| `coaching_insights` | `weekly_retro_id` | `uuid` | nullable FK |
| `push_subscriptions` | `keys` | `jsonb` | `{p256dh, auth}` |
| `push_subscriptions` | `daily_action`/`weekly_review`/`coaching_reminder`/`marketing` | `boolean` | 알림 종류별 on/off |

---

## 히스토리 화면 조회 예시

이전 목표 이력 표시 시 JOIN 없이 `goals` 테이블 단독 조회로 가능합니다.
(`final_completion_rate`가 종료 시 이미 저장돼 있기 때문)

```javascript
const { data } = await supabase
  .from('goals')
  .select('goal_title, competency_code, domain, status, started_at, ended_at, final_completion_rate')
  .in('status', ['completed', 'abandoned'])
  .order('ended_at', { ascending: false })
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.1 | 2026-05-09 | (옵션 A 정정) schema 무수정 원칙 확정 → 본문 "목표 추천받기" → "역량 방향 받기" 환원. schema는 v0.7.2 원본 복구. 09 화면명("커리어 방향 결과")은 유지. |
| v1.0 | 2026-05-09 | schema v0.7.2 기준 전면 정렬. 본 문서가 v0.6 기준으로 작성돼 있어 v0.7~v0.7.2 변경사항 통째 누락 상태였음 — 일괄 반영: `goal_category`(7) → `competency_code`(12)+`domain`(4), `recommended_competencies` JSONB 5슬롯 구조, 결정적 매칭+AI 카드 문구 개인화 3-Step 흐름, `mentioned_competencies` 키, `source_seed_id`, `push_subscriptions` 테이블, `profile_completed` 컬럼, `career_level` enum 표준화. |
