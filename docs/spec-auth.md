# spec-auth.md — 회원가입 / 로그인 인증 기능 명세

## 개요

CareerPT의 사용자 인증 시스템입니다.
이메일/비밀번호 회원가입·로그인, Google 소셜 로그인, 비밀번호 재설정 기능을 포함합니다.
인증 백엔드는 **Supabase Auth**를 사용합니다.

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `web/src/app/login/page.tsx` | 로그인 · 회원가입 · 비밀번호 찾기 화면 (Next.js 현행) |
| `web/src/app/reset-password/page.tsx` | 비밀번호 재설정 화면 (메일 링크 클릭 후 착지) |
| `web/src/app/page.tsx` | 홈 화면 (로그인 완료 후 진입, 로그아웃 버튼 포함 — 임시) |
| `web/src/lib/supabase.ts` | Supabase 클라이언트 생성 함수 (공통) |
| `pages/login.html` | 구버전 HTML 로그인 페이지 (참고용 보관) |

---

## 기술 스택 및 의존성

| 패키지 | 버전 | 역할 |
|---|---|---|
| `next` | 16.x | App Router 기반 웹 프레임워크 |
| `@supabase/ssr` | 0.10.x | Next.js 환경용 Supabase 클라이언트 |
| `@supabase/supabase-js` | 2.x | Supabase 핵심 SDK |
| `tailwindcss` | 4.x | 스타일링 |

**Supabase 클라이언트 초기화 (`web/src/lib/supabase.ts`)**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**환경변수 설정 (`web/.env.local` — git 미포함)**

```
NEXT_PUBLIC_SUPABASE_URL=https://fqgpfdzjiopajpeumlac.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> 🔒 `.env.local` 파일은 절대 git에 올리지 말 것 (`.gitignore`에 등록됨).
> `NEXT_PUBLIC_` 접두어가 붙은 변수는 브라우저에 노출됨 — `anon` 키만 사용.
> `service_role` 키는 절대 클라이언트 코드에 포함 금지.
> 팀원은 `web/.env.example`을 복사해서 `.env.local` 파일을 직접 만들어야 함.

---

## Supabase 프로젝트 설정

| 항목 | 값 |
|---|---|
| Project URL | `https://fqgpfdzjiopajpeumlac.supabase.co` |
| Region | Southeast Asia (Singapore) |
| RLS | 활성화됨 |
| 이메일 인증 | 활성화됨 |

---

## 기능 1 — 이메일 회원가입

### 화면
`web/src/app/login/page.tsx` → 회원가입 탭 (`tab === 'signup'`)

### 입력값
| 필드 | 타입 | 유효성 |
|---|---|---|
| 이름 | text | 필수 |
| 이메일 | email | 필수 |
| 비밀번호 | password | 필수, 8자 이상 |
| 개인정보 수집 및 이용 동의 | checkbox | **필수** (PIPA) |
| 마케팅 정보 수신 동의 | checkbox | 선택 (PIPA) |

### 동의 UX
- "전체 동의" 체크 시 필수+선택 모두 체크
- 필수 미동의 상태로 가입 시도 → 동의 영역 빨간 테두리 + 에러 메시지
- 동의 여부(timestamp 포함)는 Supabase `user_metadata`에 저장

```javascript
options: {
  data: {
    consent_privacy: true,
    consent_privacy_at: new Date().toISOString(),
    consent_marketing: boolean,
    consent_marketing_at: string | null,
  }
}
```

### 동작 흐름
```
입력 → 유효성 검사 → 필수 동의 체크 확인 → Supabase signUp() 호출
  → 성공: "가입 완료! 받은 편지함(스팸함도 확인)의 인증 이메일을 클릭해주세요." 메시지 표시
  → 실패: 에러 메시지 표시 (이메일 중복: 별도 한국어 메시지)
```

### 이메일 인증
- 가입 후 Supabase에서 인증 메일 자동 발송
- 이메일 템플릿: `docs/email_confirm_template.html` 참고
- 인증 완료 전까지 로그인 불가

