# 13. 회고 AI 코칭

기준 프로토타입: home_0520.html (p13)
DB 스키마: docs/schema/spec-schema.md v0.7.2
작성일: 2026-05-19 / 최종 수정: 2026-05-20

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 13_reflect_ai_coach |
| 화면명 | 회고 AI 코칭 |
| 페이즈 | MAINTAIN |
| 역할 | 위클리 회고 후 AI 코치와 채팅 형식으로 이번 주 패턴 파악 + 다음 주 액션 아이템 확정 |
| 진입 경로 | 12 회고 (위클리 모드) → 회고 저장 완료 → CTA 카드 [AI 코치와 다음 주 액션 정하기] 탭 |
| 다음 화면 | 11 홈 (요약 후 [홈에서 확인하기] 버튼) / 재협의 완료 후 동일 요약 화면 재표시 |

---

## 2. 진입 조건

- 유효한 Supabase 세션 존재
- goals 테이블에 status='active' 목표 존재
- 해당 week_number의 weekly_retros 레코드가 저장된 직후 진입 (12 회고 위클리 저장 완료 상태)

---

## 3. AI 연동 참조

이 화면의 AI 동작은 전적으로 아래 파일들을 구현 기준으로 따른다. UI 측에서 알아야 할 것은 입력/출력 인터페이스뿐이다.

| 역할 | 참조 파일 |
| --- | --- |
| 코치 페르소나 및 대화 원칙 | docs/ai_prompt/system_prompt.md |
| 컨텍스트 수집 · 대화 · 인사이트 추출 · 액션 생성 · 역량 변경 분기 · 재협의 전체 | docs/ai_prompt/06_reflect_coaching.md **v1.2** |
| 액션 시드 데이터 | docs/ai_prompt/competency_action_map.md |

> **06_reflect_coaching.md v1.2 주요 변경사항 (UI 영향분):**
> - 재협의 종료 방식: 확정어 감지 → 코치 자연 마무리 발화 방식으로 변경 (5. 기능 참조)
> - 재협의 코치 첫 발화: "어떤 부분이 다르게 느껴지셨나요?"로 확정
> - 완료 액션 제외 로직: AI 내부 처리. UI 영향 없음

UI ↔ AI 인터페이스:

| 방향 | 내용 |
| --- | --- |
| 입력 | /api/coaching-context 응답 (System Prompt 조립 결과) |
| 출력 (메인 코칭) | coaching_insights INSERT + action_items INSERT (다음 주) |
| 출력 (재협의) | `---ACTION_REVISED---` 구분자 + JSON. revised=true 시 action_items UPDATE |
| 요약 화면 표시 데이터 | coaching_insights.{topic, pattern_insight, next_action_title, strength_link} |

**종료 감지 방식 (구현 주의):**

| 단계 | 감지 방식 |
| --- | --- |
| 메인 코칭 대화 (4개 질문) | 코치 발화에서 `"오늘 코칭은 여기서 마무리하겠습니다"` 문자열 클라이언트 감지 |
| 액션 재협의 대화 | 코치 발화 직후 `---ACTION_REVISED---` 구분자 클라이언트 파싱 |

두 단계는 반드시 다른 로직으로 처리해야 한다.

---

## 4. UI 구성

> **p08 커리어 인터뷰(08_career_interview) 화면과 동일한 디자인 시스템을 사용한다.**
> 아래 4.1~4.4의 모든 스타일은 p08 기준이며, 두 화면 사이에 시각적 불일치가 없어야 한다.

### 4.1 상단 바

3열 그리드 구조. sticky top, bg 배경, 하단 1px line 보더.

| 열 | 내용 | 스타일 |
| --- | --- | --- |
| 좌측 (40px) | ← 뒤로가기 버튼 → navBack() (12 회고로 복귀) | 22px, ink, background none |
| 중앙 | "다음 주 액션 정하기" | 16px, weight 800, ink, text-align center |
| 우측 (64px) | "Q{n} / {totalQ}" | 13px, weight 700, ink-mute, text-align right |

