# CareerPT 기획 스펙

## 목차

1. [제품 개요 (Overview)](#1-제품-개요-overview)
2. [배경 및 목적 (Background & Goals)](#2-배경-및-목적-background--goals)
3. [제품 전략: SLC 원칙](#3-제품-전략-slc-원칙)
4. [타겟 유저 (Target User)](#4-타겟-유저-target-user)
5. [유저 플로우 (User Flow)](#5-유저-플로우-user-flow)
6. [화면별 기능 명세 (Screen Spec)](#6-화면별-기능-명세-screen-spec)
7. [AI 코칭 설계 (AI Spec)](#7-ai-코칭-설계-ai-spec)
8. [데이터 구조 (Data Model)](#8-데이터-구조-data-model)
9. [예외 처리 & 엣지 케이스](#9-예외-처리--엣지-케이스)
10. [미결 사항 (Open Questions)](#10-미결-사항-open-questions)

---

## 1. 제품 개요 (Overview)

### 1.1 제품 한 줄 정의

**강점 기반으로 나에게 맞는 커리어 방향을 스스로 발견하고, 12주 코칭으로 실행 — 회고 — 성장까지 완결된 경험을 제공한다.**

### 1.2 제품 기본 정보

| 항목 | 내용 |
| --- | --- |
| 제품명 | CareerPT |
| 전략 방향 | SLC (Simple · Lovable · Complete) |
| 플랫폼 | 모바일 웹 (390px 기준, 반응형) |
| 화면 수 | 총 22개 화면 (기존 15개 + 신규 7개) |
| 인증/저장 | Supabase (Auth + PostgreSQL) |
| AI 엔진 | Claude API |
| AI 설계 기반 | MCC 코칭 철학 + 갤럽 CliftonStrengths 34 테마 |

---

## 2. 배경 및 목적 (Background & Goals)

### 2.1 문제 정의

커리어를 고민하는 직장인은 다음 네 가지 문제를 경험합니다.

- **방향 부재**: 이직·전환을 원하지만 어디서 시작해야 할지 모른다.
- **강점 미인식**: 자신이 무엇을 잘하고, 어디서 에너지를 얻는지 언어화하지 못한다.
- **실행 단절**: 막연한 고민이 구체적인 행동으로 연결되지 않는다.
- **지속 부재**: 방향을 정해도 12주 이상 실행을 유지하는 구조가 없다.

### 2.2 해결 방식

CareerPT는 4단계 여정으로 12주 실행 코칭을 지원합니다.

- **DISCOVER (발견)**: 강점 인터뷰로 나의 강점 테마를 언어화한다.
- **DIRECTION (방향)**: 커리어 인터뷰로 강점 기반 커리어 방향을 도출한다.
- **DO (실행)**: 선택한 방향에 맞는 액션 아이템을 선택하고 12주간 실행한다.
- **MAINTAIN (지속)**: 매일 회고·주간 코칭·히스토리로 성장을 이어간다.

### 2.3 성공 지표 (Success Metrics)

- **온보딩 완료율**: 01 랜딩 → 10 액션아이템 완료율 50% 이상
- **커리어 방향 선택률**: 09 화면에서 방향 선택 후 다음 단계 이동 비율
- **재방문율**: 액션아이템 설정 후 홈 화면 주 3회 이상 방문
- **주간 회고 완료율**: 12주 중 회고 완료 비율 (목표 60%)
- **회고 코칭 진입율**: 회고 완료 유저 중 AI 코칭 대화 진입 비율

---

## 3. 제품 전략: SLC 원칙

CareerPT는 MVP(Minimum Viable Product) 대신 **SLC(Simple·Lovable·Complete)** 전략을 채택합니다.
처음 사용하는 유저도 발견 → 방향 → 실행 → 지속의 완결된 여정을 경험할 수 있어야 합니다.

| 원칙 | 적용 방식 |
| --- | --- |
| **Simple** | 불필요한 기능을 제거하고, 핵심 흐름(15개 화면)에 집중. 각 화면은 하나의 명확한 목적만 가진다. |
| **Lovable** | AI 코치의 언어, 결과 카드 디자인, 홈의 12주 타임라인 등 유저가 계속 돌아오고 싶은 경험을 만든다. |
| **Complete** | 온보딩부터 강점 발견 → 커리어 방향 → 실행 → 회고 → 히스토리까지 끊기지 않는 완결된 여정을 제공. 추가로 운영·예외 화면(NEW01~NEW06)도 안정성을 위해 포함한다. |

---

## 4. 타겟 유저 (Target User)

### 4.1 Primary Persona

| 항목 | 내용 |
| --- | --- |
| 이름 (가상) | 김지현, 31세 |
| 직군 | 마케터 / 5년차 |
| 상황 | 현 직장에 지쳐 있고 이직 또는 직군 전환을 고민 중이지만 방향을 잡지 못함 |
| Pain Point | "내가 뭘 잘하는지 모르겠다. 이직하고 싶은데 어디로 가야 할지 모르겠다." |
| Goal | 나에게 맞는 커리어 방향을 찾고, 일정 기간 동안 실행해서 실질적인 변화를 만들고 싶다 |
| 디바이스 | 스마트폰 (iOS / Android) |
| 이용 패턴 | 출퇴근 시간·점심시간 등 짧은 시간 활용, 매일 15분 이내 |

### 4.2 유저 진입 동기

- 커리어 전환을 막연하게 고민하지만 구체적 방향이 없음
- 전문 코치 비용(회당 15~30만원)이 부담되어 접근하지 못했던 유저
- 갤럽 강점 진단을 알고 있지만 혼자 해석하기 어려웠던 유저
- 12주라는 기간 안에 실질적인 커리어 변화를 원하는 유저

---

## 5. 유저 플로우 (User Flow)

사용자는 **온보딩(01 ~ 03 + NEW01) → 강점 발견(04 ~ 06) → 커리어 방향(07 ~ 09) → 액션 설정(10) + 시작 안내(NEW02) → 12주 실행 루프(11 ~ 15 + NEW04 + NEW07)**를 거치며, 12주 완주 시 **NEW03**로 진입합니다.

### 5.1 페이즈 범례

| 페이즈 | 화면 |
| --- | --- |
| ONBOARDING | 01, 02, NEW01, 03 |
| DISCOVER | 04, 05, 06 |
| DIRECTION | 07, 08, 09 |
| DO | 10, NEW02 |
| MAINTAIN | 11, 12, 13, 14, 15, NEW04, NEW07 |
| CYCLE END | NEW03 |
| ERROR (전역) | NEW05, NEW06 |

### 5.2 전체 플로우 테이블

#### 기존 화면 (01~15)

| 화면 | 화면명 | 페이즈 | 핵심 목적 |
| --- | --- | --- | --- |
| 01 | 랜딩 / 코칭 합의 | ONBOARDING | 코칭 원칙 안내 및 동의 후 온보딩 시작 |
| 02 | 로그인 / 회원가입 | ONBOARDING | 계정 생성 또는 로그인 (Supabase Auth) |
| 03 | 기본 정보 입력 | ONBOARDING | 이름·나이·직군·고민 등 기본 프로필 수집 |
| 04 | 강점 선택 | DISCOVER | 갤럽 34 테마에서 Top 5 강점 직접 선택 (4-Domain 칩) |
| 05 | 강점 인터뷰 (AI 채팅) | DISCOVER | AI 코치와 대화로 강점 테마 탐색 |
| 06 | 강점 결과 | DISCOVER | 상위 강점 테마 Top 5 제시 및 확인 |
| 07 | 커리어 인터뷰 인트로 | DIRECTION | 강점 → 커리어 방향 탐색 전환 안내 |
| 08 | 커리어 인터뷰 (AI 채팅) | DIRECTION | 강점 컨텍스트 기반 커리어 방향 AI 탐색 |
| 09 | 커리어 방향 결과 | DIRECTION | 커리어 방향(목표 역량) 후보 5개 제시 및 유저 선택 |
| 10 | 액션 아이템 선택 | DO | 선택 방향 기반 실행 과제 제시, 유저 선택 및 저장 |
| 11 | 홈 (12주 대시보드) | MAINTAIN | 12주 코칭 현황·오늘의 액션·타임라인 확인 |
| 12 | 회고 | MAINTAIN | 평일 메모 작성 및 주말 주간 회고 완성 |
| 13 | 회고 코칭 (AI 채팅) | MAINTAIN | 주간 회고 기반 AI 코칭 대화 및 인사이트 도출 |
| 14 | 히스토리 | MAINTAIN | 과거 강점·커리어·액션·패턴 아카이브 조회 |
| 15 | 프로필 | MAINTAIN | 강점 요약·기본정보 수정·알림 설정·로그아웃·탈퇴 |

#### 신규 화면 (NEW01~NEW07)

| 화면 | 화면명 | 페이즈 | 핵심 목적 |
| --- | --- | --- | --- |
| NEW01 | 이메일 인증 안내 | ONBOARDING | 회원가입 후 이메일 인증 메일 확인 및 재발송 |
| NEW02 | 커리어 방향 설정 완료 | DO | 10 직후 1회 노출. 강점·커리어 방향·액션 설정 완료 안내 + 12주 실행 시작 동기 부여 |
| NEW03 | 12주 완료 화면 | CYCLE END | 12주 완주 축하 + 다음 사이클 진입 유도 |
| NEW04 | 푸시 알림 권한 요청 | MAINTAIN | 15 프로필 알림 설정에서 진입, 코칭 일정 알림용 푸시 권한 요청 |
| NEW05 | 네트워크 오류 화면 | ERROR | 서버/네트워크 연결 실패 시 안내 + 재시도 |
| NEW06 | 일반 오류 화면 | ERROR | 404/런타임 오류 통합 fallback 화면 |
| NEW07 | 비밀번호 변경 | MAINTAIN | 15 프로필에서 진입, 현재 비밀번호 재인증 후 새 비밀번호 설정 |

### 5.3 분기 플로우

- **02 회원가입 완료** → NEW01 이메일 인증 → 인증 완료 시 03으로
- **02 로그인 (기존 사용자)** → 사용자 상태 기반 라우팅 (5.4 참조)
- **04 강점 선택** → 5개 선택 후 → 07 직행 (메인 플로우, v1.11). 05 AI 인터뷰 → 06 결과 → 07 흐름은 풀 스펙으로 별도 진입점 보존. **갤럽 결과지 PDF 업로드 경로는 v1.11에서 spec 전체 제거**
- **06 강점 결과** → 다음(07) 또는 다시 분석(04로 복귀)
- **09 커리어 방향 결과** → 다음(10) 또는 인터뷰 다시하기(08로 재진입)
- **10 액션아이템 완료** → NEW02 커리어 방향 설정 완료 → 11 홈
- **11 홈** ↔ 탭바: 12 회고, 14 히스토리, 15 프로필
- **12 회고** → 주말 회고 완료 시: 13 회고 코칭으로 이동 (평일은 메모만)
- **13 회고 코칭** → "맞아요" 확정 시 11로 복귀 / "다시 다듬기" 클릭 시 13 내부 복귀
- **15 프로필** → 강점 재분석(04) / 커리어 방향 재설정(재설정 선택 다이얼로그 → 인터뷰 다시하기 07 또는 역량목표 & 액션아이템 다시 설정 09) / 알림 설정(NEW04) / 비밀번호 변경(NEW07) / 정보 수정(03 수정 모드 → 15 복귀) / 로그아웃(01) / 회원 탈퇴(01)
- **12주 완주 시** → 다음 진입에서 NEW03로 자동 라우팅
- **NEW03** → 새 12주 시작(07) / 강점부터 다시(04) / 히스토리(14)

### 5.4 사용자 상태별 진입 라우팅 `v1.14 — 01 랜딩 자동 라우팅 폐지`

**02 로그인 성공 시점** + **사용자 상태 기반으로 다음 화면을 결정해야 하는 모든 진입점**(NEW06 "홈으로", 15에서 새 사이클 시작 등)에서 사용. **01 랜딩은 v1.8부터 자동 라우팅 제외** (모든 사용자에게 랜딩 그대로 노출, `01_landing.md` §2 참조).

| 사용자 상태 | 조건 | 진입 화면 |
| --- | --- | --- |
| 비로그인 | 세션 없음 | 01 랜딩 |
| 이메일 미인증 | `email_confirmed_at IS NULL` | NEW01 이메일 인증 |
| 기본 정보 미완 | `profiles.profile_completed = false` | 03 기본 정보 |
| 강점 미분석 | `strength_analyses` (is_latest=true) 없음 | 04 강점 선택 |
| 커리어 미분석 | `goals` 없음 (career_interview_results는 있으나 goals 미생성) | 07 커리어 인터뷰 인트로 |
| 액션 미선택 | `action_items` (week_number=1) 없음 | 10 액션 아이템 |
| 코칭 진행 중 | `goals.status = 'active'` 또는 `'paused'` | 11 홈 |
| 12주 완주 | `goals.status = 'completed'` | NEW03 |

### 5.5 에러 화면 진입 (전역)

NEW05·NEW06은 어떤 화면에서도 발생 가능. 복귀는 사용자 상태에 따라 자동 분기.

- 네트워크 실패 / 5xx → NEW05 → [다시 시도] → 원래 화면 복귀
- 404 / JS 런타임 오류 → NEW06 → [홈으로] → 사용자 상태 기반 라우팅

---

### 5.6 MVP 스코프 (NEW 프로토타입 v1 기반) 🆕

> 본 절은 **Next.js MVP 빌드** 기준으로 작성. 풀 스펙(§5.2 ~ §5.5)은 production 목표로 그대로 두되, **첫 빌드에서 어디까지 구현할지**를 본 절에서 결정한다. NEW 프로토타입 v1을 1:1로 매핑한다.

#### 5.6.1 화면 분류

| 화면 | 화면명 | MVP | 비고 |
| --- | --- | --- | --- |
| 01 | 랜딩 / 코칭 합의 | ✅ | 12주 타임라인·Secondary CTA·소셜 로그인 모두 제외 |
| 02 | 로그인 / 회원가입 | ✅ | Google OAuth·Apple OAuth 제외, 이메일/비밀번호만 |
| NEW01 | 이메일 인증 안내 | ✅ | 풀 스펙대로 |
| 03 | 기본 정보 입력 | ✅ | 신규 진입 모드만. 수정 모드는 Post-MVP (15에서 진입) |
| 04 | 강점 선택 | ✅ | 직접 선택 단일 흐름. AI 인터뷰·PDF 업로드 분기 모두 제외 |
| 05 | 강점 인터뷰 (AI 채팅) | ⏳ | Post-MVP. 별도 진입점에서 도입 |
| 06 | 강점 결과 | ⏳ | Post-MVP. 05 완료 시에만 진입 |
| 07 | 커리어 인터뷰 인트로 | ✅ | 04 직접 선택 결과만 표시 |
| 08 | 커리어 인터뷰 (AI 채팅) | ✅ | 인터뷰 더하기 모드 포함 |
| 09 | 커리어 방향 결과 | ✅ | 5개 슬롯 + badge 3종 정상 운영 |
| 10 | 액션 아이템 선택 | ✅ | "시작하기 🚀" CTA |
| NEW02 | 커리어 방향 설정 완료 | ✅ | **MVP에서는 임시 종착점** (CTA 미구현, 11 홈으로 자동 진입 없음) |
| 11 | 홈 (12주 대시보드) | ⏳ | Post-MVP. 코드는 보존되어 있으나 진입 경로 0 |
| 12 | 회고 | ⏳ | Post-MVP |
| 13 | 회고 코칭 (AI 채팅) | ⏳ | Post-MVP |
| 14 | 히스토리 | ⏳ | Post-MVP |
| 15 | 프로필 | ⏳ | Post-MVP |
| NEW03 | 12주 완료 화면 | ⏳ | Post-MVP |
| NEW04 | 푸시 알림 권한 | ⏳ | Post-MVP |
| NEW05 | 네트워크 오류 화면 | ✅ | "처음으로" CTA → 01로 단순 분기 |
| NEW06 | 일반 오류 화면 | ✅ | "처음으로" CTA → 01로 단순 분기, 새로고침 버튼 제외 |
| NEW07 | 비밀번호 변경 | ⏳ | Post-MVP |

**MVP 화면 수: 12개 (01, 02, NEW01, 03, 04, 07, 08, 09, 10, NEW02, NEW05, NEW06)**
**Post-MVP 화면 수: 10개 (05, 06, 11~15, NEW03, NEW04, NEW07)**

#### 5.6.2 MVP 한정 동작 / 단순화

| 항목 | 풀 스펙 | MVP 동작 |
| --- | --- | --- |
| NEW02 종료 후 | 11 홈으로 진입 | **임시 종착점**. CTA 미구현. 사용자는 본 화면에서 종료 |
| 사용자 상태 라우팅 (5.4) | ACTIVE/PAUSED/COMPLETED 분기 → 11 / NEW03 | MVP에는 11/NEW03 미구현 → ACTIVE/PAUSED/COMPLETED 상태도 모두 ONBOARDING 흐름 종료 후 NEW02로 처리(또는 01로 fallback) |
| 04 진단 경로 분기 | AI 인터뷰 vs 갤럽 PDF 업로드 vs 직접 선택 (3택) | 직접 선택 단일 흐름 (분기 UI 자체 없음) |
| 02 소셜 로그인 | Google OAuth 지원 | 이메일/비밀번호만. OAuth 흐름 미구현 |
| 03 수정 모드 | 15·NEW03에서 진입 가능 | 진입 경로 자체가 미구현 (15 없으므로) |
| 강점 재분석 (15에서 진입) | 04로 진입 | 진입 경로 미구현 |
| 커리어 방향 재설정 (15에서 진입) | 재설정 선택 다이얼로그 → 07(인터뷰 다시하기) / 09(역량목표 & 액션아이템 다시 설정) | 진입 경로 미구현 (15 Post-MVP) |
| NEW05/NEW06 복귀 | 사용자 상태 기반 라우팅 | 단순 01 랜딩 진입 |

#### 5.6.3 MVP에서 사용하는 DB 테이블 (부분집합)

> 풀 스펙은 §8 데이터 구조 참조. MVP에서는 다음 테이블만 활용. 나머지는 Post-MVP에서 도입.

**MVP 활용 테이블 (5개)**:
- `auth.users` (Supabase Auth 기본)
- `profiles` — 기본 정보
- `strength_analyses` — `method='direct_select'` 단일 enum 운영 (04 직접 선택 결과)
- `career_interview_results` — 08 인터뷰 결과 + 09 추천 역량
- `goals` — 09 선택 역량 + 10 시작일

**MVP 미사용 테이블 (Post-MVP에서 도입, 5개)**:
- `action_items` — 10에서 INSERT는 하지만 11/12에서 활용 → MVP에서는 INSERT만 하고 후속 사용은 없음
- `action_completions` — 11/12 일일 체크
- `daily_memos` — 12 평일 메모
- `weekly_retros` — 12 주말 회고
- `coaching_insights` — 13 회고 코칭 결과
- `push_subscriptions` — NEW04 푸시 권한

> 10에서 `action_items` INSERT는 그대로 진행 (이후 11에서 표시되도록 데이터 보존). MVP 사용자는 NEW02에서 종료되므로 INSERT한 액션이 화면에 표시되지는 않음.

#### 5.6.4 Next.js 라우트 제안

| 화면 | Next.js Route (App Router 가정) |
| --- | --- |
| 01 | `/` 또는 `/landing` |
| 02 | `/auth` |
| NEW01 | `/auth/verify-email` |
| 03 | `/onboarding/profile` |
| 04 | `/onboarding/strengths` |
| 07 | `/onboarding/career-intro` |
| 08 | `/onboarding/career-interview` |
| 09 | `/onboarding/career-result` |
| 10 | `/onboarding/action-items` |
| NEW02 | `/onboarding/complete` |
| NEW05 | `/error/network` |
| NEW06 | `/error` |

> 라우트 그룹 `/onboarding/*`로 일관성 확보. NEW02가 임시 종착점이므로 `/onboarding/complete`에서 종료 처리(또는 안내 화면 후 `/`로 link).

---

## 6. 화면별 기능 명세 (Screen Spec)

각 화면은 [화면 목적 / 주요 UI / 핵심 동작 / 기술 연계 키워드] 순으로 기술합니다.
상세 스펙(예외 처리, 분석 이벤트, 접근성 등)은 페이지별 md 문서를 참조.

### ── ONBOARDING (01 ~ 03 + NEW01) ──

#### 01. 랜딩 / 코칭 합의 [ONBOARDING]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | CareerPT의 코칭 원칙·신뢰 요소·12주 코칭 차별점을 안내. (v1.14: swipe deck 6장 구조, `01_landing.md` §3 참조) |
| 주요 UI | 브랜드 헤더, swipe deck 6장(HERO / 강점 시작 / TRUST / WHY 12주 코칭 / JOURNEY / OUTCOME+CTA), 하단 floating 화살표 (v1.14) |
| 핵심 동작 | 마지막 카드 "로그인하고 시작하기 →" CTA → 02 로그인 / 회원가입 (`/login?tab=signup`) |
| 기술 키워드 | Client Component (swipe deck 상태), v1.14: **사용자 상태 기반 자동 리다이렉트 폐지** — 모든 사용자에게 랜딩 노출. 상태 기반 라우팅은 02 로그인 성공 시점에만 적용 (§5.4 참조) |

#### 02. 로그인 / 회원가입 [ONBOARDING]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 신규 유저는 회원가입, 기존 유저는 로그인하여 Supabase 세션을 생성한다. |
| 주요 UI | 탭(로그인/회원가입) 전환, 이메일·비밀번호 필드, 비밀번호 재설정 링크, 분리 동의(개인정보·이용약관·14세·마케팅) (Google 소셜 로그인 버튼 제거됨, v1.11) |
| 핵심 동작 | 이메일 로그인 / 비밀번호 재설정 / 가입 완료 → NEW01 이동 / 로그인 성공 → 사용자 상태 기반 라우팅 |
| 기술 키워드 | Supabase Auth, signInWithPassword, resetPasswordForEmail, JWT 세션 |

#### NEW01. 이메일 인증 안내 [ONBOARDING] 🆕

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 회원가입 후 이메일 인증을 완료하지 않은 사용자에게 안내하고, 인증 메일 재발송을 지원한다. |
| 주요 UI | 안내 메시지, "메일함 열기" CTA, "인증 메일 다시 보내기" CTA(60초 쿨다운), "다른 이메일로 가입하기" 링크 |
| 핵심 동작 | 자동 폴링(5초 간격, 최대 5분) → 인증 완료 감지 시 자동 03 이동 / 재발송 버튼 / 로그아웃 |
| 기술 키워드 | Supabase Auth `email_confirmed_at` 폴링, 메일 재발송 API, 쿨다운 타이머 |

#### 03. 기본 정보 입력 [ONBOARDING]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | AI 코칭 개인화를 위해 이름·나이대·직군·현재 고민을 수집한다. |
| 주요 UI | 이름 텍스트 입력, 나이대 선택, 직군 선택(드롭다운), 현재 고민 자유 텍스트, "다음으로" CTA |
| 핵심 동작 | 필수 필드 미입력 시 CTA 비활성화 → 모두 입력 시 활성화 → Supabase 저장 → 04 이동 |
| 기술 키워드 | Supabase `profiles` 테이블 upsert, `profiles.profile_completed = true` 기록, 입력값 → AI 시스템 프롬프트 컨텍스트 주입 |

### ── DISCOVER (04 ~ 06) ──

#### 04. 강점 선택 [DISCOVER] *(v2.0: 페이지 전면 재정의)*

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 갤럽 클리프턴 스트렝스 34개 테마 중 자신을 가장 잘 나타내는 강점 5개를 사용자가 직접 선택한다. |
| 주요 UI | 4개 도메인(실행력·영향력·대인관계 구축·전략적 사고) 색깔 구분 섹션, 도메인별 칩 그리드 (총 34개), 5개 선택 카운터, "다음으로 →" CTA |
| 핵심 동작 | 칩 탭 → 선택/해제 토글, 5개 도달 시 미선택 칩 disabled / "다음으로" 클릭 → `strength_analyses` INSERT (`method='direct_select'`) → 07 이동 (06 강점 결과 화면 우회) |
| 기술 키워드 | Supabase `strength_analyses` INSERT(`method='direct_select'`, `strengths` JSONB 5개, `is_latest=true`), 도메인 매핑 클라이언트 상수, localStorage prefill, 갤럽 공식 한국어 번역(심사숙고/승부/개발/긍정/회고) 반영 |

> production 풀 스펙: 05 AI 인터뷰 → 06 결과 → 07 흐름은 별도 진입점에서 유지(v1.11). 메인 플로우는 04 직접 선택 → 07 직행. PDF 업로드 경로는 v1.11에서 폐지.

#### 05. 강점 인터뷰 (AI 채팅) [DISCOVER]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | AI 코치와 멀티턴 대화를 통해 유저의 핵심 강점 테마를 탐색·언어화한다. |
| 주요 UI | 채팅 인터페이스, 주관식 텍스트 입력창 + 전송 버튼, 인터뷰 완료 CTA |
| 핵심 동작 | 유저 메시지 → AI 코칭 질문 반환 → 대화 반복 → 완료 시 AI가 강점 JSON 반환 → 06 이동 |
| 기술 키워드 | Claude API, 시스템 프롬프트: MCC 코칭+갤럽 강점, 대화 히스토리 누적, 강점 Top 5 JSON 파싱 → `strength_analyses` INSERT |

#### 06. 강점 결과 [DISCOVER]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 05 AI 인터뷰 분석 결과를 바탕으로 유저의 갤럽 34개 테마 중 상위 강점 Top 5를 카드 형태로 제시하고 유저가 결과를 확인·납득하도록 한다. (v1.11: PDF 업로드 경로 폐지로 업로드 진입 케이스 제거) |
| 주요 UI | 강점 카드 5개 (순위·테마명·도메인·설명), "커리어 방향 찾기" CTA, "강점 분석 다시하기" 버튼 |
| 핵심 동작 | 결과 확인 → 07 커리어 인트로 이동 / 재분석 → 04 이동 (이전 결과 비활성화) |
| 기술 키워드 | AI 응답 파싱 후 강점 Top 5 구조화, Supabase `strength_analyses` 테이블 INSERT (`strengths JSONB` 5개, `method='ai_interview'`), `is_latest` 트리거 자동 관리 |

### ── DIRECTION (07 ~ 09) ──

#### 07. 커리어 인터뷰 인트로 [DIRECTION]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 강점 결과를 확인한 유저가 커리어 방향 탐색으로 자연스럽게 전환하도록 동기를 부여한다. |
| 주요 UI | 안내 문구, 강점 요약 배지(Top 5 chip), "인터뷰 시작하기" CTA |
| 핵심 동작 | 버튼 클릭 → 08 커리어 인터뷰 이동 |
| 기술 키워드 | `strength_analyses` (is_latest=true) 에서 강점 테마 읽기, Static 전환 화면 |

#### 08. 커리어 인터뷰 (AI 채팅) [DIRECTION]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 강점 결과를 컨텍스트로 받은 AI 코치와 대화하며 커리어 고민과 방향을 탐색한다. |
| 주요 UI | 채팅 인터페이스, 주관식 입력창, "진단 완료하기" CTA, "인터뷰 더하기" 버튼 |
| 핵심 동작 | 강점 요약을 시스템 프롬프트에 포함하여 AI 호출 → AI 커리어 코칭 대화 → 완료 시 방향 5개 JSON 반환 → 09 이동 |
| 기술 키워드 | Claude API, 시스템 프롬프트에 기본정보+강점 컨텍스트 주입, 완료 시 `career_interview_results` INSERT (`key_insights`, `ai_summary` 저장) — 대화 원문 미저장 |

#### 09. 커리어 방향 결과 [DIRECTION]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 08 인터뷰 종료 후 "역량 방향 받기" 버튼을 누른 유저에게 결정적 매칭으로 산출된 5개 역량 방향 옵션을 제시하고, 유저가 1개를 선택하게 한다. |
| 주요 UI | "[역량 방향 받기]" 버튼 (인터뷰 저장 완료 화면), 5개 역량 방향 카드 (슬롯 1~3 = `strength_match` badge "강점에 잘 맞아요" / 슬롯 4 = `user_interest` badge "직접 언급하셨어요" / 슬롯 5 = `growth_potential` badge "도전해 볼 만해요", 각 카드에 AI가 생성한 `personalized_text`), 선택 체크, "액션 아이템 받기" CTA, "인터뷰 다시하기" 링크 |
| 핵심 동작 | "역량 방향 받기" 버튼 클릭 → **Step 1 결정적 매칭** (코드 로직, AI 미사용 — Top 5 강점 ∩ 12역량 연계 강점 매칭으로 5개 슬롯 결정) → **Step 2 AI 카드 문구 개인화** (1회 AI 호출, `personalized_text` 메모리/세션 저장, DB 미저장) → **Step 3 DB 저장** (`recommended_competencies` UPDATE) → 5개 카드 제시 → 유저 선택 → CTA 활성화 → `goals` INSERT → 10 이동 / "인터뷰 다시하기" → 08 재진입 |
| 기술 키워드 | "역량 방향 받기" 버튼 → 결정적 매칭(코드, AI 미사용)으로 `career_interview_results.recommended_competencies` UPDATE (5개 슬롯 고정, JSONB, badge 3종) → AI 카드 문구 개인화(메모리/세션, DB 미저장) → 유저 선택 시 `goals` INSERT (`competency_code`, `domain`, `goal_title` 앱 상수, `status='active'`, `started_at=today`) |

### ── DO (10 + NEW02) ──

#### 10. 액션 아이템 선택 [DO]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 선택한 커리어 방향에 맞는 실행 과제(액션 아이템)를 추천·선택하고 12주 코칭을 시작한다. 첫 액션은 즉시 적용되어 W1이 시작된다. |
| 주요 UI | 추천 액션 카드 리스트, 직접 입력 추가 UI, 선택 체크(단일 선택), "시작하기 🚀" CTA |
| 핵심 동작 | AI 추천 또는 사전 정의 목록 제공 → 유저 선택 → `action_items` 저장 + `goals.started_at` 기록 + W1 액션 아이템 생성 → NEW02 이동 |
| 기술 키워드 | AI가 `action_items` INSERT (week_number=1, is_custom=false) 자동 생성, `goals.started_at` 기록, 트랜잭션 처리 |

#### NEW02. 커리어 방향 설정 완료 [DO] 🆕 *(v1.11: 페이지명·역할 변경)*

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 10 액션 선택 완료 직후 1회 노출. 강점·커리어 방향·액션 설정이 완료되었음을 알리고 12주 실행 시작 동기를 부여한다. |
| 주요 UI | 페이지 타이틀 "커리어 방향 설정 완료", 메인 타이틀 "준비 완료! 🎉 실행을 시작해요", 요약 카드(강점 Top 5 + 방향 + 첫 액션), 일정 표시(시작일/종료일), "홈으로 가기 →" CTA |
| 핵심 동작 | CTA 클릭 → 11 홈으로 이동 / 재방문 시 노출되지 않음 |
| 기술 키워드 | `goals.started_at` 직후 1회 노출, 1회 노출 플래그 관리 |

> NEW 프로토타입 v1에서는 본 화면이 임시 종착점이며 11 홈은 진입 경로 0(코드 보존). production 풀 스펙에서는 11 홈으로 이어지는 CTA 그대로.

### ── MAINTAIN (11 ~ 15 + NEW04 + NEW07) ──

#### 11. 홈 — 12주 코칭 대시보드 [MAINTAIN]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 유저가 매일 방문하여 12주 코칭 진행 현황·오늘의 액션·주간 타임라인을 확인하고 동기를 유지한다. |
| 주요 UI | 인사말(이름+요일+현재 주차), 12주 테마 카드(테마명+12주 도트), 오늘의 액션 체크 카드(액션 텍스트 + 토글 + 7일 그리드), 알림 카드(평일=메모 / 주말=회고 유도), 12주 타임라인(W1~W12 흐름) |
| 핵심 동작 | 오늘의 액션 토글 → `action_completions` INSERT/DELETE / 7일 그리드 클릭 → 해당 요일 체크 / 타임라인 "회고하기" → 12 회고 이동 / 12주 완주 시 자동 NEW03로 라우팅 |
| 기술 키워드 | `profiles` + `goals` + `action_items` + `action_completions` 조회, 주차 계산(`goals.started_at` 기준), 체크 토글 → `action_completions` INSERT/DELETE, 탭바 네비게이션 |

#### 12. 회고 [MAINTAIN]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 평일에는 짧은 일일 메모를 작성하고, 주말에는 한 주 메모를 기반으로 주간 회고를 완성한다. |
| 주요 UI | **[평일 모드 (월~금)]** 오늘의 메모 textarea + "메모 저장" 버튼, 이번 주 메모 리스트, "회고 코칭 미리하기" 카드<br>**[주말 모드 (토·일)]** 이번 주 액션 요약 카드, 평일 메모 컨텍스트 카드, 한 줄 회고 textarea, "코치와 이야기 나누기 →" CTA |
| 핵심 동작 | 평일 메모 저장 → `daily_memos` 누적 / 주말 "코치와 이야기 나누기" → 13 회고 코칭 / 평일 "회고 코칭 미리 하기" → 13 (다음 주 적용 모드) |
| 기술 키워드 | `daily_memos` INSERT (평일 메모, `memo_date` + `week_number`), `weekly_retros` INSERT (주간 회고, `completion_count`/`target_count` 프론트 집계), 요일 기반 자동 분기, 평일 메모는 회고 코칭 컨텍스트로 자동 주입 |

#### 13. 회고 코칭 (AI 채팅) [MAINTAIN]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 주간 회고 내용을 컨텍스트로 받은 AI 코치와 대화하며 패턴·인사이트를 도출하고 다음 주 방향을 정한다. (※ 새 주제 발굴 X) |
| 주요 UI | 자체 헤더(공통 탭바 숨김 풀스크린), 진행 바(질문 N/6 + %), AI 코치 메시지(회색 라운드), 사용자 메시지(블루 라운드), 주관식 텍스트 입력창, 단일 진행 버튼 "다음 주 변경 사항 정리하기", 정리 화면("맞아요" / "다시 다듬기") |
| 핵심 동작 | 주간 회고 + 강점 컨텍스트 → AI 코칭 대화(회고 전용 6개 질문 순차) → "다음 주 변경 사항 정리" → 정리 카드 → "맞아요" 클릭 시 다음 주 월요일부터 새 액션 적용(이번 주 데이터는 보존) → 11 이동 / "다시 다듬기" → 코칭 화면 복귀 |
| 기술 키워드 | Claude API, 시스템 프롬프트에 `daily_memos`+`weekly_retros`+`coaching_insights`(최근 3주) 주입, 대화 원문 미저장(sessionStorage), 확정 시 `coaching_insights` INSERT + `action_items` INSERT (week+1), RETRO 모드 |

#### 14. 히스토리 [MAINTAIN]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 과거 강점·커리어 방향·액션·패턴·인사이트를 아카이브 형태로 한 곳에 모아 조회하며 성장을 확인한다. |
| 주요 UI | Archive 헤더, 아카이브 카드 리스트(주차+날짜·패턴·액션·강점 연결·인사이트), 사이클/강점 필터, 무한 스크롤 |
| 핵심 동작 | 카드 탭 → 상세 내용 펼침 / 강점 연관 태그 클릭 → 해당 강점 상세로 이동(추후) |
| 기술 키워드 | `coaching_insights` 조회(회고 코칭 확정 시 자동 저장), `goals` (status=completed/abandoned) 이력 조회, `week_number` 역순 정렬, 패턴·액션·강점 필드 렌더링 |

#### 15. 프로필 [MAINTAIN]

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 유저의 강점 요약·커리어 방향·기본정보를 확인하고, 알림 설정·재인터뷰·로그아웃·회원 탈퇴를 제공한다. |
| 주요 UI | 내 강점 Top 5 섹션, 커리어 방향 섹션(재인터뷰 링크), 기본정보 섹션(정보 수정), 설정 섹션(알림 설정 → NEW04 / 비밀번호 변경 → NEW07 / 데이터 다운로드 / 약관), Danger Zone(로그아웃 / 회원 탈퇴) |
| 핵심 동작 | 강점 재분석 → 04 이동 / 커리어 방향 재설정 → 재설정 선택 다이얼로그(3선택지) → 인터뷰 다시하기 07 이동 / 역량목표 & 액션아이템 다시 설정 09 이동(최신 인터뷰 결과 재사용) / 취소 / 알림 설정 → NEW04 이동 / 비밀번호 변경 → NEW07 이동 / 정보 수정 → 03 (수정 모드, 기존 값 prefill) → 변경된 필드만 `profiles` UPDATE → 15 복귀 + 토스트 "정보가 수정되었어요" / 로그아웃 → 02 이동 / 탈퇴 → 데이터 삭제 확인 모달(2단계) → 01 이동 |
| 기술 키워드 | `strength_analyses`(is_latest=true)·`career_interview_results`·`profiles` 조회, Supabase signOut, 회원 탈퇴: `profiles` 데이터 삭제 + Supabase Auth deleteUser, 알림: Web Push (`push_subscriptions`) |

#### NEW04. 푸시 알림 권한 요청 [MAINTAIN] 🆕

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 15 프로필의 [알림 설정] 버튼에서 진입. 코칭 일정 알림(매일 액션, 주간 회고, 코칭 30분 전)을 위한 푸시 권한을 요청한다. |
| 주요 UI | 일러스트, 알림 종류 안내(daily_action / weekly_review / coaching_reminder / marketing 토글), "알림 받기" CTA(권한 요청), "나중에" CTA |
| 핵심 동작 | 권한 허용 시 `push_subscriptions` UPSERT(엔드포인트, 키, 알림 종류별 on/off) → 15 복귀 / "나중에" → 15 복귀 |
| 기술 키워드 | Web Push API, `push_subscriptions` 테이블 (UPSERT, user_id 기준 1:1), 알림 종류별 BOOLEAN 컬럼, 마케팅은 명시 동의 후에만 true |

#### NEW07. 비밀번호 변경 [MAINTAIN] 🆕

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 15 프로필의 [비밀번호 변경] 버튼에서 진입. 현재 비밀번호 재인증 후 새 비밀번호로 변경한다. |
| 주요 UI | 현재 비밀번호 입력 필드, 새 비밀번호·확인 입력 필드, "비밀번호 변경" CTA, "취소" 버튼 |
| 핵심 동작 | 현재 비밀번호 재인증 통과 시 새 비밀번호로 업데이트 → 현재 세션 유지 + 다른 디바이스만 자동 로그아웃 → **11 홈으로 이동** (보안성 강조 + 변경 직후 다음 행동을 자연스럽게 시작) / 취소 → 15 복귀 |
| 기술 키워드 | Supabase Auth `updateUser({ password })`, 현재 비밀번호 재인증, 다른 디바이스 토큰 무효화. 별도 화면(모달 X) — 모바일 키보드/패스워드 매니저 호환 고려 |

### ── CYCLE END (NEW03) ──

#### NEW03. 12주 완료 화면 [CYCLE END] 🆕

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 12주차를 완주한 사용자에게 노출되는 성취 페이지. 다음 사이클로의 자연스러운 전환을 유도한다. |
| 주요 UI | 축하 애니메이션, 성취 요약(총 액션 일수 X/84, 메모 개수, 회고 횟수, 자주 활용한 강점 Top 5), 핵심 패턴 3가지 회고 카드, "새로운 12주 시작하기" / "강점부터 다시 분석하기" / **"기본 정보 업데이트"(보조 카드, 강제 X 권장 O)** / "히스토리로 돌아보기" CTA |
| 핵심 동작 | 12주 완주 후 첫 로그인 시 1회 자동 노출 / 이후 15에서 재진입 가능 / 새 12주 시작 → 07 / 강점부터 → 04 / **기본 정보 업데이트 → 03 (수정 모드) → NEW03 복귀 + 토스트 "정보가 수정되었어요"** / 히스토리 → 14 |
| 기술 키워드 | `goals.status='completed'` 판정, 사이클 데이터 집계(`action_completions`, `daily_memos`, `coaching_insights`), cycle_summaries 저장(선택) |

### ── ERROR (NEW05, NEW06) ──

#### NEW05. 네트워크 오류 화면 [ERROR] 🆕

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 서버/네트워크 연결 실패 시 사용자에게 안내하고 재시도를 지원한다. |
| 주요 UI | 일러스트, "연결이 불안정해요" 메시지, "다시 시도" CTA(재시도 카운터), 보조 "홈으로" CTA |
| 핵심 동작 | 자동 재시도(5초 간격, 최대 3회) → 성공 시 원래 화면 복귀 / 오프라인 지원 화면(메모, 체크)에서는 배너만 노출 + 입력 큐 적재 |
| 기술 키워드 | API 5xx/타임아웃/오프라인 분기, 재시도 큐, 인증 만료(401) 시 자동 로그아웃 |

#### NEW06. 일반 오류 화면 [ERROR] 🆕

| 항목 | 내용 |
| --- | --- |
| 화면 목적 | 404 Not Found, JS 런타임 오류 등 네트워크 외 모든 비정상 상태를 통합 처리한다. |
| 주요 UI | 일러스트, 케이스별 메시지(404 / 런타임 / 알 수 없음), "홈으로 돌아가기" CTA, "새로고침"(런타임 시), 에러 ID + "고객센터 문의" 링크 |
| 핵심 동작 | "홈으로" 클릭 시 사용자 상태 기반 라우팅(5.4 참조) / 런타임 오류는 Sentry 자동 보고 |
| 기술 키워드 | React Error Boundary, unhandled promise rejection, Sentry 보고, 에러 ID 표시 |

---

## 7. AI 코칭 설계 (AI Spec)

### 7.1 AI 역할 정의

| 항목 | 내용 |
| --- | --- |
| 역할 | 질문 생성 + 유저 답변 요약·분석 + 인사이트 도출 |
| 적용 화면 | 05 강점 인터뷰 / 08 커리어 인터뷰 / 13 회고 코칭 |
| AI 엔진 | Claude API |
| 호출 방식 | 멀티턴 대화 — 대화 히스토리 전체 누적 전달 |
| 컨텍스트 계층 | 기본정보(03) → 강점결과(06) → 커리어방향(09) → 주간메모(12) 순으로 누적 |

### 7.2 시스템 프롬프트 설계 원칙

- **코칭 기반**: MCC(Master Certified Coach) 원칙 — 코치가 먼저 결론 제시 금지, 유저 스스로 답을 찾도록 질문 중심 진행
- **강점 프레임**: 갤럽 CliftonStrengths 34 테마를 참조, "확정 진단"이 아닌 "관찰된 강점 후보"로 활용. 모든 액션은 강점명을 명시적으로 사용한다 (예: 「체계」 「학습」 「공감」)
- **개인화**: 03 기본정보(직군·나이·고민)와 이전 대화 맥락을 시스템 프롬프트에 포함
- **입력 형식**: 채팅 인터페이스로 주관식(자유 입력) 형태
- **출력 형식**: 인터뷰 종료 시 AI는 JSON 구조로 결과 반환 → 파싱 후 Supabase 저장
- **회고 코칭**: 주간 메모 + 강점 + 커리어 방향을 컨텍스트로 받아 패턴·인사이트 도출 및 다음 주 방향 제안

### 7.3 코칭 모드 분리 (General vs Retro)

AI 코칭은 두 가지 모드로 분리되어 동작하며, UI도 다른 화면을 사용합니다.

#### Mode 1 — GENERAL (일반 코칭)

| 항목 | 내용 |
| --- | --- |
| 진입 경로 | 강점 진단 직후 첫 코칭(05/08), 평일 "회고 코칭 미리 하기" 진입(12) |
| 목적 | 막연한 고민 → 명확한 문제 → 강점 기반 액션 도출 |
| 흐름 | 3-Phase: Phase 1 주제 명료화 → Phase 2 강점 기반 액션 → Phase 3 정리·확인 |
| 단계 전환 | 사용자가 명시적으로 결정 (코치는 임의로 다음 단계로 넘어가지 않음) |
| 적용 화면 | 05 강점 인터뷰 / 08 커리어 인터뷰 |

#### Mode 2 — RETRO (회고 코칭)

| 항목 | 내용 |
| --- | --- |
| 진입 경로 | 주말 회고 화면(12)에서 "코치와 이야기 나누기" 클릭 |
| 목적 | 이미 진행 중인 액션의 효용 평가 + 다음 주 액션 조정 (※ 새 주제 발굴 X) |
| 흐름 | 단일 흐름: 한 주 인상 → 실행 경험 → 잘 된 부분 → 효용 평가 → 변경 의사 → 강점 매칭 → 본인 표현으로 굳히기 |
| 입력 방식 | 주관식(자유 입력) |
| 종료 버튼 | 단일 진행 버튼 — "다음 주 변경 사항 정리하기" |
| 적용 화면 | 13 회고 코칭 |

### 7.4 시간 정책 (Time Policy)

코칭에서 정한 액션이 언제부터 적용되는지에 대한 규칙입니다.

- **강점 진단 직후 첫 코칭(05/08)**: 즉시 적용 — W1부터 시작
- **회고 코칭(13, 주말)**: 다음 주 월요일부터 적용 — 이번 주 데이터는 그대로 보존되어 12주 여정의 한 페이지로 남음
- **평일 "미리 하는 회고 코칭"(12 → 13)**: 다음 주 월요일부터 적용 — 평일 메모는 코치 컨텍스트로 자동 전달

주 단위 리듬을 유지하기 위해 모든 변경은 **"주 경계(월요일)"**에서만 발생합니다.

### 7.5 화면별 AI 입출력 흐름

| 화면 | INPUT | OUTPUT | 저장 위치 |
| --- | --- | --- | --- |
| 05 강점 인터뷰 | 기본정보 + 대화 히스토리(sessionStorage) | 코칭 질문 + 종료 시 강점 테마 Top 5 JSON | `strength_analyses` INSERT (`strengths JSONB`, `method='ai_interview'`, `is_latest` 트리거) |
| 08 커리어 인터뷰 | 기본정보 + 강점 요약 + 대화 히스토리(sessionStorage) | 코칭 질문 + 종료 시 `key_insights` + `ai_summary` | `career_interview_results` INSERT — 대화 원문 미저장 |
| 13 회고 코칭 | `daily_memos` + `action_completions` + `weekly_retros` + `coaching_insights`(최근 3주) | 코칭 대화 + 인사이트 요약 | `coaching_insights` INSERT + `action_items` INSERT (week+1) — 대화 원문 미저장 |

### 7.6 안전장치

- **위기 신호 감지**: 자살/자해 관련 키워드 감지 시 즉시 인터뷰 중단 + 상담 안내(자살예방상담전화 1393)
- **PII 입력 차단**: 사용자가 답변에 주민번호/카드번호 등 입력 시 클라이언트에서 패턴 검출 후 마스킹 안내
- **부적절한 AI 응답 필터**: 욕설/차별/의료법률 진단 등 감지 시 안전 메시지로 대체

---

## 8. 데이터 구조 (Data Model)

### 8.1 저장소

Supabase (PostgreSQL 기반) — 인증(Auth)과 데이터베이스 모두 Supabase로 통합 관리

### 8.2 테이블 관계 개요

```
profiles ─┬─ strength_analyses         ── (강점 분석 결과, is_latest 트리거)
          ├─ career_interview_results  ── (커리어 인터뷰 결과, recommended_competencies JSONB)
          ├─ goals                     ── (12주 목표 + 사이클 상태 관리)
          │    └─ action_items         ── (주차별 액션 아이템, week_number)
          │         └─ action_completions ── (일일 액션 완료 기록)
          ├─ daily_memos               ── (평일 메모, goal_id NOT NULL)
          ├─ weekly_retros             ── (주간 회고)
          ├─ coaching_insights         ── (AI 코칭 정리본, 대화 원문 미저장)
          └─ push_subscriptions        ── (푸시 토큰, NEW04 연동) 🆕
```

> ⚠️ **삭제된 테이블 (v0.2 정책 변경)**:
> - `coaching_sessions` — 대화 원문 미저장 정책으로 삭제
> - `career_focus`, `weekly_actions`, `weekday_memos`, `insight_history` — 테이블 통폐합
> - `users` → `profiles` (테이블명 변경)

### 8.3 주요 테이블 명세

> ⚠️ **v1.3 schema 전면 검증 완료** (2026-05-05): 실제 Supabase 스키마(`spec-schema.md` v0.6)와 불일치하는 테이블/컬럼명 전체 수정.  
> ⚠️ **v1.4 schema v0.7 반영** (2026-05-07): `goal_category`→`competency_code`+`domain`, `recommended_goal_categories`→`recommended_competencies`, `career_level` enum화, `profile_completed` 추가, `source_seed_id` 추가.

#### ① profiles (구 users)

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | Supabase Auth UID (PK) |
| nickname | TEXT | 유저 이름 (03에서 입력) |
| birthdate | DATE | 생년월일 (nullable) |
| gender | TEXT | 성별 (nullable) |
| job_field | TEXT | 직군 |
| career_level | TEXT | 경력 단계 enum (`junior_new` / `junior` / `senior_mid` / `senior`) |
| main_concern | TEXT | 현재 커리어 고민 |
| profile_completed | BOOLEAN | 03 기본 정보 입력 완료 여부 (온보딩 라우팅 기준) |
| avatar_url | TEXT | 프로필 이미지 URL (nullable) |
| streak_days | INT | 연속 접속일 |
| created_at | TIMESTAMP | 계정 생성 시각 |
| updated_at | TIMESTAMP | 마지막 수정 시각 |

#### ② strength_analyses (구 strength_results)

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK → profiles.id |
| strengths | JSONB | 강점 테마 배열 [{rank, name, description}] (Top 5) |
| method | TEXT | `'ai_interview'` 또는 `'direct_select'` (v1.11: `'gallup_upload'` 폐지) |
| is_latest | BOOLEAN | 최신 결과만 true (새 INSERT 시 트리거가 기존 row 자동 false) |
| created_at | TIMESTAMP | 저장 시각 |

#### ③ career_interview_results (구 career_results)

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK → profiles.id |
| key_insights | JSONB | AI가 추출한 핵심 인사이트 요약 |
| ai_summary | TEXT | 커리어 인터뷰 전체 요약 |
| recommended_competencies | JSONB | 09 화면 결정적 매칭 결과 ({code, match_score, badge} × 5개 고정) |
| created_at | TIMESTAMP | 저장 시각 |

> 대화 원문 미저장 (v0.2 정책). 브라우저 sessionStorage에서만 관리.

#### ④ goals (구 career_focus)

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK → profiles.id |
| career_interview_id | UUID | FK → career_interview_results.id |
| competency_code | TEXT | 12개 역량 코드 (T-1~E-3, CHECK 제약) |
| domain | TEXT | 역량 도메인 (T/I/R/E) |
| goal_title | TEXT | competency_code 매핑 한글명 (앱 상수) |
| status | TEXT | `active` / `paused` / `completed` / `abandoned` |
| current_week | INT | 현재 진행 주차 (1~12, 매주 월요일 자동 증가) |
| total_weeks | INT | 전체 주차 (기본 12) |
| started_at | DATE | 12주 코칭 시작일 |
| ended_at | DATE | 종료일 (completed/abandoned 시) |
| final_completion_rate | NUMERIC | 최종 완수율 (completed/abandoned 시 기록) |
| created_at | TIMESTAMP | 생성 시각 |

#### ⑤ action_items (주차별 액션 아이템)

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| goal_id | UUID | FK → goals.id |
| week_number | INT | 해당 주차 (1~12) |
| title | TEXT | 액션 제목 |
| description | TEXT | 액션 설명 |
| is_custom | BOOLEAN | 유저 직접 입력 여부 |
| source_seed_id | TEXT | 파생 시드 식별자 (예: `T-1-junior-2`, nullable, 디버깅용) |
| created_at | TIMESTAMP | 생성 시각 |

> 각 액션 아이템이 별도 row로 저장됨 (JSONB 배열 방식 아님).  
> v0.7: `competency_action_map.md` 시드 기반 AI 재해석으로 생성.

#### ⑥ action_completions (일일 액션 완료 기록)

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| action_item_id | UUID | FK → action_items.id |
| user_id | UUID | FK → profiles.id |
| completed_date | DATE | 완료일 |
| created_at | TIMESTAMP | 기록 시각 |

> 체크 시 INSERT, 체크 해제 시 DELETE. 7일 이내만 수정 가능.

#### ⑦ daily_memos (구 weekday_memos)

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK → profiles.id |
| goal_id | UUID | FK → goals.id (NOT NULL) |
| memo_date | DATE | 메모 작성 날짜 |
| week_number | INT | 해당 주차 |
| content | TEXT | 메모 본문 (최대 500자) |
| created_at | TIMESTAMP | 작성 시각 |

> `goal_id NOT NULL` — active 목표 없으면 메모 작성 불가.

#### ⑧ weekly_retros (구 weekly_actions.reflection)

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK → profiles.id |
| goal_id | UUID | FK → goals.id |
| week_number | INT | 해당 주차 |
| retro_date | DATE | 회고 작성 날짜 |
| summary_one_line | TEXT | 한 줄 회고 (최대 1000자) |
| completion_count | INT | 해당 주 액션 완료 횟수 (프론트 집계) |
| target_count | INT | 해당 주 액션 목표 횟수 (프론트 집계) |
| created_at | TIMESTAMP | 저장 시각 |

#### ⑨ coaching_insights (구 insight_history)

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK → profiles.id |
| goal_id | UUID | FK → goals.id |
| weekly_retro_id | UUID | FK → weekly_retros.id |
| week_number | INT | 해당 주차 |
| topic | TEXT | 다룬 주제 (한 줄) |
| pattern_insight | TEXT | 발견한 패턴 (1~2문장) |
| next_action_title | TEXT | 다음 주 액션 제목 |
| next_action_reason | TEXT | 액션 선택 이유 |
| strength_link | TEXT | 강점 연결 (예: 「체계」 + 「학습」) |
| created_at | TIMESTAMP | 저장 시각 |

> 대화 원문 미저장. `coaching_sessions` 테이블 삭제됨 (v0.2).

#### ⑩ push_subscriptions 🆕

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| user_id | UUID | FK → profiles.id |
| endpoint | TEXT | 푸시 엔드포인트 URL |
| keys | JSONB | p256dh, auth 등 푸시 키 |
| daily_action | BOOLEAN | 일일 액션 알림 수신 여부 |
| weekly_review | BOOLEAN | 주간 회고 알림 수신 여부 |
| coaching_reminder | BOOLEAN | 코칭 일정 알림 수신 여부 |
| marketing | BOOLEAN | 마케팅 알림 수신 여부 |
| created_at | TIMESTAMP | 등록 시각 |

---

## 9. 예외 처리 & 엣지 케이스

### 9.1 인증

- 비로그인 상태에서 03 이후 화면 직접 접근 → 02 로그인으로 리디렉션
- Google OAuth: v1.11에서 spec 제외 (소셜 로그인 자체를 향후 검토로 이동)
- 세션 만료 → 자동 로그아웃 후 02 이동
- **02 로그인 성공 시**: 사용자 상태 기반 라우팅 (§5.4 참조). 01 랜딩은 v1.14부터 자동 라우팅 폐지 — 모든 사용자에게 노출.
- 회원가입 후 이메일 미인증 상태로 재진입 → NEW01로 자동 이동 🆕

### 9.2 AI 인터뷰 (05·08·13) 및 AI 분석 (09)

- AI API 응답 지연(>5초) → 로딩 인디케이터 + 타임아웃 안내
- API 오류(5xx) → 재시도 버튼 노출, 3회 연속 실패 시 고객 문의 안내
- AI 응답이 JSON 파싱 불가 형태 → 오류 로그 기록, 유저에게 "잠시 후 다시 시도" 안내
- 인터뷰 중 화면 이탈 → 매 메시지 즉시 서버 저장 + sessionStorage 백업 (재진입 시 다이얼로그로 이어하기/처음부터)
- 위기 신호(자살/자해) 감지 → 즉시 인터뷰 중단 + 1393 안내 🆕
- PII 입력 감지 → 마스킹 안내 🆕

> **예외 — 분석 작업형 호출 (08 finalize / 09 Step2)** `v1.13 추가`
> 위 ">5초 임계 → 로딩 인디케이터" 정책은 **chat 턴 응답** 기준. 다음은 본질적으로 오래 걸리는 분석 작업이므로 **호출 시작 즉시** 전용 대기 UI를 노출 (임계 없음):
> - **08 finalize** (Path A/B 종료 → 추출): 풀스크린 분석 오버레이. 카피·동작은 `08_career_interview.md §3.6` 참조.
> - **09 Step2** (화면 진입 자동 트리거 → AI 카드 개인화): 상태 배너 + 카드 pulse 스켈레톤. 사양은 `09_career_result.md §3.6` 참조.
>
> 변경 배경: 사용자 조사 인사이트 3 — 끝을 알 수 없는 침묵이 신뢰 손실. 분석 작업은 *언제 끝날지 예고*가 핵심.

### 9.3 데이터 입력

- 03 필수 필드 미입력 → CTA 비활성화
- 04 강점 5개 미만 선택 → CTA 비활성화 (v1.11: 신규 직접 선택 정책)
- 10 액션아이템 0개 선택 → CTA 비활성화
- 10 커스텀 입력 공백 제출 → 저장 불가 처리

> v1.11: 04 파일 업로드 관련 예외 처리 항목은 페이지 재정의로 인해 제거 (04 spec 참조).

### 9.4 홈 / 회고 (11·12)

- 12주 코칭 시작 정보(`goals.started_at`)가 없는 유저가 11 홈 접근 → 10 액션아이템으로 리디렉션
- 12 회고에서 메모 미작성 상태로 주간 회고 시도 → 최소 1개 메모 필요 안내
- 주간 회고 저장 실패 → 로컬 임시 저장 후 재전송 유도
- 13 회고 코칭 확정 후 같은 주에 재시도할 경우 → 마지막 결정만 유효 (`coaching_insights` UPSERT, 다음 주 `action_items` 갱신)
- 12주 완주 시 다음 진입에서 NEW03로 자동 라우팅 🆕

### 9.5 프로필 (15)

- 회원 탈퇴 → 확인 모달 2단계(오탈퇴 방지) → 데이터 삭제 후 01 랜딩으로 이동
- 알림 권한 미허용 → 설정에서 권한 허용 안내

### 9.6 운영·전역 예외 🆕

- 모든 API 5xx / 네트워크 실패 → NEW05 노출, 자동 재시도 후 사용자 재시도 CTA
- 401 인증 만료 → 자동 로그아웃 → 02
- 429 Rate limit → "잠시 후 다시 시도" + 대기 시간 표시
- 잘못된 URL / 삭제된 리소스 → NEW06 (404 케이스)
- React Error Boundary 캐치 / unhandled promise rejection → NEW06 + Sentry 보고

---

## 10. 미결 사항 (Open Questions)

아래 항목은 스펙 작성 시점 기준 아직 결정되지 않은 사항입니다. 의사결정 후 스펙을 업데이트하세요.

| 미결 질문 | 상태 |
| --- | --- |
| AI 엔진: Claude API vs GPT API 최종 선택은? | **✅ Claude API로 확정 (v1.2)** |
| 05·08 인터뷰 중 화면 이탈 시 대화 내용 임시 저장 구현 여부 | **✅ 매 메시지 즉시 서버 저장 + sessionStorage 백업으로 확정 (v1.2)** |
| 시스템 프롬프트 버전 관리 방식 (DB 저장 vs 코드 내 상수) | 미결 |
| 강점 인터뷰 최소·최대 대화 턴 수 결정 | Light 버전(코어 6 + follow-up 최대 12)으로 진행, 최종 TBD |
| 10 액션아이템 추천 목록: 사전 정의 vs AI 동적 생성 | 미결 |
| 11 홈 알림: 브라우저 Push Notification vs 서버 이메일 발송 | Web Push로 잠정 결정 (NEW04에 반영) |
| 12 회고 메모 최소 글자 수 또는 분량 기준 존재 여부 | 미결 |
| 14 히스토리 카드 상세 펼침 UX: 인라인 펼침 vs 별도 상세 화면 | 미결 |
| 15 재인터뷰 시 기존 강점 결과 덮어쓰기 vs 히스토리 보존 방식 | `strength_analyses.is_latest` 트리거로 이력 보존 (v1.3) |
| **NEW02 푸시 권한 노출 시점**: NEW02 직후 강제 vs 11 첫 진입 vs 15 프로필 진입 | **✅ 15 프로필 [알림 설정] 진입으로 확정 (v1.6, NEW02 직후 강제 노출 안 함)** |
| **NEW03 → 새 12주 진입 시 03 기본정보 재진입 옵션 제공 여부** | **✅ 옵션 제공 (강제 X, 권장 O) — NEW03 보조 카드로 노출 (v1.9 재확정, v1.7에서 일시 제거됐으나 v1.8 flow + v1.9 common에서 재도입)** |
| **15 커리어 방향 재설정**: 기존 액션(10) 유지 vs 새로 선택 | **✅ 기존 사이클 종료(`abandoned`) + 새 사이클 시작(강제 새로 선택) 으로 확정 (v1.6)** |
| **`profiles.nickname` UNIQUE 제약 여부** | **✅ UNIQUE 없음 확정 (v1.10)** — 닉네임은 본인에게 표시되는 용도, 동명이인 허용. 중복 검사 로직 불필요 |
| **`profiles.career_level` UI 레이블** | **✅ 확정 (v1.10)** — 신입(0년) / 주니어(1~3년) / 미드(4~7년) / 시니어(8년+), 4개 옵션으로 통일 |
| **`profiles.streak_days` 갱신 정책** | **✅ v1 후순위 확정 (v1.10)** — 갱신 정책(어떤 행동이 streak 인정?) 미확정. 프로필 UI에서 streak 배지 미표시. 앱 출시 후 재검토 |
| **온보딩/로그인 중 화면 이탈 시 복귀 위치** | **✅ 확정 (v1.10, 라우팅 기준 v1.14)** — 끊긴 단계 이후부터 재시작. 라우팅 로직은 §5.4 참조 (이전엔 01 §2.1에 있었으나 v1.14에서 §5.4로 단일화) |
| **액션아이템 미수행 주차 처리** | **✅ 확정 (v1.10)** — 미수행 주차는 공란으로 두고 다음 주차로 자동 전환. 예: 3주차 완료 후 4주차 회고 없으면 4주차 공란, 5주차에 정상 진행 |
| **목표 진행 중 개인정보(직군·고민 등) 변경 시 처리** | **✅ 확정 (v1.10)** — 기존 인터뷰 결과·액션아이템 유지, 변경된 정보는 이후 AI 인터뷰(05/08/13)부터 반영 |
| **09 커리어 방향 카드 강점 표현 방식** | **✅ Option B 확정 (v1.10)** — 강점 번호 표시, 순위(rank) 아님. "강점 연관 이유" → 도메인(T/I/R/E) 기준 표현 |
| 10 액션아이템 추천 목록: 사전 정의 vs AI 동적 생성 | 미결 (인채 프롬프팅 내용 확인 필요) |


---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.15 | 2026-06-06 | **15 커리어 방향 재설정 — 단일 → 3선택지 분기 정합** (15_profile.md v1.5 / 00_flow.md v2.1 코드 변경 대응). **§5.3 화면 전환 요약** 15 프로필 항목의 "커리어 방향 재설정(07)" → "재설정 선택 다이얼로그 → 인터뷰 다시하기 07 또는 역량목표 & 액션아이템 다시 설정 09". **§5.6.2 MVP 한정 동작 표** 커리어 방향 재설정 풀 스펙 "07로 진입" → "재설정 선택 다이얼로그 → 07 / 09"(MVP 동작은 15 Post-MVP라 진입 경로 미구현 유지). **§6.15 화면 명세** 핵심 동작 "커리어 방향 재설정 → 확인 다이얼로그 → 07 이동" → 3선택지(07 인터뷰 다시하기 / 09 역량목표 & 액션아이템 다시 설정, 최신 인터뷰 결과 재사용 / 취소). 기존 사이클 중단(`goals.status='abandoned'`)은 프로필이 아닌 09 career-result 확정 시점에 처리됨. |
| v1.14 | 2026-05-31 | **01 랜딩 자동 라우팅 폐지 정합 정리** (01_landing.md v1.8 코드 변경 대응). (1) **§5.4 라우팅 표** — 헤더 "01 또는 02 진입 시" → "**02 로그인 성공 시점** + 상태 기반 라우팅 필요한 모든 진입점". 01은 v1.8부터 자동 라우팅 제외 명시. (2) **§6.01 화면 명세** — 핵심 동작에서 "재방문 시 사용자 상태 기반 자동 리디렉션" 제거. 주요 UI를 swipe deck 6장 구조로 갱신(HERO/강점/TRUST/WHY 12주 코칭/JOURNEY/OUTCOME+CTA), 기술 키워드에 v1.14 변경 사항 명시. (3) **§9.1 인증** — "재방문 시 라우팅" → "02 로그인 성공 시 라우팅"으로 책임 위치 명확화. (4) **10번 결정사항 표** — "온보딩 이탈 복귀 위치" 라우팅 참조를 "01 §2.1" → "§5.4 단일화"로 갱신 (01 §2.1 폐지에 따라). |
| v1.13 | 2026-05-26 | **§9.2 분석 작업형 AI 호출 예외 명시** — 기존 ">5초 임계 → 로딩 인디케이터" 정책이 chat 턴 응답 기준임을 명확화. 08 finalize / 09 Step2 같은 본질적 장시간 분석 작업은 호출 시작 **즉시** 전용 대기 UI 표시(임계 없음). 각 화면 §3.6(08 분석 대기 화면, 09 분석 대기 상태)으로 cross-reference. §9.2 제목도 "AI 인터뷰 (05·08·13)" → "AI 인터뷰 (05·08·13) 및 AI 분석 (09)"로 09 범위 포함. 변경 배경: 사용자 조사 인사이트 3 (08·09 카피 변경과 동기). |
| v1.12 | 2026-05-10 | **§5.6 MVP 스코프 (NEW 프로토타입 v1 기반) 신규 추가**: Next.js MVP 빌드 가이드를 풀 스펙과 분리하여 명시. 5.6.1 화면 분류 (✅ MVP 12개 / ⏳ Post-MVP 10개) / 5.6.2 MVP 한정 동작 (NEW02 임시 종착점, 사용자 상태 라우팅 단순화 등) / 5.6.3 MVP DB 테이블 부분집합 (5개 사용 / 5개 미사용) / 5.6.4 Next.js 라우트 제안. 풀 스펙 §5.2~§5.5는 그대로 보존. |
| v1.11 | 2026-05-10 | NEW 프로토타입 v1 정합성 정렬: **§5.2 화면 정의 표** 04 화면명 "강점 진단 방식 선택" → "강점 선택" / NEW02 "12주 여정 시작 안내" → "커리어 방향 설정 완료". **§5.3 분기 플로우** 04 직접 선택 흐름 명시 (메인: 04 → 07 직행) + **갤럽 결과지 PDF 업로드 경로 spec 전체 제거**. **§6 화면별 명세** 01(Secondary CTA 제거) / 02(Google OAuth 제거) / 04(전면 재정의 — 직접 선택 + 4-Domain 칩, PDF 업로드 폐지) / 10("홈으로 시작하기" → "시작하기") / NEW02(페이지명·타이틀·카피 변경, 프로토타입 종착점 명시) 5개 화면 갱신. **§9.1 인증** Google OAuth 팝업 차단 항목 → 소셜 로그인 spec 제외 명시로 변경. **§9.3 데이터 입력** 04 파일 업로드 항목 제거, 04 강점 5개 미만 항목 추가. (00_flow.md v1.9와 정합 정렬) |
| v1.10 | 2026-05-09 | 팀 결정사항 일괄 반영 — 10번 미결 사항 표 업데이트: **nickname UNIQUE 없음 확정** / **career_level 레이블 4개 확정** (신입(0년)/주니어(1~3년)/미드(4~7년)/시니어(8년+)) / **streak_days v1 후순위 확정** / **온보딩 이탈 복귀 정책 확정** (끊긴 단계부터) / **액션아이템 미수행 주차 건너뛰기 정책 확정** / **개인정보 변경 시 기존 데이터 유지 확정** / **Option B 확정** (강점 번호, 순위 아님) / 10 액션아이템 추천 방식 미결 담당자 명시 |
| v1.9 | 2026-05-09 | 사용자 결정 변경 2건 일괄 반영 (00_flow.md v1.8과 정합성 정렬). **(1) 15 정보 수정 흐름 회귀**: v1.8의 "15 화면 내 인라인 편집" 결정을 되돌려 **"03 (수정 모드) → 15 복귀"** v1.6 방식으로 환원. 5.3 분기 플로우(라인 165) + 6.15 핵심 동작(라인 358) 일괄 정렬. **(2) NEW03 [기본 정보 업데이트] 보조 카드 재도입**: v1.7에서 일시 제거됐던 NEW03 보조 카드를 다시 추가. 6.NEW03 화면 명세 주요 UI/핵심 동작 갱신, 10번 미결사항 표의 NEW03 보조 카드 결정 ✅ 옵션 제공으로 재확정 (v1.8 미결 보류 해제). 5.2 화면 표 라인 140은 그대로 유지(사용자 결정). |
| v1.8 | 2026-05-09 | 00_flow.md v1.7(프로토타입 정합성 정렬)과 정합성 정렬. (1) 5.3 분기 플로우 + 6.15 핵심 동작 — "정보 수정 → 03 수정 모드" → "정보 수정 → 15 화면 내 인라인 편집 모드(별도 화면 이동 없음)"로 변경. (2) 6.NEW07 핵심 동작 — 변경 성공 시 "15 복귀" → "11 홈으로 이동"(보안성 + 다음 행동 시작 용이성)으로 변경, 취소는 15 복귀 유지. **충돌 3(NEW03 보조 카드 결정사항: v1.6에서 ✅ 옵션 제공으로 결정됐으나 flow v1.7에서 보조 카드 항목 자체 제거)는 미결로 보류.** 5.2 화면 표 라인 140의 15 한 줄 정의는 그대로 유지(사용자 결정). |
| v1.7 | 2026-05-09 | (사용자 결정 변경, 옵션 A) schema 무수정 원칙 확정 → schema 파일을 v0.7.2 원본으로 완전 복구. v1.6에서 진행했던 사용자 향 명칭 "목표 추천받기" 통일 작업 무효화 → 6.09 화면 명세 본문(`화면 목적`/`주요 UI`/`핵심 동작`/`기술 키워드` 4개 행)의 "목표 추천받기" 표현을 schema 본문 표현인 "역량 방향 받기"로 재정렬. **09 화면명 통일("커리어 방향 결과")은 유지** (schema에 영향 없음). 본문 외 변경 이력 부록 라인은 역사 기록으로 그대로 보존. |
| v1.6 | 2026-05-09 | 5개 메인 문서 간 정렬 + 00_common.md 내부 일관성 정리. NEW07 비밀번호 변경 화면 누락 보완(총 21→22개, 신규 6→7개). NEW04 진입 위치 정리(DO→MAINTAIN, 15 프로필에서 진입). 이미 결정된 미결사항 3건(NEW02 푸시 노출 시점/NEW03 03 재진입/15 커리어 재설정) ✅ 결정 표기. 옛 테이블·컬럼명 정리(`weekday_memos`→`daily_memos`, `weekly_actions`→`action_items`+`action_completions`, `users.coaching_start_at`→`goals.started_at`). 6.09 화면 명세를 schema #3의 Step 1(결정적 매칭)/Step 2(AI 카드 문구 개인화)/Step 3(DB 저장) 3-Step 흐름과 5개 슬롯 badge 3종으로 정렬. |
| v1.5 | 2026-05-07 | schema v0.7.1/v0.7.2 반영. `action_completions.completed_at`→`completed_date` 컬럼명 정렬. `coaching_insights`에 `goal_id`(FK→goals.id), `weekly_retro_id`(FK→weekly_retros.id) 컬럼 추가. `push_subscriptions.user_id` FK 오타 수정(`users.id`→`profiles.id`). |
| v1.4 | 2026-05-07 | schema v0.7 역량 분류 체계 전환 반영. `goals.goal_category`(7개) 제거→`competency_code`(12개) + `domain`(4개) 컬럼으로 교체. `goals.goal_title`: LLM 자유 생성→competency_code 기반 앱 상수 한글명. `recommended_goal_categories`(text[])→`recommended_competencies`(JSONB, 5개 슬롯 고정)로 교체. `profiles.career_level` 표준 enum화(`junior_new`/`junior`/`senior_mid`/`senior`) + NOT NULL. `profiles`: `age_range`→`birthdate`+`gender`로 교체, `avatar_url`+`streak_days`+`updated_at` 추가. `action_items.source_seed_id` 시드 추적용 컬럼 신규. 09 화면 기술 키워드: AI 자유 추천→결정적 매칭(코드)+AI 카드 문구 개인화 구조 반영. |
| v1.3 | 2026-05-05 | schema 전면 검증(v0.6 기준). 테이블명 변경: `users`→`profiles`, `strength_results`→`strength_analyses`, `career_results`→`career_interview_results`, `weekday_memos`→`daily_memos`, `insight_history`→`coaching_insights`. 삭제된 테이블: `coaching_sessions`(대화 원문 미저장), `career_focus`(→`goals` 통합), `weekly_actions`(→`action_items`+`action_completions` 분리). 신규 테이블: `goals`, `action_completions`, `weekly_retros`. 컬럼명 수정: `is_active`→`is_latest`(트리거 자동), `themes`→`strengths`, `source`→`method`, `week_num`→`week_number`. 사용자 상태 라우팅 조건 정렬. 09 화면 2단계 플로우 명시. |
| v1.2 | 2026-05-05 | 신규 화면 6종 추가(NEW01 이메일 인증, NEW02 12주 시작 안내, NEW03 12주 완료, NEW04 푸시 권한, NEW05 네트워크 오류, NEW06 일반 오류). 사용자 상태별 진입 라우팅(5.4) 신규. 에러 화면 진입 정책(5.5) 신규. AI 안전장치(7.6) 신규(위기 신호/PII/부적절 응답 필터). `push_subscriptions` 테이블 신규. AI 엔진 "Claude API 또는 GPT API"→"Claude API"로 확정. 화면 수 15개→21개. 페이즈 범례에 CYCLE END/ERROR 추가. |
| v1.1 | 2026-05-05 | (이전 작업, 상세 미기재) |
| v1.0 | 2026-05-04 | 최초 작성 |

---

— 문서 끝 | CareerPT Product Spec v1.14 (01 랜딩 자동 라우팅 폐지 정합 정리 — §5.4 헤더/§6.01 화면 명세/§9.1 인증/10번 결정사항 표 갱신, 01_landing.md v1.8 대응)
