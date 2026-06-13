# 14. 히스토리 (인터뷰 보관함)

> 지난 AI 커리어 인터뷰를 최신순으로 모아 보고, 카드를 누르면 그때의 대화 전문을 다시 읽으며 성장을 확인.

> 🔁 **v2.0 재정의**: v1은 `coaching_insights` + `goals` 이력 아카이브였으나, v2는 **인터뷰 로그(`career_interview_results`)** 중심으로 전환. 사용자가 AI 코치와 나눈 커리어 인터뷰의 요약·핵심 인사이트·**대화 전문**을 다시 펼쳐보는 화면. (코칭 인사이트/목표 이력 아카이브는 후속 확장 대상.)

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 14_history |
| 페이즈 | MAINTAIN |
| 역할 | 지난 커리어 인터뷰 로그(요약 + 대화 전문) 누적 표시 |
| 진입 경로 | 하단 탭바 "히스토리" (📚) |
| 다음 화면 | 카드 탭 시 대화 전문 모달(같은 화면 내 오버레이) |
| 구현 | `web/app/history/page.tsx` · 순수 로직 `web/lib/history/interviewLog.ts` |

---

## 2. 진입 조건

- 사용자 상태 = ACTIVE 또는 COMPLETED
- 하단 탭바 "히스토리" 선택
- 온보딩 가드: `useOnboardingGuard('complete')` — 미완료 시 `OnboardingRedirectModal`로 안내 후 해당 단계 이동

---

## 3. UI 구성

### 3.1 상단 바

- 좌측 브랜드 `CareerPT·`, 우측 단계 pill "히스토리"

### 3.2 헤더

- 보조 타이틀: **"인터뷰 보관함 📚"**
- 메인 타이틀: "지난 인터뷰를 **다시 펼쳐봐요**"
- 설명: "그동안 AI 코치와 나눈 커리어 인터뷰가 여기 쌓여요. 카드를 누르면 그때의 대화 전문을 처음부터 다시 읽을 수 있어요."

### 3.3 인터뷰 카드 리스트

각 카드(완료된 인터뷰 1건):

- **날짜** (`interviewed_at` → `YYYY.MM.DD`)
- **내 답변 수** 칩 (`conversation_messages`에서 user 발화 수, 상태 블록 제거 후 집계)
- **요약** (2줄 clamp): `conversation_summary` 우선, 없으면 `ai_summary`
- **다룬 주제** (1줄 clamp): `key_insights.agreed_focus`
- **마무리 인사이트** (1줄 clamp): `key_insights.user_takeaway`
- "대화 전문 보기 ›" CTA
- 정렬: `interviewed_at` 내림차순(최신 우선)

### 3.4 대화 전문 모달 (카드 탭)

- 바텀 시트(최대 88dvh, 내부 스크롤). 오버레이/ESC/✕로 닫기.
- 상단: 날짜 + "인터뷰 대화 전문"
- 인사이트 박스: 요약 + 처음 가져온 고민(`presenting_issue`) / 다룬 주제(`agreed_focus`) / 마무리 인사이트(`user_takeaway`) — 있는 항목만
- 대화: `conversation_messages`를 말풍선으로 렌더(user 우측 accent / assistant 좌측). **user 메시지의 `<현재_상태>…</현재_상태>` 블록은 표시 전 제거.**
- 대화 없음: "저장된 대화 내용이 없어요." 안내

### 3.5 빈 상태

- "아직 쌓인 인터뷰가 없어요"
- "AI 코치와 첫 커리어 인터뷰를 마치면 여기에 기록이 쌓여요."

### 3.6 하단 탭바 (히스토리 active)

- 탭바 구성: 홈 / 회고 / **히스토리(📚)** / 프로필 (4탭). `TabKey`에 `history` 추가.

---

## 4. 기능

| 기능 | 동작 | 구현 시점 |
| --- | --- | --- |
| 인터뷰 로드 | `career_interview_results` WHERE `status='completed'` 조회 (RLS로 본인 것만 자동 필터, `user_id`도 명시) | v2 |
| 정렬 | `interviewed_at` 내림차순 | v2 |
| 카드 요약 | `conversation_summary` ?? `ai_summary` | v2 |
| 카드 인사이트 | `key_insights`의 `agreed_focus` / `user_takeaway` | v2 |
| 카드 탭 → 대화 전문 모달 | `conversation_messages` 전체 표시 (상태 블록 제거) | v2 |
| 에러 + 재시도 | 로드 실패 시 alert + "다시 시도" 버튼 | v2 |
| 사이클/강점 필터 | 전체 / 현재 사이클 / 이전 사이클, 강점별 | **v3(후속)** |
| 코칭 인사이트·목표 이력 통합 | `coaching_insights` + `goals(완료/포기)` 아카이브 합치기 | **v3(후속)** |
| 무한 스크롤 | 페이지네이션 | **v3(후속)** |

