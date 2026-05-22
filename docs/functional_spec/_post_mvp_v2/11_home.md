# 11. 홈 (12주 코칭 대시보드)

> 기준 프로토타입: `home_0520.html` (p11)
> 작성일: 2026-05-18 / 최종 수정: 2026-05-20
> post-mvp 스펙(`_post_mvp/11_home.md`)과 구조는 유사하나 범위가 다름. 본 문서가 구현 기준.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 11_home |
| 페이즈 | MAINTAIN |
| 역할 | 12주 코칭 현황 확인 + 오늘의 액션 체크 + 12주 타임라인 조회 |
| 진입 경로 | NEW02 [홈으로 가기 →] / 탭바 [홈] / 재로그인 시 라우팅 |
| 다음 화면 | 12 회고 (탭바 / 타임라인 [회고하기] 버튼 / 메모 유도 카드) / 15 프로필 (탭바) |

---

## 2. 진입 조건

- `goals` 테이블에 `status='active'` 목표가 존재
- `action_items` (week_number = current_week) 존재
- 없으면 `/onboarding/action-items`로 리다이렉트

---

## 3. UI 구성

### 3.1 상단 바 (Topbar)

- 좌측: `CareerPT·` 브랜드 (dot accent 색상)
- 우측: `🏠 홈` pill (step-pill 스타일)
- sticky, blur 배경

### 3.2 인사 영역

- 메인: `"안녕하세요, {nickname}님 👋"` — nickname accent 색상, 26px weight 800
- 서브: `"{요일} · {월} {일} · {current_week}주차 진행 중 ✨"` — 13px, ink-mute, current_week는 accent 색상 bold

데이터: `profiles.nickname`, `goals.current_week`, 현재 날짜

### 3.3 커리어 방향 카드 (theme-card)

배경: **solid `var(--accent)`** (`#2D5BFF`) — 14 프로필 히어로 카드와 동일 톤으로 디자인 통일.
~~기존: 그라데이션 (135deg, `#2a3f8f → #3a4fa0 → #4a5fc0`) — v1.2에서 변경됨~~
흰색 텍스트, 우상단·우하단 반투명 흰색 원형 장식, accent 글로우 그림자.

| 요소 | 내용 |
| --- | --- |
| label | "나의 커리어 방향" (uppercase, 11px, opacity .65) |
| 메인 타이틀 | `"goals.goal_title"` (큰따옴표 포함, 22px, weight 800) |
| 진행 배지 | `{current_week}주차 / 12주` (반투명 흰색 pill) |
| 진행 바 | 가로 progress bar, 너비 = `(current_week / 12) * 100%` |
| 진행률 텍스트 | `{Math.round((current_week/12)*100)}%` |
| 설명 문구 | "하나의 역량은 단기간에 만들어지지 않아요. 강점을 기반으로 작은 행동을 반복하고 회고하며, 나만의 방식으로 체화하는 과정이 필요해요. 하나의 역량 목표는 12주 동안 집중해보는 것을 권장합니다." (10px, opacity .5) |
| 주차 도트 트랙 | 12개 dot. 완료(current_week 미만) = 흰색(`rgba(255,255,255,.85)`), 현재 = 노란색(`#fbbf24` + glow), 미래 = 반투명(`rgba(255,255,255,.18)`) |

데이터: `goals.goal_title`, `goals.current_week`

### 3.4 오늘의 액션 카드 (today-card)

accent-tint 배경, accent 2px 보더, 18px radius.

| 요소 | 내용 |
| --- | --- |
| 헤더 좌 | `"⭐ 오늘의 액션 · {요일}요일"` (accent, 12px, weight 700) |
| 헤더 우 | `"이번 주 {doneCount}/7"` (ink-mute, 13px) |
| 액션 텍스트 | `action_items.title` (17px, weight 500, line-height 1.4) |
| 7일 그리드 | 월~일 7칸. 완료 = done(accent-soft 배경 + accent 보더), 오늘 = today(흰색 + accent 보더 1.5px), 미래 = future(opacity .4, 클릭 불가) |
| 체크 안내 문구 | 그리드 하단. 미완료: `"실행한 요일에 체크해주세요 ✅"` (12px, ink-mute, weight 500) / 완료: `"🎉 오늘 완료했어요!"` (12px, accent, weight 700). `aria-live="polite"` |

