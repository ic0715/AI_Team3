# 02. 로그인 / 회원가입

> 신규 유저는 회원가입, 기존 유저는 로그인하여 Supabase 세션을 생성하고, 사용자 상태에 따라 적절한 다음 화면으로 라우팅하는 화면.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 02_login |
| 페이즈 | ONBOARDING |
| 역할 | 인증 + 가입 + 비밀번호 재설정 + 이메일 인증 안내 |
| 진입 경로 | 01 랜딩의 Primary CTA("동의하고 시작하기") → 회원가입 탭 / Secondary CTA("이미 계정이 있어요") → 로그인 탭 / 직접 URL / 이메일 인증 링크 클릭 |
| 다음 화면 | 03~10(온보딩 진행 중) / 11 홈(ACTIVE·PAUSED) / NEW03(12주 완료) |

---

## 2. 진입 조건

| 사용자 상태 | 동작 |
| --- | --- |
| GUEST | 본 화면 정상 노출 |
| UNVERIFIED | 로그인 시도 → verify-email 패널로 전환 (페이지 이동 없음) |
| ONBOARDING / ACTIVE / PAUSED / COMPLETED | 인증 성공 후 상태 기반 라우팅 (5번 참조) |

---

## 3. UI 구성

### 3.1 헤더

- CareerPT 로고 (SVG 아이콘 + 워드마크)
- 서비스 카피: "방향이 없는 당신을 위한 AI 커리어 코치"

### 3.2 탭 네비게이션

- 탭 1: "로그인"
- 탭 2: "회원가입"
- 비밀번호 재설정 / 이메일 인증 대기 진입 시 탭 영역 숨김 처리 (패널 전환 방식)
- 탭 active 상태: background 강조 + boxShadow + 굵은 글씨

### 3.3 로그인 패널

| 요소 | 설명 |
| --- | --- |
| 이메일 인증 완료 배너 | 이메일 인증 직후에만 노출. 초록색 배너: "이메일 인증이 완료되었습니다. 로그인해주세요." |
| 이메일 input | type=email, autocomplete=username |
| 비밀번호 input | type=password, autocomplete=current-password |
| 비밀번호 표시 토글 | 우측 SVG 아이콘 (눈 모양). 클릭 시 평문/마스킹 전환. `aria-pressed` 적용 |
| 로그인 버튼 | Primary, full-width |
| "비밀번호를 잊으셨나요?" 링크 | 클릭 시 reset 패널로 전환 |
| 구분선 ("또는") | — |
| Google 로그인 버튼 | Outline, Google 컬러 SVG 아이콘 포함, "Google로 계속하기" |

### 3.4 회원가입 패널 — 입력 필드

> **이름 필드 정책 확정 (Option B 채택)**
> 닉네임(이름)은 03 기본 정보 화면에서만 수집합니다. 02 회원가입 폼에서는 이름 필드를 수집하지 않습니다.
> 이름/닉네임은 `profiles.nickname`에 단일 저장됩니다.

| 필드 | 설명 | 필수 여부 |
| --- | --- | --- |
| 이메일 | RFC 5322 형식 검증 | 필수 |
| 비밀번호 | 최소 8자 이상. 영문+숫자 혼합 권장 (아래 3.7 참조). 우측 SVG 눈 아이콘으로 표시 전환 | 필수 |
| 생년월일 | 만 14세 이상만 가입 가능. max 값은 현재 날짜 기준 14년 전으로 동적 계산 | 필수 |

### 3.5 회원가입 패널 — 분리 동의 영역

정보통신망법·개인정보보호법 준수를 위해 항목별로 분리 동의를 받음.

| 항목 | 필수/선택 | 비고 |
| --- | --- | --- |
| 전체 동의 | — | 하위 항목 일괄 토글 |
| 개인정보 수집 및 이용 동의 | 필수 | 전문 보기 링크 |
| 서비스 이용약관 동의 | 필수 | 전문 보기 링크 |
| 만 14세 이상 확인 | 필수 | 생년월일 입력값과 자동 연동 — 만 14세 이상 입력 시 자동 체크 |
| 마케팅 정보 수신 동의 | 선택 | 전문 보기 링크 |

### 3.6 회원가입 액션

