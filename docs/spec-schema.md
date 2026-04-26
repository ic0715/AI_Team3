# spec-schema.md — Supabase DB 스키마 정의

> **이 문서는 팀 공유 계약서입니다.**
> 컬럼명·타입을 변경하거나 테이블을 추가할 때는 반드시 PR로 이 파일을 먼저 수정하고,
> 팀원 확인 후 Supabase에 반영해주세요.

---

## 공통 규칙

| 규칙 | 내용 |
|---|---|
| PK | 모든 테이블 `id uuid DEFAULT gen_random_uuid()` |
| 타임스탬프 | `created_at timestamptz DEFAULT now()` |
| 네이밍 | snake_case (예: `user_id`, `job_description`) |
| RLS | 모든 테이블 활성화. 본인 데이터만 읽기/쓰기 가능 |
| FK | `auth.users(id)` 참조 시 `ON DELETE CASCADE` |

---

## Supabase 프로젝트 정보

| 항목 | 값 |
|---|---|
| Project URL | `https://fqgpfdzjiopajpeumlac.supabase.co` |
| Region | Southeast Asia (Singapore) |
| anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (spec-auth.md 참고) |

---

## 테이블 목록

| 테이블 | 담당 파트 | 설명 |
|---|---|---|
| `auth.users` | Supabase 자동 생성 | 인증 정보 (이메일, 비밀번호, 소셜) |
| `profiles` | Auth (Mingsunny) | 기본 설문 + 온보딩 상태 |
| `diagnoses` | Onboarding (Jaeyoung) | AI 진단 결과 |
| `weekly_plans` | Result Confirm (Inchae) | 1주일 계획 + 알림 설정 |
| `action_items` | Main App (Eunsang) | Daily Tasks |
| `retrospectives` | Main App (Eunsang) | 일일 회고 (KPT) |

---

## 테이블 상세

---

### `auth.users` (Supabase 자동 관리)

직접 테이블 생성 불필요. Supabase Auth가 관리.

```
id            uuid        PK
email         text
user_metadata jsonb       아래 필드 포함
```

**`user_metadata` 내부 필드** (login.html signUp 시 저장):

```jsonc
{
  "name": "홍길동",
  "consent_privacy": true,
  "consent_privacy_at": "2026-04-26T10:00:00.000Z",
  "consent_marketing": false,
  "consent_marketing_at": null
}
```

세션에서 꺼내는 법:
```javascript
const { data: { session } } = await sb.auth.getSession()
const user = session.user
user.id                             // uuid
user.email                          // "hong@example.com"
user.user_metadata.name             // "홍길동"
user.user_metadata.consent_privacy  // true
```

---

### `profiles`

담당: **Auth (Mingsunny)**
생성 시점: 온보딩 Step 1 완료 후 upsert

```sql
CREATE TABLE profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 기본 설문 (Onboarding S1)
  nickname            text NOT NULL,           -- 이름/닉네임
  age                 integer,                 -- 나이 (선택)
  company             text,                    -- 소속/회사 (선택)
  job_description     text,                    -- 현재 직무 설명
  tenure              text,                    -- 연차 enum 아래 참고
  interests           text,                    -- 요즘 관심사
  current_problem     text,                    -- 해결하고 싶은 문제
  emotions            text[],                  -- 선택한 감정 태그 배열

  -- 온보딩 진행 상태
  onboarding_step     integer DEFAULT 1,       -- 현재 완료된 단계 (1~4)
  onboarding_done     boolean DEFAULT false,   -- 전체 온보딩 완료 여부

  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
```

**`tenure` 허용값:**
`'6개월 미만'` | `'6개월~1년'` | `'1~3년'` | `'3~5년'` | `'5년 이상'`

**RLS 정책:**
```sql
-- 본인만 읽기/쓰기
CREATE POLICY "본인 프로필만" ON profiles
  USING (auth.uid() = user_id);
```

---

### `diagnoses`

담당: **Onboarding (Jaeyoung)**
생성 시점: 온보딩 Step 4 (진단 결과 생성) 완료 후 insert

