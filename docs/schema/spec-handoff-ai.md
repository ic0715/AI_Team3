# CareerPT — AI 개발 담당 핸드오프

> 기준 문서: `spec-schema.md v0.7.2`
> 작성일: 2026-05-04
> 최종 수정: 2026-05-09 (schema v0.7.2 기준 전면 정렬 + 명칭 환원 정정)
> 대상: AI 기능 개발 담당

---

## 핵심 원칙

대화 원문은 DB에 저장하지 않습니다.
**브라우저 메모리에서 대화 진행 → 세션 종료 시 AI가 구조화된 결과만 DB에 저장.**

---

## 정적 레퍼런스 데이터 (DB 외부)

다음 데이터는 DB가 아닌 앱 코드/JSON 파일로 관리되며, AI 호출 시점에 클라이언트가 슬라이싱해 프롬프트에 주입합니다.

| 데이터 | 위치 | 용도 |
| --- | --- | --- |
| 12개 역량 정의 + 연계 강점 매핑 | `competency_action_map.md` → JSON 변환 | #3 옵션 매칭, #4 액션 시드 |
| 강점 페어 설명문 (1,089개, C(34,2)) | 비공개 (`.gitignore`) | #2 커리어 인터뷰 follow-up 개인화 |
| 강점별 실행항목 가이드 (34개) | 비공개 (`.gitignore`) | #4 액션 톤 보강 |

> ⚠️ 갤럽 원본 데이터는 `.gitignore`로 공개 저장소에서 제외.
> Top 5 강점만 AI에게 전달하고, 슬라이싱된 페어/실행항목 발췌만 프롬프트에 주입.

---

## 7개 AI 터치포인트 — DB 입출력 전체 구조

| # | 기능 | 성격 | DB에서 읽어야 할 것 | 정적 레퍼런스 (슬라이싱) | DB에 써야 할 것 |
|---|------|------|-------------------|-------------------|----------------|
| 1 | 강점 인터뷰 | 대화형 | `profiles.nickname`, `job_field`, `career_level` | — | `strength_analyses` INSERT |
| 2 | 커리어 인터뷰 | 대화형 | `strength_analyses.strengths` (최신 1개) | Top 5 → C(5,2)=10페어 슬라이스 | `career_interview_results` INSERT (`key_insights` + `mentioned_competencies`, `ai_summary`) |
| 3 | 역량 방향 도출 | **결정적 + 생성형** | `strength_analyses` + `career_interview_results` | `competency_action_map` (12역량 × 연계 강점 5개) | `career_interview_results` UPDATE (`recommended_competencies` 5개 슬롯) |
| 4 | 액션아이템 생성 | 생성형 | `goals` + `profiles` (필수) / `coaching_insights` 최근 1~3개 (선택) | 시드 6개 (해당 `competency_code` × `seed_level`) + 실행항목 슬라이스 (Top 5) | `action_items` INSERT 3~5건 + `source_seed_id` |
| 5 | 코칭 컨텍스트 주입 | 분석형 | `daily_memos` + `action_completions` + `weekly_retros` + `coaching_insights` 최근 3주 | — | 저장 없음 — 프롬프트 구성용 |
| 6 | 회고 코칭 | 대화형 | #5에서 만든 System Prompt | — | 저장 없음 |
| 7 | 인사이트 요약 | 생성형 | #6 대화 내용 (브라우저 메모리) | (다음 주 액션 생성 시 #4와 동일) | `coaching_insights` INSERT + `action_items` INSERT (다음 주, +`source_seed_id`) |

---

## 터치포인트별 상세

### #1 강점 인터뷰

```
입력: profiles.nickname, job_field, career_level
       ※ career_level은 enum (junior_new / junior / senior_mid / senior)
  ↓
[대화 진행 — 브라우저 메모리]
  ↓
출력: strength_analyses INSERT
  - method     = 'ai_interview'
  - strengths  = AI가 추출한 Top 5 (JSONB)
```

