# 레포지토리 구조 현황 및 체크리스트

> 최종 업데이트: 2026-05-13
> 기준 브랜치: `main` (최신 머지 반영)

---

## 1. 재구성 원칙 (합의 완료)

1. **단일 Next.js 앱 (`web/`)** — 구현 코드는 `web/` 하나에만 존재. 나머지는 모두 문서.
2. **`docs/functional_spec/` 분리** — `_mvp/`(지금 구현) / `_post_mvp/`(보존) 폴더로 상태 표시.
3. **`web/lib/constants/` 중앙화** — 하드코딩 데이터를 상수 파일로 분리해 페이지 간 공유.

---

## 2. 현재 폴더 구조 (GitHub main 기준)

```
AI_Team3/                               ← 레포 루트
├── .env.example                        ✅ 환경변수 템플릿 (루트 위치)
├── .gitignore                          ✅
├── config.example.js                   ⚠️  하단 이슈 #3 참고
│
├── docs/                               ← 문서 전용 (구현 코드 없음)
│   ├── README.md                       ✅
│   ├── MANIFESTO.md                    ✅
│   ├── STRUCTURE.md                    ✅ 이 파일
│   ├── PREMORTEM.md                    ✅
│   ├── WHYTREE.md                      ✅
│   │
│   ├── functional_spec/
│   │   ├── _mvp/                       ✅ 현재 구현 대상 스펙 (14개)
│   │   │   ├── 00_common.md
│   │   │   ├── 00_flow.md
│   │   │   ├── 01_landing.md           → app/page.tsx          ✅ 구현
│   │   │   ├── 02_login.md             → app/login/page.tsx    ✅ 구현
│   │   │   ├── 03_basic_info.md        → app/onboarding/profile/page.tsx ✅ 구현
│   │   │   ├── 04_strength_choice.md   → app/onboarding/strengths/       ⬜ 미구현
│   │   │   ├── 07_career_intro.md      → app/onboarding/career-intro/    ⬜ 미구현
│   │   │   ├── 08_career_interview.md  → app/onboarding/career-interview/ ⬜ 미구현
│   │   │   ├── 09_career_result.md     → app/onboarding/career-result/   ⬜ 미구현
│   │   │   ├── 10_action_items.md      → app/onboarding/action-items/    ⬜ 미구현
│   │   │   ├── NEW01_email_verify.md   → app/(auth)/verify-email/        ⬜ 미구현
│   │   │   ├── NEW02_cycle_start.md    → app/onboarding/complete/        ⬜ 미구현
│   │   │   ├── NEW05_network_error.md  → app/error/network/page.tsx      ✅ 구현
│   │   │   └── NEW06_general_error.md  → app/error.tsx + not-found.tsx   ✅ 구현
│   │   │
│   │   └── _post_mvp/                  ✅ MVP 이후 보존 (10개, 건드리지 않음)
│   │
│   ├── ai_prompt/                      ✅ AI 프롬프트 문서
│   ├── schema/                         ✅ DB/API 스키마 문서
│   └── prototypes/                     ✅ 프로토타입 HTML 아카이브
│
└── web/                                ← Next.js App Router (구현 코드)
    ├── package.json                    ✅ next 16, react 19, supabase, tailwind 4
    ├── tsconfig.json                   ✅ strict mode, @/* 경로 alias
    ├── postcss.config.mjs              ✅ Tailwind v4 설정
    ├── next-env.d.ts                   ✅
    │
    ├── app/
    │   ├── layout.tsx                  ✅ 루트 레이아웃 (Pretendard, metadata)
    │   ├── page.tsx                    ✅ p01 랜딩 (인증 상태 기반 라우팅 포함)
    │   ├── error.tsx                   ✅ NEW06 런타임 Error Boundary
    │   ├── not-found.tsx               ✅ NEW06 404 화면
    │   │
    │   ├── login/                      ✅ p02 로그인/회원가입 (이메일+Google OAuth)
    │   │   └── page.tsx
    │   │
    │   ├── auth/
    │   │   └── callback/
    │   │       └── route.ts            ✅ Google OAuth 콜백 처리
    │   │
    │   ├── (auth)/                     ⚠️  하단 이슈 #1 참고
    │   │   ├── login/                  ⚠️  .gitkeep만 존재 (실제 login은 app/login/)
    │   │   └── verify-email/           ⬜ NEW01 미구현
    │   │
    │   ├── onboarding/
    │   │   ├── profile/
    │   │   │   └── page.tsx            ✅ p03 기본 정보 입력
    │   │   ├── strengths/              ⬜ p04 미구현
    │   │   ├── career-intro/           ⬜ p07 미구현
    │   │   ├── career-interview/       ⬜ p08 미구현
    │   │   ├── career-result/          ⬜ p09 미구현
    │   │   ├── action-items/           ⬜ p10 미구현
    │   │   └── complete/               ⬜ NEW02 미구현
    │   │
    │   └── error/
    │       └── network/
    │           └── page.tsx            ✅ NEW05 네트워크 오류
    │
    ├── components/
    │   └── ui/                         ⬜ 공통 컴포넌트 미구현
    │
    ├── lib/
    │   ├── supabase.ts                 ⚠️  하단 이슈 #2 참고 (사용 안 함, 삭제 대상)
    │   ├── supabase/
    │   │   └── client.ts               ✅ 실제 사용 중인 Supabase 클라이언트
    │   ├── constants/
    │   │   ├── strengths.ts            ✅ 갤럽 34개 테마 + 4개 도메인
    │   │   ├── competencies.ts         ✅ 5개 역량 카드
    │   │   └── seeds.ts                ✅ 역량별 액션 아이템 25개
    │   ├── types/
    │   │   ├── database.ts             ⬜ 파일만 존재, 타입 미작성
    │   │   └── api.ts                  ⬜ 파일만 존재, 타입 미작성
    │   └── hooks/
    │       ├── useAuth.ts              ⬜ 미구현
    │       └── useOnboardingGuard.ts   ⬜ 미구현
    │
    └── styles/
        ├── globals.css                 ✅ CSS 변수 + Tailwind import + body 스타일
        └── tokens.css                  ⚠️  하단 이슈 #4 참고 (비어있음)
```