- Q레이블: 질문 이동 시 갱신. 재협의 모드 진입 시 숨김 또는 "-" 표시.
- 패딩: 14px 18px

### 4.2 진행률 바

- 전체 너비, 높이 3px
- 배경: line 색상 (`var(--line)`)
- fill: accent 색상, transition .4s ease
- 별도 섹션 배경 없음, 하단 보더 없음
- 진행률 숫자 텍스트 없음 (Q레이블은 4.1 상단바 우측)
- 코칭 완료(요약 화면) 시 숨김
- 재협의 모드 진입 시 재노출

### 4.3 채팅 영역

- flex:1, overflow-y:auto
- 패딩: 24px 20px
- 배경: 흰색 (`#fff`)

**코치 메시지**
- 아바타 없음
- 말풍선: 흰색(`#fff`) 배경, 1px line 보더, border-radius `18px 18px 18px 4px` (bottom-left 4px)
- 폰트: 16px, line-height 1.7
- 최대 너비: 88%
- 등장 애니메이션: msgIn (.35s, translateY 6px → 0)

**사용자 메시지**
- 우측 정렬
- 말풍선: accent 배경, 흰색 글씨, border-radius `18px 18px 4px 18px` (bottom-right 4px)
- 최대 너비: 78%, word-break: break-word, white-space: pre-wrap
- 등장 애니메이션: msgIn

**타이핑 인디케이터**
- 코치 말풍선과 동일한 흰색 카드 스타일
- 텍스트: "입력 중…" (13px, ink-mute)

### 4.4 입력창

하단 고정, 흰색 배경, 상단 보더 없음.

- **텍스트 입력 박스**: border-radius 14px, 1.5px line 보더, 패딩 14px 18px, 15px
- **전송 버튼**: 52×52px, border-radius 14px, accent 배경, 종이비행기 SVG 아이콘 (white, stroke-width 2.5)
- Enter 키 전송 가능
- 코칭 완료(요약 화면 표시) 시 숨김
- 재협의 모드 진입 시 재노출

### 4.5 요약 결과 영역

채팅 종료 후 채팅 영역 대신 표시. overflow-y:auto, flex:1, 패딩 18px.

**인사이트 카드**
accent-tint 배경, accent 1.5px 보더, 18px radius.

| 섹션 | 레이블 | 내용 |
| --- | --- | --- |
| 패턴 | "📌 이번 주 패턴" (accent, 12px, bold) | coaching_insights.pattern_insight |
| 다음 주 액션 | "🎯 다음 주 액션 아이템" (accent, 12px, bold) | coaching_insights.next_action_title (흰색 박스, accent-soft 보더, 15px, bold) |
| 강점 링크 | — | coaching_insights.strength_link (accent-soft 배경, accent 글씨, 999px pill, 11px) |

**안내 문구 (summary-notice)**
`#fef9e7` 배경, `#fde68a` 보더, 14px radius.
"✅ 다음 주 액션이 저장됐어요. 홈에서 새 액션을 확인해보세요."

**액션 버튼 행 (summary-actions)**

| 위치 | 스타일 | 레이블 | 동작 |
| --- | --- | --- | --- |
| 좌측 (secondary) | bg-soft 배경, line-strong 보더, flex:1 | "추가로 더 이야기하기" | 채팅으로 복귀 → 액션 재협의 모드 진입 |
| 우측 (primary) | accent 배경, 흰색, flex:2 | "홈에서 확인하기" | p11 이동 |

> 재협의 완료(요약 재표시) 후에도 동일한 2개 CTA가 표시된다.
> "추가로 더 이야기하기"는 세션 내 최대 2회까지 진입 가능. 2회 초과 시 해당 버튼 비활성화(숨김)하고 "홈에서 확인하기"만 표시.

---

## 5. 기능

