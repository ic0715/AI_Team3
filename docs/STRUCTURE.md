# 레포지토리 구조 현황 및 팀 체크리스트

> 최종 업데이트: 2026-05-20
> 기준: `main` 최신 (908b956) + post-MVP v2 스펙 반영

> 설계 원칙·라우트 흐름·데이터 레이어는 [`ARCHITECTURE.md`](ARCHITECTURE.md)를 참조하세요.

---

## 1. 전체 폴더 구조

```
AI_Team3/                                   ← 레포 루트
├── .env.example                            ✅ 환경변수 템플릿
├── .gitignore                              ✅
│
├── docs/                                   ← 문서 전용 (코드 없음)
│   ├── ARCHITECTURE.md                     ✅ 설계·라우트·데이터 레이어
│   ├── STRUCTURE.md                        ✅ 이 파일 (현황·체크리스트)
│   ├── README.md / MANIFESTO.md 외         ✅
│   ├── functional_spec/
│   │   ├── _mvp/                           ✅ MVP 스펙 (구현 기준)
│   │   ├── _post_mvp_v1/                   ✅ pivot 이전 설계안 (보존용)
│   │   └── _post_mvp_v2/                   ✅ home_0520.html 기반 (구현 기준)
│   │       ├── 11_home.md
│   │       ├── 12_reflect.md
│   │       ├── 13_reflect_ai_coach.md
│   │       └── 15_profile.md
│   ├── ai_prompt/
│   │   └── 06_reflect_coaching.md          ✅ 회고 AI 코칭 명세 v1.2
│   ├── schema/                             ✅ DB/API 스키마 문서
│   ├── prototypes/                         ✅ HTML 프로토타입 아카이브
│   ├── user_interviews/                    ✅ 사용자 인터뷰 원본·요약
│   └── ralph_loop/                         ✅ Ralph loop 실행 기록
│
└── web/                                    ← Next.js 앱 (유일한 구현 코드)
    ├── package.json                        ✅ next 16 / react 19 / supabase / tailwind 4
    ├── tsconfig.json                       ✅ strict, @/* 경로 alias
    ├── postcss.config.mjs                  ✅ Tailwind v4
    │
    ├── app/
    │   ├── layout.tsx                      ✅ 루트 레이아웃 (Pretendard, metadata)
    │   ├── page.tsx                        ✅ 01_landing
    │   ├── error.tsx                       ✅ NEW06 런타임 Error Boundary
    │   ├── not-found.tsx                   ✅ NEW06 404
    │   ├── login/
    │   │   └── page.tsx                    ✅ 02_login
    │   ├── auth/
    │   │   └── callback/route.ts           ✅ Google OAuth 콜백
    │   ├── verify-email/
    │   │   └── page.tsx                    ⬜ NEW01 미구현
    │   ├── onboarding/
    │   │   ├── profile/
    │   │   │   └── page.tsx                ✅ 03_basic_info
    │   │   ├── strengths/
    │   │   │   └── page.tsx                ⬜ 04_strength_choice 미구현
    │   │   ├── career-intro/
    │   │   │   └── page.tsx                ⬜ 07_career_intro 미구현
    │   │   ├── career-interview/
    │   │   │   └── page.tsx                ⬜ 08_career_interview 미구현
    │   │   ├── career-result/
    │   │   │   └── page.tsx                ⬜ 09_career_result 미구현
    │   │   ├── action-items/
    │   │   │   └── page.tsx                ⬜ 10_action_items 미구현
    │   │   └── complete/
    │   │       └── page.tsx                ⬜ NEW02 미구현
    │   ├── home/
    │   │   └── page.tsx                    ⬜ 11_home 미구현 (post-MVP v2)
    │   ├── reflect/
    │   │   ├── page.tsx                    ⬜ 12_reflect 미구현 (post-MVP v2)
    │   │   └── ai-coach/
    │   │       └── page.tsx                ⬜ 13_reflect_ai_coach 미구현 (post-MVP v2)
    │   ├── profile/
    │   │   └── page.tsx                    ⬜ 15_profile 미구현 (post-MVP v2)
    │   └── error/
    │       └── network/page.tsx            ✅ NEW05 네트워크 오류
    │
    ├── components/
    │   └── ui/                             ⬜ 공통 컴포넌트 미구현
    │
    ├── lib/
    │   ├── supabase/
    │   │   └── client.ts                   ✅ 브라우저용 Supabase 클라이언트
    │   ├── constants/
    │   │   ├── strengths.ts                ✅ 갤럽 34개 테마 + 4개 도메인
    │   │   ├── competencies.ts             ✅ 5개 역량 카드
    │   │   └── seeds.ts                    ✅ 역량별 액션 아이템 25개
    │   ├── types/
    │   │   ├── database.ts                 🟡 파일만 존재 (타입 미작성)
    │   │   └── api.ts                      🟡 파일만 존재 (타입 미작성)
    │   └── hooks/
    │       ├── useAuth.ts                  ⬜ 미구현
    │       └── useOnboardingGuard.ts       ✅ 온보딩 단계 가드 훅
    │
    └── styles/
        └── globals.css                     ✅ CSS 변수 + Tailwind import + 전역 스타일
```

