# CareerPT — DB 스키마 설계 (Draft v0.6)

> 기준 프로토타입: `CareerPT_prototype_0504.html`  
> 작성일: 2026-05-04  
> 상태: 기획 요건 확정 → Supabase 테이블 생성 준비  
> DB: Supabase (PostgreSQL)

### v0.5 → v0.6 변경 사항
| # | 변경 내용 |
|---|-----------|
| 1 | `career_interview_results` RLS: UPDATE ❌ → ✅ 허용 (기획 결정: 카테고리 추천은 별도 버튼으로 분리) |
| 2 | `goals.status` 허용값에 `abandoned` 추가 + `pause_reason` 컬럼 신규 추가 |
| 3 | `daily_memos.goal_id` nullable → NOT NULL (기획 결정: 목표 없으면 메모 화면 비활성) |
| 4 | 주차 자동 전환 정책 명시: 매주 월요일 자정 자동 전환, 회고 없어도 액션아이템 추천 가능 |
| 5 | `weekly_retros.completion_count / target_count` 자동 집계 방식 명시 |
| 6 | `action_items` 중복 컬럼 정리: `ai_recommended` 제거 → `is_custom` 단일 컬럼으로 통합 |
| 7 | DB 생성용 CHECK 제약 및 트리거 섹션 신규 추가 |

### v0.4 → v0.5 변경 사항
| # | 변경 내용 |
|---|-----------|
| 1 | `goals.goal_type` 단일 컬럼 → `goal_category` (고정 대분류 7개) + `goal_title` (LLM 자유 생성) 으로 분리 |
| 2 | `career_interview_results.recommended_goal_types` → `recommended_goal_categories` 로 명칭 변경 |
| 3 | AI 연동 설계 #3, #4 섹션 컬럼명 반영 |

### v0.3 → v0.4 변경 사항
| # | 변경 내용 |
|---|-----------|
| 1 | `career_interview_results`: 고정 질문 컬럼(q1~q6) 제거 → `key_insights (jsonb)` 로 교체 (대화형 인터뷰 대응) |
| 2 | AI 연동 설계: 7개 AI 터치포인트 전체 반영 및 DB 연결 구조 정리 |

### v0.2 → v0.3 변경 사항
| # | 변경 내용 |
|---|-----------|
| 1 | `goals`: `final_completion_rate` 컬럼 추가 → 히스토리 표시 시 JOIN 없이 달성률 조회 가능 |
| 2 | `career_interview_results` 테이블 신규 추가 → 마이페이지에서 커리어 인터뷰 결과 조회 가능 |
| 2 | ERD, 테이블 목록, 목차 업데이트 |

### v0.1 → v0.2 변경 사항
| # | 변경 내용 |
|---|-----------|
| 1 | `goals`: 한 유저는 동시에 목표 1개만 보유 → Partial Unique Index 추가 |
| 2 | `action_items`: 매주 AI가 새로 추천하는 구조 명시 |
| 3 | `coaching_sessions` 테이블 제거 → 대화 원문 미저장 결정 |
| 3 | `strength_analyses.interview_messages` 컬럼 제거 (동일 이유) |
| 3 | `coaching_insights` 컬럼 보강 (요약 결과값 중심으로 재설계) |
| 3 | AI 연동 설계 섹션 신규 추가 |

---

## 목차

