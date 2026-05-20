# CareerPT 아키텍처 문서

> 최종 업데이트: 2026-05-20
> 기준: `main` 최신 (908b956) + post-MVP v2 스펙 반영

---

## 1. 서비스 개요

CareerPT는 갤럽 클리프턴 스트렝스 34개 테마를 기반으로 강점을 발견하고, AI 커리어 인터뷰를 통해 12주 성장 목표와 첫 번째 액션 아이템을 도출하는 AI 코칭 서비스입니다.

---

## 2. 기술 스택

| 영역 | 기술 | 버전 | 비고 |
|------|------|------|------|
| 프레임워크 | Next.js (App Router) | 16.x | `web/` 디렉토리 |
| UI 라이브러리 | React | 19.x | |
| 언어 | TypeScript | 5.x | strict 모드 |
| 스타일 | Tailwind CSS v4 + CSS 변수 | 4.x | globals.css에 `:root` 정의 |
| 백엔드/DB | Supabase | 2.x | Auth + PostgreSQL |
| 패키지 매니저 | npm | - | package-lock.json 커밋 |
| 배포 | Vercel | - | main 브랜치 자동 배포 |

---

## 3. 레포지토리 구조 원칙

```
AI_Team3/
├── docs/        ← 문서 전용 (스펙·프롬프트·스키마·아카이브)
└── web/         ← 구현 코드 전용 (Next.js 앱)
```

- **구현 코드는 `web/` 하나에만** 존재합니다.
- `docs/`에는 `.ts`, `.tsx`, `.js` 파일을 두지 않습니다.
- 루트(`AI_Team3/`)에는 `.env.example`, `.gitignore`만 존재합니다.

> 현재 구현 상태(진행률, 폴더 트리, 체크리스트)는 [`STRUCTURE.md`](STRUCTURE.md)를 참조하세요.

---

## 4. 라우트 구조

### 4.1 전체 라우트 맵

| URL 경로 | 파일 | 스펙 | 구분 |
|----------|------|------|------|
| `/` | `app/page.tsx` | 01_landing | MVP |
| `/login` | `app/login/page.tsx` | 02_login | MVP |
| `/auth/callback` | `app/auth/callback/route.ts` | OAuth 콜백 | MVP |
| `/verify-email` | `app/verify-email/` | NEW01 | MVP |
| `/onboarding/profile` | `app/onboarding/profile/page.tsx` | 03_basic_info | MVP |
| `/onboarding/strengths` | `app/onboarding/strengths/` | 04_strength_choice | MVP |
| `/onboarding/career-intro` | `app/onboarding/career-intro/` | 07_career_intro | MVP |
| `/onboarding/career-interview` | `app/onboarding/career-interview/` | 08_career_interview | MVP |
| `/onboarding/career-result` | `app/onboarding/career-result/` | 09_career_result | MVP |
| `/onboarding/action-items` | `app/onboarding/action-items/` | 10_action_items | MVP |
| `/onboarding/complete` | `app/onboarding/complete/` | NEW02 | MVP |
| `/home` | `app/home/` | 11_home | post-MVP v2 |
| `/reflect` | `app/reflect/` | 12_reflect | post-MVP v2 |
| `/reflect/ai-coach` | `app/reflect/ai-coach/` | 13_reflect_ai_coach | post-MVP v2 |
| `/profile` | `app/profile/` | 15_profile | post-MVP v2 |
| `/error/network` | `app/error/network/page.tsx` | NEW05 | MVP |
| (런타임 오류) | `app/error.tsx` | NEW06 | MVP |
| (404) | `app/not-found.tsx` | NEW06 | MVP |

### 4.2 사용자 상태별 진입 화면

랜딩(`/`)은 로그인 상태에 따라 다음 화면으로 자동 라우팅합니다.