| 기능 | 동작 |
| --- | --- |
| 화면 진입 | /api/coaching-context 호출 → System Prompt 수신 → 첫 코치 메시지 400ms 딜레이 후 표시. 진행률 바 초기화 (Q1/4, 25%) |
| 메시지 전송 | 전송 버튼 or Enter → 사용자 메시지 추가 → 타이핑 인디케이터(900ms) → 코치 응답 |
| 진행률 업데이트 | 질문 이동 시 상단바 Q레이블 및 진행률 바 갱신 |
| 메인 코칭 종료 감지 | 코치 발화에서 `"오늘 코칭은 여기서 마무리하겠습니다"` 문자열 감지 → 타이핑 인디케이터(1200ms) → 요약 화면 전환 (입력창·진행률 바 숨김) |
| 저장 | coaching_insights INSERT + 다음 주 action_items INSERT (06_reflect_coaching.md v1.2 로직에 따름) |
| 요약 표시 | coaching_insights 저장 완료 후 summary-section 표시 |
| **액션 재협의 진입** | "추가로 더 이야기하기" 탭 → 요약 숨김 + 입력창·진행률 바 재노출 → 코치 재협의 첫 발화 표시: **"어떤 부분이 다르게 느껴지셨나요?"** (200ms 딜레이) |
| **재협의 종료 감지** | 코치 발화 직후 `---ACTION_REVISED---` 구분자 클라이언트 파싱. revised=true이면 action_items UPDATE 후 요약 화면 재전환. revised=false이면 원래 액션 유지 후 요약 화면 재전환 |
| **재협의 후 요약 재표시** | 갱신된 coaching_insights.next_action_title 반영한 요약 화면 표시. 동일 2개 CTA 재표시 |
| 역량 변경 분기 | 06_reflect_coaching.md §4.2 결정적 판단에 따라 suggest_change 시 요약 화면 하단에 후보 역량 카드 2개 추가 표시 |
| 홈 반영 | 저장 완료 후 홈 화면 데이터 갱신 (action_items 최신화) |
| 뒤로가기 | ← → navBack() → pageHistory 기반 이전 화면 (12 회고) |

---

## 6. 데이터

### 6.1 읽기

| 테이블 | 용도 |
| --- | --- |
| goals | goal_title, competency_code, current_week |
| action_items | 이번 주 액션 (완료 이력 포함, 06 v1.2 완료 액션 제외 로직에 사용) |
| action_completions | 이번 주 완료 기록 |
| daily_memos | 이번 주 평일 메모 |
| weekly_retros | 이번 주 한 줄 회고 |
| coaching_insights | 최근 3주 패턴 |
| strength_analyses | Top 5 강점 (is_latest=true) |

### 6.2 쓰기

| 테이블 | 동작 | 시점 |
| --- | --- | --- |
| coaching_insights | INSERT | 코칭 완료 시 |
| action_items | INSERT (3~5건, week_number=current_week+1) | 코칭 완료 시 |
| action_items | UPDATE (재협의 revised=true 시) | 재협의 종료 시 |
| coaching_insights | next_action_title UPDATE (재협의 revised=true 시) | 재협의 종료 시 |
| goals | status='abandoned' UPDATE + 새 goals INSERT | suggest_change 분기에서 사용자가 역량 변경 선택 시 |

---

## 7. 탭바

없음. 전용 상단바만 표시. ← 뒤로가기로만 이전 화면 복귀.

---

## 8. 예외 처리

