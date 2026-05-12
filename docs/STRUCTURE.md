# 레포지토리 구조 현황 및 체크리스트

> 최종 업데이트: 2026-05-12
> 작성 기준 브랜치: `docs/reorganize-functional-spec` (main PR 대기 중)

---

## 1. 재구성 원칙 (합의 완료)

1. **단일 Next.js 앱 (`web/`)** — 구현 코드는 `web/` 하나에만 존재. 나머지는 모두 문서.
2. **`docs/functional_spec/` 분리** — `_mvp/`(지금 구현) / `_post_mvp/`(보존) 폴더로 상태 표시.
3. **`web/lib/constants/` 중앙화** — 프로토타입에서 하드코딩된 데이터를 상수 파일로 분리.

---

## 2. 현재 폴더 구조 (완료)

```
AI_Team3/                          ← 레포 루트
├── .env.example                   ✅ 환경변수 템플릿 (Supabase URL/KEY)
├── .gitignore                     ✅
├── config.example.js              ⚠️  하단 체크리스트 참고
│
├── docs/                          ← 문서 전용 (구현 코드 없음)
│   ├── README.md
│   ├── MANIFESTO.md
│   ├── STRUCTURE.md               ← 이 파일
│   │
│   ├── functional_spec/
│   │   ├── _mvp/                  ✅ 지금 구현할 화면 스펙 (14개)
│   │   │   ├── 00_common.md
│   │   │   ├── 00_flow.md
│   │   │   ├── 01_landing.md
│   │   │   ├── 02_login.md
│   │   │   ├── 03_basic_info.md
│   │   │   ├── 04_strength_choice.md
│   │   │   ├── 07_career_intro.md
│   │   │   ├── 08_career_interview.md
│   │   │   ├── 09_career_result.md
│   │   │   ├── 10_action_items.md
│   │   │   ├── NEW01_email_verify.md
│   │   │   ├── NEW02_cycle_start.md
│   │   │   ├── NEW05_network_error.md
│   │   │   └── NEW06_general_error.md
│   │   │
│   │   └── _post_mvp/             ✅ MVP 이후 보존 (10개, 건드리지 않음)
│   │       ├── 05_strength_interview.md
│   │       ├── 06_strength_result.md
│   │       ├── 11_home.md
│   │       ├── 12_reflect.md
│   │       ├── 13_reflect_coaching.md
│   │       ├── 14_history.md
│   │       ├── 15_profile.md
│   │       ├── NEW03_cycle_complete.md
│   │       ├── NEW04_push_permission.md
│   │       └── NEW07_password_change.md
│   │
│   ├── ai_prompt/                 ✅ AI 프롬프트 문서 (변경 없음)
│   ├── schema/                    ✅ DB/API 스키마 문서 (변경 없음)
│   └── prototypes/                ✅ 프로토타입 HTML 아카이브
│       ├── (Pivoted)CareerPT_prototype_v4_0511.html
│       └── CareerPT_prototype_v9_260509.html
│
└── web/                           ← Next.js App Router (구현 코드)
    ├── next-env.d.ts
    │
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/             ✅ 폴더 생성 완료 (page.tsx 미구현)
    │   │   └── verify-email/      ✅ 폴더 생성 완료 (page.tsx 미구현)
    │   │
    │   ├── onboarding/
    │   │   ├── profile/           ✅ 폴더 생성 완료 (page.tsx 미구현)
    │   │   ├── strengths/         ✅ 폴더 생성 완료 (page.tsx 미구현)
    │   │   ├── career-intro/      ✅ 폴더 생성 완료 (page.tsx 미구현)
    │   │   ├── career-interview/  ✅ 폴더 생성 완료 (page.tsx 미구현)
    │   │   ├── career-result/     ✅ 폴더 생성 완료 (page.tsx 미구현)
    │   │   ├── action-items/      ✅ 폴더 생성 완료 (page.tsx 미구현)
    │   │   └── complete/          ✅ 폴더 생성 완료 (page.tsx 미구현)
    │   │
    │   ├── error/
    │   │   └── network/
    │   │       └── page.tsx       ✅ NEW05 네트워크 오류 화면 구현
    │   │
    │   ├── error.tsx              ✅ NEW06 런타임 Error Boundary 구현
    │   └── not-found.tsx          ✅ NEW06 404 화면 구현
    │
    ├── components/
    │   └── ui/                    ✅ 폴더 생성 완료 (컴포넌트 미구현)
    │
    ├── lib/
    │   ├── supabase.ts            ✅ Supabase 클라이언트 초기화
    │   ├── constants/
    │   │   ├── strengths.ts       ✅ 갤럽 34개 테마 + 4개 도메인 상수
    │   │   ├── competencies.ts    ✅ 5개 역량 카드 데이터
    │   │   └── seeds.ts           ✅ 역량별 액션 아이템 25개
    │   ├── types/
    │   │   ├── database.ts        ✅ 생성 완료 (타입 정의 미작성)
    │   │   └── api.ts             ✅ 생성 완료 (타입 정의 미작성)
    │   └── hooks/
    │       ├── useAuth.ts         ⬜ 미생성
    │       └── useOnboardingGuard.ts ⬜ 미생성
    │
    └── styles/
        ├── globals.css            ✅ tokens.css import 포함
        └── tokens.css             ✅ :root {} 껍데기 생성
```