```
진입 (/)
  │
  ├─ 비로그인 (GUEST)
  │     → 랜딩 화면 그대로 표시
  │
  └─ 로그인 상태
        │
        ├─ 이메일 미인증              → /login
        ├─ profile 미완료             → /onboarding/profile
        ├─ 강점 미선택                → /onboarding/strengths
        ├─ 커리어 인터뷰 미완료       → /onboarding/career-intro
        ├─ 역량 미선택                → /onboarding/career-result
        ├─ 액션 미선택                → /onboarding/action-items
        ├─ goal active / paused      → /home
        └─ goal completed            → /home (사이클 완료 배너 표시)
```

### 4.3 온보딩 플로우 (MVP)

```
/login
  └─ 회원가입 or 로그인 완료
       │
       ▼
/onboarding/profile        ← 이름·직군·연차·성별 입력
       │                      → profiles 테이블 저장
       ▼
/onboarding/strengths      ← 갤럽 34개 테마 중 5개 직접 선택
       │                      → strength_analyses 테이블 저장
       ▼
/onboarding/career-intro   ← 커리어 인터뷰 안내
       │
       ▼
/onboarding/career-interview ← AI와 커리어 대화
       │                        → career_interview_results 테이블 저장
       ▼
/onboarding/career-result  ← AI가 제안한 5개 역량 중 1개 선택
       │                      → goals 테이블 저장
       ▼
/onboarding/action-items   ← 역량별 액션 아이템 선택
       │                      → action_items 테이블 저장
       ▼
/onboarding/complete       ← 12주 사이클 시작 안내
       │
       ▼
/home                      ← post-MVP 진입
```

### 4.4 post-MVP 화면 흐름 (v2 기준)

> 스펙 원본: `docs/functional_spec/_post_mvp_v2/`

```
/home                      ← 12주 코칭 대시보드
  │                           커리어 방향 카드 + 오늘의 액션 + 주차별 타임라인
  │
  ├─ 회고 버튼
  │     ▼
  │   /reflect              ← 날짜 기반 자동 모드 분기
  │     │                      평일: 메모 모드 / 주말: 회고 모드
  │     │
  │     └─ 주말 회고 저장 후 AI 코칭 CTA
  │           ▼
  │         /reflect/ai-coach  ← 회고 AI 코칭
  │                               p08 커리어 인터뷰와 동일 디자인 시스템
  │                               → AI 프롬프트: docs/ai_prompt/06_reflect_coaching.md
  │
  └─ 프로필 버튼
        ▼
      /profile               ← 기본 정보 인라인 편집 + 설정
```

---

## 5. 데이터 레이어

### 5.1 Supabase 클라이언트 사용 규칙

```ts
// ✅ 모든 페이지 / 컴포넌트에서 이렇게 import
import { supabase } from '@/lib/supabase/client'

// ❌ 페이지 안에서 직접 createClient() 호출 금지
```

**예외**: `app/auth/callback/route.ts`는 서버 Route Handler이므로 직접 `createClient()`를 사용합니다.
서버 컴포넌트가 늘어나면 `lib/supabase/server.ts`를 별도 추가합니다.

### 5.2 주요 테이블

| 테이블 | 역할 | 연결 화면 |
|--------|------|----------|
| `profiles` | 사용자 기본 정보 | p03, p15 |
| `strength_analyses` | 강점 선택 결과 (`is_latest` 플래그) | p04 |
| `career_interview_results` | AI 인터뷰 결과 + 추천 역량 | p08~p09 |
| `goals` | 12주 목표 + 상태(`active/paused/completed`) | p09, p11 |
| `action_items` | 선택한 액션 아이템 | p10, p11 |

> 전체 스키마: [`docs/schema/spec-schema.md`](schema/spec-schema.md)

### 5.3 상수 데이터 (lib/constants/)

| 파일 | 내용 | 사용 화면 |
|------|------|----------|
| `strengths.ts` | 갤럽 34개 테마 + 4개 도메인 색상 | p04 |
| `competencies.ts` | 5개 역량 카드 (제목·설명·태그) | p09 |
| `seeds.ts` | 역량별 액션 아이템 25개 | p10 |

페이지 파일 안에 강점·역량·액션 데이터를 직접 작성하지 않습니다.

