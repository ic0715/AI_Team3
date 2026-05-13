# 레포지토리 구조 현황 및 팀 체크리스트

> 최종 업데이트: 2026-05-13
> 기준: `main` 최신 (908b956 커밋 완료)

---

## 1. 전체 폴더 구조 (GitHub main 현재 상태)

```
AI_Team3/                                   ← 레포 루트
├── .env.example                            ✅ 환경변수 템플릿
├── .gitignore                              ✅
│
├── docs/                                   ← 문서 전용 (코드 없음)
│   ├── STRUCTURE.md                        ✅ 이 파일
│   ├── README.md / MANIFESTO.md 외         ✅
│   ├── functional_spec/
│   │   ├── _mvp/                           ✅ 현재 구현 대상 스펙 14개
│   │   └── _post_mvp/                      ✅ MVP 이후 보존 10개
│   ├── ai_prompt/                          ✅ AI 프롬프트 문서
│   ├── schema/                             ✅ DB/API 스키마 문서
│   └── prototypes/                         ✅ HTML 프로토타입 아카이브
│
└── web/                                    ← Next.js 앱 (유일한 구현 코드)
    ├── package.json                        ✅ next 16 / react 19 / supabase / tailwind 4
    ├── tsconfig.json                       ✅ strict, @/* 경로 alias
    ├── postcss.config.mjs                  ✅ Tailwind v4
    │
    ├── app/
    │   ├── layout.tsx                      ✅ 루트 레이아웃 (Pretendard, metadata)
    │   ├── page.tsx                        ✅ p01 랜딩
    │   ├── error.tsx                       ✅ NEW06 런타임 Error Boundary
    │   ├── not-found.tsx                   ✅ NEW06 404
    │   ├── login/
    │   │   └── page.tsx                    ✅ p02 로그인/회원가입
    │   ├── auth/
    │   │   └── callback/route.ts           ✅ Google OAuth 콜백
    │   ├── verify-email/                   ⬜ NEW01 미구현 (.gitkeep)
    │   ├── onboarding/
    │   │   ├── profile/page.tsx            ✅ p03 기본 정보
    │   │   ├── strengths/                  ⬜ p04 미구현
    │   │   ├── career-intro/               ⬜ p07 미구현
    │   │   ├── career-interview/           ⬜ p08 미구현
    │   │   ├── career-result/              ⬜ p09 미구현
    │   │   ├── action-items/               ⬜ p10 미구현
    │   │   └── complete/                   ⬜ NEW02 미구현
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

## 2. 아키텍처 흐름

```
사용자
  │
  ▼
app/page.tsx  (랜딩, p01)
  │  로그인 상태 확인 (Supabase)
  │
  ├─ 비로그인 → 랜딩 화면 노출
  │
  └─ 로그인 → DB 상태에 따라 자동 라우팅
       ├─ 이메일 미인증          → /login
       ├─ profile 미완료         → /onboarding/profile
       ├─ 강점 미선택            → /onboarding/strengths
       ├─ 커리어 인터뷰 미완료   → /onboarding/career-intro
       ├─ 역량 미선택            → /onboarding/career-result
       ├─ 액션 미선택            → /onboarding/action-items
       ├─ goal active/paused    → /home  (post-MVP)
       └─ goal completed        → /cycle-complete  (post-MVP)

app/login/page.tsx  (로그인/회원가입, p02)
  ├─ 이메일 로그인 / 회원가입
  ├─ Google OAuth → app/auth/callback/route.ts
  ├─ 비밀번호 재설정 (패널 전환)
  └─ 이메일 인증 대기 (패널 전환, verify-email 패널 내장)

app/onboarding/
  ├─ profile/page.tsx    (p03) ✅ 기본 정보 입력 → profiles 테이블
  ├─ strengths/          (p04) ⬜ 강점 선택 → strength_analyses 테이블
  ├─ career-intro/       (p07) ⬜ 커리어 인터뷰 안내
  ├─ career-interview/   (p08) ⬜ AI 인터뷰 → career_interview_results 테이블
  ├─ career-result/      (p09) ⬜ 역량 선택 → goals 테이블
  ├─ action-items/       (p10) ⬜ 액션 선택 → action_items 테이블
  └─ complete/           (NEW02) ⬜ 온보딩 완료

