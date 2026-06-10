# CareerPT AI-Native & Harness Engineering 현황 리뷰

> 작성일: 2026-06-10  
> 목적: Office Hours — AI-Native 구현 현황 및 개선 방향 논의

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [AI-Native 구현 현황](#ai-native-구현-현황)
3. [Ralph-Loop 아키텍처](#ralph-loop-아키텍처)
4. [Retention-Sim 아키텍처](#retention-sim-아키텍처)
5. [Harness Engineering 현황](#harness-engineering-현황)
6. [미구현 필수 요소](#미구현-필수-요소)
7. [우선순위 로드맵](#우선순위-로드맵)

---

## 프로젝트 개요

**CareerPT**는 Claude 기반의 AI 커리어 코칭 서비스입니다.

- **스택**: Next.js 16 + Anthropic SDK (`claude-sonnet-4-6`) + Supabase
- **핵심 플로우**: 커리어 인터뷰 (멀티턴 대화) → 역량 매칭 → 주간 리플렉션 코칭
- **평가 시스템**: `ralph_loop` — 34개 페르소나 시뮬레이션 기반 3-Layer 품질 평가

---

## AI-Native 구현 현황

### ✅ 구현 완료

#### 1. 멀티턴 대화 AI + 프롬프트 캐싱

| 항목 | 내용 |
|------|------|
| 모델 | `claude-sonnet-4-6` |
| 방식 | 매 POST마다 전체 대화 이력 재전송 |
| 캐싱 | 시스템 프롬프트 + 이력에 `cache_control: ephemeral` (TTL 1h) |
| 효과 | 세션 내 입력 토큰 ~90% 절감 |

```
관련 파일:
  web/src/app/api/career-interview/chat/route.ts
  web/src/app/api/reflect-coach/chat/route.ts
  web/src/lib/anthropic.ts
```

#### 2. Extended Thinking (심층 추론)

- 인터뷰 종료 시 전체 transcript를 대상으로 `budget_tokens: 4000` 적용
- 추출 항목: `presenting_issue`, `agreed_focus`, `agreement_evolution`, `growth_competencies`
- temperature는 thinking 활성화 시 SDK 요구사항에 따라 1.0으로 고정

```
관련 파일: web/src/app/api/career-interview/finalize/route.ts
```

#### 3. 하이브리드 개인화 (Deterministic + AI)

```
Step 1 (결정론적): 12개 역량 중 5개를 인터뷰 인사이트 × 강점 점수 매트릭스로 매칭
Step 2 (AI): 매칭된 5개 슬롯에 사용자 맥락 기반 설명 생성 (80–140자)
```

```
관련 파일:
  web/src/app/api/career-personalize/route.ts
  web/src/lib/competency/match.ts
```

#### 4. 세션 안전장치

| 경로 | 조건 | 처리 |
|------|------|------|
| Path A | AI가 종료 키워드 발화 | 정상 종료 → finalize |
| Path B | 사용자가 종료 의사 표현 | 정상 종료 → finalize |
| Path C | 위기 키워드 감지 ("죽고 싶다" 등) | 위기 리소스 표시, finalize 생략 |

#### 5. 구조화된 프롬프트 엔지니어링

- `docs/ai_prompt/` 마크다운 스펙 전문을 시스템 프롬프트에 주입
- **강점 페어 컨텍스트**: Top 5 강점 간 시너지/긴장 관계 20문장 자동 생성
- **4가지 코칭 액션 타입**: Echo-back, Hypothesis, Scenario, Insight

#### 6. 상태 인식 컨텍스트 주입 (Self-feeding State)

매 턴마다 클라이언트가 현재 대화 상태를 AI에게 주입:

```xml
<현재_상태>
phase: exploration
agreed_focus: "팀장 전환 이후 자기 인식"
turn_count: 8
session_duration: medium
</현재_상태>
```

서버는 완전 stateless — 상태는 클라이언트가 매 요청에 재주입하여 LLM이 해석.

#### 7. 턴 캡 & 소프트/하드 종료

| 라우트 | Soft Cap | Hard Failsafe |
|--------|----------|---------------|
| career-interview | 없음 | 30 user msgs → 종료 플래그 |
| reflect-coach | 30턴 → 마무리 유도 주입 | 50턴 → 강제 종료 문장 주입 |

#### 8. JSON 구조화 추출 + 검증

- `parseJSONLoose()`: 마크다운 펜스 제거, `---SUMMARY---` 구분자 처리
- `clipString()` / `clipArray()`: 길이 클리핑 및 배열 중복 제거
- enum 검증 (역량 코드, 세션 시간 등) + 기본값 fallback
- finalize 엔드포인트 전체: **3-attempt retry** 공통 적용

---

## Ralph-Loop 아키텍처

### 전체 파이프라인

```
┌─────────────────────────────────────────────────────┐
│  ralph_loop — 34페르소나 시뮬레이션 배터리              │
│                                                       │
│  [Layer 1] Interview Multi-Turn Loop                  │
│    Claude Sonnet (코치) ↔ GPT-4o (페르소나)           │
│    MAX_INTERVIEW_TURNS = 14                           │
│           ↓                                           │
│  [Layer 2] Finalize                                   │
│    Extended Thinking → 핵심 인사이트 추출              │
│    3-attempt retry                                    │
│           ↓                                           │
│  [Layer 3] Post-processing Pipeline                   │
│    역량 매칭(결정론적) → AI 개인화 → Action 생성        │
│           ↓                                           │
│  [Evaluation]                                         │
│    Layer A: LLM-as-Judge (Gemini/Haiku)               │
│    Layer B: 결정론적 검증                              │
│    Layer C: 페르소나 자기평가 (GPT-4o)                 │
│                                                       │
│  종합 점수 = 0.5·A + 0.3·B + 0.2·C  (10점 만점)      │
│  통과 기준: 34페르소나 평균 ≥ 9.0                      │
│            비정형 7개 모두 ≥ 8.0                       │
└─────────────────────────────────────────────────────┘
```

### 3-Layer 평가 상세

#### Layer A — LLM-as-Judge
- 턴별 분류: **코칭 굿 5개** (powerful_question, reflection 등) + **안티패턴 4개** (advice, solution 등)
- Judge 모델: Gemini 또는 Claude Haiku
- 4개 KPI: Positive ratio, Antipattern ratio, Coherence score, Coaching balance

#### Layer B — 결정론적 검증
- 카드 매칭 점수, 뱃지 정확성
- 텍스트 길이 범위 검증 (카드: 60~200자, 액션: 20~240자)
- AI 호출 없음

#### Layer C — 페르소나 자기평가
- GPT-4o가 세션 종료 후 4축 평가 (각 1~10점):
  `overall_value`, `insight_novelty`, `emotional_safety`, `desire_to_return`

### 산출물 구조 (세션당)

```
round_{N}/persona_{NN}/
├── input.json                  페르소나 + 목표
├── transcript_interview.jsonl  턴별 대화 기록
├── interview_extract.json      finalize 결과 + 메타
├── recommendations.json        카드 + 단계 메타데이터
├── actions.json                액션 풀 + 메타
├── scores_layer_a.json         턴별 Judge 레이블
├── scores_layer_b.json         결정론적 검증 결과
├── scores_layer_c.json         페르소나 자기평가
└── session_score.json          종합 점수 + 비용
```

### 비용 추적

| 구분 | 수치 |
|------|------|
| 캐싱 적용 시 세션당 비용 | ~$0.50 |
| 34페르소나 배터리 전체 | ~$17 |
| 캐싱 절감 효과 | 입력 토큰 ~90% |

---

## Retention-Sim 아키텍처

### 모듈 목적

`retention_sim`은 **12주 사용자 이탈 예측 시뮬레이션 하네스**입니다.  
"실제 출시 전, 어느 주차에 어떤 이유로 이탈이 발생하는가?"를 답하는 **제품 의사결정 도구**입니다.

> careerpt_sim이 **코칭 품질**을 평가한다면,  
> retention_sim은 **12주 제품 리텐션**을 예측합니다.

---

### careerpt_sim과의 관계

```
careerpt_sim (1세션 코칭 품질 평가)
  └─ Layer C 점수 (desire_to_return, emotional_safety, insight_novelty)
         ↓ 입력으로 소비
retention_sim (12주 이탈 예측)
```

| 구분 | careerpt_sim | retention_sim |
|------|-------------|---------------|
| 범위 | 1세션 코칭 품질 | 12주 이탈 패턴 예측 |
| 출력 | session_score (0~10) | 리텐션 곡선, 이탈 주차, 훅 효과 |
| AI 역할 | 코치 역할 수행 | 사용자 행동 시뮬레이션 |
| 모델 | Claude Sonnet(코치), GPT-4o(페르소나), Gemini(평가) | Claude Sonnet(시나리오), Claude Haiku(훅 평가) |
| 시간 지평 | ~45분 (1세션) | 12주 |

---

### 전체 파이프라인 (2개 병렬 트랙)

```
personas_with_goals.jsonl + Layer C 점수
         │
         ├─── [Method A] 수학적 모델 ─────────────────────────────────────┐
         │     churn_model.py                                              │
         │     주차별 이탈 확률 공식 (순수 Python, AI 호출 없음)            │
         │     → 3개 시나리오 곡선 (pessimistic / current / target)         │
         │                                                                 │
         └─── [Method B] AI-Native 시뮬레이션 ───────────────────────────┐ │
               churn_scenario_gen.py (Claude Sonnet)                     │ │
               → 12주 드롭아웃 시나리오 생성 (이탈 주차 + 이유 + 전환점)  │ │
                        ↓                                                 │ │
               churn_evaluator.py (Claude Haiku)                         │ │
               → 4개 리텐션 훅의 재참여 효과 평가                          │ │
                        ↓                                                 ↓ ↓
                   [Cross-Validation] 두 방법이 불일치하는 지점 = 공식이
                   감지 못한 감정적 맥락 (예: 푸시 알림이 소진된 사용자에게 역효과)
```

---

### Method A — 수학적 이탈 공식

```python
p_churn(week) =
    0.80 × exp(-0.28 × dtr)              # desire_to_return 기반 베이스
    + max(0, (6.0 - es) × 0.04)          # emotional_safety < 6 → 초기(1~3주) 패널티
    + max(0, (6.5 - nov) × 0.012 × decay) # insight_novelty 감소 → 4주차~ 포화
    - (session_score - 5.0) × 0.012      # 코칭 품질 버퍼
    → clamp(0, 0.95)
```

**3개 시나리오 비교**

| 시나리오 | score 배수 | dtr 조정 | novelty 감쇠 | 의미 |
|----------|-----------|---------|-------------|------|
| pessimistic | 0.78× | -1.5 | 1.4× 빠름 | session_score ~7 상황 |
| current | 1.00× | 0.0 | 1.0× | 실제 ralph_loop 결과 |
| target | 1.00× | +1.8 | 0.75× 느림 | session_score ≥9 달성 시 |

---

### Method B — AI-Native 시나리오 생성

**Step 1: 12주 드롭아웃 시나리오 생성** (Claude Sonnet 4.5)

```json
{
  "churn_week": 1,
  "primary_churn_reason": "첫 인터뷰에서 안전감 부족. 코치의 조언형 질문이 '넌 이미 알겠지' 느낌.",
  "turning_points": [
    { "week": 1, "mood": "불안·방어", "note": "카드 5장이 너무 일반적, 본인 상황 미반영" }
  ],
  "hook_sensitivity": {
    "push_notification": false,
    "weekly_coaching_cta": true,
    "streak_badge": false
  }
}
```

**Step 2: 리텐션 훅 효과 평가** (Claude Haiku 4.5)

4개 훅에 대해 이탈 위기 사용자가 재참여할 확률(`reopen_prob`) 계산:

| 훅 | reopen_rate | 비고 |
|----|-------------|------|
| `none` | 0% | 기준선 |
| `push_notification` | 0% | 소진된 사용자에게 **죄책감 역효과** |
| `weekly_coaching_cta` | **20%** | "5분 리플렉션" 긍정적 프레임 효과 |
| `streak_badge` | 0% | 압박감으로 이탈 가속 |

**핵심 인사이트**: Method A 공식은 "push_notification이 이탈률 -3.2% 감소"라고 계산하지만,  
Method B는 소진된 페르소나에서 **역효과**를 발견 — 감정적 맥락이 공식에 반영되지 않은 것.

---

### 프롬프트 캐싱 최적화

```
34개 페르소나 실행 시:
  1번째 페르소나 → 시스템 프롬프트 캐시 생성 (cache_creation_input_tokens)
  2~34번째 페르소나 → 캐시 재사용 (cache_read_input_tokens, 비용 90% 절감)
```

| 항목 | 비용 |
|------|------|
| Method A (순수 Python) | $0 |
| Method B 시나리오 생성 (34개) | ~$0.50~0.60 |
| Method B 훅 평가 (34개) | ~$0.40~0.50 |
| **전체 배터리 합계** | **~$1.00** |

---

### 산출물 구조

```
~/.careerpt-sim/
├── churn_ai/
│   ├── scenarios/persona_{01..34}.json   # 12주 드롭아웃 시나리오
│   ├── hook_eval/
│   │   ├── persona_{01..34}.json         # 훅별 reopen_prob
│   │   └── summary.json                 # 집계 통계
│   └── reports/
│       ├── retention_report.html         # Chart.js 인터랙티브 대시보드
│       └── hook_analysis.html
└── retention_results/
    ├── scenario_pessimistic.json
    ├── scenario_current.json
    └── scenario_target.json
```

**HTML 대시보드 시각화 포함:**
- 페르소나 × 주차 리텐션 히트맵
- 3개 시나리오 비교 곡선
- 훅 효과 바 차트
- Emotional_safety vs Churn_week 리스크 매트릭스

---

### Retention-Sim 하네스 현황

**✅ 구현된 것**
- CLI `--personas`, `--skip-eval`, `--force` 플래그로 부분 실행 가능
- 실행 전 비용 추정 출력 (캐시 히트율 고려)
- 세션별 메타데이터 저장 (`model`, `elapsed_sec`, `usage`)
- 기존 결과 파일 있으면 스킵 (idempotent 실행)

**❌ 미구현**
- 단위 테스트 없음 (`churn_model.py` 공식 검증 테스트 부재)
- CI 연동 없음
- Method A와 Method B 불일치 탐지 자동화 없음
- 실제 사용자 데이터 수집 후 공식 재보정 파이프라인 없음

---

## Harness Engineering 현황

### ✅ 구현된 것

#### 테스트 (제한적)

```
web/src/lib/competency/match.test.ts   ✅ 역량 매칭 로직 (79 lines)
web/src/lib/utils/week.test.ts         ✅ 날짜 계산 유틸 (82 lines)
```

- 프레임워크: Vitest + React Testing Library
- Anthropic SDK mock 없음

#### 타입 시스템

- API 입출력 TypeScript 인터페이스 정의
- LLM 출력은 `Record<string, unknown>` 캐스팅 후 수동 처리
- Supabase 타입은 수동 인터페이스 (codegen 미사용)

#### 환경변수

| 변수 | 접근 범위 |
|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 (공개) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 (공개) |
| `ANTHROPIC_API_KEY` | 서버 전용 (안전) |

#### 에러 처리

- 모든 라우트: `try/catch` + `console.error('[route-name] error:', e)`
- finalize: 3-attempt retry + 기본값 fallback
- 사용자 응답: 한국어 에러 메시지 반환

---

## 미구현 필수 요소

### 🔴 Priority 1 — 사용자 경험 & AI 신뢰성

#### 스트리밍 응답 미구현

**현재**: 전체 응답 완성 후 일괄 반환 → 2~4초 공백  
**필요**: `stream: true` + `ReadableStream`으로 토큰 단위 실시간 출력

```typescript
// 현재
const response = await anthropic.messages.create({ ... })

// 필요
const stream = await anthropic.messages.stream({ ..., stream: true })
return new Response(stream.toReadableStream())
```

#### Tool Use / Function Calling 미구현

**현재**: 텍스트 → `parseJSONLoose()` 수동 파싱 (실패 위험)  
**필요**: Anthropic `tools` 파라미터로 스키마 기반 구조화 추출

```typescript
tools: [{
  name: "extract_career_insights",
  input_schema: {
    type: "object",
    properties: {
      presenting_issue: { type: "string", maxLength: 500 },
      growth_competencies: { type: "array", items: { enum: COMPETENCY_CODES } }
    },
    required: ["presenting_issue", "growth_competencies"]
  }
}]
```

### 🔴 Priority 2 — 운영 안정성

#### Zod 런타임 검증 없음

**현재 위험**: LLM이 잘못된 JSON 반환 시 → `clipString(undefined)` → 빈 값이 DB 저장

```typescript
// 현재 — 타입 안전하지 않음
const extraction = JSON.parse(text) as Record<string, unknown>;
const presenting_issue = clipString(extraction.presenting_issue, 500);

// 필요
const FinalizeSchema = z.object({
  presenting_issue: z.string().max(500),
  growth_competencies: z.array(CompetencyCodeEnum).max(5),
  session_duration_choice: z.enum(['short', 'medium', 'long']).default('medium')
});
```

#### 구조적 로깅 없음

```typescript
// 현재 — 운영 디버깅 불가
console.error('[career-interview/chat] error:', e);

// 필요 — 운영 가능한 구조
logger.error({
  route: 'career-interview/chat',
  userId: context.userId,
  turnCount: messages.length,
  retryAttempt: attempt,
  anthropicRequestId: response?.id,
  errorType: e.name
});
```

#### 지수 백오프 없음

```typescript
// 현재 — 고정 3회 즉시 재시도 (429 악화 가능)
for (let attempt = 0; attempt < 3; attempt++) { ... }

// 필요
const delay = Math.min(1000 * 2 ** attempt + Math.random() * 100, 10000);
await new Promise(r => setTimeout(r, delay));
```

### 🟡 Priority 3 — 품질 보증 인프라

#### API 라우트 테스트 전무

```
web/src/app/api/
  career-interview/chat/     ❌ 테스트 없음
  career-interview/finalize/ ❌ 테스트 없음
  reflect-coach/chat/        ❌ 테스트 없음
  career-personalize/        ❌ 테스트 없음
  career-actions/            ❌ 테스트 없음
```

#### CI/CD 파이프라인 없음

```
현재: 코드 변경 → 수동 ralph_loop → 점수 확인 → PR 머지

필요:
  PR 생성 → GitHub Actions
    → vitest 유닛 테스트
    → tsc --noEmit 타입체크
    → (선택) 미니 배터리 5페르소나 실행
    → 품질 게이트 통과 시 머지 허용
```

#### 프롬프트 버전 관리 미흡

```
현재:
  ralph_loop/prompt/system_prompt_v1.md  (스냅샷, 수동 관리)
  docs/ai_prompt/system_prompt.md        (실제 사용)
  → 두 파일 간 드리프트 위험

필요:
  프롬프트 파일 상단에 버전 헤더
  # system_prompt v2.3.1 (2026-06-10)
  API 응답에 사용된 프롬프트 버전 로깅
```

### 🟢 Priority 4 — 지능 고도화

#### 크로스세션 패턴 감지 루프 없음

```
현재: 각 세션이 독립적

필요:
  Session 1 (3주 전) ─┐
  Session 2 (2주 전) ─┼→ [패턴 분석] → "3주 연속 실행력 이슈"
  Session 3 (이번 주) ─┘
```

#### 토큰 사용량 추적 없음

```typescript
// response.usage 데이터 현재 미저장
{
  input_tokens: 1200,
  output_tokens: 350,
  cache_read_input_tokens: 800,   // 캐시 히트
  cache_creation_input_tokens: 400 // 캐시 생성
}
// → Supabase에 저장해 세션별 비용 집계 필요
```

#### 임베딩 / 벡터 검색 없음

- 현재: 하드코딩된 키워드 기반 역량 매칭
- 필요: Supabase `pgvector` + 인터뷰 내러티브 임베딩 → 의미적 유사도 검색

---

## 우선순위 로드맵

```
Phase 1 — 운영 안정화 (즉시)
  ① Zod 스키마로 LLM 출력 런타임 검증
  ② 구조적 로깅 (route + userId + requestId)
  ③ 지수 백오프 재시도 (Anthropic API 과부하 대응)

Phase 2 — 품질 보증 (단기)
  ④ 스트리밍 응답 (UX 직결)
  ⑤ Tool Use로 JSON 추출 안정화
  ⑥ API 라우트 유닛 테스트 + GitHub Actions CI
  ⑦ 프롬프트 버전 헤더 + 응답에 버전 로깅

Phase 3 — 지능 고도화 (중기)
  ⑧ 토큰 사용량 DB 저장 + 비용 대시보드
  ⑨ 크로스세션 패턴 감지 루프
  ⑩ 임베딩 + 벡터 검색 기반 역량 매칭
```

---

## 핵심 진단 요약

| 영역 | 현황 | 평가 |
|------|------|------|
| 대화 AI 기반 | 멀티턴, 상태관리, 위기감지 | ✅ 완성도 높음 |
| 프롬프트 엔지니어링 | 캐싱, Extended Thinking, 상태주입 | ✅ 완성도 높음 |
| 개인화 파이프라인 | 하이브리드 매칭 + AI 개인화 | ✅ 양호 |
| 평가 인프라 | 3-Layer Eval, 34페르소나 배터리 | ✅ 정교함 |
| 스트리밍 | 미구현 | ❌ UX 직결 |
| 런타임 검증 | Zod 없음, 수동 클리핑만 | ❌ 운영 위험 |
| 테스트 커버리지 | API 라우트 전무 | ❌ 품질 보증 공백 |
| CI/CD | 없음 | ❌ 수동 배포 |
| 로깅/모니터링 | console.error만 | ❌ 운영 디버깅 불가 |
| 멀티세션 분석 | 없음 | 🟡 장기 코칭 가치 |

> **결론**: Ralph-loop의 평가 인프라(3-Layer Eval)는 매우 정교하게 설계되어 있으나,  
> 그 결과가 웹 앱의 품질 게이트(CI, 테스트, 검증)와 연결되지 않는 구조적 공백이 존재합니다.  
> Phase 1 운영 안정화 → Phase 2 품질 보증 연결 순서로 접근하는 것을 권장합니다.