**저장 포맷 — `strength_analyses.strengths` (JSONB):**

반드시 아래 구조를 지켜야 합니다. rank 1~5, 총 5개 배열.

```json
[
  { "rank": 1, "name_ko": "전략", "name_en": "Strategic", "description": "복잡한 상황에서도 최적의 경로를 빠르게 찾아내요." },
  { "rank": 2, "name_ko": "분석", "name_en": "Analytical", "description": "데이터와 근거를 바탕으로 깊이 생각해요." },
  { "rank": 3, "name_ko": "성취", "name_en": "Achiever", "description": "끊임없이 뭔가를 이루고 싶은 강한 내면의 불꽃이 있어요." },
  { "rank": 4, "name_ko": "배움", "name_en": "Learner", "description": "새로운 지식과 기술을 습득하는 과정 자체에서 에너지를 얻어요." },
  { "rank": 5, "name_ko": "책임", "name_en": "Responsibility", "description": "한번 맡은 일은 반드시 완수하는 강한 책임감이 있어요." }
]
```

> ⚠️ `is_latest` 갱신은 DB 트리거가 자동 처리합니다. 코드에서 따로 업데이트하지 마세요.

---

### #2 커리어 인터뷰

```
입력 (DB):
  - strength_analyses.strengths (최신 1개 — is_latest = true 조회)

입력 (정적 레퍼런스, 클라이언트가 슬라이싱):
  - Top 5 기반 강점 페어 10개 슬라이스 (C(5,2)=10)
    (페어 데이터는 비공개. AI 자체 지식 + 슬라이스로 페어 시너지 추론)
  ↓
[대화 진행 — 브라우저 메모리]
  - 메인 질문 6개 고정 (current_satisfaction, current_frustration,
    future_vision, work_style, values, career_concern)
  - 각 메인 질문 답변 후 페어 컨텍스트 기반 follow-up 1~2회
  ↓
출력: career_interview_results INSERT
  - key_insights = AI가 추출한 인사이트 JSONB
                   (7개 의미 키 + mentioned_competencies)
  - ai_summary   = 종합 한 줄 요약
  ※ recommended_competencies는 이 단계에서 미입력 (#3에서 UPDATE)
```

**저장 포맷 — `key_insights` (JSONB):**

대화 흐름에 따라 7개 의미 키 일부는 생략 가능. 단, **`mentioned_competencies` 키는 항상 포함** (없으면 빈 배열 `[]`).

```json
{
  "current_satisfaction": "팀원들과 협업할 때 에너지를 얻어요",
  "current_frustration": "내가 성장하고 있는지 방향이 불명확해요",
  "future_vision": "3~5년 안에 팀을 이끄는 리더가 되고 싶어요",
  "work_style": "자율성이 보장되는 소규모 팀 선호",
  "values": ["성장", "인정", "자율"],
  "career_concern": "이직을 해야 하는지 현 직장에서 성장해야 하는지 모르겠어요",
  "dream": "언젠가 나만의 팀을 만들어 제품을 만들고 싶어요",
  "mentioned_competencies": ["I-2", "T-1"]
}
```

**`mentioned_competencies` 추출 규칙 (v0.7.1):**
- 인터뷰 종료 시 AI가 `key_insights`의 다른 키들을 분석해 **0~3개** 역량 코드 추출
- 명시 언급 (예: "비판적 사고를 기르고 싶어요" → `T-1`)
- 암묵 언급 (예: "데이터 기반 의사결정을 잘하고 싶어요" → `T-2`)
- 언급된 게 없으면 빈 배열 `[]`
- #3 옵션 매칭의 슬롯 4(`user_interest`)의 입력으로 사용됨

---

### #3 역량 방향 도출 (결정적 + 생성형) — **v0.7.1 핵심 변경**