1. [전체 테이블 목록](#전체-테이블-목록)
2. [ERD 관계 요약](#erd-관계-요약)
3. [테이블 상세 정의](#테이블-상세-정의)
   - [profiles](#1-profiles)
   - [strength_analyses](#2-strength_analyses)
   - [career_interview_results](#3-career_interview_results) ← v0.3 신규
   - [goals](#4-goals)
   - [action_items](#5-action_items)
   - [action_completions](#6-action_completions)
   - [daily_memos](#7-daily_memos)
   - [weekly_retros](#8-weekly_retros)
   - [coaching_insights](#9-coaching_insights)
4. [AI 연동 설계](#ai-연동-설계)
5. [주차 자동 전환 정책](#주차-자동-전환-정책)
6. [보안 정책 (RLS)](#보안-정책-rls)
7. [DB 생성 시 필수 설정](#db-생성-시-필수-설정)

---

## 전체 테이블 목록

| # | 테이블명 | 한글명 | 역할 |
|---|----------|--------|------|
| 1 | `profiles` | 유저 프로필 | Supabase Auth와 연결된 기본 정보 |
| 2 | `strength_analyses` | 강점 분석 결과 | AI 인터뷰 또는 갤럽 파일로 산출된 Top 5 강점 |
| 3 | `career_interview_results` | 커리어 인터뷰 결과 | 🆕 6개 질문에 대한 핵심 답변 요약 (마이페이지 표시용) |
| 4 | `goals` | 커리어 목표 | 유저의 역량 목표 (한 번에 1개만 active, 이력 보존) |
| 5 | `action_items` | 액션 아이템 | 목표별 주차별 실행 과제 (매주 AI가 새로 추천) |
| 6 | `action_completions` | 액션 완료 기록 | 날짜별 완료 체크 기록 |
| 7 | `daily_memos` | 일일 메모 | 평일 짧은 메모 |
| 8 | `weekly_retros` | 주차 회고 | 주말 회고 한 줄 요약 |
| 9 | `coaching_insights` | 코칭 인사이트 | 코칭 세션 종료 후 AI가 생성한 결과 요약 (히스토리) |

> ⚠️ `coaching_sessions` 테이블은 **삭제**했어요.  
> 대화 원문은 저장하지 않고, 브라우저 메모리에서만 진행 후 결과 요약만 `coaching_insights`에 저장합니다.

---

## ERD 관계 요약

```
auth.users (Supabase 관리)
    │
    └── profiles (1:1)
            │
            ├── strength_analyses (1:N)         ← 재진단 시 새 row 추가
            │
            ├── career_interview_results (1:N)  ← 🆕 커리어 인터뷰 핵심 답변
            │       │
            │       └── goals (1:N, active는 1개) ← 인터뷰 후 목표 설정
            │               │
            │               ├── action_items (1:N) ← 주차별 AI 추천 과제
            │               │       │
            │               │       └── action_completions (1:N) ← 날짜별 체크
            │               │
            │               ├── weekly_retros (1:N) ← 주차별 회고
            │               │
            │               └── coaching_insights (1:N) ← 코칭 결과 요약
            │
            └── daily_memos (1:N)               ← 날짜별 평일 메모
```

> `career_interview_results` → `goals` 의 관계:  
> 커리어 인터뷰를 마친 후 목표를 선택하므로, `goals.career_interview_id`로 어떤 인터뷰 결과에서 이 목표가 생성됐는지 추적 가능합니다.

---

## 테이블 상세 정의

---

### 1. `profiles`

> 역할: Supabase Auth(`auth.users`)와 1:1로 연결되는 유저 기본 정보.  
> 회원가입 후 기본 정보 입력 화면에서 저장됨.

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
|--------|------|------|------|------|
| `id` | `uuid` | PK, FK → `auth.users.id` | Supabase Auth 유저 ID와 동일 | `a1b2c3d4-...` |
| `nickname` | `text` | NOT NULL | 닉네임 (앱 내 표시 이름) | `지수` |
| `birthdate` | `date` | nullable | 생년월일 | `1997-03-15` |
| `gender` | `text` | nullable | 성별 (`남성` / `여성` / `기타`) | `여성` |
| `job_field` | `text` | nullable | 직업/분야 | `IT/개발` |
| `career_level` | `text` | nullable | 경력 단계 | `주니어 (1~3년)` |
| `main_concern` | `text` | nullable | 가장 큰 커리어 고민 (자유 입력) | `이직을 해야 하는지 모르겠어요` |
| `avatar_url` | `text` | nullable | 프로필 이미지 URL | `https://...` |
| `streak_days` | `int` | default 0 | 연속 접속일 | `7` |
| `created_at` | `timestamptz` | default now() | 가입 일시 | `2026-04-16 09:00:00+09` |
| `updated_at` | `timestamptz` | default now() | 마지막 수정 일시 | `2026-04-23 18:30:00+09` |

---

### 2. `strength_analyses`

> 역할: 강점 진단 결과 저장. AI 인터뷰 또는 갤럽 파일 업로드 두 방식 모두 지원.  
> 재진단하면 새 row가 추가되고 `is_latest`로 최신 결과를 식별함.
>
> ⚡ v0.2 변경: `interview_messages` 컬럼 제거 (대화 원문 미저장 방침)

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
|--------|------|------|------|------|
| `id` | `uuid` | PK, default gen_random_uuid() | 분석 고유 ID | `b2c3d4e5-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `method` | `text` | NOT NULL | 진단 방식 (`ai_interview` / `gallup_upload`) | `ai_interview` |
| `strengths` | `jsonb` | NOT NULL | Top 5 강점 배열 | 아래 참고 |
| `file_url` | `text` | nullable | 갤럽 파일 URL (gallup_upload일 때만) | `https://...` |
| `is_latest` | `boolean` | default true | 최신 분석 여부 | `true` |
| `created_at` | `timestamptz` | default now() | 분석 일시 | `2026-04-16 10:00:00+09` |

**`strengths` JSONB 예시:**
```json
[
  { "rank": 1, "name_ko": "전략", "name_en": "Strategic", "description": "복잡한 상황에서도 최적의 경로를 빠르게 찾아내요." },
  { "rank": 2, "name_ko": "분석", "name_en": "Analytical", "description": "데이터와 근거를 바탕으로 깊이 생각해요." },
  { "rank": 3, "name_ko": "성취", "name_en": "Achiever", "description": "끊임없이 뭔가를 이루고 싶은 강한 내면의 불꽃이 있어요." },
  { "rank": 4, "name_ko": "배움",  "name_en": "Learner", "description": "새로운 지식과 기술을 습득하는 과정 자체에서 에너지를 얻어요." },
  { "rank": 5, "name_ko": "책임", "name_en": "Responsibility", "description": "한번 맡은 일은 반드시 완수하는 강한 책임감이 있어요." }
]
```

---

### 3. `career_interview_results`

> 역할: 커리어 인터뷰 완료 후 AI가 추출한 핵심 인사이트를 저장.  
> 마이페이지에서 "내가 당시 어떤 상황이었는지" 돌아볼 수 있고, 목표 생성 및 이후 AI 컨텍스트로도 활용됨.
>
> 🆕 v0.3 신규 추가  
> ⚡ v0.4 수정: 고정 질문 컬럼(q1~q6) 제거 → **`key_insights (jsonb)`** 로 교체  
> 이유: 대화형 인터뷰는 AI가 맥락에 따라 질문을 다르게 할 수 있어서 컬럼 고정이 불가능.  
> 대화 원문은 저장하지 않고, 세션 종료 시 AI가 핵심만 추출해서 구조화된 JSONB로 저장.

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
|--------|------|------|------|------|
| `id` | `uuid` | PK, default gen_random_uuid() | 인터뷰 결과 고유 ID | `z1y2x3w4-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `interviewed_at` | `timestamptz` | NOT NULL, default now() | 인터뷰 완료 일시 | `2026-04-16 10:30:00+09` |
| `key_insights` | `jsonb` | NOT NULL | AI가 대화에서 추출한 핵심 인사이트 (아래 참고) | 아래 참고 |
| `ai_summary` | `text` | NOT NULL | AI가 생성한 인터뷰 종합 한 줄 요약 | `성취 지향적이며 방향성보다 성장 환경을 중시함` |
| `recommended_goal_categories` | `text[]` | nullable | AI가 추천한 목표 대분류 코드 배열 (최대 3개) | `["thinking", "technical"]` |

**`key_insights` JSONB 구조:**

대화 내용이 달라져도 AI가 **의미 단위**로 추출해서 저장하는 방식이에요.  
질문이 바뀌어도 저장 포맷은 유지돼요.

```json
{
  "current_satisfaction": "팀원들과 협업할 때 에너지를 얻어요",
  "current_frustration": "내가 성장하고 있는지 방향이 불명확해요",
  "future_vision": "3~5년 안에 팀을 이끄는 리더가 되고 싶어요",
  "work_style": "자율성이 보장되는 소규모 팀 선호",
  "values": ["성장", "인정", "자율"],
  "career_concern": "이직을 해야 하는지 현 직장에서 성장해야 하는지 모르겠어요",
  "dream": "언젠가 나만의 팀을 만들어 제품을 만들고 싶어요"
}
```

> **왜 JSONB인가?**  
> - AI가 대화 흐름에 따라 다른 주제를 더 깊이 파고들 수 있음  
> - 어떤 유저는 "현재 불만"을 더 많이 이야기하고, 다른 유저는 "미래 비전"에 집중할 수 있음  
> - 고정 컬럼이면 대화 내용이 달라질 때 빈 컬럼이 많아지거나 데이터가 잘림  
> - JSONB는 인사이트 키가 추가/변경돼도 스키마 변경 없이 유연하게 대응 가능

> **마이페이지 표시 예시:**
> ```
> 📋 2026.04.16 커리어 인터뷰
> ──────────────────────────────
> 현재 만족하는 점  팀원들과 협업할 때 에너지를 얻어요
> 아쉬운 점        방향이 불명확해요
> 5년 후 목표      팀을 이끄는 리더
> 핵심 가치        성장 · 인정 · 자율
> ──────────────────────────────
> AI 요약: 성취 지향적이며 방향성보다 성장 환경을 중시함
> ```

> **재인터뷰 시:** 새 row 추가 → 이력이 쌓임. 가장 최근 것은 `interviewed_at DESC`로 조회.

---

### 4. `goals`

> 역할: 유저가 선택한 역량 목표. 완료된 이전 목표도 row로 남아 히스토리로 조회 가능.  
> **한 유저는 동시에 active 목표를 1개만 가질 수 있음.**  
> 12주 완료 후 `completed` 처리 → 새 목표를 다시 생성 가능.
>
> ⚡ v0.2 변경: Partial Unique Index 추가 (`active` 상태 목표는 유저당 1개만)  
> ⚡ v0.3 변경: `career_interview_id`, `final_completion_rate` 컬럼 추가  
> ⚡ v0.5 변경: `goal_type` → `goal_category` + `goal_title` 으로 분리

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
|--------|------|------|------|------|
| `id` | `uuid` | PK, default gen_random_uuid() | 목표 고유 ID | `c3d4e5f6-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `career_interview_id` | `uuid` | nullable, FK → `career_interview_results.id` | 이 목표를 만들게 된 커리어 인터뷰 | `z1y2x3w4-...` |
| `goal_category` | `text` | NOT NULL | UI·통계·필터용 대분류 코드 (고정 7개, 아래 참고) | `thinking` |
| `goal_title` | `text` | NOT NULL | LLM이 생성한 유저에게 보이는 목표 제목 | `비판적 사고 기르기` |
| `status` | `text` | NOT NULL, default `'active'` | 진행 상태 (`active` / `paused` / `completed` / `abandoned`) | `active` |
| `pause_reason` | `text` | nullable | 목표 일시중단 사유 (선택 입력) | `바빠서 잠깐 쉬고 싶어요` |
| `current_week` | `int` | default 1 | 현재 진행 주차 (1~12) | `3` |
| `total_weeks` | `int` | default 12 | 전체 목표 기간 (주) | `12` |
| `started_at` | `date` | NOT NULL | 목표 시작일 | `2026-04-16` |
| `ended_at` | `date` | nullable | 목표 종료일 (`completed` / `abandoned` 시 기록) | `2026-07-08` |
| `final_completion_rate` | `int` | nullable | 목표 종료 시 최종 달성률 (%) | `78` |
| `created_at` | `timestamptz` | default now() | 생성 일시 | `2026-04-16 09:30:00+09` |

**`goal_category` 허용값 (7개 고정 대분류):**

| 코드 | 한글 대분류 | LLM이 생성할 수 있는 `goal_title` 예시 |
|------|------------|---------------------------------------|
| `thinking` | 사고력 | 비판적 사고 기르기, 논리적 사고력 향상, 창의적 문제해결 능력 키우기 |
| `technical` | 기술·전문성 | 데이터 분석 능력 기르기, SQL 익히기, 파이썬으로 업무 자동화하기 |
| `communication` | 소통·표현 | 커뮤니케이션 능력 기르기, 발표력 향상, 설득력 있는 글쓰기 |
| `leadership` | 리더십·관리 | 리더십 역량 기르기, 팀 코칭 역량 키우기, 의사결정력 높이기 |
| `execution` | 실행·습관 | 실행력·추진력 기르기, 꾸준한 실행 습관 만들기, 마감 관리 능력 키우기 |
| `career` | 커리어 탐색 | 이직 준비하기, 포트폴리오 만들기, 업계 네트워크 넓히기 |
| `wellness` | 멘탈·에너지 | 번아웃 없이 일하는 방법 찾기, 스트레스 관리 능력 기르기, 자기인식 높이기 |

> **LLM 프롬프트 지침:** AI는 `goal_title`을 자유롭게 생성하되,  
> 반드시 위 7개 `goal_category` 중 하나로 분류해서 함께 반환해야 합니다.  
> 애매한 경우는 가장 가까운 카테고리로 매핑하고, 어느 쪽에도 맞지 않으면 `wellness` 사용.

**`status` 허용값:**

| 값 | 설명 |
|----|------|
| `active` | 현재 진행 중 (유저당 1개만 허용) |
| `paused` | 일시 중단 (중단 중에도 새 active 목표 생성 가능, 재개 시 주차 이어서 진행) |
| `completed` | 12주 완료 (`ended_at` + `final_completion_rate` 기록) |
| `abandoned` | 유저 포기/종료 (`ended_at` + `final_completion_rate` 기록) |

> **paused 관련 규칙:**
> - 중단 사유(`pause_reason`)는 선택 입력
> - `paused` 상태 목표가 있어도 새 `active` 목표를 만들 수 있음 (Partial Unique Index는 `active`만 제한)
> - 재개(`paused` → `active`) 시 `current_week`은 중단 시점 그대로 유지

**Partial Unique Index (active 목표 1개 보장):**
```sql
CREATE UNIQUE INDEX one_active_goal_per_user
  ON goals (user_id)
  WHERE status = 'active';
```

---

### 5. `action_items`

> 역할: 목표별 주차별 실행 과제.  
> **매주 AI가 새로 추천하는 구조** → 주차마다 새 row가 생성됨.  
> AI 추천 항목(`is_custom=false`)과 유저 직접 추가(`is_custom=true`) 모두 저장.
>
> ⚡ v0.2 변경: 매주 AI 추천 구조 명시

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
|--------|------|------|------|------|
| `id` | `uuid` | PK, default gen_random_uuid() | 액션 아이템 고유 ID | `d4e5f6g7-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `goal_id` | `uuid` | NOT NULL, FK → `goals.id` | 연결된 목표 ID | `c3d4e5f6-...` |
| `week_number` | `int` | NOT NULL | 해당 주차 (1~12) | `3` |
| `title` | `text` | NOT NULL | 액션 아이템 제목 | `TED 강연 1개 보고 핵심 논지 분석하기` |
| `description` | `text` | nullable | 상세 설명 | `강연을 보고 주장과 근거를 써보는 연습이에요.` |
| `tags` | `text[]` | nullable | 분류 태그 배열 | `["📹 영상 분석", "⏱ 1~2시간"]` |
| `is_custom` | `boolean` | default false | 유저 직접 추가 여부 (`true`면 AI 추천 아님, `false`면 AI 추천) | `false` |
| `created_at` | `timestamptz` | default now() | 생성 일시 | `2026-04-16 09:35:00+09` |

> ⚡ v0.6 변경: `ai_recommended` 컬럼 제거 → `is_custom`의 반대값으로 판단 가능 (`is_custom=false` = AI 추천)

> **매주 추천 흐름:** 코칭 인사이트 저장 시 다음 주 액션 아이템을 AI가 생성 → `action_items`에 INSERT  
> 유저가 직접 추가하면 `is_custom=true`로 INSERT

---

### 6. `action_completions`

> 역할: 각 액션 아이템의 날짜별 완료 체크 기록.  
> 홈 화면의 "오늘 했나요?" 체크와 요일별 상태를 저장.

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
|--------|------|------|------|------|
| `id` | `uuid` | PK, default gen_random_uuid() | 완료 기록 고유 ID | `e5f6g7h8-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `action_item_id` | `uuid` | NOT NULL, FK → `action_items.id` | 완료한 액션 아이템 ID | `d4e5f6g7-...` |
| `completed_date` | `date` | NOT NULL | 완료한 날짜 | `2026-04-23` |
| `created_at` | `timestamptz` | default now() | 기록 생성 일시 | `2026-04-23 22:00:00+09` |

**제약:** `(user_id, action_item_id, completed_date)` UNIQUE — 같은 날 같은 항목 중복 방지

---

### 7. `daily_memos`

> 역할: 평일 짧은 메모 저장 (회고 화면 평일 모드).  
> 주말 코칭 시 AI 컨텍스트로 활용됨.

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
|--------|------|------|------|------|
| `id` | `uuid` | PK, default gen_random_uuid() | 메모 고유 ID | `f6g7h8i9-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `goal_id` | `uuid` | NOT NULL, FK → `goals.id` | 연결된 목표 (활성 목표 없으면 메모 화면 비활성) | `c3d4e5f6-...` |
| `memo_date` | `date` | NOT NULL | 메모 날짜 | `2026-04-23` |
| `week_number` | `int` | NOT NULL | 해당 목표의 주차 | `2` |
| `content` | `text` | NOT NULL | 메모 내용 | `오늘은 30분 읽고 3줄 메모 남김.` |
| `created_at` | `timestamptz` | default now() | 생성 일시 | `2026-04-23 22:10:00+09` |
| `updated_at` | `timestamptz` | default now() | 수정 일시 | `2026-04-23 22:10:00+09` |

**제약:** `(user_id, memo_date)` UNIQUE — 날짜별 메모 1개

---

### 8. `weekly_retros`

> 역할: 주말 회고 기록. "한 주를 한 줄로" 요약 저장.  
> 이 데이터가 코칭 AI에게 전달되는 이번 주 출발점이 됨.

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
|--------|------|------|------|------|
| `id` | `uuid` | PK, default gen_random_uuid() | 회고 고유 ID | `g7h8i9j0-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `goal_id` | `uuid` | NOT NULL, FK → `goals.id` | 이번 주차 목표 ID | `c3d4e5f6-...` |
| `week_number` | `int` | NOT NULL | 해당 주차 | `3` |
| `retro_date` | `date` | NOT NULL | 회고 날짜 (주말) | `2026-04-27` |
| `summary_one_line` | `text` | nullable | 한 줄 회고 | `야근이 많아서 1번밖에 못했어요.` |
| `completion_count` | `int` | default 0 | 이번 주 완료한 액션 수 (앱이 자동 집계) | `3` |
| `target_count` | `int` | default 0 | 이번 주 AI 추천 액션 아이템 총 수 (앱이 자동 집계) | `5` |
| `created_at` | `timestamptz` | default now() | 생성 일시 | `2026-04-27 21:00:00+09` |

**제약:** `(user_id, goal_id, week_number)` UNIQUE — 주차별 회고 1개

> **자동 집계 방식:** 회고 제출 시 앱이 해당 주차의 `action_completions` 건수를 세어 `completion_count`에, 해당 주차 `action_items` 건수를 세어 `target_count`에 자동 저장함.

---

### 9. `coaching_insights`

> 역할: AI 코칭 세션 종료 후 저장되는 핵심 요약.  
> 히스토리 화면의 "인사이트 보관함"으로 표시되고, 다음 주 코칭 시 AI 컨텍스트로 재사용됨.
>
> ⚡ v0.2 변경: 기존 `coaching_sessions`(대화 원문 저장) 테이블 제거 후 이 테이블로 통합.  
> 대화 과정은 저장하지 않고, **AI가 생성한 결과 요약만** 저장함.

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
|--------|------|------|------|------|
| `id` | `uuid` | PK, default gen_random_uuid() | 인사이트 고유 ID | `h8i9j0k1-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `goal_id` | `uuid` | NOT NULL, FK → `goals.id` | 해당 목표 | `c3d4e5f6-...` |
| `weekly_retro_id` | `uuid` | nullable, FK → `weekly_retros.id` | 연결된 주차 회고 | `g7h8i9j0-...` |
| `week_number` | `int` | NOT NULL | 해당 주차 | `3` |
| `topic` | `text` | NOT NULL | 이번 주 코칭 핵심 주제 | `팀에서 의견을 분명하게 말하기` |
| `pattern_insight` | `text` | nullable | AI가 발견한 행동 패턴 | `"정리되기 전엔 말하지 않는다" — 체계 강점의 그림자` |
| `next_action_title` | `text` | NOT NULL | 다음 주 AI 추천 액션 제목 | `책 한 챕터 읽고, 블로그 1편 써보기` |
| `next_action_reason` | `text` | nullable | 추천 이유 | `체계 강점의 최소 단위로 압축한 출력 훈련이에요.` |
| `strength_link` | `text` | nullable | 연결된 강점 | `체계 + 학습` |
| `created_at` | `timestamptz` | default now() | 인사이트 생성 일시 | `2026-04-27 22:00:00+09` |

**제약:** `(user_id, goal_id, week_number)` UNIQUE — 주차별 인사이트 1개

---

## AI 연동 설계

> 대화 원문은 저장하지 않고, 각 AI 기능의 **결과값만** DB에 저장하는 원칙을 따릅니다.  
> 대화는 브라우저 메모리에서 진행 → 종료 시 AI가 구조화된 결과 생성 → DB에 INSERT.

---

### 7개 AI 터치포인트 전체 구조

| # | 기능 | 성격 | 입력 (DB에서 읽기) | 출력 (DB에 저장) |
|---|------|------|-------------------|-----------------|
| 1 | 강점 인터뷰 | 대화형 | `profiles` (기본 정보) | `strength_analyses.strengths` |
| 2 | 커리어 인터뷰 | 대화형 | `strength_analyses` (강점 결과) | `career_interview_results.key_insights` |
| 3 | 역량 방향 도출 | 분석·생성형 | `strength_analyses` + `career_interview_results` | `career_interview_results.recommended_goal_categories` + `goal_title` 후보 생성 |
| 4 | 액션아이템 개인화 생성 | 생성형 | `goals` + `coaching_insights` (최근 이력) | `action_items` (주차별 신규 INSERT) |
| 5 | 회고 메모 → 코칭 컨텍스트 주입 | 분석형 | `daily_memos` + `action_completions` + `weekly_retros` | *(DB 저장 없음, 프롬프트 구성용)* |
| 6 | 회고 코칭 | 대화형 | #5에서 구성한 컨텍스트 | *(대화 원문 미저장)* |
| 7 | 인사이트 요약 | 생성형 | #6 대화 내용 (메모리) | `coaching_insights` |

---

### 터치포인트별 상세

#### #1 강점 인터뷰 (대화형)

```
입력: profiles.nickname, job_field, career_level
  ↓
[대화 진행 — 브라우저 메모리]
  ↓
출력: strength_analyses INSERT
  - method       = 'ai_interview'
  - strengths    = AI가 추출한 Top 5 강점 (JSONB)
  - is_latest    = true (기존 최신 레코드는 false로 업데이트)
```

#### #2 커리어 인터뷰 (대화형)

```
입력: strength_analyses.strengths (강점 결과를 초기 컨텍스트로 제공)
  ↓
[대화 진행 — 브라우저 메모리]
  ↓
출력: career_interview_results INSERT
  - key_insights = AI가 대화에서 추출한 인사이트 (JSONB)
  - ai_summary   = 종합 한 줄 요약
  ※ 이 단계에서는 recommended_goal_categories 아직 미입력
```

#### #3 역량 방향 도출 (분석·생성형)

> **기획 결정 (v0.6):** 인터뷰 완료 후 유저가 별도 버튼("목표 추천받기")을 눌러야 이 단계가 실행됨.  
> 따라서 `career_interview_results` 에 대한 UPDATE가 발생하며, RLS도 UPDATE를 허용함.

```
트리거: 유저가 커리어 인터뷰 완료 후 "목표 추천받기" 버튼 클릭
  ↓
입력: strength_analyses.strengths
    + career_interview_results.key_insights + ai_summary
  ↓
[AI가 강점 × 커리어 인사이트를 종합 분석]
  ↓
출력: career_interview_results UPDATE
  - recommended_goal_categories = ["thinking", "technical", ...]
  (각 카테고리에 대해 goal_title도 함께 생성해서 유저에게 선택지로 제시)
  (유저에게 goal_title 선택지 3~5개 제시 → 유저가 1개 선택 → goals INSERT)
     goals.goal_category = 분류된 카테고리 코드
     goals.goal_title    = LLM이 생성한 목표 제목
```

#### #4 액션아이템 개인화 생성 (생성형)

> **기획 결정 (v0.6):** 회고 작성 여부와 무관하게 다음 액션아이템을 추천해야 함.  
> 회고가 없으면 `coaching_insights`가 비어있을 수 있으므로, 없을 경우 `goals + profiles`만으로 생성.

```
트리거: 매주 월요일 자정 주차 자동 전환 후 OR 유저가 앱 재접속 시 (해당 주차 action_items 없으면)
  ↓
입력 (필수): goals.goal_category + goals.goal_title + goals.current_week
           + profiles (직군, 경력)
입력 (선택): coaching_insights (최근 1~3개 — 존재하면 이전 주 패턴 참고)
  ↓
[AI가 이번 주에 맞는 액션 아이템 3~5개 생성]
  ↓
출력: action_items INSERT (여러 건)
  - week_number = current_week
  - is_custom   = false  (AI 추천)
  - title, description, tags
```

#### #5 회고 메모 → 코칭 컨텍스트 주입 (분석형)

```
입력 (DB 조회만, 별도 저장 없음):
  - daily_memos      (이번 주 평일 메모 최대 5개)
  - action_completions (이번 주 완료 횟수)
  - weekly_retros    (이번 주 한 줄 요약)
  - coaching_insights (최근 3주 인사이트)
  ↓
[System Prompt 조립 → #6 회고 코칭에 주입]
```

#### #6 회고 코칭 (대화형)

```
입력: #5에서 조립한 System Prompt
  ↓
[대화 진행 — 브라우저 메모리]
  ↓
출력: 없음 (대화 원문 미저장)
     → 대화가 끝나면 바로 #7로 전환
```

#### #7 인사이트 요약 (생성형)

```
입력: #6 대화 내용 전체 (브라우저 메모리)
  ↓
[AI가 핵심만 추출해 구조화]
  ↓
출력: coaching_insights INSERT
  - topic               = 이번 주 코칭 주제
  - pattern_insight     = 발견된 행동 패턴
  - next_action_title   = 다음 주 추천 액션
  - next_action_reason  = 추천 이유
  - strength_link       = 연결된 강점

  + action_items INSERT (다음 주 항목)
  - #4 방식과 동일, week_number = current_week + 1
  - coaching_insights의 next_action_title 기반
```

---

### 전체 데이터 흐름 요약

```
[온보딩]
profiles ← 기본 정보 입력
    ↓
strength_analyses ← #1 강점 인터뷰 결과
    ↓
career_interview_results ← #2 커리어 인터뷰 결과
career_interview_results ← #3 역량 방향 도출 (recommended_goal_categories + goal_title 후보 생성)
    ↓
goals ← 유저가 목표 선택 (goals.career_interview_id 연결)
action_items ← #4 1주차 액션 아이템 생성

[매주 반복]
daily_memos ← 평일 메모 저장
action_completions ← 완료 체크 저장
weekly_retros ← 주말 한 줄 회고 저장
    ↓ (#5 컨텍스트 주입)
회고 코칭 대화 (#6, 미저장)
    ↓
coaching_insights ← #7 인사이트 요약 저장
action_items ← 다음 주 액션 아이템 생성
goals.current_week ← +1 업데이트
```

---

## 주차 자동 전환 정책

> **기획 결정 (v0.6):** 주차는 매주 월요일 자정에 자동으로 전환됨. 회고 작성 여부와 무관.

### 전환 규칙

| 조건 | 처리 |
|------|------|
| `status = 'active'`인 모든 goals | `current_week += 1` |
| `current_week >= total_weeks` 도달 시 | 앱에서 완료 화면 안내 (자동 `completed` 처리는 하지 않음 — 유저가 직접 완료 버튼) |
| `status = 'paused'`인 goals | 주차 전환 없음 (재개 전까지 동결) |

### 액션아이템 생성 시점

```
매주 월요일 자정
  → goals.current_week += 1
  → 해당 주차 action_items 없으면 AI 생성 큐에 추가

유저가 앱 첫 접속 시
  → 현재 주차의 action_items가 존재하는지 확인
  → 없으면 즉시 AI에 생성 요청 (회고 여부 무관)
```

> **회고 없는 경우 컨텍스트:** `coaching_insights`가 없으면 `goals + profiles`만으로 액션아이템 생성.  
> 회고가 있을수록 AI 추천의 개인화 품질이 높아지지만, 없어도 서비스는 정상 동작함.

---

## 보안 정책 (RLS)

> Supabase에서 **모든 테이블에 RLS를 활성화**해야 합니다.  
> 기본 원칙: "내 데이터만 읽고 쓸 수 있다"

```sql
-- 예시: goals 테이블 RLS 설정
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 목표만 조회"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "본인 목표만 생성"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 목표만 수정"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id);
```

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `profiles` | 본인만 | 본인만 | 본인만 | ❌ 불가 |
| `strength_analyses` | 본인만 | 본인만 | 본인만 | 본인만 |
| `career_interview_results` | 본인만 | 본인만 | 본인만 ¹ | ❌ 불가 |
| `goals` | 본인만 | 본인만 | 본인만 | 본인만 |
| `action_items` | 본인만 | 본인만 | 본인만 | 본인만 |
| `action_completions` | 본인만 | 본인만 | ❌ (삭제 후 재입력) | 본인만 |
| `daily_memos` | 본인만 | 본인만 | 본인만 | 본인만 |
| `weekly_retros` | 본인만 | 본인만 | 본인만 | ❌ 불가 |
| `coaching_insights` | 본인만 | 본인만 | ❌ 불가 | ❌ 불가 |

> ¹ `career_interview_results` UPDATE: `recommended_goal_categories` 컬럼만 UPDATE 허용 (AI 터치포인트 #3에서 유저가 "목표 추천받기" 버튼을 눌렀을 때 한 번 기록). 앱에서 해당 컬럼만 PATCH하도록 제한.  
> 🔐 `coaching_insights`는 당시 기록 보존이 중요하므로 생성 후 수정·삭제 불가로 설정합니다.  
> 재인터뷰가 필요하면 새 row를 INSERT하는 방식으로 이력을 쌓습니다.

---

## DB 생성 시 필수 설정

> Supabase에서 테이블 생성 후 아래 설정을 추가해야 합니다.  
> 설정하지 않으면 데이터 오염, 회원가입 오류, 자동 갱신 미작동 등이 발생합니다.

### 1. profiles 자동 생성 트리거

회원가입 시 `auth.users`에 row가 생성되면 자동으로 `profiles`도 생성되어야 합니다.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. updated_at 자동 갱신 트리거

`profiles`, `daily_memos`의 `updated_at`이 수정 시 자동으로 갱신되어야 합니다.

```sql
-- Supabase Dashboard > Database > Extensions에서 moddatetime 활성화 후:
CREATE TRIGGER handle_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE TRIGGER handle_updated_at_daily_memos
  BEFORE UPDATE ON daily_memos
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

### 3. strength_analyses.is_latest 자동 갱신 트리거

새 강점 분석이 INSERT되면 기존 레코드의 `is_latest`를 자동으로 `false`로 전환합니다.

```sql
CREATE OR REPLACE FUNCTION reset_strength_is_latest()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE strength_analyses
  SET is_latest = false
  WHERE user_id = NEW.user_id AND is_latest = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_strength_analyses_is_latest
  BEFORE INSERT ON strength_analyses
  FOR EACH ROW EXECUTE FUNCTION reset_strength_is_latest();
```

### 4. CHECK 제약 (테이블 생성 시 컬럼에 포함)

```sql
-- goals 테이블
goal_category TEXT NOT NULL
  CHECK (goal_category IN ('thinking','technical','communication','leadership','execution','career','wellness')),
status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','paused','completed','abandoned')),
final_completion_rate INT
  CHECK (final_completion_rate BETWEEN 0 AND 100),

-- strength_analyses 테이블
method TEXT NOT NULL
  CHECK (method IN ('ai_interview','gallup_upload'))
```

### 5. 성능 인덱스

```sql
-- 현재 active 목표 빠른 조회
CREATE INDEX idx_goals_user_status ON goals (user_id, status);

-- 주차별 액션 아이템 조회
CREATE INDEX idx_action_items_goal_week ON action_items (goal_id, week_number);

-- 최신 강점 분석 조회
CREATE INDEX idx_strength_latest ON strength_analyses (user_id, is_latest);

-- 코칭 인사이트 컨텍스트 재구성용
CREATE INDEX idx_coaching_goal_week ON coaching_insights (goal_id, week_number DESC);
```