---

## 3. 아키텍처 개요

```
사용자 요청
    │
    ▼
app/layout.tsx          ← 폰트, metadata, body 기본 스타일
    │
    ├── app/page.tsx                 [p01 랜딩]
    │       └── Supabase auth 상태 확인 → 상태별 라우팅
    │
    ├── app/login/page.tsx           [p02 로그인/회원가입]
    │       ├── 이메일 로그인 / 회원가입
    │       ├── Google OAuth (→ app/auth/callback/route.ts)
    │       └── 비밀번호 재설정 / 이메일 인증 패널
    │
    ├── app/onboarding/
    │   ├── profile/page.tsx         [p03 기본 정보] ✅
    │   ├── strengths/               [p04 강점 선택] ⬜  ← lib/constants/strengths.ts 사용 예정
    │   ├── career-intro/            [p07]           ⬜
    │   ├── career-interview/        [p08]           ⬜
    │   ├── career-result/           [p09]           ⬜  ← lib/constants/competencies.ts 사용 예정
    │   ├── action-items/            [p10]           ⬜  ← lib/constants/seeds.ts 사용 예정
    │   └── complete/                [NEW02]         ⬜
    │
    ├── app/(auth)/verify-email/     [NEW01]         ⬜
    ├── app/error/network/page.tsx   [NEW05]         ✅
    ├── app/error.tsx                [NEW06 런타임]  ✅
    └── app/not-found.tsx            [NEW06 404]     ✅

공통 레이어
    ├── lib/supabase/client.ts       ← 모든 페이지가 사용하는 Supabase 클라이언트
    ├── lib/constants/               ← 데이터 상수 (하드코딩 제거)
    ├── lib/types/                   ← DB / API 타입 (미작성)
    ├── lib/hooks/                   ← useAuth, useOnboardingGuard (미구현)
    ├── components/ui/               ← 공통 UI 컴포넌트 (미구현)
    └── styles/globals.css           ← CSS 변수, Tailwind, 전역 스타일
```

---

## 4. 이슈 체크리스트

### 🔴 즉시 수정 필요

#### 이슈 #1 — `app/(auth)/login/` 라우트 불일치
- **상황**: 기존 설계는 `app/(auth)/login/page.tsx`였으나, 실제 구현은 `app/login/page.tsx`에 있음
- **영향**: `app/(auth)/login/`에 `.gitkeep`만 남아있어 혼란 유발. `verify-email`도 `(auth)` 안에 있는데 `login`만 밖으로 나온 상태.
- **선택지**:
  - A. `app/login/`을 `app/(auth)/login/`으로 이동 → 설계 원칙 유지
  - B. `(auth)` 라우트 그룹 폐기 → `verify-email`도 `app/verify-email/`로 이동