- "시작하기 →" 버튼 (Primary, full-width): 필수 동의 3개 + 이메일·비밀번호·생년월일 모두 입력 시에만 활성화 (미충족 시 opacity 0.4)
- "Google로 시작하기" 버튼 (Outline, full-width)

### 3.7 비밀번호 정책

| 구분 | 내용 |
| --- | --- |
| 최소 길이 | 8자 이상 (필수, 미충족 시 가입 차단) |
| 문자 구성 | 영문 + 숫자 혼합 권장 (미충족 시 차단 없음) |
| 강도 표시 | 약함 / 보통 / 강함 3단계 (색상 바 + 텍스트 병기, 색약 대응) |
| 평문 저장 | 절대 금지 (Supabase Auth가 bcrypt 해시 처리) |

### 3.8 비밀번호 재설정 패널

> 진입 방식: 로그인 패널의 "비밀번호를 잊으셨나요?" 클릭 시 패널 전환 (탭 영역 숨김).

- 이메일 입력 필드
- "재설정 링크 보내기" 버튼 (Primary, full-width). 이메일 미입력 시 opacity 0.4 / disabled
- 성공 시 초록색 배너: "재설정 링크를 이메일로 보냈어요 ✅"
- "← 로그인으로 돌아가기" 텍스트 버튼 → 탭 패널 복귀 + 로그인 탭 활성화
- `redirectTo`: `${origin}/reset-password`

### 3.9 이메일 인증 대기 패널 (verify-email)

> 진입 시점: 회원가입 성공 직후 / 이메일 미인증 상태로 로그인 시도 시. 페이지 이동 없이 패널 전환.

| 요소 | 설명 |
| --- | --- |
| 봉투 SVG 아이콘 | 보라색 원형 배경 + 이메일 아이콘 |
| 타이틀 | "이메일을 확인해주세요" |
| 안내 문구 | 가입한 이메일 주소 강조 표시 + "인증 링크를 보냈어요" |
| 보조 안내 | "링크를 클릭하면 가입이 완료돼요. 메일이 안 보이면 스팸함을 확인해주세요." |
| 돌아가기 버튼 | "← 로그인으로 돌아가기" → 탭 패널 복귀 + 로그인 탭 활성화 |

### 3.10 메시지 영역

- 에러: 빨간색 alert box (`role="alert"`, `aria-live="polite"`), 폼 위쪽 표시
- 성공: 초록색 alert box
- 이메일 인증 완료 배너: 초록색, 체크 SVG 아이콘 포함

---

## 4. 기능 및 인터랙션

| 기능 | 동작 | 비고 |
| --- | --- | --- |
| 로그인 | Supabase Auth `signInWithPassword` → 성공 시 상태 기반 라우팅 | rate limit: IP당 10회/시간 |
| Enter 로그인 | Enter 키로 폼 제출 | Shift+Enter 제외 |
| Google 로그인 | `signInWithOAuth({ provider: 'google' })` → `/auth/callback` → `/login?oauth=success` → 상태 기반 라우팅 | — |
| 회원가입 | `signUp` 호출 → 이메일 인증 메일 자동 발송 → verify-email 패널로 전환 (페이지 이동 없음) | `emailRedirectTo`: `${origin}/login` |
| 이메일 인증 완료 감지 | URL에 `?code=` 또는 `#access_token=` 존재 시 `onAuthStateChange`로 SIGNED_IN 이벤트 감지 → 세션 제거 → 이메일 미리채움 → 배너 표시 | 수동 로그인 유도 |
| 이메일 미인증 로그인 | `signInWithPassword` 에러 'Email not confirmed' → verify-email 패널로 전환 | — |
| 전체 동의 토글 | 모든 하위 항목 동기화 | — |
| 생년월일·연령 동의 연동 | 생년월일 입력 시 만 14세 이상이면 연령 동의 자동 체크 / 미만이면 자동 해제 | — |
| 비밀번호 재설정 | Supabase `resetPasswordForEmail` → `redirectTo: ${origin}/reset-password` | — |
| 비밀번호 강도 표시 | 새 비밀번호 입력 시 실시간 강도 표시 (약함/보통/강함). `aria-live="polite"` | 회원가입 패널 전용 |
| 비밀번호 표시 토글 | 각 input 우측 SVG 눈 아이콘. 클릭 시 평문/마스킹 전환. `aria-pressed` 적용 | — |
| 로딩 상태 | 요청 중 버튼 disabled + 텍스트 변경 ("로그인 중..." / "처리 중...") | 중복 요청 방지 |
| 에러 메시지 초기화 | 이메일·비밀번호 input 변경 시 loginError 자동 초기화 | — |