---

## 2. 구현 진행 현황

### MVP

| 스펙 | 라우트 | 상태 |
|------|--------|------|
| 01_landing | `app/page.tsx` | ✅ 완료 |
| 02_login | `app/login/page.tsx` | ✅ 완료 |
| 03_basic_info | `app/onboarding/profile/page.tsx` | ✅ 완료 |
| 04_strength_choice | `app/onboarding/strengths/page.tsx` | ⬜ 미구현 |
| 07_career_intro | `app/onboarding/career-intro/page.tsx` | ⬜ 미구현 |
| 08_career_interview | `app/onboarding/career-interview/page.tsx` | ⬜ 미구현 |
| 09_career_result | `app/onboarding/career-result/page.tsx` | ⬜ 미구현 |
| 10_action_items | `app/onboarding/action-items/page.tsx` | ⬜ 미구현 |
| NEW01_email_verify | `app/verify-email/page.tsx` | ⬜ 미구현 |
| NEW02_cycle_start | `app/onboarding/complete/page.tsx` | ⬜ 미구현 |
| NEW05_network_error | `app/error/network/page.tsx` | ✅ 완료 |
| NEW06_general_error | `app/error.tsx` + `app/not-found.tsx` | ✅ 완료 |

**MVP 진행률: 5 / 12 완료**

### post-MVP v2

| 스펙 | 라우트 | 상태 |
|------|--------|------|
| 11_home | `app/home/page.tsx` | ⬜ 미구현 |
| 12_reflect | `app/reflect/page.tsx` | ⬜ 미구현 |
| 13_reflect_ai_coach | `app/reflect/ai-coach/page.tsx` | ⬜ 미구현 |
| 15_profile | `app/profile/page.tsx` | ⬜ 미구현 |

> post-MVP 구현은 MVP 완료 후 시작 예정 (`feature/home` 브랜치부터)

---

## 3. 핵심 개발 규칙

### Supabase 클라이언트
```ts
// ✅ 모든 페이지에서 이렇게 import
import { supabase } from '@/lib/supabase/client'

// ❌ 직접 createClient() 호출 금지 (auth/callback/route.ts 제외)
```

### 경로 alias
```ts
import { STRENGTHS } from '@/lib/constants/strengths'    // ✅
import { STRENGTHS } from '../../lib/constants/strengths' // ❌
```

### 상수 데이터
페이지 파일 안에 강점·역량·액션 데이터를 직접 작성하지 않습니다.
```
lib/constants/strengths.ts    → 강점 칩 (p04)
lib/constants/competencies.ts → 역량 카드 (p09)
lib/constants/seeds.ts        → 액션 아이템 (p10)
```

### 스타일
- CSS 변수는 `styles/globals.css`의 `:root`에 정의
- 페이지는 `style={{ color: 'var(--accent)' }}` 방식으로 참조
- Tailwind는 `layout.tsx` 구조 수준에서만 사용

---

## 4. 팀 체크리스트

### 🔵 구현 시 참고

**`onboarding/profile/page.tsx` 상수 인라인 정의**
`JOB_OPTIONS`, `CAREER_OPTIONS`, `GENDER_OPTIONS`가 페이지 파일에 직접 정의되어 있음. 다른 페이지에서 재사용이 필요해지면 `lib/constants/`로 이동.

**`app/auth/callback/route.ts` Supabase 클라이언트**
서버 Route Handler이므로 직접 `createClient()` 호출이 정상. 서버 컴포넌트 필요 시 `lib/supabase/server.ts` 별도 생성.

**`lib/types/database.ts` 작성 시점**
DB 스키마 확정 후 자동 생성:
```bash
cd web
npx supabase gen types typescript --project-id <project-id> > lib/types/database.ts
```

**`app/verify-email/` 라우트 처리**
현재 `login/page.tsx` 안에 이메일 인증 대기 패널이 내장되어 있음 (`PanelType = 'verify-email'`).
별도 라우트로 분리할지 현재 구조 유지할지 결정 필요.

### ✅ 완료된 작업

- `config.example.js` 삭제 (908b956)
- `styles/tokens.css` 삭제 — `globals.css` 단일 파일로 유지 (908b956)
- `lib/hooks/useOnboardingGuard.ts` 구현 (908b956)
- post-MVP v2 스펙 문서 작성 (`_post_mvp_v2/` 4개 파일)
- `06_reflect_coaching.md` v1.2 작성
