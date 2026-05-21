# NEW07. 비밀번호 변경

> 기준 프로토타입: `home_0520.html` (pNEW07)
> 작성일: 2026-05-21
> feature/12에서 신규 추가. _post_mvp_v2에 처음 등록.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | NEW07_password_change |
| 페이즈 | MAINTAIN |
| 역할 | 현재 비밀번호 재인증 + 새 비밀번호 설정 |
| 진입 경로 | 15 프로필 → [🔒 비밀번호 변경] 메뉴 (`/profile/password-change`) |
| 다음 화면 | 11 홈 (변경 완료 시) / 15 프로필 (취소·뒤로가기 시) |

---

## 2. 진입 조건

- 로그인 상태 (`supabase.auth.getSession()` 유효)
- 15 프로필에서 [비밀번호 변경] 클릭
- **이메일 가입 사용자만 진입 가능**
  - `auth.users.app_metadata.providers` 배열에 `'email'` 포함, 또는 `app_metadata.provider === 'email'` (둘 다 허용 — Supabase 버전 호환)
- OAuth 전용 사용자(Google 등 단독 가입)는 진입 불가 → alert 안내 후 15 복귀: "Google 계정 비밀번호는 Google에서 관리해주세요."

---

## 3. UI 구성

### 3.1 상단 바

3열 그리드. 좌측 ← 뒤로가기, 중앙 "비밀번호 변경", 우측 spacer.
- 뒤로가기 클릭: 입력값 있으면 "변경사항이 사라져요" 다이얼로그 → 15 복귀

### 3.2 안내 메시지

- 메인 타이틀: "안전한 비밀번호로 변경해주세요" (20px, weight 800)
- 서브: "변경 후 다른 디바이스에서는 자동으로 로그아웃돼요." (13px, ink-soft)

### 3.3 폼 필드

3개의 password input (모두 보안 표시 토글 👁 포함):

| 필드 | 타입 | 필수 | 검증 |
| --- | --- | --- | --- |
| 현재 비밀번호 | password | 필수 | `supabase.auth.signInWithPassword`로 재인증 |
| 새 비밀번호 | password | 필수 | 최소 8자, 영문+숫자 권장 |
| 새 비밀번호 확인 | password | 필수 | 새 비밀번호와 일치 |

- 각 input: `border-radius 12px`, `border 1.5px line`, 우측에 👁 토글 (32×32px, fontSize 16px)
- input attribute: `autocomplete="current-password"` 또는 `"new-password"` 적절히 설정
- 에러 시: border 색 `var(--danger)` + 하단 12px 빨강 메시지

### 3.4 비밀번호 강도 표시

새 비밀번호 입력 시 실시간 노출 (입력 길이 > 0일 때만):

- 행 구조: "강도" 라벨 + 4px 높이 bar + "약함/보통/강함" 텍스트 (`aria-live="polite"`)
- 색상: 약함=`#dc2626`, 보통=`#F59E0B`, 강함=`#10B981`
- 강도 계산 로직:
  - 8자 미만 → **약함**
  - 8자 이상 + 영문/숫자 혼합 → **보통**
  - 12자 이상 + 영문/숫자/특수문자 모두 → **강함**

### 3.5 Bottom CTA

- Primary: "비밀번호 변경" — accent 배경, 흰색, 전체 너비, `boxShadow 0 4px 14px -4px rgba(45,91,255,.3)`
  - 활성화 조건: 현재 비밀번호 ≥1자, 새 비밀번호 ≥8자, 새 비밀번호 = 확인. 그리고 submitting 아님.
- Secondary: "취소" — `bg-soft` 배경, ink-soft 글씨, line-strong 보더, 12px radius

---

## 4. 기능 및 인터랙션

| 기능 | 동작 |
| --- | --- |
| 사용자 이메일 조회 | `supabase.auth.getUser()` → `data.user.email` 사용 (메모리 임시 보관, `profiles` 등 비즈니스 테이블 조회 X) |
| OAuth 사용자 차단 | `app_metadata.providers` 배열 또는 `app_metadata.provider` 필드 검사 — 둘 다 허용 |
| 현재 비밀번호 재인증 | `supabase.auth.signInWithPassword({ email, password: currentPwd })` |
| 새 비밀번호 강도 표시 | 실시간 계산 (입력 1자 이상부터 노출) |
| 일치 검증 | 새 비밀번호 ≠ 확인 → 인라인 에러 |
| 변경 클릭 | 클라이언트 검증 → 재인증 → `supabase.auth.updateUser({ password })` → 성공 alert → 11 홈 이동 |
| 취소·뒤로가기 | 입력값 없으면 → 15 복귀. 있으면 → "변경사항이 사라져요" 다이얼로그 |

---

## 5. 변경 성공 후 동작