---

## 5. 인증 성공 후 라우팅 로직

Supabase Auth 인증 성공 후 다음 순서로 사용자 상태를 확인하여 라우팅.

```
1. email_confirmed_at = null → verify-email 패널로 전환 (페이지 이동 없음)
2. goals (status='active') 존재 → /home
3. goals (status='paused') 존재 & active 없음 → /home
4. goals (status='completed', current_week >= total_weeks) 존재 & active 없음 → /cycle-complete
5. 위 조건 모두 해당 없음 → /basic-info (온보딩 시작)
```

### 이메일 인증 완료 후 플로우

```
이메일 링크 클릭
  → /login 진입 (?code= 또는 #access_token= 포함)
  → onAuthStateChange SIGNED_IN 이벤트 감지
  → supabase.auth.signOut() (세션 제거)
  → loginEmail 필드에 인증 이메일 자동 입력
  → "이메일 인증이 완료되었습니다. 로그인해주세요." 배너 표시
  → 사용자가 비밀번호 입력 후 로그인 버튼 클릭 → 상태 기반 라우팅
```

> ⚠️ **schema 불일치 — 수정 완료**: 기존 스펙의 `users.coaching_start_at` 컬럼은 schema에 존재하지 않음.
> 12주 완료 판별은 `goals.status = 'completed'` + `goals.current_week >= goals.total_weeks` 조합으로 대체.

---

## 6. 예외 처리

| 상황 | 처리 메시지 |
| --- | --- |
| 이메일 미입력 | "이메일을 입력해주세요" |
| 이메일 형식 오류 | "올바른 이메일 형식이 아니에요" |
| 비밀번호 미입력 | "비밀번호를 입력해주세요" |
| 비밀번호 8자 미만 | "비밀번호는 최소 8자 이상이어야 해요" |
| 로그인 실패 (자격증명 불일치) | "이메일 또는 비밀번호가 올바르지 않아요" |
| 만 14세 미만 | "만 14세 이상만 가입할 수 있어요" |
| 필수 동의 미체크 | "필수 항목에 동의해주세요" |
| 이메일 인증 미완료 (로그인 시도) | verify-email 패널로 전환 (별도 에러 메시지 없음) |
| 중복 이메일 (회원가입) | "이미 가입된 이메일이에요. 로그인을 시도해보세요" + 로그인 탭 자동 전환 |
| Rate limit 초과 (이메일 재발송) | "잠시 후 다시 시도해주세요 (이메일 발송 횟수 제한)" |
| 잘못된 이메일 형식 (Supabase 검증) | "올바른 이메일 형식이 아니에요" |
| 약한 비밀번호 (Supabase 정책) | "비밀번호가 너무 간단해요. 영문+숫자 조합으로 바꿔주세요" |
| OAuth 실패 (`?error=oauth_failed`) | 로그인 화면 유지 (에러 파라미터 노출) |
| 네트워크 오류 / 기타 서버 에러 | "가입에 실패했어요. 잠시 후 다시 시도해주세요" + 콘솔에 실제 에러 로그 |
| 중복 클릭 | 버튼 disabled로 차단 |

---

## 7. 데이터 정책

| 항목 | 설명 |
| --- | --- |
| 인증 시스템 | Supabase Auth |
| 사용자 테이블 | `auth.users` (Supabase 관리) + `profiles` (트리거로 자동 생성) |
| 저장 항목 (가입 시) | `auth.users`: email, password(hash) / `auth.users.raw_user_meta_data`: birthdate, consent_marketing / `profiles`: nickname은 03에서 수집 후 저장 |
| 동의 항목 저장 | `consent_marketing`은 `raw_user_meta_data`에 저장. `consent_privacy_at`, `consent_terms_at`, `policy_version` 컬럼은 schema 반영 필요 |
| 세션 관리 | Supabase JWT (access 1h, refresh 30d) |
| 이메일 인증 redirectTo | `${window.location.origin}/login` (PKCE 또는 implicit 토큰 포함) |
| OAuth Provider | Google (`/auth/callback` route 경유) |
| 비밀번호 정책 | 최소 8자, 평문 저장 금지 |