---

## 3. 체크리스트 — 팀 확인 필요

### 🔴 Critical: 지금 없으면 앱 실행 불가

다음 4개 파일이 없습니다. `npx create-next-app`으로 생성하거나 팀 기존 설정을 가져와야 합니다.

| 파일 | 역할 | 담당 |
|------|------|------|
| `web/package.json` | 의존성 정의. 없으면 npm install 불가 | |
| `web/tsconfig.json` | TypeScript 컴파일 설정 | |
| `web/next.config.ts` | Next.js 설정 (이미지 도메인, 리다이렉트 등) | |
| `web/app/layout.tsx` | App Router 필수 루트 레이아웃. 없으면 모든 페이지 렌더 안 됨 | |

> **권장**: 팀원 중 한 명이 `web/` 안에서 `npx create-next-app@latest . --typescript --tailwind --app --src-dir no` 실행 후 불필요한 boilerplate 파일 제거.

---

### 🟡 혼란 유발: 수정 or 삭제 결정 필요

#### ① `.env.example` copy 경로 불일치

`.env.example`은 레포 **루트**에 있지만, Next.js는 `web/` 안의 `.env.local`을 읽습니다.

```bash
# 현재 파일 안 안내 (잘못됨)
cp .env.example .env.local

# 올바른 명령어
cp .env.example web/.env.local
```

→ `.env.example` 파일 상단 안내 문구 수정 필요. **또는** `.env.example`을 `web/`으로 다시 이동하는 방법도 있음. 팀 결정 후 반영.

#### ② `config.example.js` 중복 여부

루트에 `config.example.js`가 존재하며 `.env.example`과 동일한 Supabase 값을 담고 있습니다. 단, vanilla JS 방식(`const SUPABASE_URL = ...`)으로 작성되어 Next.js 환경변수(`process.env.NEXT_PUBLIC_...`)와 방식이 다릅니다.

- **삭제 권장**: Next.js 앱은 `.env.local`만 사용하므로 `config.example.js`는 더 이상 필요 없음
- **유지 결정 시**: 용도가 다르다면 파일 상단에 용도 명시 필요

---

### 🟢 문제 없음 (참고용)

| 항목 | 이유 |
|------|------|
| `web/app/error.tsx` + `web/app/error/network/` 공존 | Next.js에서 `error.tsx`는 라우트가 아닌 특수 파일이라 충돌 없음 |
| `docs/PREMORTEM.md`, `docs/WHYTREE.md` | 문서 파일, 앱 동작에 영향 없음 |
| `_mvp/` 안에 `.gitkeep` 파일 | Git 빈 폴더 추적용. 파일이 채워지면 자동으로 무의미해짐 |

---

## 4. 다음 구현 순서 (제안)

| 단계 | 작업 | 스펙 참고 |
|------|------|----------|
| 1 | `web/` Next.js 프로젝트 초기화 (package.json 등) | — |
| 2 | `web/styles/tokens.css` CSS 변수 정의 | `_mvp/00_common.md` |
| 3 | `web/app/layout.tsx` 루트 레이아웃 | `_mvp/00_common.md` |
| 4 | `web/components/ui/` 공통 컴포넌트 | `_mvp/00_common.md` |
| 5 | `web/lib/hooks/useAuth.ts` | `_mvp/02_login.md` |
| 6 | `web/lib/hooks/useOnboardingGuard.ts` | `_mvp/00_flow.md` |
| 7 | 각 페이지 `page.tsx` 구현 | `_mvp/` 각 스펙 |

---

## 5. 스펙 파일 ↔ 구현 파일 매핑

| 스펙 | 라우트 경로 | 구현 상태 |
|------|------------|----------|
| 01_landing | `app/page.tsx` | ⬜ 미구현 |
| 02_login | `app/(auth)/login/page.tsx` | ⬜ 미구현 |
| 03_basic_info | `app/onboarding/profile/page.tsx` | ⬜ 미구현 |
| 04_strength_choice | `app/onboarding/strengths/page.tsx` | ⬜ 미구현 |
| 07_career_intro | `app/onboarding/career-intro/page.tsx` | ⬜ 미구현 |
| 08_career_interview | `app/onboarding/career-interview/page.tsx` | ⬜ 미구현 |
| 09_career_result | `app/onboarding/career-result/page.tsx` | ⬜ 미구현 |
| 10_action_items | `app/onboarding/action-items/page.tsx` | ⬜ 미구현 |
| NEW01_email_verify | `app/(auth)/verify-email/page.tsx` | ⬜ 미구현 |
| NEW02_cycle_start | `app/onboarding/complete/page.tsx` | ⬜ 미구현 |
| NEW05_network_error | `app/error/network/page.tsx` | ✅ 구현 완료 |
| NEW06_general_error | `app/error.tsx` + `app/not-found.tsx` | ✅ 구현 완료 |
