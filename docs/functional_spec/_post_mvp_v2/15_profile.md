# 15. 프로필

> 기준 프로토타입: `home_0520.html` (p15)
> 작성일: 2026-05-18 / 최종 수정: 2026-05-20
> post-mvp 스펙(`_post_mvp/15_profile.md`)과 구조는 유사하나 범위가 다름. 본 문서가 구현 기준.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 15_profile (별칭: 14_profile, feature/12 라우트 `/profile`) |
| 페이즈 | MAINTAIN |
| 역할 | 사용자 정보 조회·수정 + 강점 수정 + 커리어 방향 재설정 + 비밀번호 변경 + 로그아웃/탈퇴 |
| 진입 경로 | 탭바 [프로필] / 04 강점 선택 (?from=profile 저장 완료 시 자동 복귀) |
| 다음 화면 | 04 강점 선택 (`/onboarding/strengths?from=profile`, 강점 수정) / 07 커리어 인터뷰 인트로 (`/onboarding/career-intro`, 재설정 › 인터뷰 다시하기) / 09 역량 추천 결과 (`/onboarding/career-result`, 재설정 › 역량목표 & 액션아이템 다시 설정) / NEW07 비밀번호 변경 (`/profile/password-change`) / 01 랜딩 (로그아웃·탈퇴) |

> **v1.2: ID 별칭 안내** — `_mvp/14_profile.md`와 동일 화면. _post_mvp_v2 문서는 ID 15로 유지(이력 보존), feature/12 코드 라우트는 `/profile` 사용.

---

## 2. 진입 조건

- 로그인 상태 (Supabase 세션 유효)
- 탭바에서 언제든 진입 가능

---

## 3. UI 구성

### 3.1 상단 바 (Topbar)

- 좌측: `CareerPT·` 브랜드
- 우측: `👤 프로필` pill

### 3.2 프로필 히어로 카드 `v1.4 — 아바타 영역 제거`

accent 배경, 22px radius, 중앙 정렬, 흰색 텍스트.

| 요소 | 내용 |
| --- | --- |
| 이름 | `profiles.nickname` (22px, weight 800) |
| 이메일 | `auth.users.email` (12.5px, opacity .85) |
| 배지 행 | `"🔥 {streak_days}일 연속"` + `"{job_field} · {career_level_label}"` |

> v1.4 변경: 아바타(76×76px 원형 이니셜) 영역 제거. 사진 업로드 기능을 도입하지 않기로 결정 → 빈 자리만 차지하는 이니셜 표시를 빼고 이름·이메일·배지로만 구성.
> `streak_days`는 v1에서 정책 미확정. 고정값 표시 또는 미노출 처리.
> `career_level_label`: `junior_new`→"신입", `junior`→"주니어", `senior_mid`→"미드", `senior`→"시니어"

### 3.3 내 강점 Top 5 섹션 `v1.3 — 강점 수정 메뉴 추가`

section-card 스타일 (bg-soft 배경, line 보더, 18px radius).

- 섹션 타이틀: "⭐ 내 강점 Top 5"
- 강점 chip 5개: `strength_analyses.strengths` (is_latest=true) Top 5 테마명
  - 스타일: 흰색 배경, accent 글씨, accent-soft 보더, 999px radius
- **메뉴 아이템 (chip 영역 아래)**: "✏️ 강점 수정" + 서브 "다른 강점 5개로 다시 선택할 수 있어요" → `/onboarding/strengths?from=profile` 이동
  - 04 강점 선택 페이지로 진입 (재선택 흐름)
  - 저장 완료 시 04 페이지가 `?from=profile` 파라미터를 감지해 `/profile`로 복귀
  - 04 진입 시 04 페이지 타이틀이 "강점 선택" → "강점 수정"으로 변경, CTA 버튼이 "다음으로 →" → "강점 수정 저장"으로 변경

### 3.4 커리어 방향 섹션

section-card 스타일.

- 섹션 타이틀: "🎯 커리어 방향"
- 내용:
  - `goals.goal_title` (17px, weight 800, accent 색상)
  - "역량 목표 **{current_week}주차** 진행 중이에요. ✨"
- 메뉴 아이템: "🔄 커리어 방향 재설정" + "언제든 다시 설정할 수 있어요" → 재설정 선택 다이얼로그 (v1.5 3선택지)

> 재설정 진입 시: **재설정 선택 다이얼로그**(`ResetChoiceDialog`, 제목 "커리어 방향을 다시 설정할까요?", 설명 "어디서부터 다시 시작할지 선택하세요.")에서 세로로 쌓인 3개 버튼 중 선택 —
> ① **인터뷰 다시하기** (primary) → 07 커리어 인터뷰 인트로 (`/onboarding/career-intro`) → 08 → 09 → 10 으로 새 사이클.
> ② **역량목표 & 액션아이템 다시 설정하기** (secondary) → 09 역량 추천 결과 (`/onboarding/career-result`) 로 직접 진입, **최신 인터뷰 결과(`career_interview_results`)를 재사용**해 역량 목표만 다시 추천 → 10 액션 아이템까지.
> ③ **취소** → 다이얼로그 닫기.
>
> 기존 `goals.status='abandoned'` UPDATE는 본 화면이 아니라 **09 career-result 확정 시점**에 처리(인터뷰 도중 뒤로가기 시 기존 goal 유실 방지). 따라서 프로필 화면은 네비게이션만 수행하고 goals를 직접 쓰지 않음.

