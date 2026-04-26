# spec-auth.md — 회원가입 / 로그인 인증 기능 명세

## 개요

CareerPT의 사용자 인증 시스템입니다.
이메일/비밀번호 회원가입·로그인, Google 소셜 로그인, 비밀번호 재설정 기능을 포함합니다.
인증 백엔드는 **Supabase Auth**를 사용합니다.

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `login.html` | 로그인 · 회원가입 · 비밀번호 찾기 화면 |
| `reset_password.html` | 비밀번호 재설정 화면 (메일 링크 클릭 후 착지) |
| `career_coaching_prototype_ver2.html` | 메인 앱 (로그인 완료 후 진입, 로그아웃 버튼 포함) — 파일명 변경 시 `login.html` 상단 `APP_URL` 변수만 수정 |

---

## 기술 스택 및 의존성

```html
<!-- Supabase JS SDK (UMD 빌드 — 반드시 이 URL 사용) -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
```

> ⚠️ `@supabase/supabase-js@2` (UMD 경로 미지정) 사용 시 `sb` 초기화 에러 발생. 반드시 `/dist/umd/supabase.js` 경로를 명시할 것.

**Supabase 클라이언트 초기화 (공통)**

```javascript
const { createClient } = supabase
const sb = createClient(
  'https://fqgpfdzjiopajpeumlac.supabase.co',  // Project URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'   // anon public key (legacy)
)
```

> 🔒 `anon` 키는 공개용으로 코드에 포함 가능. `service_role` 키는 절대 클라이언트 코드에 포함 금지.

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
`login.html` → 회원가입 탭

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
```javascript
const { data, error } = await sb.auth.signUp({
  email,
  password,
  options: { data: { name } }
})
```

---

## 기능 2 — 이메일 로그인

### 화면
`login.html` → 로그인 탭

### 입력값
| 필드 | 타입 | 유효성 |
|---|---|---|
| 이메일 | email | 필수 |
| 비밀번호 | password | 필수 |

### 동작 흐름
```
입력 → Supabase signInWithPassword() 호출
  → 성공: career_coaching_prototype_ver2.html 로 이동
  → 실패: 에러 메시지 표시
```

### 주요 에러 메시지
| 상황 | 메시지 |
|---|---|
| 이메일/비밀번호 불일치 | 이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해주세요. |
| 필드 미입력 | 이메일과 비밀번호를 입력해주세요. |

> 보안 정책상 "이메일 없음"과 "비밀번호 틀림"을 동일 메시지로 처리. Supabase가 의도적으로 두 케이스를 동일 에러로 반환함 (사용자 열거 공격 방지).

### API 호출
```javascript
const { data, error } = await sb.auth.signInWithPassword({ email, password })
```

---

## 기능 3 — Google 소셜 로그인 / 회원가입

### 화면
`login.html` → 로그인 탭 하단 / 회원가입 탭 하단

### 동작 흐름
```
"Google로 계속하기" 버튼 클릭
  → Google 계정 선택 팝업
  → 인증 완료 → career_coaching_prototype_ver2.html 로 이동
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
```javascript
await sb.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.origin + '/career_coaching_prototype_ver2.html' }
})
```

---

## 기능 4 — 비밀번호 재설정

### 화면 흐름
```
login.html (비밀번호를 잊으셨나요? 클릭)
  → 비밀번호 찾기 패널 (이메일 입력)
  → 재설정 메일 발송
  → 메일 링크 클릭
  → reset_password.html (새 비밀번호 입력)
  → 완료 → login.html 자동 이동 (2초 후)
```

### Step 1 — 재설정 메일 요청
```javascript
const { error } = await sb.auth.resetPasswordForEmail(email, {
  redirectTo: window.location.origin + '/reset_password.html'
})
```

| 상황 | 메시지 |
|---|---|
| 등록되지 않은 이메일 | 등록되지 않은 이메일입니다. |
| 성공 | ✓ 재설정 링크를 이메일로 보냈어요. 메일함을 확인해주세요. |

### Step 2 — 새 비밀번호 설정 (`reset_password.html`)
- URL 해시(`#type=recovery`)로 유효한 링크인지 검증
- 유효하지 않은 링크 → 안내 화면 표시
- 비밀번호 강도 표시 (3단계: 약함 / 보통 / 안전)

```javascript
const { error } = await sb.auth.updateUser({ password: newPassword })
```

| 유효성 조건 | 메시지 |
|---|---|
| 8자 미만 | 비밀번호는 8자 이상이어야 합니다. |
| 비밀번호 불일치 | 비밀번호가 일치하지 않아요. |

### 이메일 템플릿
`docs/email_reset_template.html` 참고
Supabase → Authentication → Email Templates → **Reset Password** 에 적용

### Supabase 설정 필요
```
Authentication → URL Configuration → Redirect URLs
→ http://localhost:3000/reset_password.html 추가
```

---

## 기능 5 — 세션 유지 및 자동 리디렉션

### 동작
- `login.html` 접속 시 기존 로그인 세션 확인
- 세션 있으면 → `career_coaching_prototype_ver2.html` 자동 이동

```javascript
sb.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'career_coaching_prototype_ver2.html'
})
```

---

## 기능 6 — 로그아웃

### 위치
`career_coaching_prototype_ver2.html` → 프로필 탭 → 하단

### 동작
```
로그아웃 버튼 클릭 → 세션 종료 → login.html 이동
```

```javascript
async function handleLogout() {
  await sb.auth.signOut()
  window.location.href = 'login.html'
}
```

---

## 로컬 실행 방법

HTML 파일을 직접 더블클릭(file://)하면 CORS 오류로 인증 기능이 동작하지 않음.
반드시 로컬 서버로 실행해야 함.

```bash
cd /path/to/AI_Team3
python3 -m http.server 3000
```

브라우저에서 `http://localhost:3000/login.html` 접속

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