> ~~완료 토글 버튼(큰 버튼)~~ **v1.3에서 제거** — 요일 그리드 하단 작은 안내 문구로 대체. 레이아웃 순서: 액션 텍스트 → 7일 그리드 → 체크 안내 문구.

인터랙션:
- 요일 탭 → 해당 날 완료 체크/해제 (`action_completions` INSERT/DELETE)
- 과거 날짜 탭 → 해당 날 완료 체크/해제 (오늘 이전만 가능)
- 미래 날짜 탭 → 무시 (이벤트 차단)

### 3.5 메모 유도 알림 카드

`#fef9e7` 배경, `#fde68a` 보더, 14px radius.

- 상단 행: 💌 아이콘(22px) + "오늘의 메모, 짧게라도 남겨볼까요? ✏️" (bold) + "주말에 코치와 마감 회고를 할 때 컨텍스트가 돼요."
- 하단: "회고하기 →" 버튼 (ink 배경, 흰색, 전체 너비, 10px border-radius)
- 카드 전체 탭 또는 버튼 탭 시 → 12 회고(평일 모드)로 이동

### 3.6 12주 타임라인

섹션 타이틀: "🗺️ 12주의 여정" (13px, weight 700, margin-top 24px)

좌측 주차 컬럼(dot + W{n} label) + 우측 카드로 구성되는 vertical timeline. 주차 상태별 3가지 형태:

**done (완료된 과거 주차)**
- dot: accent-soft 배경, accent 보더, accent-deep 글씨
- 카드: `#f5f7fa` 배경
- 내용:
  - 상단: `"완료 · {completed}{badge} {comment}"` — completed는 "7/7회" 형식, badge는 성과 이모지(예: 🔥 = 전체 완료, 👍 = 부분 완료), comment는 짧은 격려 문구(accent-deep, 11px, weight 600)
  - 액션명 (bold 700, 16px)
  - 강점 chip (accent-soft 배경, accent-deep 글씨, 999px pill, 10px) — `coaching_insights.strength_link` 기반, 복수 chip 지원

**current (이번 주차)**
- dot: accent 배경, 흰색 글씨, 38×38px, accent-tint glow(box-shadow 4px)
- 카드: accent-tint 배경, accent 1.5px 보더, box-shadow
- 내용:
  - 상태 레이블: `"이번 주 · 진행 중 ({doneCount}/7)"` (uppercase, 10px, accent, weight 600)
  - 액션명 (16px, weight 500)
  - 7일 체크 인디케이터 (월~일 한 줄, height 24px, done/today/일반 구분)
  - ~~이번 주 메모 요약~~ **v1.2 제거** — 회고 진입은 3.5 메모 유도 카드의 [회고하기 →] 버튼으로 일원화
  - ~~"회고하기" 버튼~~ **v1.2 제거** — 동일 사유

**future (미래 주차)**
- dot: 흰색 배경, 점선 보더, line-strong 글씨
- 카드: 투명 배경, 점선 보더, ink-mute 글씨
- 일반 주차: `"🌱 코치와 함께 정해요"` (13px)
- 마일스톤 주차(W6, W12): 마일스톤 제목(accent, weight 600) + 설명 문구(11px, ink-soft, line-height 1.65)
  - W6: `"🎯 중간 회고"` + `"절반을 지나왔어요 🎉 지금까지의 행동 패턴을 한 번 돌아보는 회고를 권장해요. 작은 발견들이 쌓여 강점이 선명해져요."`
  - W12: `"🏆 12주 통합 회고"` + `"12주가 끝났어요. 강점이 어떻게 달라졌는지, 어떤 순간에 에너지가 올랐는지 돌아보는 통합 회고를 권장해요. 다음 사이클이 더 선명해질 거예요."`