> **트리거:** 유저가 인터뷰 완료 후 **"역량 방향 받기" 버튼**을 눌렀을 때 실행됩니다.
> 인터뷰 완료 즉시 자동 실행되지 않습니다.

이 단계는 3-Step 구조입니다.
**Step 1은 코드 로직(AI 미사용), Step 2만 AI 호출.**

#### Step 1: 결정적 매칭 (코드 로직, AI 미사용)

```
입력:
  - strength_analyses.strengths (Top 5)
  - competency_action_map의 12역량 × 연계 강점 5개 매핑 (정적 레퍼런스)
  - career_interview_results.key_insights.mentioned_competencies
  ↓
[코드 로직 실행 — AI 호출 없음]
  ↓
처리:
  1) 12개 역량 각각에 대해 match_score 계산
     match_score = |Top 5 ∩ 역량 연계 강점 5개|
  2) 5개 슬롯 채우기:
     - 슬롯 1~3: match_score 내림차순 상위 3개 → badge="strength_match"
       (동률 시 도메인 분포 우선, 그래도 동률이면 코드 알파벳 순)
     - 슬롯 4: mentioned_competencies 중 슬롯 1~3에 없는 첫 1개
              → badge="user_interest"
       (mentioned가 비어있거나 모두 슬롯 1~3과 중복이면
        → 결정적 매칭 4위로 fallback, badge="strength_match")
     - 슬롯 5: 슬롯 1~4와 다른 도메인의 역량 중 match_score가
              가장 높은 1개 → badge="growth_potential"
       (이미 슬롯 1~4가 4개 도메인을 다 커버하면
        → 결정적 매칭 5위로 fallback, badge="strength_match")
  ↓
중간 결과: 5개 옵션 [{code, match_score, badge, slot}]
```

#### Step 2: 카드 문구 개인화 (AI 호출 1회, **DB 미저장**)

```
입력:
  - Step 1의 5개 옵션
  - career_interview_results.key_insights (7개 의미 키)
  - career_interview_results.ai_summary
  ↓
[AI 1회 호출]
  ↓
출력 (메모리/세션, DB 미저장):
  - 5개 옵션 각각의 personalized_text
    (예: "팀을 이끄는 리더로 성장하려면 비판적 사고가 핵심이에요.
          분석 강점이 데이터 기반 의사결정 리더로 확장될 수 있어요.")
```

> ⚠️ `personalized_text`는 화면 표시용으로만 1회 생성. 사용자가 옵션 선택 후 10번 화면으로 이동하면 더 이상 필요 없으므로 DB 저장하지 않습니다.

#### Step 3: DB 저장 + 유저 선택

```
출력 1: career_interview_results UPDATE
  - recommended_competencies = [{code, match_score, badge, slot}, ...] × 5
                               (personalized_text는 저장하지 않음)

출력 2: 유저에게 5개 옵션 카드 제시 → 1개 선택 → goals INSERT
  goals.competency_code = 선택한 코드
  goals.domain          = 코드 prefix (T/I/R/E)
  goals.goal_title      = 코드 매핑 한글명 (앱 상수에서 조회)
```

**`competency_code` 허용값 (12개 고정, schema CHECK 제약):**

| code | domain | goal_title (앱 상수) |
|------|--------|---------------------|
| T-1 | T | 비판적 사고 기르기 |
| T-2 | T | 데이터 분석 능력 기르기 |
| T-3 | T | 기획력 기르기 |
| I-1 | I | 커뮤니케이션 능력 기르기 |
| I-2 | I | 리더십 역량 기르기 |
| I-3 | I | 설득·협상력 기르기 |
| R-1 | R | 협업 능력 기르기 |
| R-2 | R | 코칭·멘토링 역량 기르기 |
| R-3 | R | 공감 소통 기르기 |
| E-1 | E | 실행력·추진력 기르기 |
| E-2 | E | 문제해결력 기르기 |
| E-3 | E | 자기관리 역량 기르기 |

