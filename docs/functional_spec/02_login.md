# 02. 로그인 / 회원가입

> 신규 유저는 회원가입, 기존 유저는 로그인하여 Supabase 세션을 생성하고, 사용자 상태에 따라 적절한 다음 화면으로 라우팅하는 화면.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 02_login |
| 페이즈 | ONBOARDING |
| 역할 | 인증 + 가입 + 비밀번호 재설정 |
| 진입 경로 | 01 랜딩의 CTA, 헤더 로그인, 직접 URL |
| 다음 화면 | NEW01(미인증) / 03~10(온보딩 진행 중) / 11(코칭 진행 중) / NEW03(12주 완료) |

## 2. 진입 조건

| 사용자 상태 | 동작 |
| --- | --- |
| GUEST | 본 화면 정상 노출 |
| UNVERIFIED | NEW01으로 자동 리다이렉트 |
| ONBOARDING / ACTIVE / PAUSED / COMPLETED | 본인 상태 화면으로 자동 리다이렉트 (01_landing 2번 항목과 동일한 우선순위 로직 적용) |

## 3. UI 구성

### 3.1 헤더

- CareerPT 로고
- 서비스 카피: "방향이 없는 당신을 위한 AI 커리어 코치"

### 3.2 탭 네비게이션

- 탭 1: "로그인"
- 탭 2: "회원가입"
- 비밀번호 재설정 진입 시 탭 영역 숨김
- 탭 active 상태 강조: bottom border + 굵은 글씨

### 3.3 로그인 패널

| 요소 | 설명 |
| --- | --- |
| 이메일 input | type=email, autocomplete=username |
| 비밀번호 input | type=password, autocomplete=current-password |
| 로그인 버튼 | Primary, full-width |
| Google 로그인 버튼 | Outline, Google 아이콘 포함 |
| "비밀번호를 잊으셨나요?" 링크 | 비밀번호 재설정 패널 진입 |

### 3.4 회원가입 패널 - 입력 필드

| 필드 | 설명 |
| --- | --- |
| 이름 | 1~20자 |
| 이메일 | RFC 5322 형식 검증 |
| 비밀번호 | 8자 이상, 영문+숫자 혼합 권장 |
| 생년월일 | 만 14세 이상만 가입 가능 (차단 검증) |

### 3.5 회원가입 패널 - 분리 동의 영역

정보통신망법·개인정보보호법 준수를 위해 항목별로 분리 동의를 받음.

| 항목 | 필수/선택 | 비고 |
| --- | --- | --- |
| 전체 동의 | - | 하위 항목 일괄 토글 |
| 개인정보 수집 및 이용 동의 | 필수 | 전문 보기 링크 |
| 서비스 이용약관 동의 | 필수 | 전문 보기 링크 |
| 만 14세 이상 확인 | 필수 | 생년월일과 일치 여부 검증 |
| 마케팅 정보 수신 동의 | 선택 | 전문 보기 링크 |

### 3.6 회원가입 액션

- 회원가입 버튼 (Primary): 필수 동의 모두 체크 시에만 활성화
- "Google로 시작하기" 버튼 (Outline)

### 3.7 비밀번호 재설정 패널

- 이메일 입력 필드
- "재설정 링크 보내기" 버튼
- "로그인으로 돌아가기" 보조 버튼

### 3.8 메시지 영역

- 에러: 빨간색 alert box, 폼 위쪽 표시
- 성공: 초록색 alert box
- 메시지는 aria-live="polite"로 스크린 리더 알림

## 4. 기능 및 인터랙션

| 기능 | 동작 | 비고 |
| --- | --- | --- |
| 로그인 | Supabase Auth signInWithPassword | rate limit: IP당 10회/시간 |
| Enter 로그인 | Enter 키로 폼 제출 | Shift+Enter 제외 |
| Google 로그인 | OAuth redirect → 사용자 상태 기반 라우팅 | - |
| 회원가입 | 이메일 인증 메일 자동 발송 → NEW01으로 이동 | - |
| 전체 동의 토글 | 모든 하위 항목 동기화 | - |
| 동의 시각 기록 | consent_*_at 컬럼에 timestamptz 저장 | 약관 버전도 함께 |
| 비밀번호 재설정 | Supabase reset password API | - |
| 로딩 상태 | 요청 중 버튼 disabled + 스피너 | 중복 요청 방지 |

## 5. 인증 성공 후 라우팅 로직

Supabase Auth 인증 성공 후 다음 순서로 사용자 상태를 확인하여 라우팅.  
01_landing 2.1 ONBOARDING 세부 로직과 동일한 체크 순서를 따름.

