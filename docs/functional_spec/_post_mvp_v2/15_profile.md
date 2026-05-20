# 15. 프로필

> 기준 프로토타입: `home_0520.html` (p15)
> 작성일: 2026-05-18 / 최종 수정: 2026-05-20
> post-mvp 스펙(`_post_mvp/15_profile.md`)과 구조는 유사하나 범위가 다름. 본 문서가 구현 기준.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 15_profile |
| 페이즈 | MAINTAIN |
| 역할 | 사용자 정보 조회·수정 + 강점/커리어 방향 확인 + 비밀번호 변경 + 로그아웃/탈퇴 |
| 진입 경로 | 탭바 [프로필] |
| 다음 화면 | 07 커리어 인터뷰 인트로 (커리어 방향 재설정) / NEW07 비밀번호 변경 / 01 랜딩 (로그아웃·탈퇴) |

---

## 2. 진입 조건

- 로그인 상태 (Supabase 세션 유효)
- 탭바에서 언제든 진입 가능

---

## 3. UI 구성

### 3.1 상단 바 (Topbar)

- 좌측: `CareerPT·` 브랜드
- 우측: `👤 프로필` pill

### 3.2 프로필 히어로 카드

accent 배경, 22px radius, 중앙 정렬, 흰색 텍스트.

| 요소 | 내용 |
| --- | --- |
| 아바타 | 76×76px 원형, 반투명 흰색 배경, 이니셜 이모지 표시 |
| 이름 | `profiles.nickname` (22px, weight 800) |
| 이메일 | `auth.users.email` (12.5px, opacity .85) |
| 배지 행 | `"🔥 {streak_days}일 연속"` + `"{job_field} · {career_level_label}"` |

> `streak_days`는 v1에서 정책 미확정. 고정값 표시 또는 미노출 처리.
> `career_level_label`: `junior_new`→"신입", `junior`→"주니어", `senior_mid`→"미드", `senior`→"시니어"

### 3.3 내 강점 Top 5 섹션

section-card 스타일 (bg-soft 배경, line 보더, 18px radius).

- 섹션 타이틀: "⭐ 내 강점 Top 5"
- 강점 chip 5개: `strength_analyses.strengths` (is_latest=true) Top 5 테마명
  - 스타일: 흰색 배경, accent 글씨, accent-soft 보더, 999px radius

### 3.4 커리어 방향 섹션

section-card 스타일.

- 섹션 타이틀: "🎯 커리어 방향"
- 내용:
  - `goals.goal_title` (17px, weight 800, accent 색상)
  - "역량 목표 **{current_week}주차** 진행 중이에요. ✨"
- 메뉴 아이템: "🔄 커리어 방향 재설정" + "언제든 다시 인터뷰할 수 있어요" → 07 커리어 인터뷰 인트로

> 재설정 진입 시: 확인 다이얼로그 → 기존 `goals.status='abandoned'` UPDATE → 07로 이동.

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
- "⚠️ 회원 탈퇴" 버튼 (opacity .65): 확인 다이얼로그 → 데이터 삭제 → 01 랜딩

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
| 커리어 방향 재설정 | 확인 다이얼로그 → `goals.status='abandoned'` UPDATE → `/onboarding/career-intro` |
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
| `goals` | `status='abandoned'` UPDATE | 커리어 방향 재설정 확인 |
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