### 3.7 탭바

홈(active) / 회고 / 프로필 — 3탭 고정.

레이아웃 구현: wrapper(`height: 100dvh; overflow: hidden; display: flex; flex-direction: column`) 기준으로 탭바는 `flex-shrink: 0`으로 항상 하단 고정. 콘텐츠 영역(`flex: 1; overflow-y: auto`)만 스크롤됨. 회고·프로필 페이지도 동일한 구조 적용.

> ~~sticky bottom~~ **v1.3에서 변경** — flex column 구조의 `flexShrink: 0` 방식으로 전환. 스크롤 시 콘텐츠만 올라가고 탭바는 항상 고정됨.

---

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 화면 진입 | `goals`, `action_items`, `action_completions`, `profiles`, `daily_memos`, `coaching_insights` 조회 후 렌더링 |
| 오늘 체크 토글 | `action_completions` INSERT(완료) / DELETE(미완료). 낙관적 업데이트 |
| 과거 날짜 체크 | 오늘 이전 날짜만 가능. 오늘 초과 탭은 무시 |
| 주차 도트 트랙 | `current_week` 기준으로 done/current/future 렌더링 |
| 타임라인 done 카드 | `coaching_insights` 기반 액션명·강점chip·완료율·badge·comment 렌더링 |
| 타임라인 current 카드 메모 요약 | `daily_memos` (이번 주, 최대 2개) 미리보기. "+N개 더 보기 →" 탭 시 p12 이동 |
| [회고하기] 버튼 | 12 회고로 이동 |
| 메모 유도 카드 [회고하기 →] 버튼 | 12 회고(평일 모드)로 이동 |
| 탭바 | 탭 클릭 시 해당 페이지로 이동 |

---

## 5. 데이터

### 5.1 읽기

| 테이블 | 필드 | 용도 |
| --- | --- | --- |
| `profiles` | `nickname` | 인사 영역 |
| `goals` (status='active') | `goal_title`, `current_week`, `competency_code` | 커리어 방향 카드, 진행 바, 인사 서브 |
| `action_items` (week_number=current_week) | `title` | 오늘의 액션 텍스트, 타임라인 current 카드 |
| `action_completions` (이번 주) | `completed_date` | 7일 그리드, doneCount, 타임라인 current 체크 인디케이터 |
| `coaching_insights` (goal_id, week_number < current_week) | `week_number`, `next_action_title`, `strength_link`, **`badge`**, **`comment`** (schema v0.8) | 타임라인 done 카드 액션명·강점chip·이모지 배지·코멘트 |
| `action_items` (week_number=current_week) | **`strength_link`** (schema v0.8) | 오늘의 액션 카드 "강점 「○○」을 발휘하는 시간" 표시 |
| ~~`daily_memos` (이번 주)~~ | ~~`content`, `memo_date`~~ | **v1.2 제거** — 타임라인 current 카드 메모 요약 미노출에 따라 홈 화면에서 읽기 불필요 |

### 5.2 쓰기

| 테이블 | 동작 | 시점 |
| --- | --- | --- |
| `action_completions` | INSERT | 오늘 또는 과거 날짜 체크 완료 |
| `action_completions` | DELETE | 오늘 또는 과거 날짜 체크 해제 |

> 과거 날짜 체크는 해당 날짜의 `completed_date`로 INSERT/DELETE.

---

## 6. 타임라인 데이터 구조

| 주차 상태 | 데이터 소스 |
| --- | --- |
| done | `coaching_insights` (해당 week_number) — next_action_title, strength_link, 완료율(completion_count/target_count) |
| current | `action_items` (current_week) + `action_completions` + `daily_memos` |
| future | 정적 ("🌱 코치와 함께 정해요") / W6·W12는 앱 상수 마일스톤 제목 + 설명 문구 |

**done 카드 badge 로직 (앱 상수 기준):**

| 완료율 | badge 이모지 | comment 문구 |
| --- | --- | --- |
| 7/7 (100%) | 🔥 | "완벽한 한 주!" |
| 5~6/7 | 👍 | "꾸준함이 쌓이고 있어요" |
| 3~4/7 | 😊 | "절반을 해냈어요" |
| 0~2/7 | 🌱 | "다음 주를 기대해요" |

