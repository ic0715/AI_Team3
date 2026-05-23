# 10. 액션 아이템 선택

> 09에서 선택한 커리어 방향에 맞춰 AI가 추천한 실행 과제(액션) 중 1개를 선택하고 12주 코칭을 시작.

---

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 10_action_items |
| 페이즈 | DO |
| 역할 | 첫 주 액션 확정 + 코칭 시작 |
| 이전 화면 | 09 커리어 방향 결과 |
| 다음 화면 | NEW02 커리어 방향 설정 완료 → 11 홈 |

---

## 2. 진입 조건

- 09에서 목표 선택 후 `goals` INSERT 완료된 상태
- `goals` 테이블에 `status='active'`인 목표가 있는 상태
- 해당 목표의 현재 주차(`current_week`)에 `action_items`가 아직 없는 경우 (AI 생성 전)

> ⚠️ **schema 불일치 수정 완료**: `career_results.selected_direction` 컬럼 없음 → `goals.goal_title` 사용.
> `users.coaching_start_at` 없음 → `goals.started_at`으로 대체.

---

## 3. UI 구성

### 3.1 상단 바

- 뒤로가기 → 09 (선택 변경 가능)
- 페이지 타이틀: "액션 아이템 선택"

### ~~3.2 상단 goal pill~~ `v1.6 제거`

> ~~프로토타입 기준으로 확정. 목표명 pill과 현재 선택 수 badge를 함께 표시.~~

**v1.6에서 제거됨.** 안내 패널(3.3)에 "내가 선택한 목표" 라벨이 추가되어 상단 goal pill의 역할이 중복 → 상단/하단 pill·badge 영역 모두 제거.

### 3.3 안내 패널 `v1.6 수정 — 목표 라벨 추가`

- **패널 상단 라벨**: `"내가 선택한 목표"` (11px, accent 색상, weight 700, opacity 0.75, letter-spacing .06em)
- 패널 제목: "🎯 [goal_title]" (이모지 + 목표명)
- 구분선: 1px accent-tint (margin 10px 0)
- 패널 서브: **"AI가 추천하는 액션 아이템이에요. 지금 시작할 수 있는 것 1개를 골라주세요."**
  - "1개" 부분은 accent 색상 + bold로 강조

### 3.4 추천 액션 리스트 (5개 고정) `v1.5 수정 — 3~5개 → 5개 고정`

각 카드:

- 선택 버튼 (단일 선택 — radio 패턴, 좌측 체크박스 ✓)
- 액션 제목 (예: "하루 1개 뉴스·보고서 읽고 \"이 주장의 근거는?\" 메모하기")
- 설명 (1~2문장)
- 메타 태그 (보통 3개): 시간(예: "⏱ 10분"), 형태(예: "📝 메모"), 빈도(예: "🌱 매일 루틴")
- 상태: 기본 / hover / picked (선택됨, accent-light 배경)

> 추천 카드 개수는 **5개 고정** (프로토타입 v4 기준 확정). 시드 데이터 구조는 5번 데이터 정책 참조.

### 3.5 커스텀 액션 영역

- 텍스트 입력 **(5~50자, `maxlength="50"`)**
- placeholder: "나만의 액션 아이템 추가..."
- "추가" 버튼 (Secondary 스타일, accent-light 배경)
- 추가된 커스텀 항목 선택 시 기존 추천 선택 자동 해제 (단일 선택 유지)
- 커스텀 항목 우측에 삭제 버튼(×) 노출

### ~~3.6 하단 summary 영역~~ `v1.6 제거`

**v1.6에서 제거됨.** 상단 goal pill(3.2)과 함께 제거. 3.3 안내 패널이 목표 정보를 충분히 표시하므로 중복 제거.

### 3.7 Bottom CTA

- **"시작하기 🚀"** (1개 선택 시 활성화) → NEW02로 이동
- 미선택 시: disabled 상태 유지

---

## 4. 기능

> **화면 성격 확정**: 유저가 AI 추천 목록에서 직접 1개를 선택하는 UX.
> AI 추천 액션 목록은 화면 진입 시 이미 생성된 상태로 표시됨.
> (백그라운드에서 09 목표 선택 직후 AI 생성 완료 → 10 진입 시 즉시 렌더링. 로딩이 필요한 경우 skeleton UI)