### 주요 에러 메시지
| 상황 | 메시지 |
|---|---|
| 필드 미입력 | 모든 항목을 입력해주세요. |
| 비밀번호 8자 미만 | 비밀번호는 8자 이상이어야 합니다. |
| file:// 프로토콜 | ⚠️ 파일을 직접 열면 작동하지 않아요. |

### API 호출
```typescript
const supabase = createClient()

const { error } = await supabase.auth.signUp({
  email: signupEmail,
  password: signupPassword,
  options: {
    emailRedirectTo: `${window.location.origin}/login`,
    data: {
      name: signupName,
      consent_privacy: true,
      consent_privacy_at: new Date().toISOString(),
      consent_marketing: consentMarketing,
      consent_marketing_at: consentMarketing ? new Date().toISOString() : null,
    },
  },
})
```

---

## 기능 2 — 이메일 로그인

### 화면
`web/src/app/login/page.tsx` → 로그인 탭 (`tab === 'login'`)

### 입력값
| 필드 | 타입 | 유효성 |
|---|---|---|
| 이메일 | email | 필수 |
| 비밀번호 | password | 필수, 보기/숨기기 토글 버튼 제공 |

### 동작 흐름
```
입력 → Supabase signInWithPassword() 호출
  → 성공: router.push('/') — 홈 화면으로 이동
  → 실패: 에러 메시지 표시
```

### 주요 에러 메시지
| 상황 | 메시지 |
|---|---|
| 이메일/비밀번호 불일치 | 이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해주세요. |
| 필드 미입력 | 이메일과 비밀번호를 입력해주세요. |

> 보안 정책상 "이메일 없음"과 "비밀번호 틀림"을 동일 메시지로 처리. Supabase가 의도적으로 두 케이스를 동일 에러로 반환함 (사용자 열거 공격 방지).

### API 호출
```typescript
const { error } = await supabase.auth.signInWithPassword({
  email: loginEmail,
  password: loginPassword,
})
```

---

## 기능 3 — Google 소셜 로그인 / 회원가입

### 화면
`web/src/app/login/page.tsx` → 로그인 탭 하단 / 회원가입 탭 하단

### 동작 흐름
```
"Google로 계속하기" 버튼 클릭
  → Google 계정 선택 팝업
  → 인증 완료 → / (홈) 로 이동
  → 실패 시 한국어 에러 메시지 표시
```

> 신규 유저면 자동 회원가입, 기존 유저면 로그인으로 처리됨. 별도 구분 불필요.

### Supabase 설정
- Authentication → Sign In / Providers → Google → **Enable ON**
- Client ID: Google Cloud Console에서 발급한 OAuth 클라이언트 ID
- Client Secret: Google Cloud Console에서 발급한 보안 비밀번호

### Google Cloud Console 설정
- 프로젝트명: CareerPT
- 앱 유형: 웹 애플리케이션
- 승인된 JavaScript 원본: `http://localhost:3000`
- 승인된 리디렉션 URI: `https://fqgpfdzjiopajpeumlac.supabase.co/auth/v1/callback`
- 테스트 사용자: 테스트할 Google 계정 이메일 등록 필요 (현재 테스트 모드)

### API 호출
```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/` },
})
if (error) setError('Google 로그인 중 오류가 발생했어요. 다시 시도해주세요.')
```

---

## 기능 4 — 비밀번호 재설정

### 화면 흐름
```
web/src/app/login/page.tsx (비밀번호를 잊으셨나요? 클릭)
  → 비밀번호 찾기 탭 (tab === 'forgot') — 이메일 입력
  → 재설정 메일 발송
  → 메일 링크 클릭
  → web/src/app/reset-password/page.tsx (새 비밀번호 입력)
  → 완료 → /login 자동 이동 (2.5초 후)
