# CareerPT — DB 스키마 설계 (Draft v0.7.1)

> 기준 프로토타입: `CareerPT_prototype_v3_0505.html`
> 작성일: 2026-05-04
> 최종 수정: 2026-05-07
> 상태: 기획 요건 확정 → Supabase 테이블 생성 준비
> DB: Supabase (PostgreSQL)

---

### v0.7 → v0.7.1 변경 사항 (2026-05-07)

| # | 변경 내용 |
| --- | --- |
| 1 | `recommended_competencies` JSONB의 `badge` enum: 2개 → **3개로 확장** (`strength_match` / `user_interest` / `growth_potential`) |
| 2 | 옵션 5개 슬롯 구조 명시: 1~3 = 결정적 매칭, 4 = 사용자 의도, 5 = 도메인 확장 |
| 3 | `career_interview_results.key_insights` JSONB에 `mentioned_competencies` 키 추가 (사용자가 인터뷰에서 언급한 역량 코드 목록) |
| 4 | AI 연동 #3 단계 분리: Step 1 (결정적 매칭, 코드) + Step 2 (AI 카드 문구 개인화, DB 미저장) |
| 5 | AI 연동 #2 (커리어 인터뷰)에서 `mentioned_competencies` 추출 책임 명시 |

### v0.6 → v0.7 변경 사항 (2026-05-07)

| # | 변경 내용 |
| --- | --- |
| 1 | `goals.goal_category` (7개 대분류) 제거 → `goals.competency_code` (12개 역량 코드) + `goals.domain` (4개 도메인) 추가 |
| 2 | `goals.goal_title` LLM 자유 생성 → competency_code 매핑 한글명 (앱 상수) |
| 3 | `career_interview_results.recommended_goal_categories` (text[]) → `recommended_competencies` (JSONB, code+match_score+badge 구조) |
| 4 | 옵션 개수 정책: 3~5개 동적 → **5개 고정** |
| 5 | 옵션 매칭 로직: AI 추천 → **결정적 매칭(코드)** + 카드 문구만 AI 개인화 |
| 6 | 액션 생성 정책: AI 자유 생성 → competency_action_map.md 시드 6개 + AI 재해석 |
| 7 | `action_items.source_seed_id` 컬럼 신규 추가 (선택) |
| 8 | `profiles.career_level` 표준 enum화 (junior_new/junior/senior_mid/senior) |
| 9 | 정적 레퍼런스 데이터 섹션 신규 추가 (DB 외부 데이터 명시) |
| 10 | AI 연동 #2: 강점 페어 컨텍스트 활용 명시 (P08 커리어 인터뷰부터) |

### v0.5 → v0.6 변경 사항

| # | 변경 내용 |
| --- | --- |
| 1 | `career_interview_results` RLS: UPDATE ❌ → ✅ 허용 (기획 결정: 카테고리 추천은 별도 버튼으로 분리) |
| 2 | `goals.status` 허용값에 `abandoned` 추가 + `pause_reason` 컬럼 신규 추가 |
| 3 | `daily_memos.goal_id` nullable → NOT NULL (기획 결정: 목표 없으면 메모 화면 비활성) |
| 4 | 주차 자동 전환 정책 명시: 매주 월요일 자정 자동 전환, 회고 없어도 액션아이템 추천 가능 |
| 5 | `weekly_retros.completion_count / target_count` 자동 집계 방식 명시 |
| 6 | `action_items` 중복 컬럼 정리: `ai_recommended` 제거 → `is_custom` 단일 컬럼으로 통합 |
| 7 | DB 생성용 CHECK 제약 및 트리거 섹션 신규 추가 |

### v0.4 → v0.5 변경 사항

| # | 변경 내용 |
| --- | --- |
| 1 | `goals.goal_type` 단일 컬럼 → `goal_category` (고정 대분류 7개) + `goal_title` (LLM 자유 생성) 으로 분리 |
| 2 | `career_interview_results.recommended_goal_types` → `recommended_goal_categories` 로 명칭 변경 |
| 3 | AI 연동 설계 #3, #4 섹션 컬럼명 반영 |

### v0.3 → v0.4 변경 사항

| # | 변경 내용 |
| --- | --- |
| 1 | `career_interview_results`: 고정 질문 컬럼(q1~q6) 제거 → `key_insights (jsonb)` 로 교체 (대화형 인터뷰 대응) |
| 2 | AI 연동 설계: 7개 AI 터치포인트 전체 반영 및 DB 연결 구조 정리 |

