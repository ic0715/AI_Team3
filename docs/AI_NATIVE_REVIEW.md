# CareerPT AI-Native & Harness Engineering 현황 리뷰

> 작성일: 2026-06-10  
> 목적: Office Hours — AI-Native 구현 현황 및 개선 방향 논의

---

## 전체 구조 한눈에 보기

```
CareerPT 시스템
│
├── [A] AI-Native 제품 기능 (web/src)          ← 사용자가 직접 경험
│     멀티턴 코칭, 개인화, 인사이트 추출 등
│
└── [B] 개발 인프라 / Evaluation Harness        ← 팀이 품질 보증에 사용
      ralph_loop/
      ├── careerpt_sim   코칭 품질 평가 배터리   ← AI-Native 기능을 검증하는 도구
      └── retention_sim  12주 이탈 예측 연구     ← 제품 의사결정을 지원하는 도구
```

> `careerpt_sim`과 `retention_sim`은 **AI를 활용한 개발 하네스**입니다.  
> 사용자에게 노출되지 않으며, AI-Native 제품 기능의 **품질을 보증하고 방향을 설정하기 위한 수단**입니다.

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [A. AI-Native 제품 기능](#a-ai-native-제품-기능)
3. [B. 개발 인프라 — Evaluation Harness](#b-개발-인프라--evaluation-harness)
   - [careerpt_sim — 코칭 품질 평가 배터리](#careerpt_sim--코칭-품질-평가-배터리)
   - [retention_sim — 12주 이탈 예측 연구](#retention_sim--12주-이탈-예측-연구)
4. [Harness Engineering 현황](#harness-engineering-현황)
5. [우선순위 로드맵](#우선순위-로드맵)

---

## 프로젝트 개요

**CareerPT**는 Claude 기반의 AI 커리어 코칭 서비스입니다.

- **스택**: Next.js 16 + Anthropic SDK (`claude-sonnet-4-6`) + Supabase
- **핵심 플로우**: 커리어 인터뷰 (멀티턴 대화) → 역량 매칭 → 주간 리플렉션 코칭
- **품질 보증**: `ralph_loop` — 34개 페르소나 시뮬레이션 기반 오프라인 평가 인프라

---

## A. AI-Native 제품 기능

> **정의**: 실제 서비스에서 사용자가 직접 경험하는 AI 기능 (`web/src/app/api/` 하위)

---

### ✅ 구현 완료

#### 1. 멀티턴 대화 AI + 프롬프트 캐싱

| 항목 | 내용 |
|------|------|
| 모델 | `claude-sonnet-4-6` |
| 방식 | 매 POST마다 전체 대화 이력 재전송 (서버 stateless) |
| 캐싱 | 시스템 프롬프트 + 이력에 `cache_control: ephemeral` (TTL 1h) |
| 효과 | 세션 내 입력 토큰 ~90% 절감 |

```
관련 파일:
  web/src/app/api/career-interview/chat/route.ts
  web/src/app/api/reflect-coach/chat/route.ts
  web/src/lib/anthropic.ts
```

#### 2. Extended Thinking (심층 추론)

- 인터뷰 종료 시 전체 transcript 대상으로 `budget_tokens: 4000` 적용
- 추출 항목: `presenting_issue`, `agreed_focus`, `agreement_evolution`, `growth_competencies`
- thinking 활성화 시 temperature SDK 요구에 따라 1.0 고정

```
관련 파일: web/src/app/api/career-interview/finalize/route.ts
```

#### 3. 하이브리드 개인화 (Deterministic + AI)

```
Step 1 (결정론적): 12개 역량 중 5개를 인터뷰 인사이트 × 강점 점수 매트릭스로 매칭
Step 2 (AI):       매칭된 5개 슬롯에 사용자 맥락 기반 설명 생성 (80–140자)
```

```
관련 파일:
  web/src/app/api/career-personalize/route.ts
  web/src/lib/competency/match.ts
```

#### 4. 세션 안전장치 (3-Path 분기)

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

### ❌ 미구현 — 필수 추가 요소

#### 🔴 Priority 1 — 사용자 경험 직결

**스트리밍 응답 (Streaming)**

- **현재**: 전체 응답 완성 후 일괄 반환 → 2~4초 공백 후 텍스트가 한번에 출력
- **필요**: `stream: true` + `ReadableStream`으로 토큰 단위 실시간 출력

```typescript
// 현재
const response = await anthropic.messages.create({ ... })

// 필요
const stream = await anthropic.messages.stream({ ..., stream: true })
return new Response(stream.toReadableStream())
```

---

#### 🔴 Priority 2 — AI 신뢰성

**Tool Use / Function Calling**

- **현재**: AI 텍스트 출력 → `parseJSONLoose()` 수동 파싱 → 잘못된 JSON 시 조용히 빈 값 저장
- **필요**: Anthropic `tools` 파라미터로 스키마 기반 구조화 추출

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

**Zod 런타임 검증**

- **현재**: `JSON.parse(text) as Record<string, unknown>` → 타입 없는 수동 처리
- **현재 위험**: LLM 잘못된 JSON → `clipString(undefined)` → 빈 값이 DB에 저장

```typescript
// 필요
const FinalizeSchema = z.object({
  presenting_issue: z.string().max(500),
  growth_competencies: z.array(CompetencyCodeEnum).max(5),
  session_duration_choice: z.enum(['short', 'medium', 'long']).default('medium')
});
const result = FinalizeSchema.safeParse(extraction);
```

---

#### 🟡 Priority 3 — 지능 고도화

**크로스세션 패턴 감지**

- **현재**: 각 세션이 독립적 — 이전 주 코칭 결과가 이번 주 AI에 반영되지 않음
- **필요**: 여러 세션 결과를 분석해 장기 패턴 도출

```
Session 1 (3주 전) ─┐
Session 2 (2주 전) ─┼→ [패턴 분석] → "3주 연속 실행력 이슈"
Session 3 (이번 주) ─┘
```

**토큰 사용량 추적**

- **현재**: `response.usage` 데이터 미저장 — 세션별 비용 파악 불가
- **필요**: Supabase에 저장 후 비용 집계 대시보드

```typescript
// response.usage 예시
{ input_tokens: 1200, output_tokens: 350,
  cache_read_input_tokens: 800, cache_creation_input_tokens: 400 }
```

**임베딩 / 벡터 검색**

- **현재**: 역량 매칭이 하드코딩된 키워드 기반
- **필요**: Supabase `pgvector` + 인터뷰 내러티브 임베딩 → 의미적 유사도 검색

---

### AI-Native 제품 기능 현황 요약

| 기능 | 구현 | 우선순위 |
|------|------|---------|
| 멀티턴 대화 AI + 프롬프트 캐싱 | ✅ | — |
| Extended Thinking (심층 추론) | ✅ | — |
| 하이브리드 개인화 | ✅ | — |
| 세션 안전장치 (위기감지 포함) | ✅ | — |
| 구조화된 프롬프트 엔지니어링 | ✅ | — |
| 상태 인식 컨텍스트 주입 | ✅ | — |
| 턴 캡 & 소프트/하드 종료 | ✅ | — |
| JSON 구조화 추출 + 3-attempt retry | ✅ | — |
| 스트리밍 응답 | ❌ | 🔴 P1 (UX 직결) |
| Tool Use / Function Calling | ❌ | 🔴 P2 (신뢰성) |
| Zod 런타임 검증 | ❌ | 🔴 P2 (운영 안전) |
| 크로스세션 패턴 감지 | ❌ | 🟡 P3 (장기 가치) |
| 토큰 사용량 추적 | ❌ | 🟡 P3 (비용 관리) |
| 임베딩 / 벡터 검색 | ❌ | 🟡 P3 (지능 고도화) |

---

## B. 개발 인프라 — Evaluation Harness

> **정의**: 팀이 로컬에서 실행하는 오프라인 도구.  
> 사용자에게 노출되지 않으며, [A] AI-Native 제품 기능의 품질 검증과 제품 의사결정을 위해 사용.

---

### careerpt_sim — 코칭 품질 평가 배터리

**목적**: "프롬프트 변경이 코칭 품질을 실제로 향상시켰는가?"를 34개 페르소나 시뮬레이션으로 검증.

#### 파이프라인

```
┌──────────────────────────────────────────────────────────┐
│  careerpt_sim — 34페르소나 × 1세션 시뮬레이션              │
│                                                           │
│  [Session] Interview Multi-Turn Loop                      │
│    Claude Sonnet (코치 역할) ↔ GPT-4o (페르소나 역할)     │
│    MAX_INTERVIEW_TURNS = 14                               │
│           ↓                                               │
│  [Finalize] Extended Thinking → 핵심 인사이트 추출         │
│           ↓                                               │
│  [Post-processing]                                        │
│    역량 매칭(결정론적) → AI 개인화 → Action 생성           │
│           ↓                                               │
│  [3-Layer Evaluation]                                     │
│    Layer A: LLM-as-Judge (Gemini/Claude Haiku)            │
│    Layer B: 결정론적 검증 (AI 없음)                        │
│    Layer C: 페르소나 자기평가 (GPT-4o)                    │
│                                                           │
│  종합 점수 = 0.5·A + 0.3·B + 0.2·C  (10점 만점)          │
│  통과 기준: 34페르소나 평균 ≥ 9.0 & 비정형 7개 모두 ≥ 8.0 │
└──────────────────────────────────────────────────────────┘
```

#### 3-Layer 평가 상세

| Layer | 방법 | 평가 항목 | 모델 |
|-------|------|----------|------|
| A | LLM-as-Judge | 턴별 코칭 굿 5개 / 안티패턴 4개 분류 | Gemini / Claude Haiku |
| B | 결정론적 | 카드 매칭 정확도, 텍스트 길이 범위 검증 | 없음 (순수 Python) |
| C | 페르소나 자기평가 | overall_value, insight_novelty, emotional_safety, desire_to_return (1~10) | GPT-4o |

#### 산출물 (세션당)

```
round_{N}/persona_{NN}/
├── transcript_interview.jsonl  턴별 대화 기록
├── interview_extract.json      finalize 결과 + 메타
├── scores_layer_a/b/c.json     각 Layer 평가 결과
└── session_score.json          종합 점수 + 비용 ($0.50/세션, 캐싱 적용)
```

#### 제품 기능과의 관계

```
careerpt_sim 배터리 실행
  → 점수 ≥ 9.0 통과
  → 프롬프트 스냅샷 ralph_loop/prompt/에 저장
  → PR로 docs/ai_prompt/ 업데이트
  → 웹 앱에 반영 (다음 배포)
```

---

### retention_sim — 12주 이탈 예측 연구

**목적**: "출시 전, 어느 주차에 어떤 이유로 이탈이 발생하는가?"를 예측해 제품 Hook 전략 수립.

> careerpt_sim이 **코칭 품질**을 검증한다면,  
> retention_sim은 **12주 리텐션**을 예측합니다.

#### careerpt_sim과의 데이터 의존 관계

```
careerpt_sim Layer C 점수
  (desire_to_return, emotional_safety, insight_novelty)
         ↓ 입력으로 소비
retention_sim → 12주 이탈 곡선 + 훅 효과 분석
```

#### 2개 병렬 트랙 파이프라인

```
Layer C 점수 + 페르소나 메타데이터
         │
         ├── [Method A] 수학적 모델 (AI 없음)
         │     주차별 이탈 확률 공식
         │     → 3개 시나리오 곡선 (pessimistic / current / target)
         │
         └── [Method B] AI-Native 시뮬레이션
               Claude Sonnet → 12주 드롭아웃 시나리오 생성
                      ↓
               Claude Haiku → 4개 리텐션 훅 효과 평가
                      ↓
               [Cross-Validation]
               두 방법 불일치 지점 = 공식이 놓친 감정적 맥락
```

#### Method A — 수학적 이탈 공식

```python
p_churn(week) =
    0.80 × exp(-0.28 × dtr)               # desire_to_return 기반 베이스
    + max(0, (6.0 - es) × 0.04)           # emotional_safety < 6 → 초기(1~3주) 패널티
    + max(0, (6.5 - nov) × 0.012 × decay) # insight_novelty 감소 → 4주차~ 포화
    - (session_score - 5.0) × 0.012       # 코칭 품질 버퍼
    → clamp(0, 0.95)
```

| 시나리오 | score 배수 | dtr 조정 | 의미 |
|----------|-----------|---------|------|
| pessimistic | 0.78× | -1.5 | session_score ~7 상황 |
| current | 1.00× | 0.0 | 실제 careerpt_sim 결과 |
| target | 1.00× | +1.8 | session_score ≥9 달성 시 |

#### Method B — AI-Native 시나리오 생성 핵심 발견

| 훅 | Method A 예측 | Method B 발견 |
|----|-------------|--------------|
| `push_notification` | 이탈률 -3.2% | 소진된 페르소나에 **죄책감 역효과** |
| `weekly_coaching_cta` | 효과 있음 | "5분 리플렉션" 긍정 프레임 **재참여 20%** |
| `streak_badge` | 중립 | 압박감으로 이탈 **가속** |

> **핵심 가치**: 수식이 놓친 감정적 맥락을 AI 내러티브가 포착. 두 방법의 **불일치 지점이 product insight**.

#### 비용

| 항목 | 비용 |
|------|------|
| Method A (순수 Python) | $0 |
| Method B 전체 (34페르소나, 캐싱 적용) | ~$1.00 |

---

## Harness Engineering 현황

### ✅ 구현된 것

**웹 앱 테스트 (제한적)**

```
web/src/lib/competency/match.test.ts   ✅ 역량 매칭 로직 (79 lines)
web/src/lib/utils/week.test.ts         ✅ 날짜 계산 유틸 (82 lines)
```

**ralph_loop 하네스 운영 기능**

- CLI `--personas`, `--skip-eval`, `--force` 플래그로 부분 실행 가능
- 실행 전 비용 추정 출력 (캐시 히트율 고려)
- 세션별 메타데이터 저장 (`model`, `elapsed_sec`, `usage`)
- 기존 결과 파일 있으면 스킵 (idempotent 실행)

**환경변수 보안**

| 변수 | 접근 범위 |
|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 (공개) |
| `ANTHROPIC_API_KEY` | 서버 전용 ✅ |

**에러 처리**

- finalize: 3-attempt retry + 기본값 fallback
- 모든 라우트: `try/catch` + `console.error()`

---

### ❌ 미구현

**웹 앱**

| 항목 | 현황 | 위험 |
|------|------|------|
| API 라우트 테스트 | 5개 라우트 전무 | 코드 변경 시 회귀 감지 불가 |
| CI/CD 파이프라인 | 없음 | 수동 배포, 품질 게이트 없음 |
| 구조적 로깅 | `console.error`만 | 운영 디버깅 불가 |
| 지수 백오프 | 고정 3회 즉시 재시도 | Anthropic 429 상황 악화 |

**ralph_loop 하네스**

| 항목 | 현황 |
|------|------|
| `churn_model.py` 공식 단위 테스트 | 없음 |
| Method A ↔ Method B 불일치 자동 탐지 | 없음 |
| 프롬프트 버전 헤더 | 미적용 (스냅샷-실제 파일 간 드리프트 위험) |
| 실사용자 데이터 기반 공식 재보정 | 없음 |

---

## 우선순위 로드맵

```
Phase 1 — 운영 안정화 (즉시)
  ① Zod 스키마로 LLM 출력 런타임 검증        [A] AI-Native
  ② 구조적 로깅 (route + userId + requestId)  [B] Harness
  ③ 지수 백오프 재시도                        [B] Harness

Phase 2 — 품질 보증 연결 (단기)
  ④ 스트리밍 응답 (UX 직결)                  [A] AI-Native
  ⑤ Tool Use로 JSON 추출 안정화              [A] AI-Native
  ⑥ API 라우트 유닛 테스트 + GitHub Actions  [B] Harness
  ⑦ 프롬프트 버전 헤더 + 응답에 버전 로깅    [B] Harness

Phase 3 — 지능 고도화 (중기)
  ⑧ 토큰 사용량 DB 저장 + 비용 대시보드      [A] AI-Native
  ⑨ 크로스세션 패턴 감지 루프               [A] AI-Native
  ⑩ 임베딩 + 벡터 검색 기반 역량 매칭        [A] AI-Native
```

---

## 핵심 진단 요약

| 레이어 | 영역 | 현황 | 평가 |
|--------|------|------|------|
| **[A] 제품** | 멀티턴 대화 AI + 캐싱 | 상태관리, 위기감지 포함 | ✅ 완성도 높음 |
| **[A] 제품** | 프롬프트 엔지니어링 | Extended Thinking, 상태주입 | ✅ 완성도 높음 |
| **[A] 제품** | 개인화 파이프라인 | 하이브리드 매칭 + AI 개인화 | ✅ 양호 |
| **[A] 제품** | 스트리밍 | 미구현 | ❌ UX 직결 |
| **[A] 제품** | Tool Use + Zod 검증 | 미구현 | ❌ 신뢰성 |
| **[A] 제품** | 크로스세션 분석 | 미구현 | 🟡 장기 코칭 가치 |
| **[B] 하네스** | careerpt_sim 평가 배터리 | 3-Layer Eval, 34페르소나 | ✅ 정교함 |
| **[B] 하네스** | retention_sim 이탈 예측 | 수학 + AI 교차검증 | ✅ 정교함 |
| **[B] 하네스** | 웹 앱 테스트 커버리지 | API 라우트 전무 | ❌ 품질 보증 공백 |
| **[B] 하네스** | CI/CD + 로깅 | 없음 | ❌ 운영 디버깅 불가 |
| **[B] 하네스** | 프롬프트 버전 관리 | 수동 스냅샷 | 🟡 드리프트 위험 |

> **결론**: [B] 평가 인프라는 매우 정교하게 설계되어 있으나,  
> 그 결과가 [A] 웹 앱의 품질 게이트와 **연결되지 않는 구조적 공백**이 존재합니다.  
> Phase 1 운영 안정화 → Phase 2 두 레이어의 품질 게이트 연결 순서로 접근하는 것을 권장합니다.