```

### Step 1 — 재설정 메일 요청
```typescript
const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
  redirectTo: `${window.location.origin}/reset-password`,
})
```

| 상황 | 메시지 |
|---|---|
| 성공 | 재설정 링크를 이메일로 보냈어요. 스팸함도 확인해주세요. |
| 실패 | 오류: (Supabase 에러 메시지) |

### Step 2 — 새 비밀번호 설정 (`/reset-password`)
- 비밀번호 / 비밀번호 확인 두 필드 입력
- 비밀번호 보기/숨기기 토글 버튼 제공
- 완료 후 `router.push('/login')`으로 이동

```typescript
const { error } = await supabase.auth.updateUser({ password })
```

| 유효성 조건 | 메시지 |
|---|---|
| 8자 미만 | 비밀번호는 8자 이상이어야 합니다. |
| 비밀번호 불일치 | 비밀번호가 일치하지 않아요. |

### 이메일 템플릿
`docs/email-templates/email_reset_template.html` 참고
Supabase → Authentication → Email Templates → **Reset Password** 에 적용

### Supabase 설정 필요
```
Authentication → URL Configuration → Redirect URLs
→ http://localhost:3000/reset-password 추가
```

---

## 기능 5 — 세션 유지 및 자동 리디렉션

### 동작
- `web/src/app/page.tsx` 접속 시 기존 로그인 세션 확인
- 세션 있으면 → 홈 화면(이메일 + 로그아웃 버튼) 표시
- 세션 없으면 → `/login` 자동 이동

```typescript
// web/src/app/page.tsx
useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) {
      router.push('/login')
    } else {
      setEmail(data.user.email ?? '')
    }
  })
}, [])
```

> ℹ️ `getSession()` 대신 `getUser()` 사용 — getUser()는 서버에서 토큰을 직접 검증하므로 더 안전함.

---

## 기능 6 — 로그아웃

### 위치
`web/src/app/page.tsx` → 로그아웃 버튼 (임시 홈 화면)

### 동작
```
로그아웃 버튼 클릭 → 세션 종료 → /login 이동
```

```typescript
async function handleLogout() {
  await supabase.auth.signOut()
  router.push('/login')
}
```

---

## 로컬 실행 방법

```bash
# 1. web 디렉터리로 이동
cd AI_Team3/web

# 2. 환경변수 파일 설정 (최초 1회)
cp .env.example .env.local
# .env.local 파일을 열어서 Supabase URL과 anon key 입력

# 3. 패키지 설치 (최초 1회)
npm install

# 4. 개발 서버 시작
npm run dev
```

브라우저에서 `http://localhost:3000/login` 접속

> ⚠️ `.env.local` 파일은 팀원 각자 직접 만들어야 함. git에 올라가지 않음.
> Supabase URL과 anon key는 Supabase 대시보드 → Project Settings → API 에서 확인.

---

## 이메일 템플릿 목록

| 템플릿 | 파일 | Supabase 적용 위치 |
|---|---|---|
| 이메일 인증 | `docs/email-templates/email_confirm_template.html` | Email Templates → Confirm signup |
| 비밀번호 재설정 | `docs/email-templates/email_reset_template.html` | Email Templates → Reset Password |

---

## 미구현 / 추후 개발 항목

| 항목 | 내용 |
|---|---|
| 카카오 로그인 | Supabase 미지원 → 별도 커스텀 OAuth 구현 필요 |
| 커스텀 발신자 이메일 | 도메인 확보 후 Resend SMTP 연결 필요 |
| Google 앱 게시 | 현재 테스트 모드 — 실 서비스 출시 전 Google 검수 필요 |
| 회원 탈퇴 | 미구현 |
| 소셜 계정 연동 해제 | 미구현 |
| 이미 로그인된 상태에서 /login 접근 | 현재 로그인 화면 그대로 표시됨 → 홈으로 리디렉션 필요 |
| 비밀번호 강도 표시 | 미구현 (약함/보통/안전 3단계) |

---

## 변경 이력

| 날짜 | 변경 내용 | 담당 |
|---|---|---|
| 2026-04-26 | 최초 작성 (HTML 기반) | Mingsunny |
| 2026-04-30 | Next.js 전환 반영 — 파일 경로, 기술 스택, API 코드, 실행 방법 전면 업데이트 | Mingsunny |