**`badge` 허용값 (3종):**
- `strength_match` — 결정적 매칭 상위 (슬롯 1~3 기본, 슬롯 4·5 fallback)
- `user_interest` — 사용자가 인터뷰에서 언급한 역량 (슬롯 4)
- `growth_potential` — 시야 확장용 다른 도메인 추천 (슬롯 5)

> ⚠️ 옵션 개수는 **5개 고정**입니다. 3~5개 동적 아님.
> ⚠️ `goal_title`은 LLM 자유 생성이 아닙니다. **앱 상수 한글명을 그대로** INSERT.

---

### #4 액션아이템 개인화 생성

> ⚠️ **구현 진화 콜아웃 (이 절은 v0.7.2 시드-인용 모델 기준 — 현 구현과 다름):**
> 현재 액션 도출은 **"시드 풀 선택"이 아니라 "인터뷰·강점 기반 직접 생성 + 검증 게이트"** 다.
> - ① 인터뷰·강점에서 후보 직접 생성(시드 인용 강제 아님) → 강점연계 위생 필터.
> - ② 별도 콜 검증 게이트(역량적합·강점연계·ICF·정서안전·형식). **게이트 미통과분은 노출 안 됨.**
> - ③ 통과분이 부족하면 검증된 시드를 인터뷰·강점 톤으로 **재작성**해 보충(`source_seed_id`=원본 시드 id).
> - ④ 콜/파싱 실패 시 검증된 시드 풀로 폴백(fail-closed).
> 따라서 `source_seed_id`는 **재작성·풀 폴백분에만** 부여되고, **생성분은 null**(설계 의도).
> 코드: `web/app/api/career-actions/route.ts`, `web/lib/actionItems/{sanitizeCandidates,rewriteFallback,strengthLink}.ts`,
> `web/lib/prompts/career-actions.ts`. 아래 v0.7.2 입출력 표는 시드 추적 ID 포맷 참고용으로만 유지.

> **트리거:** 매주 월요일 자정 주차 자동 전환 후, 또는 유저가 앱 재접속 시 해당 주차 액션아이템이 없으면 실행.

```
입력 (필수, DB):
  - goals.competency_code + goals.current_week
  - profiles.career_level (junior_new/junior → seed_level=junior,
                          senior_mid/senior  → seed_level=senior)

입력 (필수, 정적 레퍼런스):
  - competency_action_map.md의 시드 액션 6개
    (해당 competency_code × seed_level 조합)

입력 (선택):
  - strength_analyses.strengths (Top 5 — 강점 결을 살린 재해석에 사용)
  - 강점별 실행항목 슬라이스 (Top 5 강점 5블록 — 톤 보강에 사용)
  - coaching_insights (최근 1~3개 — 존재하면 이전 주 패턴 참고)
  ↓
[AI가 시드 6개를 강점 결에 맞춰 재해석/재생성하여 3~5개 액션 출력]
  ↓
출력: action_items INSERT (3~5건)
  - week_number    = current_week
  - is_custom      = false
  - title, description, tags
  - source_seed_id = 어느 시드에서 파생됐는지 추적용 (예: "T-1-junior-2")
```

**폴백 규칙 — 회고/인사이트 없는 경우:**

`coaching_insights`가 없어도 오류를 내면 안 됩니다.
첫 주이거나 회고를 작성하지 않은 경우 `goals + profiles + 시드`만으로 생성합니다.

| 상황 | 사용할 컨텍스트 |
|------|-------------------|
| `coaching_insights` 있음 | `goals + profiles + 시드 + 강점 + coaching_insights` (최근 1~3개) |
| `coaching_insights` 없음 | `goals + profiles + 시드` (강점은 있으면 추가) |

> 회고가 있을수록 AI 추천의 개인화 품질이 높아지지만, 없어도 서비스는 정상 동작해야 합니다.