공통 레이어
  lib/supabase/client.ts   ← 모든 페이지가 사용하는 DB 연결
  lib/constants/           ← 강점·역량·액션 데이터 (하드코딩 제거)
  styles/globals.css       ← CSS 변수 + 전역 스타일
```

---

## 3. 핵심 개발 규칙 (팀 공통)

### Supabase 클라이언트
```ts
// ✅ 모든 페이지에서 이렇게 import
import { supabase } from '@/lib/supabase/client'

// ❌ 직접 createClient() 호출 금지 (auth/callback/route.ts 제외)
```

### 경로 alias
```ts
// tsconfig의 "@/*": ["./*"] 설정에 따라
import { STRENGTHS } from '@/lib/constants/strengths'   // ✅
import { STRENGTHS } from '../../lib/constants/strengths' // ❌
```

### 상수 데이터
```
lib/constants/strengths.ts    → 강점 칩 (p04에서 사용)
lib/constants/competencies.ts → 역량 카드 (p09에서 사용)
lib/constants/seeds.ts        → 액션 아이템 (p10에서 사용)
```
페이지 파일 안에 강점·역량·액션 데이터를 직접 작성하지 않는다.

### 스타일
- CSS 변수는 `styles/globals.css`의 `:root` 블록에 정의되어 있음
- 페이지는 `style={{ color: 'var(--accent)' }}` 방식으로 CSS 변수를 사용 중
- Tailwind 클래스는 `layout.tsx`의 구조 수준에서만 사용

### 환경변수 설정
```bash
# 로컬 개발 시작 전 필수
cp .env.example web/.env.local
# web/.env.local에 실제 Supabase URL/KEY 입력
```

---

## 4. 구현 진행 현황

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

**진행률: 5 / 12 완료**

---

## 5. 팀 체크리스트

### 🟡 결정 필요 (개발 시작 전 합의)

**① `app/verify-email/` 라우트 필요 여부**

현재 `login/page.tsx` 안에 이메일 인증 대기 패널이 내장되어 있음 (`PanelType = 'verify-email'`).
NEW01 스펙의 이메일 인증 화면을 별도 라우트(`/verify-email`)로 분리할지, 아니면 지금처럼 로그인 페이지 내 패널로 유지할지 결정 필요.

| 선택 | 장점 | 단점 |
|------|------|------|
| 별도 라우트 유지 | URL로 직접 접근 가능, 명확한 상태 구분 | 로그인 페이지와 상태 공유 필요 |
| 로그인 패널로 유지 | 이미 구현됨, 상태 공유 간단 | `/verify-email` 폴더가 사용 안 됨 |

### ✅ 완료된 정리 작업

**② `config.example.js` 삭제** — 완료 (908b956)

**③ `styles/tokens.css` 삭제** — 완료 (908b956). `globals.css` 단일 파일로 유지.

**⑦ `lib/hooks/useOnboardingGuard.ts` 구현** — 완료 (908b956). 각 온보딩 페이지에서 `const { ready } = useOnboardingGuard("strengths")` 형태로 사용.

### 🔵 구현 시 참고사항

**④ `onboarding/profile/page.tsx` 상수 인라인 정의**

현재 `JOB_OPTIONS`, `CAREER_OPTIONS`, `GENDER_OPTIONS`가 페이지 파일 안에 직접 정의되어 있음.
다른 페이지에서 재사용이 필요해지면 `lib/constants/`로 이동 검토.
(현재 profile 페이지에서만 쓰이므로 급하지 않음)

**⑤ `app/auth/callback/route.ts` Supabase 클라이언트**

이 파일은 서버에서 실행되는 Route Handler이므로 브라우저용 `@/lib/supabase/client`를 사용할 수 없어 직접 `createClient()`를 호출. 정상 동작임. 추후 서버 컴포넌트가 필요해지면 `lib/supabase/server.ts`를 별도로 만들어야 함.

**⑥ `lib/types/database.ts` / `api.ts` 작성 시점**

현재 빈 파일. Supabase에서 타입 자동 생성 명령어:
```bash
cd web
npx supabase gen types typescript --project-id <project-id> > lib/types/database.ts
```
DB 스키마가 확정되면 생성 권장.