| 기능 | 동작 |
| --- | --- |
| 화면 진입 시 | 선택한 `competency_code` + 사용자 `career_level`을 키로 시드 5개 액션 즉시 렌더링 |
| 추천 액션 선택 | 단일 선택 (radio 패턴). 선택 시 상단 badge +1, 다른 항목 자동 해제, 커스텀도 해제 |
| 커스텀 액션 추가 | 입력 후 [추가] 클릭 또는 Enter. 추가 시 추천 선택 자동 해제하고 커스텀이 선택 상태로 |
| 커스텀 액션 삭제 | × 클릭으로 제거. 선택 상태였다면 선택 해제 |
| "시작하기 🚀" 클릭 | 선택된 액션 `action_items` INSERT (week_number=1) → `goals.started_at` 기록 → NEW02 이동 |

---

## 5. 데이터 `v1.5 수정 — source_seed_id 형식 명세 신규 추가`

### 5.1 읽기

- `goals` (active, goal_title, competency_code, domain, current_week)
- `profiles` (career_level)
- 시드 데이터 (앱 상수, 5번 5.3 참조)

### 5.2 쓰기

- 선택된 `action_items` INSERT (week_number=1)
  - `title`, `description`, `tags`(JSONB array), `is_custom` (true/false)
  - **`source_seed_id`**: 시드 기반 추천일 경우 채워짐, 커스텀일 경우 NULL
  - **`strength_link`** (schema v0.8): 사용자 Top 1 강점 `name_ko` (예: "분석"). `strength_analyses.strengths[0].name_ko`에서 조회. 11 홈 "오늘의 액션" 카드 "강점 「○○」을 발휘하는 시간 ✨" 표시용. 강점 데이터 없으면 NULL.
- 전체 작업은 트랜잭션으로 처리 (실패 시 롤백)

### 5.3 시드 데이터 구조 `v1.5 신규`

추천 액션은 앱에 내장된 시드 데이터(앱 상수)에서 제공됨. 프로토타입 v4 기준 5종 역량 × 5개 액션 = **총 25개 시드**.

| competency_code | goal_title | 시드 액션 개수 |
| --- | --- | --- |
| `T-1` | 비판적 사고 기르기 | 5개 |
| `T-2` | 데이터 분석 능력 기르기 | 5개 |
| `E-1` | 실행력·추진력 기르기 | 5개 |
| `I-2` | 리더십 역량 기르기 | 5개 |
| `R-1` | 협업 능력 기르기 | 5개 |

> ⚠️ 프로토타입 v4는 위 5종 역량만 시드 제공. 12개 역량 코드 전체에 대한 시드는 별도 작업으로 채워야 함 (production 미결).

### 5.4 `source_seed_id` 형식 `v1.5 신규`

추천 액션을 선택한 경우, `action_items.source_seed_id`에 다음 형식의 문자열을 저장하여 추후 분석·개선 시 시드 추적이 가능하도록 함.

```
{competency_code}-{career_level_key}-{index}
```

예시:
- `T-1-junior-1` : 비판적 사고 기르기 / 주니어 / 1번 시드
- `E-1-junior-3` : 실행력·추진력 기르기 / 주니어 / 3번 시드
- `R-1-senior-2` : 협업 능력 기르기 / 시니어 / 2번 시드 (향후 확장 시)

| 필드 | 값 | 설명 |
| --- | --- | --- |
| `competency_code` | T-1 / T-2 / E-1 / I-2 / R-1 ... | 09에서 선택한 역량 코드 |
| `career_level_key` | `junior_new` / `junior` / `senior_mid` / `senior` | 03에서 수집한 경력 카테고리 매핑. 프로토타입 v4는 **`junior` 단일 레벨만 시드 제공**. 향후 다른 레벨 확장 시 추가 |
| `index` | 1 ~ 5 | 해당 (역량 × 레벨) 시드 묶음 내 순번 |

**커스텀 액션 저장 시**: `source_seed_id = NULL` (또는 빈 문자열, 스키마 정책에 따라 통일)

> ⚠️ **schema 반영 필요 항목**: `action_items.source_seed_id` 컬럼(`text`, nullable) 추가 필요. 기존 schema에 미존재할 경우 v0.7.3에서 반영.

### 5.5 기타 schema 정합 (기존 유지)

> ⚠️ **schema 불일치 수정 완료**:
> - `career_focus` 테이블 없음 → `goals` 테이블로 대체
> - `weekly_actions` 테이블 없음 → `action_items` 테이블로 대체 (week_number 컬럼으로 주차 구분)
> - `action_items.items JSONB` 구조 없음 → 각 액션아이템이 별도 row (title, description, tags, is_custom 컬럼)
> - `users.coaching_start_at` 없음 → `goals.started_at`으로 대체

