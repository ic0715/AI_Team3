# NEW07. 비밀번호 변경 (신규)

> 사용자가 본인 비밀번호를 안전하게 변경하는 별도 화면. 15 프로필에서 진입하며, 변경 완료 또는 취소 시 15로 복귀.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | NEW07_password_change |
| 페이즈 | MAINTAIN |
| 역할 | 현재 비밀번호 재인증 + 새 비밀번호 설정 |
| 진입 경로 | 15 프로필 → [비밀번호 변경] 버튼 |
| 다음 화면 | 15 프로필 (변경 완료 또는 취소 시 복귀) |

## 2. 진입 조건

- 로그인 상태 (Supabase 세션 유효, `supabase.auth.getSession()`로 확인)
- 15 프로필에서 [비밀번호 변경] 클릭
- 이메일 가입 사용자만 진입 가능 — `auth.users.app_metadata.providers` 배열에 `'email'` 포함 여부로 판별
- OAuth 전용 사용자(Google 등 단독 가입)는 진입 불가 → 안내 후 15 복귀: "Google 계정 비밀번호는 Google에서 관리해주세요"

## 3. UI 구성

### 3.1 상단 바

- 뒤로가기(←) → 15 프로필
- 페이지 타이틀: "비밀번호 변경"

### 3.2 안내 메시지

- "안전한 비밀번호로 변경해주세요"
- "변경 후 다른 디바이스에서는 자동으로 로그아웃돼요" (보안 안내)

### 3.3 폼 필드

| 필드 | 타입 | 필수 | 검증 |
| --- | --- | --- | --- |
| 현재 비밀번호 | password | 필수 | Supabase Auth `signInWithPassword`로 재인증 검증 |
| 새 비밀번호 | password | 필수 | 8자 이상, 영문+숫자 혼합 권장 |
| 새 비밀번호 확인 | password | 필수 | 새 비밀번호와 일치 |

### 3.4 비밀번호 강도 표시

- 새 비밀번호 입력 시 실시간 강도 표시 (약함 / 보통 / 강함)
- 색상 + 텍스트로 표시 (색약 대응)

### 3.5 비밀번호 표시 토글

- 각 비밀번호 input 우측에 👁 아이콘
- 클릭 시 평문 표시/마스킹 전환 (입력 정확성 확보)

### 3.6 Bottom CTA

- Primary: "비밀번호 변경" (모든 필드 충족 시 활성화)
- Secondary: "취소" → 15 프로필 복귀

## 4. 기능 및 인터랙션

| 기능 | 동작 | 비고 |
| --- | --- | --- |
| 사용자 이메일 조회 | `supabase.auth.getUser()` 호출 → `data.user.email` 사용 | 클라이언트 메모리에 임시 보관, `profiles` 등 비즈니스 테이블 조회 X |
| 현재 비밀번호 재인증 | `supabase.auth.signInWithPassword({ email, password })` (이메일은 위 단계에서 조회한 값) | rate limit: IP당 10회/시간 |
| 새 비밀번호 강도 검사 | 8자 이상 + 영문/숫자 포함 검증 | 실시간 표시 |
| 일치 검증 | 새 비밀번호 ≠ 확인 시 인라인 에러 | 디바운스 0.3초 |
| 변경 클릭 | 클라이언트 검증 → 재인증 → `supabase.auth.updateUser({ password })` 호출 → 성공 토스트 → 15 복귀 | 로딩 상태 표시 |
| 취소 클릭 | 입력값 있으면 "변경사항이 사라져요" 다이얼로그 → 15 복귀 | - |
| 뒤로가기 | 취소와 동일 동작 | - |

## 5. 변경 성공 후 동작

1. `supabase.auth.updateUser({ password })` 호출 성공
2. `auth.users.updated_at` 자동 갱신 (Supabase Auth 관리, 클라이언트 추가 작업 불필요)
3. **다른 디바이스의 refresh token 자동 무효화** (Supabase 기본 동작)
   - 다른 디바이스의 access token은 만료(기본 1시간)될 때까지 유효
   - access token 만료 후 refresh 시도하면 실패하여 로그아웃 처리됨