---

## 8. 분석 이벤트

| 이벤트 | 트리거 | 속성 |
| --- | --- | --- |
| `auth_screen_view` | 화면 진입 | `initial_tab` |
| `signup_started` | 회원가입 탭 진입 | — |
| `signup_completed` | 가입 성공 → verify-email 패널 노출 | `method`, `has_marketing_consent` |
| `signup_failed` | 가입 실패 | `error_type` |
| `login_attempted` | 로그인 버튼 클릭 | `method` |
| `login_succeeded` | 로그인 성공 | `method`, `redirect_target` |
| `login_failed` | 로그인 실패 | `error_type` |
| `email_verified` | 이메일 인증 완료 배너 노출 | — |
| `password_reset_requested` | 재설정 메일 요청 | — |
| `oauth_started` | OAuth 시작 | `provider` |
| `oauth_completed` | OAuth 완료 | `provider`, `is_new_user` |

---

## 9. 접근성

- 모든 input에 `<label>` 또는 `aria-label`
- 에러 메시지는 `role="alert"` + `aria-live="polite"`
- 동의 체크박스는 키보드 토글 가능
- 비밀번호 표시/숨김 토글 버튼 `aria-pressed` 속성 사용
- 폼 자동완성 속성(`autocomplete`) 적절히 사용 (username, current-password, new-password)
- 비밀번호 강도 표시는 `aria-live="polite"`로 실시간 알림
- 색약 대응: 강도 표시는 색상 외 텍스트 레이블 병기

---

## 10. 성능 목표

- 화면 진입 ~ 인터랙션 가능: 2.0초 이하
- 로그인 응답: p95 800ms 이하
- 가입 응답: p95 1.5초 이하 (이메일 발송 포함)

---

## 미결 사항

| 항목 | 내용 | 우선순위 |
| --- | --- | --- |
| 동의 컬럼 저장 위치 | `consent_privacy_at`, `consent_terms_at`, `policy_version` — `profiles` 테이블 컬럼 추가 vs `raw_user_meta_data` 중 확정 필요 | 🟡 개발 전 |
| Apple OAuth | 추후 검토 대상 (현재 Google만 지원) | 🟢 v2 |
| 카카오 OAuth | Supabase 미지원으로 커스텀 구현 필요. v1 이후 검토 | 🟢 v2 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.3 | 2026-05-10 | 구현 코드 기준 전면 정렬: **(1) 이메일 인증 패널 인라인화** — 회원가입 후 NEW01 이동 제거, 로그인 화면 내 verify-email 패널 전환 방식으로 변경 / **(2) 인증 완료 후 수동 로그인** — 이메일 링크 클릭 후 자동 라우팅 제거, 세션 제거 후 "이메일 인증이 완료되었습니다. 로그인해주세요." 배너 + 수동 로그인 유도 / **(3) 비밀번호 토글 아이콘** — 👁 이모지 → SVG 아이콘 / **(4) 에러 메시지 세분화** — rate limit·약한 비밀번호·잘못된 이메일 개별 처리 추가 / **(5) 비밀번호 재설정 패널 구현 완료** — ⚠️ 미구현 주석 제거 / **(6) 라우팅 로직 업데이트** — UNVERIFIED 상태 NEW01 이동 → verify-email 패널 전환, 라우팅 경로 `/home`, `/cycle-complete`, `/basic-info` 명시 / **(7) emailRedirectTo** — `/auth/callback` 경유 제거, `/login` 직접 지정 + `onAuthStateChange` 감지 방식 문서화 |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 및 팀 결정 반영: 회원가입 폼 이름 필드 제거 확정 (Option B 채택) — 닉네임은 03에서만 수집 / 비밀번호 정책 필수·권장 구분 명확화 (8자 필수, 영문+숫자 혼합 권장) / 비밀번호 재설정 패널 진입 방식·위치 확정 / Google OAuth 팝업 차단 예외 처리 추가 / 접근성 항목 보강 (aria-pressed, aria-live) |
| v1.1 | 2026-05-05 | schema 검증 반영: PAUSED 상태 진입 조건 추가, 라우팅 로직(5번) `users.coaching_start_at` → `goals` 테이블 기반으로 수정 및 schema 불일치 명시, 사용자 테이블명 `users` → `profiles` 정정, 동의 항목 컬럼 schema 반영 필요 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