---

## 6. 스타일 시스템

### 6.1 CSS 변수 (globals.css)

모든 색상·간격·폰트는 `styles/globals.css`의 `:root` 블록에 정의된 CSS 변수를 사용합니다.

```css
/* 브랜드 */
--accent:         #2D5BFF;
--accent-light:   #EEF2FF;
--accent-deep:    #1A3ACC;
--accent-soft:    #dbeafe;    /* post-MVP v2 추가 */
--accent-tint:    #eff6ff;    /* post-MVP v2 추가 */

/* 배경 / 서피스 */
--bg:             #F8F9FC;
--surface:        #FFFFFF;

/* 텍스트 */
--text-primary:   #111827;
--text-secondary: #6B7280;
--text-muted:     #9CA3AF;
--ink:            #111418;    /* post-MVP v2 추가 */
--ink-soft:       #3f4651;    /* post-MVP v2 추가 */
--ink-mute:       #8b93a0;    /* post-MVP v2 추가 */

/* 보더 */
--border:         #E5E7EB;
--line:           #e8eaee;    /* post-MVP v2 추가 */
--line-strong:    #d3d7de;    /* post-MVP v2 추가 */

/* 상태 */
--danger:         #EF4444;
--success:        #10B981;

/* 강점 도메인 색상 */
--d-executing:    #7C3AED;
--d-influencing:  #EA580C;
--d-relationship: #2563EB;
--d-strategic:    #059669;

/* 레이아웃 */
--radius-sm: 6px;  --radius-md: 10px;
--radius-lg: 16px; --radius-full: 999px;
```

> `--ink-soft`, `--line`, `--line-strong`, `--accent-soft`, `--accent-tint` 5개는
> post-MVP v2 화면 구현 전 `fix/css-variables-sync` PR이 머지돼야 사용 가능합니다.

### 6.2 적용 방식

```tsx
// 현재 방식 (인라인 스타일 + CSS 변수)
<div style={{ color: 'var(--accent)', borderRadius: 'var(--radius-lg)' }}>

// Tailwind는 layout.tsx 구조 레벨에서만 사용 중
<body className="min-h-full flex flex-col">
```

### 6.3 모바일 우선 레이아웃

모든 페이지는 `width: 390px`로 고정된 모바일 카드 형태로 화면 중앙에 표시됩니다.

```tsx
<div style={{ width: '390px', minHeight: '100dvh', margin: '0 auto' }}>
```

---

## 7. 인증 흐름

```
이메일 회원가입
  → Supabase 인증 이메일 발송
  → 사용자 인증 링크 클릭
  → /login 페이지에서 세션 감지 후 로그인 유도

Google OAuth
  → /login 에서 Google 버튼 클릭
  → Supabase OAuth 리다이렉트
  → Google 인증 완료
  → app/auth/callback/route.ts 에서 code → session 교환
  → /login?oauth=success 로 리다이렉트
  → 로그인 페이지에서 상태 확인 후 다음 화면 이동
```

---

## 8. 경로 alias

`tsconfig.json`의 `paths` 설정에 따라 `@/`는 `web/` 디렉토리를 가리킵니다.

```ts
'@/lib/supabase/client'     → web/lib/supabase/client.ts
'@/lib/constants/strengths' → web/lib/constants/strengths.ts
'@/components/ui/Button'    → web/components/ui/Button.tsx
```

---

## 9. 로컬 개발 시작

```bash
# 1. 환경변수 설정
cp .env.example web/.env.local
# web/.env.local 열어서 Supabase URL / ANON KEY 입력

# 2. 의존성 설치
cd web
npm install

# 3. 개발 서버 시작
npm run dev
# → http://localhost:3000
```

---

## 10. 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 배포 브랜치. 직접 커밋 금지, PR로만 머지 |
| `feature/<화면ID>` | 화면 단위 구현 (예: `feature/04_strength_choice`) |
| `fix/<내용>` | 버그 수정 |
| `docs/<내용>` | 문서 작업 |