| 상황 | 처리 |
| --- | --- |
| active goals 없음 | /onboarding/action-items로 리다이렉트 |
| weekly_retros 미저장 상태 진입 | 12 회고로 리다이렉트 (진입 가드) |
| 동일 week_number coaching_insights 이미 존재 | 저장 스킵, 기존 데이터로 요약 화면 바로 표시 |
| 빈 메시지 전송 | 무시 (입력창 유지) |
| 타이핑 중 전송 시도 | 무시 (p13Typing 플래그) |
| coaching_insights INSERT 실패 | 토스트 "저장에 실패했어요. 다시 시도해주세요" |
| action_items INSERT 실패 | 토스트 안내 (coaching_insights는 저장됐으므로 홈 재진입 시 재생성) |
| 세션 만료 | 토스트 안내 후 로그인 리다이렉트 |
| 재협의 중 3턴 초과 | 06 v1.2 로직에 따라 코치가 자동 마무리 발화 + `---ACTION_REVISED---` 출력 → 클라이언트 정상 파싱 처리 |
| 재협의 `---ACTION_REVISED---` 파싱 실패 | 재시도 1회. 실패 시 revised=false로 원래 액션 유지 후 요약 화면 재전환 |
| "추가로 더 이야기하기" 2회 초과 진입 시도 | 버튼 비활성화(숨김). "홈에서 확인하기"만 표시 |

---

## 9. 미결 사항 (Post-MVP)

| 항목 | 내용 |
| --- | --- |
| 실제 AI 응답 (동적) | MVP는 시나리오 기반 정적 플로우. 추후 Claude API 스트리밍 연동 |
| 온보딩 모드 진입 | p13 온보딩 모드 진입 경로·조건 미확정 |
| 이전 답변 수정 | 채팅 내 이전 메시지 롤백 기능 |
| 주말 코칭 리마인드 알림 | push_subscriptions.coaching_reminder 연동 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.0 | 2026-05-19 | 최초 작성. AI 연동 상세 로직을 06_reflect_coaching.md 참조로 대체. 페이지 스펙은 UI·동작·데이터 인터페이스 중심으로 구성. |
| v1.1 | 2026-05-20 | **[디자인 전면 개편]** p08 커리어 인터뷰 화면과 동일한 스타일로 통일 (4.1~4.4). 상단바 우측 Q레이블 추가. 진행률 바 얇은 전체너비 바로 변경. 코치 말풍선 흰색 카드 + 테두리, 아바타 제거. 입력창 사각형 박스 + 사각형 전송 버튼(종이비행기 SVG)으로 변경. **[CTA 변경]** 요약 화면 좌측 CTA "위클리 회고로"(→ p12) → "추가로 더 이야기하기"로 변경. **[재협의 플로우 추가]** "추가로 더 이야기하기" 탭 시 채팅 복귀 + 액션 재협의 모드 진입. 확정어 감지 시 요약 화면 재전환 + 동일 2개 CTA 표시. **[이슈 등록]** BUG-01 디자인 통일 미완, BUG-02 재협의 종료 불안정 — 9. 미결 사항에 기재. |
| v1.2 | 2026-05-20 | **[06 v1.2 반영 + BUG 해소]** **3.** 참조 파일 버전을 06_reflect_coaching.md v1.2로 업데이트. 종료 감지 방식 차이(메인=문자열, 재협의=구분자) 인터페이스 표로 명시. **4.5** "추가로 더 이야기하기" 세션 내 최대 2회 제한 및 초과 시 버튼 숨김 동작 명시. **5.** 재협의 진입 시 코치 첫 발화를 "어떤 부분이 다르게 느껴지셨나요?"로 확정. 재협의 종료 감지를 확정어 방식 → `---ACTION_REVISED---` 구분자 파싱 방식으로 교체. 재협의 후 요약 재표시 동작 명시. **6.2** action_items UPDATE + coaching_insights UPDATE 쓰기 항목 추가. **8.** 예외 처리 — "재협의 중 확정어 미감지" 항목 제거 및 "3턴 초과 처리", "파싱 실패 처리", "2회 초과 진입" 항목으로 교체. **9.** BUG-01(p08 디자인 통일) 해소 — 미결 사항에서 제거하고 4.1~4.4 확정 스펙으로 전환. BUG-02(재협의 종료 불안정) 해소 — 06 v1.2 구조적 해결로 미결 사항에서 제거. |