4. 성공 토스트: "비밀번호가 변경되었어요"
5. 15 프로필로 자동 복귀
6. 현재 세션은 유지 (재로그인 불필요)

## 6. 데이터 정책

| 항목 | 설명 |
| --- | --- |
| 인증 시스템 | Supabase Auth (`auth.users` 테이블) |
| 비즈니스 테이블 영역과의 관계 | `auth.users`는 핸드오프 문서의 9개 비즈니스 테이블에 미포함되는 별도 영역 |
| 변경 API | `supabase.auth.updateUser({ password })` |
| 평문 저장 | 절대 금지 (Supabase Auth가 bcrypt 해시 처리) |
| 변경 이력 | `auth.users.updated_at` 자동 갱신, 별도 이력 테이블 미사용 |
| `profiles` 테이블 영향 | 비밀번호 변경 동작에서는 영향 없음 (`profiles`는 `auth.users.id`와 1:1로 연결되지만 비밀번호 정보는 보유하지 않음). 마이페이지의 다른 기능(닉네임 수정 등)은 `profiles`를 UPDATE하지만 NEW07과 분리된 동작 |
| AI 컨텍스트 주입 영역과의 분리 | 비밀번호 변경은 AI 핸드오프 #5(`daily_memos`, `action_completions`, `weekly_retros`, `coaching_insights`) 컨텍스트와 완전 분리됨 (보안상 비밀번호 입력값이 AI 프롬프트에 포함될 수 없음) |
| 본인 계정 검증 | Supabase Auth가 세션 토큰 기반으로 자체 검증 (RLS와는 별개 메커니즘) |
| 비밀번호 입력값 | 화면 이탈 시 즉시 메모리에서 폐기, sessionStorage 저장 안 함 |

## 7. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 현재 비밀번호 미입력 | "현재 비밀번호를 입력해주세요" 인라인 에러 |
| 현재 비밀번호 불일치 | "현재 비밀번호가 일치하지 않아요" 인라인 에러 + 포커스 |
| 새 비밀번호 8자 미만 | "비밀번호는 최소 8자 이상이어야 해요" |
| 새 비밀번호 = 현재 비밀번호 | "현재 비밀번호와 다른 비밀번호를 사용해주세요" |
| 새 비밀번호 ≠ 확인 | "비밀번호가 일치하지 않아요" 인라인 에러 (확인 필드에 표시) |
| Supabase API 실패 (5xx) | "변경에 실패했어요. 잠시 후 다시 시도해주세요" + 재시도 버튼 |
| 네트워크 오류 | NEW05 네트워크 오류 화면 (입력값은 유지하지 않음, 보안상) |
| Rate limit 초과 (재인증 10회/시간) | "잠시 후 다시 시도해주세요" + 대기 시간 표시 |
| 세션 만료 | 자동 로그아웃 후 02 로그인으로 이동 |
| 중복 클릭 | 첫 클릭 시 버튼 disabled |
| OAuth 전용 사용자 진입 (`app_metadata.providers`에 `'email'` 미포함) | 진입 불가 안내 + 15로 복귀 |

## 8. 분석 이벤트

| 이벤트 | 트리거 | 속성 |
| --- | --- | --- |
| password_change_started | 화면 진입 (15 프로필에서 진입 시 트리거) | from_screen=profile |
| password_change_attempted | 변경 버튼 클릭 | - |
| password_change_succeeded | 변경 성공 | time_spent |
| password_change_failed | 변경 실패 | error_type (current_password_mismatch / weak_password / api_error / rate_limit) |
| password_change_cancelled | 취소 또는 뒤로가기 | has_input(boolean) |

> `password_change_started` 이벤트는 15_profile.md v1.2의 분석 이벤트와 일관성 유지.

## 9. 접근성

- 모든 input에 `<label>` 또는 aria-label
- 에러 메시지는 aria-describedby로 input과 연결
- 비밀번호 표시 토글은 aria-pressed 속성 사용
- 강도 표시는 aria-live="polite"로 알림
- 비밀번호 입력란에 autocomplete 속성 적절히 사용 (current-password / new-password)
- 키보드만으로 모든 작업 완료 가능

## 10. 성능 목표

- 화면 진입 ~ 인터랙션 가능: 1.0초 이하
- 재인증 응답: p95 800ms 이하
- 변경 응답: p95 1.5초 이하