```
1. auth.users.email_confirmed_at = null → NEW01 이메일 인증
2. goals (status='active') 존재 → 11 홈 (ACTIVE)
3. goals (status='paused') 존재 & active 없음 → 11 홈 (PAUSED, 중단됨 배지)
4. goals (status='completed', current_week >= total_weeks) 존재 & active 없음 → NEW03 12주 완료
5. 위 조건 모두 해당 없음 → ONBOARDING 세부 로직 (01_landing 2.1 참조)
```

> ⚠️ **schema 불일치 — 수정 필요**: 기존 스펙의 `users.coaching_start_at` 컬럼은 schema에 존재하지 않음.  
> 12주 완료 판별은 `goals.status = 'completed'` + `goals.current_week >= goals.total_weeks` 조합으로 대체.

## 6. 예외 처리

| 상황 | 처리 메시지 |
| --- | --- |
| 이메일 미입력 | "이메일을 입력해주세요" (인라인) |
| 이메일 형식 오류 | "올바른 이메일 형식이 아니에요" |
| 비밀번호 미입력 | "비밀번호를 입력해주세요" (인라인) |
| 로그인 실패 (자격증명 불일치) | "이메일 또는 비밀번호가 올바르지 않아요" |
| 이름 미입력 | "이름을 입력해주세요" |
| 비밀번호 8자 미만 | "비밀번호는 최소 8자 이상이어야 해요" |
| 만 14세 미만 | "만 14세 이상만 가입할 수 있어요" |
| 필수 동의 미체크 | "필수 항목에 동의해주세요" |
| 중복 이메일 | "이미 가입된 이메일이에요. 로그인을 시도해보세요" + 로그인 탭 전환 CTA |
| 등록되지 않은 이메일(재설정) | "가입된 계정이 없어요" |
| 이메일 인증 미완료 | NEW01으로 라우팅, 별도 메시지 미노출 |
| OAuth 실패 | "Google 로그인에 실패했어요. 다시 시도해주세요" |
| 네트워크 오류 | NEW05 네트워크 오류 화면 |
| Rate limit 초과 | "잠시 후 다시 시도해주세요" |
| 중복 클릭 | 버튼 disabled로 차단 |

## 7. 데이터 정책

| 항목 | 설명 |
| --- | --- |
| 인증 시스템 | Supabase Auth |
| 사용자 테이블 | `auth.users` (Supabase 관리) + `profiles` (트리거로 자동 생성) |
| 저장 항목 (가입 시) | `profiles.nickname` (이름 입력값), `profiles.birthdate`, `auth.users`의 email·password(hash) |
| 동의 항목 저장 | consent_privacy_at, consent_terms_at, consent_marketing_at, policy_version → **schema 반영 필요** (`profiles` 테이블에 컬럼 추가 또는 `auth.users.raw_user_meta_data`에 저장 방식 확정 필요) |
| 세션 관리 | Supabase JWT (access 1h, refresh 30d) |
| OAuth Provider | Google (이후 Apple 검토) |
| 비밀번호 정책 | 최소 8자, 평문 저장 금지 |
| 이메일 인증 | 가입 후 인증 메일 발송, 인증 전까지 UNVERIFIED 상태 |

## 8. 분석 이벤트

| 이벤트 | 트리거 | 속성 |
| --- | --- | --- |
| auth_screen_view | 화면 진입 | initial_tab |
| signup_started | 회원가입 탭 진입 | - |
| signup_completed | 가입 성공 | method, has_marketing_consent |
| signup_failed | 가입 실패 | error_type |
| login_attempted | 로그인 버튼 클릭 | method |
| login_succeeded | 로그인 성공 | method, redirect_target |
| login_failed | 로그인 실패 | error_type |
| password_reset_requested | 재설정 메일 요청 | - |
| oauth_started | OAuth 시작 | provider |
| oauth_completed | OAuth 완료 | provider, is_new_user |

## 9. 접근성

- 모든 input에 <label> 또는 aria-label
- 에러 메시지는 aria-describedby로 input과 연결
- 동의 체크박스는 키보드 토글 가능
- 비밀번호 표시/숨김 토글 버튼 제공 (입력 정확성 확보)
- 폼 자동완성 속성(autocomplete) 적절히 사용

## 10. 성능 목표

- 화면 진입 ~ 인터랙션 가능: 2.0초 이하
- 로그인 응답: p95 800ms 이하
- 가입 응답: p95 1.5초 이하 (이메일 발송 포함)

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.1 | 2026-05-05 | schema 검증 반영: PAUSED 상태 진입 조건 추가, 라우팅 로직(5번) `users.coaching_start_at` → `goals` 테이블 기반으로 수정 및 schema 불일치 명시, 사용자 테이블명 `users` → `profiles` 정정, 동의 항목 컬럼 schema 반영 필요 명시, 이름 필드가 `profiles.nickname`에 저장됨을 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