---

### #5 회고 코칭 컨텍스트 주입

DB 조회만 하고 저장은 없습니다. System Prompt를 조립해 #6에 주입하는 단계입니다.

```
조회 범위:
  - daily_memos        WHERE goal_id = 현재목표 AND week_number = 현재주차
  - action_completions WHERE action_item_id IN (이번 주 action_items)
  - weekly_retros      WHERE goal_id = 현재목표 AND week_number = 현재주차
  - coaching_insights  WHERE goal_id = 현재목표 ORDER BY week_number DESC LIMIT 3
```

---

### #6 회고 코칭

```
입력: #5에서 조립한 System Prompt
  ↓
[대화 진행 — 브라우저 메모리]
  ↓
출력: 없음 (대화 원문 미저장)
     → 대화 종료 후 바로 #7 실행
```

---

### #7 인사이트 요약

```
입력: #6 대화 내용 전체 (브라우저 메모리)
  ↓
[AI가 핵심만 추출해 구조화]
  ↓
출력 1: coaching_insights INSERT
  - topic              = 이번 주 코칭 주제
  - pattern_insight    = 발견된 행동 패턴 (nullable)
  - next_action_title  = 다음 주 추천 액션 제목
  - next_action_reason = 추천 이유 (nullable)
  - strength_link      = 연결된 강점 (자유 텍스트, 예: "체계 + 학습")

출력 2: action_items INSERT (다음 주 항목)
  - week_number    = current_week + 1
  - is_custom      = false
  - source_seed_id = 시드 추적 ID
  - #4 방식과 동일하게 생성하되, coaching_insights.next_action_title을 우선 반영
```

---

## 전체 데이터 흐름 요약

```
[온보딩]
profiles                  ← 03 기본 정보 입력 (profile_completed=true)
strength_analyses         ← #1 강점 인터뷰 결과
career_interview_results  ← #2 커리어 인터뷰 결과
                            (key_insights + mentioned_competencies + ai_summary)
career_interview_results  ← #3 Step 1 결정적 매칭 + Step 2 AI 카드 개인화
                            (recommended_competencies UPDATE)
goals                     ← 유저가 5개 옵션 중 1개 선택
                            (competency_code + domain + goal_title)
action_items              ← #4 1주차 액션 아이템 생성 (source_seed_id 포함)

[매주 반복]
daily_memos               ← 평일 메모 저장
action_completions        ← 완료 체크 저장
weekly_retros             ← 주말 한 줄 회고 저장
                            ↓ (#5 컨텍스트 주입)
회고 코칭 대화             (#6, 미저장)
                            ↓
coaching_insights         ← #7 인사이트 요약 저장
action_items              ← 다음 주 액션 아이템 생성 (source_seed_id 포함)
goals.current_week        ← +1 (매주 월요일 자정 자동)
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.1 | 2026-05-09 | (옵션 A 정정) schema 무수정 원칙 확정 → 본문 "목표 추천받기" → "역량 방향 받기" 환원. schema는 v0.7.2 원본 복구. 09 화면명("커리어 방향 결과")은 유지. |
| v1.0 | 2026-05-09 | schema v0.7.2 기준 전면 정렬. 본 문서가 v0.6 기준으로 작성돼 있어 v0.7~v0.7.2 변경사항 통째 누락 상태였음 — 일괄 반영: 정적 레퍼런스 데이터 섹션(`competency_action_map`, 강점 페어 1,089개, 강점별 실행항목 34개) 신규, #2 강점 페어 슬라이스 컨텍스트, #2 `mentioned_competencies` 추출 책임, #3 결정적 매칭(코드)+AI 카드 문구 개인화(메모리/세션) 3-Step 분리, #4 시드 6개 기반 AI 재해석, `source_seed_id` 추적, `competency_code`/`domain`/`goal_title`(앱 상수) 매핑 표 12개. |