## 11. 보안 고려사항

- **평문 표시 토글은 사용자가 명시적으로 클릭한 경우에만** 활성화 (기본은 마스킹)
- **클립보드 복사 차단**: 비밀번호 input은 javascript로 복사 방지 처리 (선택)
- **자동완성 노출 최소화**: 현재 비밀번호는 autocomplete="current-password", 새 비밀번호는 autocomplete="new-password"
- **세션 유지**: 변경 성공 후 현재 세션은 유지하여 재로그인 부담 제거
- **다른 디바이스 무효화**: refresh token 자동 무효화로 access token 만료 시 자동 로그아웃됨
- **재인증 필수**: 비밀번호 변경 전 반드시 현재 비밀번호로 재검증 (세션만으로 변경 불가)
- **AI 컨텍스트 격리**: 비밀번호 입력값은 어떤 AI 프롬프트에도 포함되지 않음 (AI 핸드오프 #5 컨텍스트 주입 영역과 완전 분리)

> ⚠️ **schema 검증 (v1.3 — `spec-handoff-frontend.md`, `spec-handoff-ai.md` v0.6 정밀 정렬)**:
>
> **테이블 영역 구분**
> - 비밀번호 데이터는 `auth.users` 테이블에서만 관리 (Supabase Auth 영역)
> - 핸드오프 문서의 9개 비즈니스 테이블(`profiles`, `strength_analyses`, `career_interview_results`, `goals`, `action_items`, `action_completions`, `daily_memos`, `weekly_retros`, `coaching_insights`)에 비밀번호 정보 없음
> - `profiles`는 `auth.users.id`와 1:1 연결되지만 비밀번호 미보유
>
> **OAuth 판별 정확화**
> - `auth.users.app_metadata.providers` (배열)로 판별 — 이메일+Google 동시 가입자는 비밀번호 변경 가능
> - 단일 필드 `provider` 대신 배열 `providers`를 사용해야 정확
>
> **본인 계정 검증 메커니즘**
> - 핸드오프 ⑦항의 RLS는 9개 비즈니스 테이블 조회 시 적용
> - 비밀번호 변경의 본인 계정 검증은 Supabase Auth가 세션 토큰으로 자체 검증 (RLS와 다른 메커니즘)
>
> **자동 관리 항목**
> - `auth.users.updated_at`은 Supabase Auth가 자동 관리 (별도 UPDATE 불필요, 핸드오프의 `is_latest` 트리거와 유사한 자동화)

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.3 | 2026-05-05 | spec-handoff(v0.6) 정밀 정렬: 본인 계정 검증과 RLS 메커니즘 분리 명시 / 9개 비즈니스 테이블 영역과 `auth.users` 영역 구분 강화 / 이메일 출처를 `supabase.auth.getUser()` 단일 경로로 통일 / AI 핸드오프 #5 컨텍스트 주입 영역과 비밀번호 변경의 격리 명시 / `profiles` 테이블이 마이페이지 다른 기능에서는 UPDATE되지만 NEW07과는 무관함을 명확화 |
| v1.2 | 2026-05-05 | spec-handoff(v0.6) 추가 정렬: OAuth 판별을 `app_metadata.provider` → `app_metadata.providers` 배열 검증으로 변경(이메일+OAuth 동시 가입자 대응) / 사용자 이메일은 `supabase.auth.getUser()`로 조회 명시 / 다른 디바이스 로그아웃은 refresh token 무효화 메커니즘으로 정확히 설명 / RLS 원칙 명시(핸드오프 문서 ⑦항과 일관) / `profiles` 테이블이 `auth.users`와 1:1 연결됨을 명시 |
| v1.1 | 2026-05-05 | schema 검증 반영: OAuth 사용자 판별 근거(`auth.users.app_metadata.provider`) 명시 / `auth.users` vs `profiles` 테이블 역할 구분 명확화 / `auth.updateUser` API 명시적 표기 / `password_change_started` 이벤트 추가(15_profile.md와 일관성) / `password_change_failed`의 error_type 세부 분류 추가 |
| v1.0 | 2026-05-05 | 최초 작성 (NEW07 신규 화면) |