---

## 5. 데이터

- 인터뷰 로그: **`career_interview_results`** (08 커리어 인터뷰 완료 시 저장)
  - 조회 컬럼: `id`, `interviewed_at`, `ai_summary`, `conversation_summary`, `key_insights`(JSONB), `conversation_messages`(JSONB)
  - `status` = `'in_progress' | 'completed' | 'abandoned'` — 히스토리는 `'completed'`만 표시
  - `conversation_messages`: `{ role: 'user' | 'assistant'; content: string }[]`
    - ⚠️ user `content`에는 AI 전송용 `<현재_상태>…</현재_상태>` prefix가 그대로 저장됨(저장 시 UI용 `displayContent`가 아니라 `content`를 넣음). 표시 전 정규식 `/^<현재_상태>[\s\S]*?<\/현재_상태>\n?/`로 제거 — 08 페이지 in_progress 복원 로직과 동일.
  - `key_insights`(JSONB): `presenting_issue` / `agreed_focus` / `user_takeaway` 등. Path C(정서 위기) row는 `null`일 수 있음 → 빈 문자열 폴백.
- 개인정보: 대화 원문은 본인 RLS 범위 내에서만 조회. 외부 노출 없음.

---

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 데이터 없음 | Empty State 표시 |
| 로드 실패 | 에러 alert + "다시 시도" 버튼(재조회) |
| `key_insights` = null / 손상 | 해당 인사이트 줄 미표시, 카드/모달 자체는 노출 |
| `conversation_messages` 비어있음/손상 | 손상 항목 필터링, 전부 비면 "저장된 대화 내용이 없어요." |
| 상태 블록 노출 | user 메시지 표시 전 `<현재_상태>` 블록 제거 |
| XSS | 메시지는 텍스트 노드로만 렌더(dangerouslySetInnerHTML 미사용) |

---

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `history_view` | `interview_count` |
| `history_card_opened` | `interview_id` |
| `history_transcript_closed` | `interview_id` |

> ⚠️ 분석 이벤트는 후속 연결 대상(현재 페이지는 미계측).

---

## 8. 접근성

- 카드 리스트는 `<ul>/<li>`, 각 카드는 `<button>`(키보드 접근 + `aria-label`).
- 모달: `role="dialog"` + `aria-modal="true"` + `aria-label`, ESC/오버레이/✕ 닫기.

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v2.0 | 2026-06-13 | **인터뷰 로그 기반으로 재구현(신규 화면 구현)**: 데이터 소스를 `coaching_insights`/`goals` → `career_interview_results`(status='completed')로 전환. ① 헤더 "인터뷰 보관함 📚" + 최신순 요약 카드(날짜/요약/다룬 주제/마무리 인사이트/내 답변 수) ② 카드 탭 → **대화 전문 바텀 시트 모달**(`conversation_messages`, `<현재_상태>` 블록 제거) ③ 탭바 4탭(홈/회고/**히스토리**/프로필) ④ Empty/에러+재시도. 순수 로직 `web/lib/history/interviewLog.ts`(+단위 테스트 21). 필터·코칭/목표 아카이브 통합·무한 스크롤은 v3 후속. (`_post_mvp_v1/14_history.md`에서 분기) |
| v1.3 | 2026-05-09 | (v1) schema v0.7.2 정합성 정렬: 목표 이력 컬럼 `goal_category` 제거 → `competency_code` + `domain`(T/I/R/E) 추가. |
| v1.2 | 2026-05-07 | (v1) 프로토타입 v6 대조 반영: 헤더 "인사이트 보관함 📚" 확정 / 필터·카드 탭 상세 모달 v2 대상 명시 / 기능 테이블 구현 시점 컬럼 추가. |
| v1.1 | 2026-05-05 | (v1) schema 검증 반영: `insight_history`→`coaching_insights`, 필드명 수정, 목표 이력·`final_completion_rate` 조회 추가, RLS 자동 필터 명시. |
| v1.0 | 2026-05-04 | (v1) 최초 작성. |