### v0.2 → v0.3 변경 사항

| # | 변경 내용 |
| --- | --- |
| 1 | `goals`: `final_completion_rate` 컬럼 추가 → 히스토리 표시 시 JOIN 없이 달성률 조회 가능 |
| 2 | `career_interview_results` 테이블 신규 추가 → 마이페이지에서 커리어 인터뷰 결과 조회 가능 |
| 3 | ERD, 테이블 목록, 목차 업데이트 |

### v0.1 → v0.2 변경 사항

| # | 변경 내용 |
| --- | --- |
| 1 | `goals`: 한 유저는 동시에 목표 1개만 보유 → Partial Unique Index 추가 |
| 2 | `action_items`: 매주 AI가 새로 추천하는 구조 명시 |
| 3 | `coaching_sessions` 테이블 제거 → 대화 원문 미저장 결정 |
| 4 | `strength_analyses.interview_messages` 컬럼 제거 (동일 이유) |
| 5 | `coaching_insights` 컬럼 보강 (요약 결과값 중심으로 재설계) |
| 6 | AI 연동 설계 섹션 신규 추가 |

---

## 목차

1. [정적 레퍼런스 데이터 (DB 외부)](#정적-레퍼런스-데이터-db-외부)
2. [전체 테이블 목록](#전체-테이블-목록)
3. [ERD 관계 요약](#erd-관계-요약)
4. [테이블 상세 정의](#테이블-상세-정의)
   - [profiles](#1-profiles)
   - [strength_analyses](#2-strength_analyses)
   - [career_interview_results](#3-career_interview_results)
   - [goals](#4-goals)
   - [action_items](#5-action_items)
   - [action_completions](#6-action_completions)
   - [daily_memos](#7-daily_memos)
   - [weekly_retros](#8-weekly_retros)
   - [coaching_insights](#9-coaching_insights)
5. [AI 연동 설계](#ai-연동-설계)
6. [주차 자동 전환 정책](#주차-자동-전환-정책)
7. [보안 정책 (RLS)](#보안-정책-rls)
8. [DB 생성 시 필수 설정](#db-생성-시-필수-설정)
9. [v0.6 → v0.7.1 마이그레이션 SQL](#v06--v071-마이그레이션-sql)

---

## 정적 레퍼런스 데이터 (DB 외부)

다음 데이터는 DB가 아닌 앱 코드/JSON 파일로 관리됩니다.
빌드 시 번들에 포함되며, AI 호출 시점에 클라이언트가 슬라이싱하여 프롬프트에 주입합니다.

| 데이터 | 위치 | 용도 |
| --- | --- | --- |
| 12개 역량 정의 + 연계 강점 매핑 | `competency_action_map.md` → JSON 변환 | #3 옵션 매칭, #4 액션 시드 |
| 강점 페어 설명문 (1,089개) | 비공개 (`.gitignore`) | #2 커리어 인터뷰 follow-up 개인화 |
| 강점별 실행항목 가이드 (34개) | 비공개 (`.gitignore`) | #4 액션 톤 보강 |

> ⚠️ 갤럽 원본 데이터는 `.gitignore`로 공개 저장소에서 제외.
> Top 5 강점만 AI에게 전달하고, 슬라이싱된 페어/실행항목 발췌만 프롬프트에 주입.

---

## 전체 테이블 목록

| # | 테이블명 | 한글명 | 역할 |
| --- | --- | --- | --- |
| 1 | `profiles` | 유저 프로필 | Supabase Auth와 연결된 기본 정보 |
| 2 | `strength_analyses` | 강점 분석 결과 | AI 인터뷰 또는 갤럽 파일로 산출된 Top 5 강점 |
| 3 | `career_interview_results` | 커리어 인터뷰 결과 | 6개 메인 질문 + follow-up 답변에서 추출한 핵심 인사이트 |
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
            ├── career_interview_results (1:N)  ← 6개 메인 질문 + follow-up 핵심 답변
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
>
> ⚡ v0.7 변경: `career_level` 표준 enum화

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK, FK → `auth.users.id` | Supabase Auth 유저 ID와 동일 | `a1b2c3d4-...` |
| `nickname` | `text` | NOT NULL | 닉네임 (앱 내 표시 이름) | `지수` |
| `birthdate` | `date` | nullable | 생년월일 | `1997-03-15` |
| `gender` | `text` | nullable | 성별 (`남성` / `여성` / `기타`) | `여성` |
| `job_field` | `text` | nullable | 직업/분야 | `IT/개발` |
| `career_level` | `text` | NOT NULL, CHECK | 경력 단계 표준 enum | `junior` |
| `main_concern` | `text` | nullable | 가장 큰 커리어 고민 (자유 입력) | `이직을 해야 하는지 모르겠어요` |
| `avatar_url` | `text` | nullable | 프로필 이미지 URL | `https://...` |
| `streak_days` | `int` | default 0 | 연속 접속일 | `7` |
| `created_at` | `timestamptz` | default now() | 가입 일시 | `2026-04-16 09:00:00+09` |
| `updated_at` | `timestamptz` | default now() | 마지막 수정 일시 | `2026-04-23 18:30:00+09` |

**`career_level` 표준값:**

| DB 값 | 표시 라벨 | seed_level 매핑 (#4 액션 시드 조회용) |
| --- | --- | --- |
| `junior_new` | 신입 (1년 미만) | `junior` |
| `junior` | 주니어 (1~3년) | `junior` |
| `senior_mid` | 미들 (4~7년) | `senior` |
| `senior` | 시니어 (8년+) | `senior` |

> ⚠️ "취업 준비 중"은 사용자 대상에서 제외 — drop-down에서도 제거.

---

### 2. `strength_analyses`

> 역할: 강점 진단 결과 저장. AI 인터뷰 또는 갤럽 파일 업로드 두 방식 모두 지원.
> 재진단하면 새 row가 추가되고 `is_latest`로 최신 결과를 식별함.

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK, default gen_random_uuid() | 분석 고유 ID | `b2c3d4e5-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `method` | `text` | NOT NULL, CHECK | 진단 방식 (`ai_interview` / `gallup_upload`) | `ai_interview` |
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
> ⚡ v0.7 변경: `recommended_goal_categories` (text[]) → `recommended_competencies` (JSONB)
> ⚡ v0.7.1 변경: `key_insights` JSONB에 `mentioned_competencies` 키 추가

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK, default gen_random_uuid() | 인터뷰 결과 고유 ID | `z1y2x3w4-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `interviewed_at` | `timestamptz` | NOT NULL, default now() | 인터뷰 완료 일시 | `2026-04-16 10:30:00+09` |
| `key_insights` | `jsonb` | NOT NULL | AI가 대화에서 추출한 핵심 인사이트 (아래 참고) | 아래 참고 |
| `ai_summary` | `text` | NOT NULL | AI가 생성한 인터뷰 종합 한 줄 요약 | `성취 지향적이며 방향성보다 성장 환경을 중시함` |
| `recommended_competencies` | `jsonb` | nullable | #3 단계에서 산출되는 5개 옵션 (아래 참고) | 아래 참고 |

**`key_insights` JSONB 구조 (v0.7.1):**

```json
{
  "current_satisfaction": "팀원들과 협업할 때 에너지를 얻어요",
  "current_frustration": "내가 성장하고 있는지 방향이 불명확해요",
  "future_vision": "3~5년 안에 팀을 이끄는 리더가 되고 싶어요",
  "work_style": "자율성이 보장되는 소규모 팀 선호",
  "values": ["성장", "인정", "자율"],
  "career_concern": "이직을 해야 하는지 현 직장에서 성장해야 하는지 모르겠어요",
  "dream": "언젠가 나만의 팀을 만들어 제품을 만들고 싶어요",
  "mentioned_competencies": ["I-2", "T-1"]
}
```

**`mentioned_competencies` 키 (v0.7.1 신규):**
- 인터뷰 중 사용자가 명시적·암묵적으로 언급한 12개 역량 코드 목록
- 인터뷰 종료 시 AI가 `key_insights`의 다른 키들을 분석해 0~3개 추출
- 명시 언급 (예: "비판적 사고를 기르고 싶어요" → `T-1`)
- 암묵 언급 (예: "데이터 기반 의사결정을 잘하고 싶어요" → `T-2`)
- 언급된 게 없으면 빈 배열 `[]`
- #3 옵션 매칭 슬롯 4(`user_interest`)의 입력으로 사용

**`recommended_competencies` JSONB 구조 (v0.7.1):**

```json
[
  {
    "code": "T-1",
    "match_score": 4,
    "badge": "strength_match",
    "slot": 1
  },
  {
    "code": "I-1",
    "match_score": 3,
    "badge": "strength_match",
    "slot": 2
  },
  {
    "code": "E-1",
    "match_score": 2,
    "badge": "strength_match",
    "slot": 3
  },
  {
    "code": "I-2",
    "match_score": 1,
    "badge": "user_interest",
    "slot": 4
  },
  {
    "code": "R-2",
    "match_score": 0,
    "badge": "growth_potential",
    "slot": 5
  }
]
```

**필드 설명:**
- `code`: 12개 역량 코드 중 하나
- `match_score`: 사용자 Top 5 강점과 해당 역량의 연계 강점 5개의 교집합 카운트 (0~5)
- `badge`: 옵션의 추천 근거 (3종)
  - `strength_match`: 결정적 매칭 상위 3개 (슬롯 1~3)
  - `user_interest`: 사용자가 인터뷰에서 언급한 역량 (슬롯 4)
  - `growth_potential`: 시야 확장용 다른 도메인 추천 (슬롯 5)
- `slot`: 옵션 표시 순서 (1~5 고정)

> **카드 개인화 문구 (`personalized_text`)는 DB에 저장하지 않습니다.**
> AI가 화면 표시용으로만 1회 생성 (메모리/세션). 사용자가 옵션 선택 후 p10으로 이동하면 더 이상 필요 없음.

> **재인터뷰 시:** 새 row 추가 → 이력이 쌓임. 가장 최근 것은 `interviewed_at DESC`로 조회.

---

### 4. `goals`

> 역할: 유저가 선택한 역량 목표. 완료된 이전 목표도 row로 남아 히스토리로 조회 가능.
> **한 유저는 동시에 active 목표를 1개만 가질 수 있음.**
> 12주 완료 후 `completed` 처리 → 새 목표를 다시 생성 가능.
>
> ⚡ v0.7 변경: `goal_category` (7개 대분류) 제거 → `competency_code` (12개 역량 코드) + `domain` (4개 도메인) 추가
> ⚡ v0.7 변경: `goal_title` LLM 자유 생성 → competency_code 매핑 한글명 (앱 상수)

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK, default gen_random_uuid() | 목표 고유 ID | `c3d4e5f6-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `career_interview_id` | `uuid` | nullable, FK → `career_interview_results.id` | 이 목표를 만들게 된 커리어 인터뷰 | `z1y2x3w4-...` |
| `competency_code` | `text` | NOT NULL, CHECK | 12개 역량 코드 중 하나 | `T-1` |
| `domain` | `text` | NOT NULL, CHECK | 도메인 (T/I/R/E) — competency_code의 prefix와 일치 | `T` |
| `goal_title` | `text` | NOT NULL | competency_code에 매핑된 고정 한글명 (앱 상수에서 조회) | `비판적 사고 기르기` |
| `status` | `text` | NOT NULL, default `'active'`, CHECK | 진행 상태 (`active` / `paused` / `completed` / `abandoned`) | `active` |
| `pause_reason` | `text` | nullable | 목표 일시중단 사유 (선택 입력) | `바빠서 잠깐 쉬고 싶어요` |
| `current_week` | `int` | default 1 | 현재 진행 주차 (1~12) | `3` |
| `total_weeks` | `int` | default 12 | 전체 목표 기간 (주) | `12` |
| `started_at` | `date` | NOT NULL | 목표 시작일 | `2026-04-16` |
| `ended_at` | `date` | nullable | 목표 종료일 (`completed` / `abandoned` 시 기록) | `2026-07-08` |
| `final_completion_rate` | `int` | nullable, CHECK 0~100 | 목표 종료 시 최종 달성률 (%) | `78` |
| `created_at` | `timestamptz` | default now() | 생성 일시 | `2026-04-16 09:30:00+09` |

**`competency_code` 허용값 (12개 고정):**

| code | domain | goal_title (앱 상수) |
| --- | --- | --- |
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

**`status` 허용값:**

| 값 | 설명 |
| --- | --- |
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
> ⚡ v0.7 변경: `source_seed_id` 컬럼 추가 (시드 액션 추적용)

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK, default gen_random_uuid() | 액션 아이템 고유 ID | `d4e5f6g7-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `goal_id` | `uuid` | NOT NULL, FK → `goals.id` | 연결된 목표 ID | `c3d4e5f6-...` |
| `week_number` | `int` | NOT NULL | 해당 주차 (1~12) | `3` |
| `title` | `text` | NOT NULL | 액션 아이템 제목 | `TED 강연 1개 보고 핵심 논지 분석하기` |
| `description` | `text` | nullable | 상세 설명 | `강연을 보고 주장과 근거를 써보는 연습이에요.` |
| `tags` | `text[]` | nullable | 분류 태그 배열 | `["📹 영상 분석", "⏱ 1~2시간"]` |
| `is_custom` | `boolean` | default false | 유저 직접 추가 여부 | `false` |
| `source_seed_id` | `text` | nullable | 시드 액션 식별자 (예: `T-1-junior-2`). 디버깅·품질 분석용 | `T-1-junior-2` |
| `created_at` | `timestamptz` | default now() | 생성 일시 | `2026-04-16 09:35:00+09` |

> **매주 추천 흐름:** 코칭 인사이트 저장 시 다음 주 액션 아이템을 AI가 생성 → `action_items`에 INSERT
> 유저가 직접 추가하면 `is_custom=true`로 INSERT (`source_seed_id` 미사용)

---

### 6. `action_completions`

> 역할: 각 액션 아이템의 날짜별 완료 체크 기록.
> 홈 화면의 "오늘 했나요?" 체크와 요일별 상태를 저장.

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
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
| --- | --- | --- | --- | --- |
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
| --- | --- | --- | --- | --- |
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
> ⚠️ `strength_link` 컬럼은 자유 텍스트 유지 (v0.8에서 정형화 검토).

| 컬럼명 | 타입 | 제약 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | PK, default gen_random_uuid() | 인사이트 고유 ID | `h8i9j0k1-...` |
| `user_id` | `uuid` | NOT NULL, FK → `profiles.id` | 유저 ID | `a1b2c3d4-...` |
| `goal_id` | `uuid` | NOT NULL, FK → `goals.id` | 해당 목표 | `c3d4e5f6-...` |
| `weekly_retro_id` | `uuid` | nullable, FK → `weekly_retros.id` | 연결된 주차 회고 | `g7h8i9j0-...` |
| `week_number` | `int` | NOT NULL | 해당 주차 | `3` |
| `topic` | `text` | NOT NULL | 이번 주 코칭 핵심 주제 | `팀에서 의견을 분명하게 말하기` |
| `pattern_insight` | `text` | nullable | AI가 발견한 행동 패턴 | `"정리되기 전엔 말하지 않는다" — 체계 강점의 그림자` |
| `next_action_title` | `text` | NOT NULL | 다음 주 AI 추천 액션 제목 | `책 한 챕터 읽고, 블로그 1편 써보기` |
| `next_action_reason` | `text` | nullable | 추천 이유 | `체계 강점의 최소 단위로 압축한 출력 훈련이에요.` |
| `strength_link` | `text` | nullable | 연결된 강점 (자유 텍스트) | `체계 + 학습` |
| `created_at` | `timestamptz` | default now() | 인사이트 생성 일시 | `2026-04-27 22:00:00+09` |

**제약:** `(user_id, goal_id, week_number)` UNIQUE — 주차별 인사이트 1개

---

## AI 연동 설계

> 대화 원문은 저장하지 않고, 각 AI 기능의 **결과값만** DB에 저장하는 원칙을 따릅니다.
> 대화는 브라우저 메모리에서 진행 → 종료 시 AI가 구조화된 결과 생성 → DB에 INSERT.

---

### 7개 AI 터치포인트 전체 구조

| # | 기능 | 성격 | 입력 (DB 또는 정적 레퍼런스) | 출력 (DB 저장) |
| --- | --- | --- | --- | --- |
| 1 | 강점 인터뷰 | 대화형 | `profiles` (기본 정보) | `strength_analyses.strengths` |
| 2 | 커리어 인터뷰 | 대화형 | `strength_analyses` + 강점 페어 슬라이스 (Top 5 → 10페어) | `career_interview_results.key_insights` (mentioned_competencies 포함) + `ai_summary` |
| 3 | 역량 방향 도출 | **결정적 + 생성형** | `strength_analyses` + `career_interview_results` + `competency_action_map` | `career_interview_results.recommended_competencies` (5개 슬롯) |
| 4 | 액션아이템 개인화 생성 | 생성형 | `goals` + `competency_action_map` 시드 6개 + 실행항목 슬라이스 (Top 5) + `coaching_insights` | `action_items` 3~5건 + `source_seed_id` |
| 5 | 회고 메모 → 코칭 컨텍스트 주입 | 분석형 | `daily_memos` + `action_completions` + `weekly_retros` | *(DB 저장 없음, 프롬프트 구성용)* |
| 6 | 회고 코칭 | 대화형 | #5에서 구성한 컨텍스트 | *(대화 원문 미저장)* |
| 7 | 인사이트 요약 | 생성형 | #6 대화 내용 (메모리) | `coaching_insights` + 다음 주 `action_items` |

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
입력 (DB):
  - strength_analyses.strengths (Top 5)
입력 (정적 레퍼런스, 클라이언트가 슬라이싱):
  - Top 5 기반 강점 페어 10개 슬라이스 (C(5,2)=10)
    (페어 데이터는 비공개. AI 자체 지식 + 슬라이스로 페어 시너지 추론)
  ↓
[대화 진행 — 브라우저 메모리]
  - 메인 질문 6개 고정 (current_satisfaction, current_frustration,
    future_vision, work_style, values, career_concern)
  - 각 메인 질문 답변 후 페어 컨텍스트 기반 follow-up 1~2회
  ↓
출력: career_interview_results INSERT
  - key_insights = AI가 추출한 인사이트 JSONB
                   (7개 의미 키 + mentioned_competencies)
  - ai_summary   = 종합 한 줄 요약
  ※ mentioned_competencies: 인터뷰에서 사용자가 명시·암묵 언급한
                           역량 코드 0~3개 (예: ["T-1", "I-2"])
  ※ recommended_competencies는 이 단계에서 미입력
```

#### #3 역량 방향 도출 (결정적 + 생성형) — v0.7.1 핵심 변경

> **트리거:** 유저가 커리어 인터뷰 완료 후 "역량 방향 받기" 버튼 클릭

**Step 1: 결정적 매칭 (코드, AI 미사용)**

```
입력:
  - strength_analyses.strengths (Top 5)
  - competency_action_map의 12역량 × 연계 강점 5개 매핑
  - career_interview_results.key_insights.mentioned_competencies
  ↓
[코드 로직 실행 — AI 호출 없음]
  ↓
처리:
  1) 12개 역량 각각에 대해 match_score 계산
     match_score = |Top 5 ∩ 역량 연계 강점 5개|
  2) 5개 슬롯 채우기:
     - 슬롯 1~3: match_score 내림차순 상위 3개 → badge="strength_match"
       (동률 시 도메인 분포 우선, 그래도 동률이면 코드 알파벳 순)
     - 슬롯 4: mentioned_competencies 중 슬롯 1~3에 없는 첫 1개
              → badge="user_interest"
       (mentioned가 비어있거나 모두 슬롯 1~3과 중복이면
        → 결정적 매칭 4위로 fallback, badge="strength_match")
     - 슬롯 5: 슬롯 1~4와 다른 도메인의 역량 중 match_score가
              가장 높은 1개 → badge="growth_potential"
       (이미 슬롯 1~4가 4개 도메인을 다 커버하면
        → 결정적 매칭 5위로 fallback, badge="strength_match")
  ↓
중간 결과: 5개 옵션 [{code, match_score, badge, slot}]
```

**Step 2: 카드 문구 개인화 (AI 호출, DB 미저장)**

```
입력:
  - Step 1의 5개 옵션
  - career_interview_results.key_insights (7개 의미 키)
  - career_interview_results.ai_summary
  ↓
[AI 1회 호출]
  ↓
출력 (메모리/세션, DB 미저장):
  - 5개 옵션 각각의 personalized_text
    (예: "팀을 이끄는 리더로 성장하려면 비판적 사고가 핵심이에요.
          분석 강점이 데이터 기반 의사결정 리더로 확장될 수 있어요.")
```

**Step 3: DB 저장**

```
출력: career_interview_results UPDATE
  - recommended_competencies = [{code, match_score, badge, slot}, ...] × 5
                               (personalized_text는 저장하지 않음)
  ↓
유저에게 5개 옵션 카드 제시 → 1개 선택 → goals INSERT
  goals.competency_code = 선택한 코드
  goals.domain          = 코드 prefix (T/I/R/E)
  goals.goal_title      = 코드 매핑 한글명 (앱 상수에서 조회)
```

#### #4 액션아이템 개인화 생성 (생성형)

> **트리거:** 매주 월요일 자정 주차 자동 전환 후 OR 유저가 앱 재접속 시 (해당 주차 action_items 없으면)
> **기획 결정:** 회고 작성 여부와 무관하게 다음 액션아이템을 추천. 회고가 없으면 `coaching_insights`가 비어있을 수 있으므로, 없을 경우 `goals + profiles + 시드`만으로 생성.

```
입력 (필수):
  - goals.competency_code + goals.current_week
  - profiles.career_level (junior/senior 매핑용)
  - 정적 데이터: competency_action_map.md의 시드 액션 6개
                (해당 competency_code × seed_level)
입력 (선택):
  - strength_analyses.strengths (Top 5 — 강점 결을 살린 재해석에 사용)
  - 실행항목 슬라이스 (Top 5 강점 5블록 — 톤 보강에 사용)
  - coaching_insights (최근 1~3개 — 존재하면 이전 주 패턴 참고)
  ↓
[AI가 시드 6개를 강점 결에 맞춰 재해석/재생성하여 3~5개 액션 출력]
  ↓
출력: action_items INSERT (3~5건)
  - week_number = current_week
  - is_custom = false
  - title, description, tags
  - source_seed_id (어느 시드에서 파생됐는지 추적용)
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
                          (key_insights + mentioned_competencies + ai_summary)
career_interview_results ← #3 Step 1 결정적 매칭 + Step 2 AI 카드 개인화
                          (recommended_competencies UPDATE)
    ↓
goals ← 유저가 5개 옵션 중 1개 선택 (goals.career_interview_id 연결)
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

> **기획 결정:** 주차는 매주 월요일 자정에 자동으로 전환됨. 회고 작성 여부와 무관.

### 전환 규칙

| 조건 | 처리 |
| --- | --- |
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

> **회고 없는 경우 컨텍스트:** `coaching_insights`가 없으면 `goals + profiles + 시드`만으로 액션아이템 생성.
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
| --- | --- | --- | --- | --- |
| `profiles` | 본인만 | 본인만 | 본인만 | ❌ 불가 |
| `strength_analyses` | 본인만 | 본인만 | 본인만 | 본인만 |
| `career_interview_results` | 본인만 | 본인만 | 본인만 ¹ | ❌ 불가 |
| `goals` | 본인만 | 본인만 | 본인만 | 본인만 |
| `action_items` | 본인만 | 본인만 | 본인만 | 본인만 |
| `action_completions` | 본인만 | 본인만 | ❌ (삭제 후 재입력) | 본인만 |
| `daily_memos` | 본인만 | 본인만 | 본인만 | 본인만 |
| `weekly_retros` | 본인만 | 본인만 | 본인만 | ❌ 불가 |
| `coaching_insights` | 본인만 | 본인만 | ❌ 불가 | ❌ 불가 |

> ¹ `career_interview_results` UPDATE: `recommended_competencies` 컬럼만 UPDATE 허용 (AI 터치포인트 #3에서 유저가 "역량 방향 받기" 버튼을 눌렀을 때 한 번 기록). 앱에서 해당 컬럼만 PATCH하도록 제한.

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
  INSERT INTO public.profiles (id, nickname, career_level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
    'junior'  -- 기본값. 사용자가 기본 정보 입력 화면에서 수정
  );
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
-- profiles 테이블
career_level TEXT NOT NULL
  CHECK (career_level IN ('junior_new','junior','senior_mid','senior')),

-- goals 테이블
competency_code TEXT NOT NULL
  CHECK (competency_code IN (
    'T-1','T-2','T-3',
    'I-1','I-2','I-3',
    'R-1','R-2','R-3',
    'E-1','E-2','E-3'
  )),
domain TEXT NOT NULL
  CHECK (domain IN ('T','I','R','E')),
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

-- 도메인별 통계 조회
CREATE INDEX idx_goals_domain ON goals (domain);

-- 주차별 액션 아이템 조회
CREATE INDEX idx_action_items_goal_week ON action_items (goal_id, week_number);

-- 최신 강점 분석 조회
CREATE INDEX idx_strength_latest ON strength_analyses (user_id, is_latest);

-- 코칭 인사이트 컨텍스트 재구성용
CREATE INDEX idx_coaching_goal_week ON coaching_insights (goal_id, week_number DESC);
```

---

## v0.6 → v0.7.1 마이그레이션 SQL

이미 Supabase에 v0.6으로 테이블이 생성되어 있다면 다음 SQL을 적용하세요.

```sql
-- ============================================================
-- v0.6 → v0.7.1 마이그레이션
-- ============================================================

-- 1. goals 테이블 — competency_code + domain 도입
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_goal_category_check;

-- 기존 goal_category 컬럼이 있으면 제거 (또는 백업 후 제거)
ALTER TABLE goals DROP COLUMN IF EXISTS goal_category;

-- competency_code 컬럼 추가
ALTER TABLE goals ADD COLUMN competency_code TEXT NOT NULL DEFAULT 'T-1'
  CHECK (competency_code IN (
    'T-1','T-2','T-3',
    'I-1','I-2','I-3',
    'R-1','R-2','R-3',
    'E-1','E-2','E-3'
  ));
ALTER TABLE goals ALTER COLUMN competency_code DROP DEFAULT;

-- domain 컬럼 추가
ALTER TABLE goals ADD COLUMN domain TEXT NOT NULL DEFAULT 'T'
  CHECK (domain IN ('T','I','R','E'));
ALTER TABLE goals ALTER COLUMN domain DROP DEFAULT;

-- 2. career_interview_results 테이블 — recommended_competencies JSONB로 교체
ALTER TABLE career_interview_results DROP COLUMN IF EXISTS recommended_goal_categories;
ALTER TABLE career_interview_results ADD COLUMN recommended_competencies JSONB;

-- 3. action_items 테이블 — source_seed_id 추가
ALTER TABLE action_items ADD COLUMN source_seed_id TEXT;

-- 4. profiles 테이블 — career_level 표준 enum화
-- ⚠️ 기존 한글 데이터가 있으면 먼저 매핑 UPDATE 필요
-- UPDATE profiles SET career_level = CASE
--   WHEN career_level LIKE '신입%' THEN 'junior_new'
--   WHEN career_level LIKE '주니어%' THEN 'junior'
--   WHEN career_level LIKE '미들%' THEN 'senior_mid'
--   WHEN career_level LIKE '시니어%' THEN 'senior'
--   ELSE 'junior'
-- END;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_career_level_check;
ALTER TABLE profiles ALTER COLUMN career_level SET NOT NULL;
ALTER TABLE profiles ADD CONSTRAINT profiles_career_level_check
  CHECK (career_level IN ('junior_new','junior','senior_mid','senior'));

-- 5. 새 인덱스
CREATE INDEX IF NOT EXISTS idx_goals_domain ON goals (domain);
```

> ⚠️ `goals.goal_title` 컬럼은 그대로 유지하지만, INSERT 시점에 더 이상 LLM이 생성한 자유 텍스트가 아닌 **competency_code에 매핑된 앱 상수의 한글명**이 들어갑니다. 앱 코드에서 INSERT 로직 변경 필요.

> ⚠️ v0.7.1 추가 사항(`mentioned_competencies` 키, 5개 슬롯 구조, `badge` 3종류)은 모두 JSONB 내부 구조 변경이라 DDL 변경이 필요 없습니다. 앱 코드의 AI 프롬프트만 업데이트하면 됩니다.

---

## 추가 검토 필요 사항 (v0.8 후보)

1. `coaching_insights.strength_link`는 자유 텍스트(예: "체계 + 학습")인데, 12개 역량 체계로 가면 이것도 `competency_code` 참조나 강점 페어 코드로 정형화할지 결정 필요. **권장**: v0.7.1에서는 손대지 말고 추후 v0.8에서 다루기. 코칭 인사이트는 사람이 읽는 텍스트라 자유도가 높은 게 더 자연스러움.

2. `recommended_competencies.personalized_text`는 현재 DB 미저장(메모리/세션)이지만, 마이페이지에서 "당시 어떤 옵션을 추천받았는지" 추적 요구가 생기면 추가 검토.

3. `mentioned_competencies` 추출 정확도가 낮으면 `key_insights` 텍스트 키들을 분석하는 별도 #2.5 단계로 분리 검토.

---

*CareerPT DB 스키마 v0.7.1 · 2026-05-07*
