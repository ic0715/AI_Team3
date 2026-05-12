# 02. 로그인 / 회원가입

> 신규 유저는 회원가입, 기존 유저는 로그인하여 Supabase 세션을 생성하고, 사용자 상태에 따라 적절한 다음 화면으로 라우팅하는 화면.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 02_login |
| 페이즈 | ONBOARDING |
| 역할 | 인증 + 가입 + 비밀번호 재설정 |
| 진입 경로 | 01 랜딩의 Primary CTA("동의하고 시작하기") → 02 진입 (탭 기본값: 회원가입) / 기존 사용자는 02 진입 후 로그인 탭 전환 / 직접 URL |
| 다음 화면 | NEW01(미인증) / 03~10(온보딩 진행 중) / 11(코칭 진행 중) / NEW03(12주 완료) |

---

## 2. 진입 조건

| 사용자 상태 | 동작 |
| --- | --- |
| GUEST | 본 화면 정상 노출 |
| UNVERIFIED | NEW01으로 자동 리다이렉트 |
| ONBOARDING / ACTIVE / PAUSED / COMPLETED | 본인 상태 화면으로 자동 리다이렉트 (01_landing 2번 항목과 동일한 우선순위 로직 적용) |

---

## 3. UI 구성

### 3.1 헤더

- CareerPT 로고 (SVG 아이콘 + 워드마크)
- 서비스 카피: "방향이 없는 당신을 위한 AI 커리어 코치"

### 3.2 탭 네비게이션

- 탭 1: "로그인"
- 탭 2: "회원가입"
- 비밀번호 재설정 진입 시 탭 영역 숨김 처리
- 탭 active 상태: bottom border 강조 + 굵은 글씨

### 3.3 로그인 패널

| 요소 | 설명 |
| --- | --- |
| 이메일 input | type=email, autocomplete=username |
| 비밀번호 input | type=password, autocomplete=current-password |
| 로그인 버튼 | Primary, full-width |
| "비밀번호를 잊으셨나요?" 링크 | 탭 영역 숨김 후 비밀번호 재설정 패널 노출 |

> v1.3: Google 로그인 버튼 + "또는" 디바이더 제거. OAuth 흐름 자체를 spec에서 제외 (Google/Apple 등 소셜 로그인은 당분간 미도입).

### 3.4 회원가입 패널 — 입력 필드

> **이름 필드 정책 확정 (Option B 채택)**
> 닉네임(이름)은 03 기본 정보 화면에서만 수집합니다. 02 회원가입 폼에서는 이름 필드를 수집하지 않습니다.
> 이름/닉네임은 `profiles.nickname`에 단일 저장됩니다.

| 필드 | 설명 | 필수 여부 |
| --- | --- | --- |
| 이메일 | RFC 5322 형식 검증 | 필수 |
| 비밀번호 | 최소 8자 이상. 영문+숫자 혼합 권장 (아래 3.7 참조) | 필수 |
| 생년월일 | 만 14세 이상만 가입 가능 (`max="2010-12-31"`) | 필수 |

### 3.5 회원가입 패널 — 분리 동의 영역

정보통신망법·개인정보보호법 준수를 위해 항목별로 분리 동의를 받음.

| 항목 | 필수/선택 | 비고 |
| --- | --- | --- |
| 전체 동의 | — | 하위 항목 일괄 토글 |
| 개인정보 수집 및 이용 동의 | 필수 | 전문 보기 링크 |
| 서비스 이용약관 동의 | 필수 | 전문 보기 링크 |
| 만 14세 이상 확인 | 필수 | 생년월일 입력값과 자동 연동 검증 |
| 마케팅 정보 수신 동의 | 선택 | 전문 보기 링크 |

### 3.6 회원가입 액션

- 회원가입 버튼 (Primary, full-width): 필수 동의 3개 모두 체크 시에만 활성화

> v1.3: "Google로 시작하기" 버튼 제거 (3.3 참조).

### 3.7 비밀번호 정책