> done 주차에 `coaching_insights`가 없으면 (회고 미진행) "회고 미완료" 상태로 표시.

---

## 7. 예외 처리

| 상황 | 처리 |
| --- | --- |
| active goals 없음 | `/onboarding/action-items`로 리다이렉트 |
| current_week의 action_items 없음 | 스켈레톤 → AI 생성 API 호출 (Post-MVP) / MVP에서는 fallback 문구 표시 |
| `profiles.nickname` 없음 | "안녕하세요 👋" fallback |
| 체크 토글 저장 실패 | 낙관적 업데이트 롤백 + 토스트 |
| 미래 날짜 체크 시도 | 무시 (이벤트 차단) |
| done 주차 `coaching_insights` 없음 | "회고 미완료" 표시 (badge/comment 없음) |

---

## 8. 미결 사항 (Post-MVP)

| 항목 | 내용 |
| --- | --- |
| 주차 자동 전환 | 매주 월요일 자정 `goals.current_week +1` 처리 |
| done 카드 완료율 | `action_completions` 기반 실제 집계. MVP에서는 `coaching_insights` 저장값 표시 |
| 메모 알림 카드 조건부 노출 | 오늘 메모 작성 여부에 따라 조건부 노출 (MVP는 항상 노출) |
| 13 회고 코칭 진입 버튼 | 타임라인 done 카드에서 "코칭 보기" 버튼 추가 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.0 | 2026-05-18 | home_0518.html p11 기준으로 최초 작성. post-mvp 스펙과 분리된 구현 기준 문서. |
| v1.1 | 2026-05-20 | **[HTML 미반영 항목 반영]** **3.4** 메모 유도 카드 내 "회고하기 →" 버튼 존재 및 동작 명시. **3.5(→3.5)** 메모 유도 카드 상세 UI(배경색, 보더, 버튼 스타일) 추가. **3.6** 타임라인 done 카드 badge 형식(이모지 + comment 문구) 상세 정의. 마일스톤 주차(W6·W12) 전체 설명 문구 명시. current 카드 메모 요약 "+N개 더 보기 →" 동작 명시. **5.1** coaching_insights 읽기 항목 추가(completion_count, target_count). **6.** done 카드 badge 로직 테이블 신규 추가. **7.** done 주차 coaching_insights 없는 경우 예외 처리 추가. |
| v1.3 | 2026-05-22 | **[TodayCard 레이아웃 변경 + GNB 고정 구조 변경]** **3.4** 완료 토글 큰 버튼 제거 → 요일 그리드 하단 작은 안내 문구로 대체. 레이아웃 순서: 액션 텍스트 → 7일 그리드 → 체크 안내 문구. 미완료: `"실행한 요일에 체크해주세요 ✅"` / 완료: `"🎉 오늘 완료했어요!"`. **3.7** 탭바 구현 방식: `sticky bottom` → `flexShrink: 0` (flex column 구조). 회고·프로필 페이지도 동일 구조 적용. wrapper `height: 100dvh + overflow: hidden`, 콘텐츠 영역 `flex: 1 + overflow-y: auto`. |
| v1.2 | 2026-05-21 | **[feature/12 구현 반영 + 디자인 통일 + schema v0.8 정합]** **3.3** 커리어 방향 카드 배경 그라데이션 → **solid `var(--accent)`** 변경 (14 프로필 히어로 카드와 동일 톤, 디자인 일관성 ↑). **3.6** 타임라인 current 카드의 ~~메모 요약~~ + ~~회고하기 버튼~~ 제거 — 회고 진입은 3.5 메모 유도 카드 [회고하기 →]로 일원화. **5.1** 데이터 — `coaching_insights.badge`/`comment`, `action_items.strength_link` 컬럼 명시 (schema v0.8). `daily_memos` 읽기 항목 제거 (current 카드 메모 미노출에 따라 불필요). |