### 3.5 기본 정보 섹션

section-card 스타일.

- 섹션 타이틀 행: "📝 기본 정보" 레이블 + **우측 "수정" 버튼** (999px radius, line-strong 보더, 12px, ink-mute)

**보기 모드 (기본)**

| 항목 | 데이터 |
| --- | --- |
| 닉네임 | `profiles.nickname` |
| 직업/분야 | `profiles.job_field` |
| 경력 | `profiles.career_level` → 한글 레이블 변환 |

**편집 모드** (수정 버튼 탭 시 토글, 섹션 내 인라인 표시)
- 상단에 1px line 보더로 구분
- 닉네임: 텍스트 input (현재값 pre-fill)
- 직업/분야: 텍스트 input (현재값 pre-fill)
- 경력: select (옵션: "1~3년차", "5년차 (4~7년)", "8년차 이상")
- 버튼 행: "취소" (bg-soft, line-strong 보더, flex:1) + "저장하기" (accent 배경, flex:2)
- 저장하기 탭: `profiles` UPDATE → 보기 모드로 전환 + 버튼 텍스트 "수정"으로 복원
- 취소 탭: 입력값 원래 값으로 리셋 → 보기 모드로 전환

### 3.6 설정 섹션

section-card 스타일.

- 섹션 타이틀: "⚙️ 설정"
- 메뉴 아이템: "🔒 비밀번호 변경" → `nav('pNEW07')` → NEW07 비밀번호 변경 화면으로 이동

### 3.7 계정 관리 (Danger Zone)

section-card 스타일 (border 없음, 버튼만).

- "🚪 로그아웃" 버튼: 확인 다이얼로그 → `supabase.auth.signOut()` → 01 랜딩
- "⚠️ 회원 탈퇴" 버튼 (opacity .65): 확인 다이얼로그(2단계) → 데이터 삭제 → 01 랜딩

> **v1.2 feature/12 구현 상태 — 회원 탈퇴:**
> MVP는 `supabase.auth.signOut()`만 수행 + `/`로 이동. 실제 데이터 삭제(`profiles`, 관련 row, `supabase.auth.admin.deleteUser`)는 서버 admin API 권한이 필요해 미구현.
> 코드에 `TODO: 서버 라우트 /api/account/delete` 마커. Post-MVP에서 처리.

### 3.8 하단

- "CareerPT v0.1.0" 버전 표시 (11px, ink-mute, 중앙 정렬)

### 3.9 탭바

홈 / 회고 / 프로필(active) — 3탭.

---

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 화면 진입 | `profiles`, `strength_analyses`(is_latest), `goals`(active) 조회 후 렌더링 |
| 기본 정보 수정 | "수정" 버튼 탭 → 인라인 편집 모드 진입. "저장하기" 탭 → `profiles` UPDATE → 보기 모드 복귀. "취소" → 원래 값 리셋 후 보기 모드 복귀 |
| 커리어 방향 재설정 | 재설정 선택 다이얼로그(3선택지) → ① 인터뷰 다시하기 `/onboarding/career-intro`(07) / ② 역량목표 & 액션아이템 다시 설정하기 `/onboarding/career-result`(09, 최신 인터뷰 재사용) / ③ 취소. 본 화면은 네비게이션만 수행하며 `goals` 직접 쓰기 없음(`status='abandoned'`는 09 확정 시 처리) |
| 비밀번호 변경 | "🔒 비밀번호 변경" 탭 → NEW07 화면으로 이동 |
| 로그아웃 | 확인 다이얼로그 → `supabase.auth.signOut()` → `/` (랜딩) |
| 회원 탈퇴 | 확인 다이얼로그(2단계) → `profiles` 및 관련 데이터 삭제 → `deleteUser()` → `/` |

---

## 5. 데이터

### 5.1 읽기

| 테이블 | 필드 | 용도 |
| --- | --- | --- |
| `profiles` | `nickname`, `job_field`, `career_level` | 히어로 카드, 기본 정보 섹션 |
| `auth.users` | `email` | 히어로 카드 이메일 |
| `strength_analyses` (is_latest=true) | `strengths` JSONB | 강점 Top 5 chip |
| `goals` (status='active') | `goal_title`, `current_week` | 커리어 방향 섹션 |

### 5.2 쓰기

| 테이블/API | 동작 | 시점 |
| --- | --- | --- |
| `profiles` | UPDATE (nickname, job_field, career_level) | 기본 정보 "저장하기" 탭 |
| `supabase.auth.signOut()` | 세션 종료 | 로그아웃 |
| 관련 테이블 전체 | DELETE | 회원 탈퇴 |
| `supabase.auth.deleteUser()` | 계정 삭제 | 회원 탈퇴 |