```sql
CREATE TABLE diagnoses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- AI 분석 결과
  summary         text NOT NULL,       -- 종합 요약 텍스트
  keywords        text[],              -- 나를 정의하는 키워드 배열
  strengths       text[],              -- 강점 배열
  weaknesses      text[],              -- 개선 영역 배열

  -- 역량 점수 (배열 of 객체)
  competencies    jsonb,
  -- 예시:
  -- [
  --   {"name": "의사결정 & 실행력", "score": 27, "priority": "high"},
  --   {"name": "커뮤니케이션 & 영향력", "score": 41, "priority": "high"},
  --   {"name": "리더십 & 팀 빌딩", "score": 37, "priority": "medium"},
  --   {"name": "도메인 전문성 심화", "score": 57, "priority": "medium"}
  -- ]

  -- 목표 로드맵
  goals           jsonb,
  -- 예시:
  -- [
  --   {"period": "1년 후", "goal": "시니어 레벨 성장, 리더십 역량 첫 경험 확보"},
  --   {"period": "3년 후", "goal": "팀 리드 역할 수행, 도메인 전문성 심화"},
  --   {"period": "5년 후", "goal": "독립적 프로덕트 오너십, 외부 영향력 확장"}
  -- ]

  -- 인터뷰 원문 (선택 — 저장할 경우)
  interview_raw   jsonb,
  -- 예시:
  -- [{"q_index": 1, "question": "...", "answer": "..."}]

  created_at      timestamptz DEFAULT now()
);
```

**RLS 정책:**
```sql
CREATE POLICY "본인 진단 결과만" ON diagnoses
  USING (auth.uid() = user_id);
```

---

### `weekly_plans`

담당: **Result Confirm (Inchae)**
생성 시점: Phase B (1주일 계획 설정) 완료 후 insert

```sql
CREATE TABLE weekly_plans (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnosis_id              uuid REFERENCES diagnoses(id),  -- 연결된 진단

  week_start                date NOT NULL,         -- 해당 주 시작일 (월요일)

  -- Phase B 입력값
  reflection_on_diagnosis   text,                  -- Q1: 진단 결과 소감
  action_plan               text,                  -- Q2: 이번 주 실천 계획
  success_criteria          text,                  -- Q3: 성공 기준

  -- 알림 설정
  notification_time         text,                  -- 예: '09:00', '12:00', '21:00'

  -- 상태
  status                    text DEFAULT 'active', -- 'active' | 'completed' | 'skipped'

  created_at                timestamptz DEFAULT now()
);
```

**`status` 허용값:** `'active'` | `'completed'` | `'skipped'`

**RLS 정책:**
```sql
CREATE POLICY "본인 주간 계획만" ON weekly_plans
  USING (auth.uid() = user_id);
```

---

### `action_items`

담당: **Main App (Eunsang)**
생성 시점: Daily Task 추가 시 insert, 체크 시 update

```sql
CREATE TABLE action_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_plan_id      uuid REFERENCES weekly_plans(id),  -- 연결된 주간 계획 (선택)

  title               text NOT NULL,          -- 할 일 내용
  tags                text[],                 -- 태그 배열 (예: ['루틴', '도전'])
  competency          text,                   -- 연결 역량 (예: '의사결정 & 실행력')
  competency_points   integer DEFAULT 0,      -- 완료 시 역량 상승 포인트

  is_completed        boolean DEFAULT false,
  completed_at        timestamptz,            -- 완료 시각 (null이면 미완료)

  due_date            date,                   -- 마감일

  created_at          timestamptz DEFAULT now()
);
```

**RLS 정책:**
```sql
CREATE POLICY "본인 액션 아이템만" ON action_items
  USING (auth.uid() = user_id);
```

---

### `retrospectives`

담당: **Main App (Eunsang)**
생성 시점: 회고 작성 완료 후 insert

```sql
CREATE TABLE retrospectives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  retro_date    date NOT NULL,    -- 회고 날짜 (보통 오늘)
  keep          text,             -- 잘 한 것 (K)
  problem       text,             -- 문제점 (P)
  try           text,             -- 다음에 시도 (T)
  tags          text[],           -- 태그 배열

  created_at    timestamptz DEFAULT now()
);
```

**RLS 정책:**
```sql
CREATE POLICY "본인 회고만" ON retrospectives
  USING (auth.uid() = user_id);
```

---

## 테이블 관계도

```
auth.users (Supabase Auth)
    │
    ├──── profiles          (1:1)  온보딩 기본 설문 + 진행 상태
    │
    ├──── diagnoses         (1:N)  AI 진단 결과 (보통 1개지만 재진단 가능)
    │         │
    │         └──── weekly_plans  (1:N)  진단 기반 주간 계획
    │                   │
    │                   └──── action_items  (1:N)  주간 계획 기반 할 일
    │
    ├──── action_items      (1:N)  주간 계획 없이 직접 추가된 할 일도 포함
    │
    └──── retrospectives    (1:N)  일일 회고
```

---

## 변경 이력

| 날짜 | 변경 내용 | 담당 |
|---|---|---|
| 2026-04-26 | 최초 작성 | Mingsunny |

> 스키마 변경 시 이 표에 추가해주세요.
