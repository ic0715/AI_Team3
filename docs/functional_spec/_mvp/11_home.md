# 11. 홈 (MVP 결과 요약)

> 강점 선택 → 커리어 인터뷰 → 액션 선택까지 완료한 사용자에게 결과 요약을 보여주는 **MVP 종착점 화면**.

> ⚠️ **풀 스펙 vs MVP 구분**
> - **풀 스펙의 11 홈**은 "12주 코칭 대시보드"로, 타임라인·오늘의 액션·회고 트래커·탭바 네비게이션(12·14·15) 등을 포함한 메인 허브 (00_flow.md §0 참조).
> - **본 문서는 MVP 단순화 버전**으로, 12주 대시보드 기능은 Post-MVP로 보류하고 단순 결과 요약 화면만 정의한다.
> - 향후 풀 스펙 11 홈(12주 대시보드) 구현 시 본 화면은 (a) MVP 완료 직후 1회성 안내 카드로 흡수되거나, (b) 별도 진입점("결과 요약 보기")으로 유지되거나, (c) 폐지된다. **처분 정책은 Post-MVP에서 결정**.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 11_home (MVP 버전) |
| 페이즈 | MAINTAIN (MVP 종착점) |
| 역할 | 강점·커리어 방향·첫 액션 요약 표시, MVP 종착점 역할 |
| 진입 경로 | NEW02 [홈으로 가기 →] 클릭 / 사용자 상태 기반 라우팅(MVP 완료자 재방문) |
| 다음 화면 | (재시작 CTA로 04 강점 선택, 또는 동일 화면에 머무름) |

---

## 2. 진입 조건

본 화면은 MVP 흐름의 모든 INSERT가 끝난 사용자에게 노출.

- `profiles.profile_completed = true`
- `strength_analyses` (is_latest=true) 존재
- `goals` (status='active') 존재
- `action_items` (week_number=1) 1개 이상 존재

> 위 조건이 모두 충족된 사용자(MVP 완료자)가 재로그인 시에도 본 화면으로 라우팅. 00_flow.md §9.3의 "MVP 완료자 → NEW02 또는 01 랜딩" 처분은 **본 v1.0에서 11 홈으로 일원화**.

---

## 3. UI 구성

### 3.1 상단 바 (topbar)

- 좌측: **"CareerPT·"** 브랜드 (작은 dot accent 색상 강조)
- 우측: **"✅ 완료"** 상태 pill (accent-tint 배경, accent 색상, 작은 글씨)
- 뒤로가기 없음 (종착점)
- 배경: bg(연한 회색) + backdrop-filter blur

### 3.2 인사 영역

- 메인 인사: **"안녕하세요, [닉네임]님 👋"**
  - 닉네임은 accent 색상, 나머지는 ink 색상
  - 폰트: 24px, weight 800
  - 닉네임은 `profiles.nickname` 사용. 없으면 "안녕하세요 👋" fallback
- 서브 메시지: **"커리어 방향 설정이 완료되었어요!"** (작은 글씨, 회색)

### 3.3 커리어 방향 요약 카드 (그라데이션)

- 배경: 선형 그라데이션 (`#1e3a8a → #2D5BFF`, 135deg)
- 보더 라디우스: 20px
- 우측 상단 장식: 반투명 흰색 원 (overflow hidden)
- 라벨: **"🎯 나의 커리어 방향"** (uppercase, 작은 글씨, 80% opacity)
- 메인 타이틀: `"[goals.goal_title]"` (큰 따옴표 포함, 19px, weight 800, 흰색)
  - 예: `"비판적 사고 기르기"`
- 강점 칩 행: Top 5 강점 (반투명 흰색 chip, `rgba(255,255,255,.18)` 배경)
  - 강점명은 `strength_analyses.strengths` (is_latest=true) Top 5
  - 단순 번호 표기, 순위 강조 없음 (Option B 정합)

### 3.4 첫 번째 액션 카드

- 배경: accent-tint (연한 파랑)
- 보더: accent-soft (1.5px)
- 라디우스: 16px
- 라벨: **"✅ 첫 번째 액션"** (uppercase, accent 색상, 작은 글씨)
- 메인 타이틀: `action_items.title` (week_number=1, 첫 항목)
  - 예: "TED 강연 1개 보고 핵심 논지와 근거 분석하기"
  - 폰트: 15px, weight 700
- 격려 카피: **"매일 작은 실행이 커리어를 바꿔요 💪"** (12px, 회색)

### 3.5 정보 행 (2-column grid)

- 좌측 카드: **"📅 시작일"** + `goals.started_at` (YYYY.MM.DD)
- 우측 카드: **"🏁 종료일"** + `started_at + 83일` (YYYY.MM.DD)
- 카드 스타일: surface 배경, border 1.5px, 라디우스 12px

### 3.6 안내 메시지

- 배경: bg(연한 회색), 라디우스 12px
- 텍스트: **"💡 강점과 커리어 방향을 바탕으로 액션 아이템이 설계되었어요. 꾸준한 실행으로 원하는 커리어를 만들어가세요!"**
- 폰트: 13px, line-height 1.7

### 3.7 재시작 CTA

- 텍스트: **"🔄 처음부터 다시 분석하기"**
- 스타일: outline 버튼 (surface 배경, border-strong 1.5px, 회색 글씨)
- 동작: 클릭 시 04 강점 선택으로 이동
- 위치: 안내 메시지 아래, 페이지 하단