| 구분 | 내용 |
| --- | --- |
| 최소 길이 | 8자 이상 (필수, 미충족 시 가입 차단) |
| 문자 구성 | 영문 + 숫자 혼합 권장 (미충족 시 차단 없음) |
| 강도 표시 | 약함 / 보통 / 강함 3단계 (색상 + 텍스트 병기, 색약 대응) |
| 평문 저장 | 절대 금지 (Supabase Auth가 bcrypt 해시 처리) |

### 3.8 비밀번호 재설정 패널

> 진입 방식: 로그인 패널의 "비밀번호를 잊으셨나요?" 링크 클릭 시 탭 영역 숨김 후 본 패널 노출.

- 이메일 입력 필드
- "재설정 링크 보내기" 버튼 (Primary, full-width)
- "로그인으로 돌아가기" 텍스트 버튼 → 탭 영역 재노출 + 로그인 패널 복귀

> ⚠️ **구현 현황**: 프로토타입 v6 미구현. 다음 프로토타입 버전에서 구현 필요.

### 3.9 메시지 영역

- 에러: 빨간색 alert box, 폼 위쪽 표시
- 성공: 초록색 alert box
- 메시지는 `aria-live="polite"`로 스크린 리더 알림

---

## 4. 기능 및 인터랙션

| 기능 | 동작 | 비고 |
| --- | --- | --- |
| 로그인 | Supabase Auth `signInWithPassword` | rate limit: IP당 10회/시간 |
| Enter 로그인 | Enter 키로 폼 제출 | Shift+Enter 제외 |
| 회원가입 | 이메일 인증 메일 자동 발송 → NEW01으로 이동 | — |
| 전체 동의 토글 | 모든 하위 항목 동기화 | — |
| 동의 시각 기록 | `consent_*_at` 컬럼에 `timestamptz` 저장 (약관 버전 포함) | schema 반영 필요 |
| 비밀번호 재설정 | Supabase `resetPasswordForEmail` API | — |
| 비밀번호 강도 표시 | 새 비밀번호 입력 시 실시간 강도 표시 (약함/보통/강함) | 회원가입 패널 전용 |
| 비밀번호 표시 토글 | 각 input 우측 👁 아이콘, 클릭 시 평문/마스킹 전환 | — |
| 로딩 상태 | 요청 중 버튼 disabled + 스피너 | 중복 요청 방지 |

---

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

> ⚠️ **schema 불일치 — 수정 완료**: 기존 스펙의 `users.coaching_start_at` 컬럼은 schema에 존재하지 않음.
> 12주 완료 판별은 `goals.status = 'completed'` + `goals.current_week >= goals.total_weeks` 조합으로 대체.

---

## 6. 예외 처리

| 상황 | 처리 메시지 |
| --- | --- |
| 이메일 미입력 | "이메일을 입력해주세요" (인라인) |
| 이메일 형식 오류 | "올바른 이메일 형식이 아니에요" |
| 비밀번호 미입력 | "비밀번호를 입력해주세요" (인라인) |
| 비밀번호 8자 미만 | "비밀번호는 최소 8자 이상이어야 해요" |
| 로그인 실패 (자격증명 불일치) | "이메일 또는 비밀번호가 올바르지 않아요" |
| 만 14세 미만 | "만 14세 이상만 가입할 수 있어요" |
| 필수 동의 미체크 | "필수 항목에 동의해주세요" |
| 중복 이메일 | "이미 가입된 이메일이에요. 로그인을 시도해보세요" + 로그인 탭 전환 CTA |
| 등록되지 않은 이메일 (재설정) | "가입된 계정이 없어요" |
| 이메일 인증 미완료 | NEW01으로 라우팅, 별도 메시지 미노출 |
| 네트워크 오류 | NEW05 네트워크 오류 화면 |
| Rate limit 초과 | "잠시 후 다시 시도해주세요" |
| 중복 클릭 | 버튼 disabled로 차단 |

---

## 7. 데이터 정책