- **권장**: A안 — `(auth)` 라우트 그룹이 레이아웃 공유에 유리

#### 이슈 #2 — `lib/supabase.ts` 중복 (사용 안 함)
- **상황**: `web/lib/supabase.ts` (루트)와 `web/lib/supabase/client.ts` (폴더) 두 개가 공존. 모든 페이지는 `@/lib/supabase/client`를 import하므로 `lib/supabase.ts`는 사용되지 않음.
- **영향**: 신규 개발자가 어떤 파일을 써야 하는지 혼동
- **조치**: `web/lib/supabase.ts` 삭제

---

### 🟡 팀 결정 후 처리

#### 이슈 #3 — `config.example.js` 중복
- **상황**: 루트에 `config.example.js`와 `.env.example` 두 파일이 공존. 동일한 Supabase 값을 담고 있으나 방식이 다름 (`const` vs `process.env`).
- **조치**: `config.example.js` 삭제 권장. Next.js는 `.env.local`만 사용.

#### 이슈 #4 — `styles/tokens.css` 빈 파일
- **상황**: CSS 변수가 `globals.css`에 직접 작성됨. `tokens.css`는 비어있고 `globals.css`에서 import만 됨.
- **선택지**:
  - A. `tokens.css`에 CSS 변수를 이동하고 `globals.css`는 레이아웃/리셋만 유지
  - B. `tokens.css` 삭제하고 `globals.css` 단일 파일로 유지
- **현재 동작에는 문제 없음**. 파일 역할 정리 차원의 결정.

#### 이슈 #5 — `.env.example` copy 경로 안내 오류
- **상황**: 파일 안에 `cp .env.example .env.local`로 안내되어 있으나, Next.js는 `web/.env.local`을 읽음.
- **조치**: 안내 문구를 `cp .env.example web/.env.local`로 수정.

---

### 🟢 정상 (오해할 수 있는 항목)

| 항목 | 설명 |
|------|------|
| `app/error.tsx` + `app/error/network/` 공존 | `error.tsx`는 Next.js 특수 파일(라우트 아님). 충돌 없음 |
| `next.config.ts` 없음 | Next.js는 config 없이도 동작. 필요 시 추가 가능 |
| `package-lock.json` 커밋됨 | npm 환경에서는 정상. yarn/pnpm 전환 시 재논의 필요 |

---

## 5. 구현 진행 현황

| 스펙 | 라우트 | 상태 | 담당 |
|------|--------|------|------|
| 01_landing | `app/page.tsx` | ✅ 완료 | |
| 02_login | `app/login/page.tsx` | ✅ 완료 | |
| 03_basic_info | `app/onboarding/profile/page.tsx` | ✅ 완료 | |
| 04_strength_choice | `app/onboarding/strengths/page.tsx` | ⬜ 미구현 | |
| 07_career_intro | `app/onboarding/career-intro/page.tsx` | ⬜ 미구현 | |
| 08_career_interview | `app/onboarding/career-interview/page.tsx` | ⬜ 미구현 | |
| 09_career_result | `app/onboarding/career-result/page.tsx` | ⬜ 미구현 | |
| 10_action_items | `app/onboarding/action-items/page.tsx` | ⬜ 미구현 | |
| NEW01_email_verify | `app/(auth)/verify-email/page.tsx` | ⬜ 미구현 | |
| NEW02_cycle_start | `app/onboarding/complete/page.tsx` | ⬜ 미구현 | |
| NEW05_network_error | `app/error/network/page.tsx` | ✅ 완료 | |
| NEW06_general_error | `app/error.tsx` + `app/not-found.tsx` | ✅ 완료 | |

**공통 레이어 진행 현황**

| 파일 | 상태 |
|------|------|
| `lib/supabase/client.ts` | ✅ 완료 |
| `lib/constants/strengths.ts` | ✅ 완료 (34개) |
| `lib/constants/competencies.ts` | ✅ 완료 (5개) |
| `lib/constants/seeds.ts` | ✅ 완료 (25개) |
| `lib/types/database.ts` | ⬜ 파일만 존재 |
| `lib/types/api.ts` | ⬜ 파일만 존재 |
| `lib/hooks/useAuth.ts` | ⬜ 미구현 |
| `lib/hooks/useOnboardingGuard.ts` | ⬜ 미구현 |
| `components/ui/` 컴포넌트 | ⬜ 미구현 |
| `styles/globals.css` | ✅ CSS 변수 + Tailwind + 전역 스타일 |