---

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| `strength_analyses` 없음 | 강점 섹션 "아직 분석된 강점이 없어요" 표시 |
| `goals` active 없음 | 커리어 방향 섹션 "아직 설정된 커리어 방향이 없어요" 표시 |
| 기본 정보 저장 실패 | 토스트 "저장에 실패했어요. 다시 시도해주세요" |
| 닉네임 빈 값으로 저장 시도 | 닉네임 input 포커스 유지, 저장 안 함 |
| 로그아웃 실패 | 로컬 세션 강제 폐기 후 `/` 이동 |
| 회원 탈퇴 실패 | 토스트 "탈퇴 처리 중 오류가 발생했어요. 다시 시도해주세요" |

---

## 7. 미결 사항 (Post-MVP)

| 항목 | 내용 |
| --- | --- |
| 알림 설정 | NEW04 화면으로 이동 |
| streak_days 배지 | 갱신 정책 확정 후 표시 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.0 | 2026-05-18 | home_0518.html p15 기준으로 최초 작성. 정보 수정·비밀번호 변경·알림 설정 Post-MVP로 명시. 읽기 전용 기본 정보 표시만 구현 범위에 포함. |
| v1.1 | 2026-05-20 | **[HTML 미반영 항목 반영 + Post-MVP 승격]** **1.** 역할에 "사용자 정보 수정" 추가. 다음 화면에 "NEW07 비밀번호 변경" 추가. **3.5** 기본 정보 섹션을 읽기 전용에서 인라인 편집 모드 포함으로 전면 개정 — "수정" 버튼, 편집 모드 UI(input·select·취소/저장하기 버튼), 토글 동작 상세 명시. **3.6** 비밀번호 변경을 "준비 중 토스트"에서 NEW07 화면 이동으로 변경. **4.** 기본 정보 수정·비밀번호 변경 기능 행 추가. **5.2** `profiles` UPDATE 쓰기 항목 추가. **6.** 기본 정보 저장 실패·닉네임 빈 값 예외 처리 추가. **7.** "기본 정보 수정", "비밀번호 변경" Post-MVP 항목 제거 (MVP 구현으로 승격). |
| v1.2 | 2026-05-21 | **[feature/12 구현 반영]** **1.** 화면 ID에 별칭 `14_profile` 표기 (라우트 `/profile`). _mvp/14_profile.md와 동일 화면이고 _post_mvp_v2 문서는 ID 15로 이력 보존. **3.7** 회원 탈퇴 — MVP는 `signOut`만 수행, 실제 데이터 삭제는 서버 admin API 권한 필요로 미구현 (TODO 마커). Post-MVP로 분류. |
| v1.3 | 2026-05-23 | **[강점 수정 기능 추가]** **1.** 역할에 "강점 수정" 추가. 진입 경로에 "04 강점 선택 ?from=profile 저장 완료 시 자동 복귀" 추가, 다음 화면에 "04 강점 선택 (`/onboarding/strengths?from=profile`)" 추가. **3.3** 내 강점 Top 5 섹션 — chip 영역 아래에 "✏️ 강점 수정" 메뉴 아이템 신규 추가. 클릭 시 `/onboarding/strengths?from=profile`로 이동. 04 페이지는 `from=profile` 파라미터를 감지해 저장 완료 시 `/profile`로 자동 복귀하고, 페이지 타이틀 + CTA 버튼 라벨을 컨텍스트에 맞게 변경. |
| v1.4 | 2026-05-24 | **[히어로 카드 아바타 제거]** **3.2** 프로필 히어로 카드에서 76×76px 이니셜 아바타 영역 제거. 사진 업로드 기능을 도입하지 않기로 결정 → 빈 자리만 차지하는 이니셜 표시를 제거하고 이름·이메일·배지 행으로만 구성. |
| v1.5 | 2026-06-06 | **[커리어 방향 재설정 — 단일 → 3선택지 다이얼로그 + abandon 시점 정정]** 기존엔 재설정 클릭 시 확인 다이얼로그 하나로 곧장 07 인터뷰 인트로로 이동했으나, **3개 선택지 다이얼로그(`ResetChoiceDialog`)**로 확장. ① **인터뷰 다시하기** → 07 `/onboarding/career-intro`, ② **역량목표 & 액션아이템 다시 설정하기** → 09 `/onboarding/career-result`(최신 인터뷰 결과 재사용해 역량 목표만 다시 추천), ③ **취소**. **§1 다음 화면**에 09 추가, **§3.4** 메뉴 서브타이틀 "언제든 다시 인터뷰할 수 있어요" → "언제든 다시 설정할 수 있어요", 재설정 진입 설명을 3선택지로 개정. **§4 기능 표 / §5.2 쓰기 표 정정** — 프로필 화면은 더 이상 `goals`를 직접 쓰지 않음. 기존 사이클 중단(`goals.status='abandoned'`) UPDATE는 **09 career-result 확정 시점**에 처리됨(인터뷰 도중 뒤로가기 시 기존 goal 유실 방지)을 반영해 5.2 쓰기 표에서 `goals` 행 제거. UI 정리: 미사용 `resetting` state 제거, 다이얼로그 버튼 세로 스택 스타일 추가. |