> ⚠️ **미결 — 재시작 시 데이터 처리 정책**: 클릭 시 기존 `goals` (active) / `action_items` / `strength_analyses` 데이터 처리 방식이 미정. 옵션은 다음 9번 항목 참조.

---

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 화면 진입 | `profiles`, `goals`, `action_items`, `strength_analyses` 읽어 카드 구성 |
| 닉네임 표시 | `profiles.nickname` 표시. 없으면 fallback |
| 종료일 계산 | `goals.started_at` + 83일 (12주 후) |
| 재시작 CTA 클릭 | 04 강점 선택 화면으로 이동. **기존 데이터 처리 정책은 9번 미결 참조** |

---

## 5. 데이터

### 5.1 읽기

| 테이블 | 필드 | 용도 |
| --- | --- | --- |
| `profiles` | `nickname` | 인사 영역 표시 |
| `strength_analyses` (is_latest=true) | `strengths` (JSONB) | 강점 5개 chip 표시 |
| `goals` (status='active') | `goal_title`, `started_at`, `competency_code`, `domain` | 커리어 방향 카드 + 일정 그리드 |
| `action_items` (week_number=1) | `title` (첫 항목) | 첫 번째 액션 카드 |

### 5.2 쓰기

- 본 화면 자체에서는 쓰기 없음
- 재시작 CTA 클릭 시 04로 이동하며 발생하는 쓰기는 9번 미결 정책에 따름

---

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| `profiles.nickname` 없음 | "안녕하세요 👋" fallback |
| 활성 `goals` 없음 | (진입 조건 위반) NEW06 일반 오류 화면으로 라우팅 |
| `action_items` (week_number=1) 없음 | 액션 카드 placeholder "액션이 설정되지 않았어요" 표시 + 10으로 이동 가이드 |
| `strength_analyses` 없음 | 강점 chip 영역 미노출 (그라데이션 카드의 목표 타이틀만 표시) |
| `started_at` 없음 | 일정 그리드에 "—" 표시 |
| 네트워크 오류 | NEW05 네트워크 오류 화면 |
| 재시작 CTA 중복 클릭 | 첫 클릭 시 disabled |

---

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `mvp_home_view` | `goal_title`, `competency_code`, `days_since_start`, `entry_source` (new02/relogin) |
| `mvp_home_restart_clicked` | `time_since_start`, `competency_code` |

---

## 8. 접근성

- 그라데이션 카드 텍스트(흰색) ↔ 진한 파랑 배경 명도 대비 4.5:1 이상 검증 필요
- 강점 chip 그룹은 `role="list"` + 각 chip `role="listitem"`
- 닉네임 변수 부분은 일반 텍스트로 처리 (스크린 리더가 자연스럽게 읽도록)
- 재시작 CTA는 명확한 포커스 인디케이터 + `aria-label="처음부터 다시 분석하기 — 강점 선택 화면으로 돌아갑니다"`
- 종료일 표시는 `<time datetime="YYYY-MM-DD">` 시맨틱 마크업

---

## 9. 미결 사항

| 항목 | 내용 | 우선순위 |
| --- | --- | --- |
| **재시작 CTA 동작 정책** | 04 이동 시 기존 `goals` (active) / `action_items` 처리 방식. 옵션: (a) 기존 goal을 `status='abandoned'`로 변경 후 새 사이클 / (b) 그대로 두고 새 strength_analyses만 INSERT (기존 active goal과 충돌 처리 필요) / (c) 전체 리셋 (강점·인터뷰·액션 모두 비활성화) | 🟡 다음 사이클 |
| **재방문 진입점 일원화** | 00_flow.md §9.3은 "MVP 완료자 → NEW02 또는 01 랜딩"이지만 본 v1.0에서 11 홈으로 통일. 00_flow.md §9.3 표 갱신 필요 | 🟡 다음 사이클 |
| **풀 스펙 11과의 관계** | 풀 스펙 11(12주 대시보드) 구현 시 본 화면의 처분 — 흡수 / 별도 유지 / 폐지 | 🟢 Post-MVP |
| **종료일 의미** | `started_at + 83일`을 "종료일"로 표시하지만 MVP에는 12주 대시보드/완주 로직 부재. 단순 표기인지 실제 종료 처리 시점인지 명확화 필요 | 🟢 Post-MVP |

---

## 10. 참고

- 프로토타입 v4 (`_Pivoted_CareerPT_prototype_v4_0511.html`, p11 페이지)
- 00_flow.md v1.10 §9 MVP 플로우

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.0 | 2026-05-11 | **최초 작성**. 프로토타입 v4(2026-05-11) p11 화면 기반. MVP 단순화 버전으로 정의 (풀 스펙 11 홈 12주 대시보드와 명확히 구분). 진입 조건·UI 구성 7개 영역(상단바·인사·요약카드·액션카드·정보행·안내메시지·재시작CTA)·데이터·예외처리·분석이벤트·접근성·미결사항 4건 명세. 00_flow.md §9.3 "MVP 완료자 → NEW02 또는 01 랜딩" 결정은 본 문서에서 11 홈으로 일원화 (00_flow.md 갱신 필요 미결로 명시). |