---

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 미선택 상태 CTA 클릭 | CTA disabled |
| 커스텀 입력 공백/5자 미만 | 인라인 에러, 저장 불가 |
| 커스텀 입력 50자 초과 | `maxlength="50"`으로 입력 차단 |
| 커스텀 욕설 감지 | 인라인 에러, 저장 불가 |
| 시드 데이터 부재 (예: 미구현 역량) | fallback 추천 액션 3~5개 표시 + 안내 토스트 |
| 선택값 저장 실패 | 토스트 + 재시도 |
| action_items 생성 실패 | 트랜잭션 롤백, 재시도 |
| 새로고침 | DB 복원 |
| 중복 클릭 | 첫 클릭 시 disabled |

---

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| `action_selection_view` | `competency_code`, `seed_count` |
| `action_option_selected` | `action_id`, `kind=recommended/custom`, `source_seed_id` |
| `custom_action_added` | `text_length` |
| `cycle_started` | `goal_title`, `competency_code`, `source_seed_id`, `is_custom`, `time_from_signup` |

---

## 8. 접근성

- 추천 액션 카드는 radio group 패턴 (`role="radiogroup"`)
- 커스텀 입력 라벨 명확 (`aria-label="나만의 액션 아이템 추가"`)
- 선택 결과 badge는 `aria-live="polite"`로 즉시 알림
- CTA 활성/비활성 상태는 `aria-disabled`로 명시

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.6 | 2026-05-22 | **[UI 간소화]** **3.2 상단 goal pill 제거** — 안내 패널(3.3)과 역할 중복. **3.6 하단 summary 영역 제거** — 동일 사유. **3.3 안내 패널** — 상단에 `"내가 선택한 목표"` 라벨 추가 (11px, accent, opacity 0.75), 구분선 추가. 유저가 현재 선택 목표를 인지할 수 있도록 패널 내에서 명확히 표시. |
| v1.5 | 2026-05-11 | 프로토타입 v4 정합성 정렬: **3.4 추천 액션 리스트 개수** "3~5개" → **"5개 고정"**으로 확정 (프로토타입 v4에서 T-1·T-2·E-1·I-2·R-1 5종 역량 각 5개 시드 = 총 25개 시드 정의). **3.3 안내 패널** 카피 미세 정렬 ("AI가 추천하는 액션 아이템이에요. 지금 시작할 수 있는 것 1개를 골라주세요."). **5번 데이터 정책 — `source_seed_id` 형식 명세 신규 추가** (5.4): `{competency_code}-{career_level_key}-{index}` 형식 (예: `T-1-junior-1`). 추천 액션 선택 시 자동 매핑되어 `action_items.source_seed_id`에 저장. 커스텀 액션은 NULL. 프로토타입 v4는 `junior` 단일 레벨만 시드 제공, 향후 다른 career_level 확장 여지. **5.3 시드 데이터 구조 신규 명세** (5종 역량 × 5개 = 25개). `action_items.source_seed_id` 컬럼 추가 → schema v0.7.3 반영 필요 명시. **7번 분석 이벤트** `source_seed_id`, `seed_count`, `is_custom` 속성 추가. |
| v1.4 | 2026-05-10 | NEW 프로토타입 v1 정합성 정렬: **3.7 Bottom CTA** + **4번 기능** CTA 텍스트 "홈으로 시작하기 🚀" → "시작하기 🚀"로 변경. 다음 화면(NEW02 → 11 홈) 흐름은 production 풀 스펙으로 그대로 유지. |
| v1.3 | 2026-05-07 | schema v0.7.1 반영: **5번 데이터** — `goal_category` → `competency_code, domain` / **7번 분석 이벤트** `cycle_started` 속성 `goal_category` → `competency_code` |
| v1.2 | 2026-05-07 | 프로토타입 v6 대조 반영: **① 화면 성격 확정** — "AI 자동 생성 로딩 화면" 정의 삭제, 유저가 직접 1개 선택하는 UX로 확정 / **② 선택 개수 1개로 확정** (프로토타입 기준) — 3.3 안내 패널·3.4 카드·3.7 CTA 전반 수정 / **③ 커스텀 maxlength 5~50자로 확정** (기존 5~80자에서 수정) / **④ 하단 summary 영역 프로토타입 기준으로 변경** — "12주 시작 준비 완료!" 문구 삭제, 목표명 pill + 선택 수 badge 구성으로 변경 / **⑤ 상단 goal pill 선택 수 badge 명세 추가** (3.2항 신규) |
| v1.1 | 2026-05-05 | schema 검증 반영: 화면 역할 재정의(유저 선택→AI 자동 생성 로딩 화면), `career_results.selected_direction`→`goals.goal_title`, `career_focus`·`weekly_actions` 테이블 없음(→`goals`·`action_items`), `action_items.items JSONB`→별도 row 구조, `users.coaching_start_at`→`goals.started_at` 수정 |
| v1.0 | 2026-05-04 | 최초 작성 |