| 항목 | 설명 |
| --- | --- |
| 인증 시스템 | Supabase Auth |
| 사용자 테이블 | `auth.users` (Supabase 관리) + `profiles` (트리거로 자동 생성) |
| 저장 항목 (가입 시) | `auth.users`: email, password(hash), birthdate / `profiles`: nickname은 03에서 수집 후 저장 |
| 동의 항목 저장 | `consent_privacy_at`, `consent_terms_at`, `consent_marketing_at`, `policy_version` → **schema 반영 필요** (`profiles` 테이블에 컬럼 추가 또는 `auth.users.raw_user_meta_data`에 저장 방식 확정 필요) |
| 세션 관리 | Supabase JWT (access 1h, refresh 30d) |
| 비밀번호 정책 | 최소 8자, 평문 저장 금지 |
| 이메일 인증 | 가입 후 인증 메일 자동 발송, 인증 전까지 UNVERIFIED 상태 |

---

## 8. 분석 이벤트

| 이벤트 | 트리거 | 속성 |
| --- | --- | --- |
| `auth_screen_view` | 화면 진입 | `initial_tab` |
| `signup_started` | 회원가입 탭 진입 | — |
| `signup_completed` | 가입 성공 | `method`, `has_marketing_consent` |
| `signup_failed` | 가입 실패 | `error_type` |
| `login_attempted` | 로그인 버튼 클릭 | `method` |
| `login_succeeded` | 로그인 성공 | `method`, `redirect_target` |
| `login_failed` | 로그인 실패 | `error_type` |
| `password_reset_requested` | 재설정 메일 요청 | — |

---

## 9. 접근성

- 모든 input에 `<label>` 또는 `aria-label`
- 에러 메시지는 `aria-describedby`로 input과 연결
- 동의 체크박스는 키보드 토글 가능
- 비밀번호 표시/숨김 토글 버튼 제공 (`aria-pressed` 속성 사용)
- 폼 자동완성 속성(`autocomplete`) 적절히 사용
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
| 동의 컬럼 저장 위치 | `profiles` 테이블 컬럼 추가 vs `auth.users.raw_user_meta_data` 중 확정 필요 | 🟡 개발 전 |
| 비밀번호 재설정 패널 | NEW 프로토타입 v1 미구현. 다음 버전에 추가 필요 | 🟡 다음 버전 |
| 소셜 로그인 (Google/Apple 등) | v1.3에서 spec 제외. 향후 도입 시 별도 검토 | 🟢 향후 검토 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.3 | 2026-05-10 | NEW 프로토타입 v1 정합성 정렬: **소셜 로그인 (Google OAuth) 흐름 spec에서 전체 제거** — 3.3 로그인 패널 Google 버튼 + "또는" 디바이더 제거 / 3.6 회원가입 액션 "Google로 시작하기" 버튼 제거 / 4번 기능 Google 로그인 행 제거 / 6번 예외 처리 OAuth 실패·팝업 차단 항목 제거 / 7번 데이터 정책 OAuth Provider 항목 제거 / 8번 분석 이벤트 oauth_started·oauth_completed 제거. **진입 경로** Secondary CTA "이미 계정이 있어요" 제거 (01번 v1.5와 정합성). **미결사항** "Apple OAuth"를 "소셜 로그인 (Google/Apple 등) — 향후 검토"로 통합. |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 및 팀 결정 반영: 회원가입 폼 이름 필드 제거 확정 (Option B 채택) — 닉네임은 03에서만 수집 / 비밀번호 정책 필수·권장 구분 명확화 (8자 필수, 영문+숫자 혼합 권장) / 비밀번호 재설정 패널 진입 방식·위치 확정 / Google OAuth 팝업 차단 예외 처리 추가 / 접근성 항목 보강 (aria-pressed, aria-live) |
| v1.1 | 2026-05-05 | schema 검증 반영: PAUSED 상태 진입 조건 추가, 라우팅 로직(5번) `users.coaching_start_at` → `goals` 테이블 기반으로 수정 및 schema 불일치 명시, 사용자 테이블명 `users` → `profiles` 정정, 동의 항목 컬럼 schema 반영 필요 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
