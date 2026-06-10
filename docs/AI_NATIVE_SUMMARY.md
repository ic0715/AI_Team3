# CareerPT AI-Native & Harness Engineering 구현 현황

> 작성일: 2026-06-10  
> 목적: Office Hours — AI-Native 구현 완료 항목 요약

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
4. [Harness Engineering 구현 현황](#harness-engineering-구현-현황)

---

## 프로젝트 개요

**CareerPT**는 Claude 기반의 AI 커리어 코칭 서비스입니다.

- **스택**: Next.js 16 + Anthropic SDK (`claude-sonnet-4-6`) + Supabase
- **핵심 플로우**: 커리어 인터뷰 (멀티턴 대화) → 역량 매칭 → 주간 리플렉션 코칭
- **품질 보증**: `ralph_loop` — 34개 페르소나 시뮬레이션 기반 오프라인 평가 인프라

---

## A. AI-Native 제품 기능

> **정의**: 실제 서비스에서 사용자가 직접 경험하는 AI 기능 (`web/src/app/api/` 하위)

### ✅ 구현 완료

#### 1. 멀티턴 대화 AI + 프롬프트 캐싱

| 항목 | 내용 |
|------|------|
| 모델 | `claude-sonnet-4-6` |
| 방식 | 매 POST마다 전체 대화 이력 재전송 (서버 stateless) |
| 캐싱 | 시스템 프롬프트 + 이력에 `cache_control: ephemeral` (TTL 1h) |
| 효과 | 세션 내 입력 토큰 ~90% 절감 |

#### 2. Extended Thinking (심층 추론)

- 인터뷰 종료 시 전체 transcript 대상으로 `budget_tokens: 4000` 적용
- 추출 항목: `presenting_issue`, `agreed_focus`, `agreement_evolution`, `growth_competencies`
- thinking 활성화 시 temperature SDK 요구에 따라 1.0 고정

#### 3. 하이브리드 개인화 (Deterministic + AI)

```
Step 1 (결정론적): 12개 역량 중 5개를 인터뷰 인사이트 × 강점 점수 매트릭스로 매칭
Step 2 (AI):       매칭된 5개 슬롯에 사용자 맥락 기반 설명 생성 (80–140자)
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

## B. 개발 인프라 — Evaluation Harness

> **정의**: 팀이 로컬에서 실행하는 오프라인 도구.  
> 사용자에게 노출되지 않으며, [A] AI-Native 제품 기능의 품질 검증과 제품 의사결정을 위해 사용.

---

### ralph_loop — 전체 구조

`ralph_loop`는 careerpt_sim과 retention_sim을 포함하는 **상위 평가 프레임워크**입니다.

```
ralph_loop/
├── careerpt_sim    1세션 코칭 품질 평가 배터리
│                   → "프롬프트가 충분히 좋은가?"를 검증
│
└── retention_sim   12주 사용자 이탈 예측 연구
                    → "사용자가 언제, 왜 떠나는가?"를 예측
```

**운영 방식**

- 34개 페르소나 (CliftonStrengths × 커리어 단계 조합) + 비정형 7개 엣지케이스로 구성된 배터리
- Claude Sonnet (코치) / GPT-4o (페르소나 시뮬레이터) / Gemini·Claude Haiku (평가 심판) 3개 모델 협업
- 프롬프트 변경 시 배터리 재실행 → 점수 통과 후 `docs/ai_prompt/` PR 반영

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

## Harness Engineering 구현 현황

### ✅ 구현된 것

**웹 앱 테스트**

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