1. `supabase.auth.updateUser({ password })` 호출 성공
2. `auth.users.updated_at` Supabase Auth가 자동 갱신
3. **다른 디바이스의 refresh token 자동 무효화** (Supabase 기본 동작)
   - access token은 만료(기본 1시간)까지 유효
   - access token 만료 후 refresh 시도 → 실패 → 자동 로그아웃
4. 성공 안내: `alert('비밀번호가 변경되었어요')` (MVP — 추후 토스트로 교체)
5. 11 홈으로 자동 이동
6. 현재 세션은 유지 (재로그인 불필요)

---

## 6. 데이터 정책

| 항목 | 설명 |
| --- | --- |
| 인증 시스템 | Supabase Auth (`auth.users` 테이블) |
| 변경 API | `supabase.auth.updateUser({ password })` |
| 평문 저장 | 절대 금지 (Supabase Auth가 bcrypt 해시 처리) |
| 변경 이력 | `auth.users.updated_at` 자동 갱신, 별도 이력 테이블 미사용 |
| `profiles` 테이블 영향 | 없음 (`profiles`는 `auth.users.id`와 1:1로 연결되지만 비밀번호 정보는 보유하지 않음) |
| AI 컨텍스트 격리 | 비밀번호 입력값은 어떤 AI 프롬프트에도 포함되지 않음 |
| 비밀번호 입력값 | 화면 이탈 시 즉시 메모리에서 폐기, sessionStorage 저장 안 함 |

---

## 7. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 현재 비밀번호 미입력 | "현재 비밀번호를 입력해주세요" 인라인 에러 |
| 현재 비밀번호 불일치 | "현재 비밀번호가 일치하지 않아요" 인라인 에러 (Supabase 응답 message에 "invalid"/"credentials" 포함 시 감지) |
| 새 비밀번호 8자 미만 | "비밀번호는 최소 8자 이상이어야 해요" |
| 새 비밀번호 = 현재 비밀번호 | "현재 비밀번호와 다른 비밀번호를 사용해주세요" |
| 새 비밀번호 ≠ 확인 | "비밀번호가 일치하지 않아요" |
| Supabase API 실패 (5xx) | "변경에 실패했어요. 잠시 후 다시 시도해주세요" |
| Rate limit 초과 | "잠시 후 다시 시도해주세요 (요청이 너무 많아요)" |
| 세션 만료 | 자동 로그아웃 후 로그인 화면으로 이동 |
| 중복 클릭 | 첫 클릭 시 버튼 disabled (`submitting` 플래그) |
| OAuth 전용 사용자 진입 | 진입 차단 alert + 15 프로필 복귀 |

---

## 8. 접근성

- 모든 input에 `<label>` 또는 aria-describedby 연결
- 에러 메시지: `id="{label}-error"` + input `aria-invalid` + `aria-describedby` 연결
- 비밀번호 표시 토글: `aria-pressed` 속성 사용
- 강도 표시: `aria-live="polite"`
- input `autocomplete` 적절히 (`current-password` / `new-password`)
- 키보드만으로 모든 작업 가능 (👁 토글도 button 요소)

---

## 9. 미결 사항 (Post-MVP)

| 항목 | 내용 |
| --- | --- |
| 토스트 UI | 현재 alert 사용 → 토스트 컴포넌트 도입 시 교체 |
| 비밀번호 정책 강화 | 특수문자 필수, 사전 단어 차단 등 정책 강화 검토 |
| 변경 이력 표시 | "최근 비밀번호 변경 N일 전" 등 표시 검토 |
| 다중 세션 명시 노출 | 변경 후 "다른 N개 디바이스에서 로그아웃됨" 안내 |

---

## 10. 보안 고려사항

- **평문 표시 토글**: 사용자가 명시적으로 클릭한 경우에만 활성화 (기본은 마스킹)
- **autocomplete 노출 최소화**: `current-password` / `new-password` 명시
- **세션 유지**: 변경 성공 후 현재 세션은 유지하여 재로그인 부담 제거
- **다른 디바이스 무효화**: refresh token 자동 무효화로 access token 만료 시 자동 로그아웃
- **재인증 필수**: 비밀번호 변경 전 반드시 현재 비밀번호로 재검증 (세션만으로 변경 불가)
- **AI 컨텍스트 격리**: 비밀번호 입력값은 어떤 AI 프롬프트에도 포함되지 않음

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.0 | 2026-05-21 | _post_mvp_v2에 신규 등록 (feature/12 구현 기준). OAuth 사용자 차단을 `app_metadata.providers` 배열 또는 `provider` 단일 필드 둘 다 허용으로 명시 (Supabase 버전 호환). 변경 성공 후 11 홈으로 이동, 취소·뒤로가기 시 15 프로필 복귀. alert 사용은 MVP 임시, 토스트 도입 검토를 미결 사항에 추가. |
