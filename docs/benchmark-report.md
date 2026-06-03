# CareerPT 벤치마크 리포트
## briefly / fevio 분석 → CareerPT 적용 전략

**작성일:** 2026-06-02  
**분석 대상:** `briefly` (AI-evolution-team5) · `fevio` (ai-business-group10) · `CareerPT` (AI_Team3 main)  
**목적:** 두 팀의 AI-Native 설계 및 Harness Engineering 패턴을 CareerPT 실정에 맞게 적용

---

## 1. CareerPT 현황 스냅샷

분석 기준: `main` 브랜치 최신 (908b956), 2026-05-20

### 스택
- **프레임워크:** Next.js 16 (App Router) + React 19 + TypeScript strict
- **백엔드/DB:** Supabase (Auth + PostgreSQL + RLS)
- **배포:** Vercel (main 자동 배포)
- **스타일:** Tailwind CSS v4 + CSS 변수

### 구현 진행률

| 구분 | 완료 | 미구현 | 진행률 |
|---|---|---|---|
| MVP (12개) | 5개 | 7개 | 42% |
| post-MVP v2 (4개) | 0개 | 4개 | 0% |

**MVP 완료:** 랜딩, 로그인, 기본정보, 네트워크 오류, 일반 오류  
**MVP 미구현:** 강점 선택(p04), 커리어 인트로(p07), 커리어 인터뷰(p08), 역량 결과(p09), 액션아이템(p10), 이메일 인증(NEW01), 사이클 시작(NEW02)  
**post-MVP 미구현:** 홈 대시보드(p11), 리플렉션(p12), 리플렉션 AI 코치(p13), 프로필(p15)

### 핵심 AI 구조 (spec-handoff-ai.md 기준)

CareerPT는 7개 AI 터치포인트를 이미 문서로 정의했습니다.

| # | 기능 | AI 역할 | 저장 방식 |
|---|---|---|---|
| 1 | 강점 인터뷰 | 대화형 — Top 5 추출 | strength_analyses INSERT |
| 2 | 커리어 인터뷰 | 대화형 — 인사이트 추출 | career_interview_results INSERT |
| 3 | 역량 방향 도출 | Step1 코드 로직(AI 없음) + Step2 AI 카드 문구 개인화(DB 미저장) | recommended_competencies UPDATE |
| 4 | 액션아이템 생성 | 시드 6개 기반 AI 재해석 | action_items INSERT (source_seed_id 추적) |
| 5 | 회고 컨텍스트 주입 | DB 조회 + System Prompt 조립 | 저장 없음 |
| 6 | 회고 코칭 | 대화형 | 저장 없음 (브라우저 메모리) |
| 7 | 인사이트 요약 | 핵심 추출·구조화 | coaching_insights + 다음 주 action_items INSERT |

**핵심 설계 원칙 (이미 적용됨):**
- 대화 원문 DB 미저장 — 브라우저 메모리만 사용
- #3 Step1은 코드 로직(AI 없음), Step2만 AI 호출 — **deterministic-first 원칙이 이미 구현됨**
- `personalized_text`는 화면 표시용으로만 생성, DB 저장 안 함

### 현재 문서 구조에서 발견된 갭

| 갭 | 위치 | 영향 |
|---|---|---|
| `CLAUDE.md` 없음 | 레포 루트 | Claude Code 세션마다 컨텍스트 재설명 필요 |
| 이슈 종료 기준 미정의 | 전체 | 완료 판단이 구현자마다 다름 |
| AI 코딩 규칙 없음 | spec-handoff-ai.md | 범위 크리프·불필요 리팩터링 반복 위험 |
| Presentation 레인 없음 | 배포 구조 | 로그인 없이 화면 시연 불가 |

---

## 2. briefly 분석

**프로젝트:** 스와이프 기반 지식 관리 앱  
**스택:** FastAPI (Python) + React/Vite + iOS (SwiftUI) + Chrome Extension

### 2-A. AI-Native 요소

#### AI 모듈 구조

7개 독립 AI 모듈이 동일한 OpenAI-compatible endpoint를 공유합니다.

```
src/ai/
├── summarizer.py        ← Anthropic/OpenAI/Gemini/로컬LLM 멀티 프로바이더
├── auto_tagger.py       ← 카테고리 + 이중언어 키워드 자동 분류
├── trend_analyzer.py    ← 스와이프 이력 기반 개인화 피드 랭킹
├── metadata_extractor.py ← URL → 제목·저자·날짜 자동 추출
├── reminder_engine.py   ← 읽기 리마인더 스케줄링
├── reflection.py        ← 독서 패턴 회고 생성
└── achievement_checker.py ← 읽기 습관 달성 뱃지 판단
```

#### 핵심 AI 설계 원칙

**멀티 프로바이더 추상화**
```python
# SUMMARY_PROVIDER=auto 시 URL 패턴으로 provider 자동 감지
# anthropic / openai / gemini / 로컬LLM(LM Studio, Ollama, vLLM) 모두 동일 인터페이스
SUMMARY_PROVIDER=auto
SUMMARY_BASE_URL=http://localhost:1234/v1/chat/completions  # 로컬 LLM도 가능
```

**Fail-open 원칙** — AI 실패가 핵심 기능을 차단하지 않음
```python
# auto_tagger.py
# Never raises — 실패 시 None 반환, 콘텐츠 저장은 그대로 진행
async def tag_content(...) -> AutoTagResult | None:
```

**TrendAnalyzer — AI 없는 개인화**
```python
# 스와이프 이력 기반 engagement decay score 계산
# LLM 없이 수학적 가중합으로 개인화 피드 생성
relevance_score = (
    TREND_RECENCY_WEIGHT * recency_score +
    TREND_ENGAGEMENT_WEIGHT * engagement_score +
    TREND_INTEREST_MATCH_WEIGHT * interest_match +
    TREND_TAG_SIMILARITY_WEIGHT * tag_similarity
)
```

### 2-B. Harness Engineering 요소

#### gstack 스킬 파이프라인

```
/investigate → /autoplan → (구현) → /review → /qa → /ship → /retro
   Think          Plan       Build     Review   Test   Ship   Reflect
```

스킬별 라우팅 규칙이 CLAUDE.md에 명문화되어 있어, 요청 유형에 따라 Claude Code가 자동으로 적절한 스킬을 호출합니다.

#### 문서 계층 구조

| 변경 유형 | 업데이트 파일 |
|---|---|
| 제품 의도·기능 목록 | docs/external/Briefly_FeatureList.md |
| 기능 요구사항 | docs/specs/{ID}.md |
| 구현 상태 | docs/feature-inventory.md |
| 기능 간 의존성 | docs/dependency-matrix.md |
| 아키텍처 결정 | docs/decisions/ARCH-NNN-{slug}.md |
| 기능 완료 | docs/records/{ID}-record.md |

#### Circle-based E2E 테스트 분리

```
tests/e2e/
├── circle1.frontend-frontend.spec.ts   ← 프론트엔드 격리 (API mock)
├── circle2.backend-frontend.spec.ts    ← 실제 API 연동
└── circle3.db-backend-frontend.spec.ts ← DB + RLS 포함 전체 통합
```

---

## 3. fevio 분석

**프로젝트:** IVF 환자 케어 운영 앱  
**스택:** Next.js 14 (App Router) + Supabase + Vercel — **CareerPT와 동일**

### 3-A. AI-Native 요소

#### Confirmation-first AI 원칙

AI 생성물은 항상 draft 상태로만 저장되고, 사용자 확인 후에만 실행 가능한 레코드로 전환됩니다.

```
병원 메모 입력 (raw text / 사진)
    ↓
LLM 호출 → schedule_candidates 테이블 (draft 상태)
    ↓
사용자가 각 후보 확인 / 수정 / 거절
    ↓
사용자 confirm → schedule_items 테이블 (confirmed 상태)
    ↓
홈 화면에는 confirmed 카드만 렌더링
```

> "CareActionCard는 사용자가 확인한 운영 태스크이지, 모델이 저작한 의료적 진실이 아니다."  
> — fevio CLAUDE.md

#### Deterministic-first, AI-second

약품 키워드 정규화에서 확인할 수 있는 계층:

```
1순위: alias dict에서 직접 매칭 (deterministic, LLM 없음)
2순위: alias miss → OpenRouter LLM fallback
→ CI에 LLM fallback smoke 테스트 별도 워크플로로 관리
```

#### Daily Brief — admin-keyed LLM + guardrail dict

```typescript
// 허용된 의료 fact 범위를 guardrail dict로 제한
// LLM은 dict 범위를 벗어난 의료 fact를 출력할 수 없음
// pull 패턴 (사용자가 직접 열 때만 생성), ephemeral (저장 안 함)
```

**MVP LLM 사용 의도:** 잘 통하는 패턴 수집 → 누적 후 deterministic template pool로 이관. LLM은 exploration tool, deterministic이 long-term destination.

#### State-driven Generative UI

AI가 UI를 자유 생성하는 게 아니라 `care_state` → 관리된 컴포넌트 조립:

```typescript
type CareDay =
  | 'onboarding'
  | 'clinic_day'
  | 'injection_day'
  | 'waiting_day'
  | 'routine_day'

// home = f(careDay, confirmedCards, todaySchedule)
// care-surface-engine.ts가 state → component 매핑 담당
```

IVF 7-stage 데모도 static mock이 아닌 상태 전이 기반 interactive prototype으로 구현합니다.

#### AI 경계 명문화 (CLAUDE.md)

```
LLM이 해도 되는 것:
  - split candidate 제안

LLM이 해서는 안 되는 것:
  - ownership 할당
  - safety priority 결정
  - 용량·치료 전략·진단·의료 권고 추론
  - fail open (반드시 manual review로 fail closed)
```

### 3-B. Harness Engineering 요소

#### CLAUDE.md = Stable Agent Mental Model

진행 상황·임시 결정은 이 파일에 기록 금지. 파일이 안정적으로 유지되어야 AI agent의 판단 기준으로 작동합니다.

```markdown
# CLAUDE.md 구성 원칙
- 제품 정체성 (불변)
- Source hierarchy (읽기 순서)
- System model (핵심 데이터 흐름)
- AI and automation boundary
- Engineering posture (선호 / 회피)
- Behavioral coding discipline (4원칙)
- Implementation anti-patterns (반복 실패 패턴 목록)
- Verification model (완료 기준)
```

#### URL-action-result 이슈 종료 기준

모든 제품 행동·UI 변경 이슈는 아래 형식의 Green 조건을 필수 포함:

```
[URL]에서 [사용자 역할]이 [행동]했을 때 [기대 결과]를 본다.

예시:
/onboarding/career-result에서 사용자가 역량 카드를 탭했을 때
5개 옵션 중 선택한 카드에 체크 표시가 생기고 "다음" 버튼이 활성화된다.
```

레이어 기반 완료 기준은 허용하지 않음: "컴포넌트 존재", "API 200 반환", "테스트 통과"만으로는 이슈 종료 불가.

#### Green Evidence Guard CI

```yaml
# .github/workflows/green-evidence-guard.yml
# issue comment에 "Green" / "배포" / "URL" 키워드 감지
# → commit이 main에 merged됐는지 자동 검증
# → branch-only evidence면 자동 경고 코멘트 + CI fail
```

#### Behavioral Coding Discipline (AI 코딩 4원칙)

LLM coding 반복 실수 4유형을 방지하는 가이드라인:

```
1. Think Before Coding
   → assumption 명시. 불분명하면 먼저 질문.
   → 여러 해석이 가능하면 선택지 제시, 묵묵히 선택 금지.

2. Simplicity First
   → 요청된 것만. 200줄이 50줄로 가능하면 다시 씀.
   → 추측성 abstraction, 요청하지 않은 flexibility 금지.

3. Surgical Changes
   → 요청한 라인만 수정. 인접 코드 개선 금지.
   → 내 변경으로 생긴 orphan만 정리 (기존 dead code 삭제 금지).

4. Goal-Driven Execution
   → 성공 기준을 먼저 정의. 검증 후에만 완료 선언.
   → 멀티스텝 작업은 [Step → verify: check] 형식으로 계획 먼저.
```

#### Implementation Anti-patterns 명문화

반복 실패 패턴을 문서화해 재발 방지:

```
1. Demo flags inside domain logic
   → isDemoMode를 도메인 로직에 분기하지 않는다.
   → 정답: 하나의 도메인 함수, 다른 데이터 주입 포인트.

2. UI-variant issues instead of data-contract issues
   → 데이터 계약 통일 전 UI 파일로 이슈 분리 금지.

3. Weak Definition of Done
   → "컴포넌트 있음" / "API 200" / "테스트 통과"만으로는 완료 아님.
   → typecheck + 타겟 테스트 + URL-action-result + Vercel smoke 필요.

4. Type widening for convenience
   → any / Record<string, unknown> 을 도메인 모델·컨트랙트 내부에서 사용 금지.
```

#### Epic Vertical-slice Owner Rule

Epic 종료 전 담당자가 deployed URL 직접 검증 + 아래 형식 코멘트 필수:

```
Vertical slice owner: [이름]
URL: [실제 검증한 URL]
Role/action/result: [역할]이 [행동]했을 때 [기대 결과] 확인
Evidence: [테스트 통과 증거] + [Vercel 배포 smoke 확인]
```

---

## 4. CareerPT 적용 포인트

### 4-A. 즉시 적용 (오늘, 팀 싱크 전)

#### ① spec-handoff-ai.md 맨 앞에 AI 코딩 4원칙 삽입

**이유:** CareerPT에 `CLAUDE.md`가 없는 상황에서, `spec-handoff-ai.md`는 Claude Code가 AI 기능 구현 시 실제로 참조하는 유일한 맥락 파일입니다. 맨 앞에 4원칙을 넣으면 p04 ~ p15 남은 모든 화면 구현 시 자동 적용됩니다.

```markdown
## AI 코딩 4원칙

이 문서를 참조해 구현할 때는 아래 원칙을 먼저 적용합니다.

1. **Think Before Coding** — assumption을 명시하고, 불분명하면 먼저 질문합니다.
2. **Simplicity First** — 요청된 것만 구현합니다. 200줄이 50줄이 되면 다시 씁니다.
3. **Surgical Changes** — 요청한 라인만 수정합니다. 인접 코드 개선은 별도 이슈로 분리합니다.
4. **Goal-Driven Execution** — 성공 기준을 먼저 정의하고 검증 후에만 완료를 선언합니다.
```

**효과:** p11(홈), p12(리플렉션), p15(프로필) 구현 시 범위 크리프와 불필요 리팩터링 예방.

#### ② CareerPT에 CLAUDE.md 생성

**이유:** `CLAUDE.md`는 Claude Code 세션이 시작될 때 자동으로 로드되는 파일입니다. 없으면 매 세션마다 프로젝트 맥락을 재설명해야 합니다.

최소 구성:

```markdown
# CareerPT Agent Mental Model

## 제품 정체성
갤럽 강점 기반 12주 AI 커리어 코칭 앱.
강점 인터뷰 → 커리어 인터뷰 → 역량 방향 도출 → 액션아이템 생성 → 매주 회고 코칭.

## Source hierarchy
구현 결정 시 아래 순서로 읽습니다.
1. docs/schema/spec-handoff-ai.md (AI 터치포인트 정의)
2. docs/functional_spec/_post_mvp_v2/ (구현 대상 화면 스펙)
3. docs/ARCHITECTURE.md (라우트·데이터 레이어)
4. docs/STRUCTURE.md (현재 구현 현황)
5. 기존 코드

## AI 경계
- 대화 원문은 DB에 저장하지 않는다 (브라우저 메모리만).
- #3 역량 도출 Step1은 코드 로직(AI 없음). personalized_text는 DB 저장 안 함.
- AI는 시드 기반 재해석만. 새 역량 코드·goal_title을 자유 생성하지 않는다.

## Engineering posture
선호: 작은 수직 슬라이스, 명시적 상태 전이, 타입 계약, @/lib/constants 상수 참조
회피: 범위 크리프, any/Record<string,unknown> 남용, 페이지 내 데이터 하드코딩

## 핵심 개발 규칙
- supabase client: `import { supabase } from '@/lib/supabase/client'` (직접 createClient 금지)
- 경로 alias: `@/` = web/ (상대경로 금지)
- 상수 데이터: lib/constants/strengths|competencies|seeds.ts 참조 (페이지 내 인라인 금지)
- 스타일: CSS 변수 방식 `style={{ color: 'var(--accent)' }}` (Tailwind는 layout.tsx만)
```

---

### 4-B. 오늘 팀 싱크 (민선·재영과 함께)

#### ③ 남은 화면 URL-action-result 완료 기준 작성

각 화면마다 한 줄씩. 아래는 초안입니다.

| 화면 | URL-action-result 기준 |
|---|---|
| p04 강점 선택 | `/onboarding/strengths`에서 사용자가 5개 강점을 선택했을 때 "다음" 버튼이 활성화되고 strength_analyses에 저장된다. |
| p07 커리어 인트로 | `/onboarding/career-intro`에서 사용자가 "인터뷰 시작" 버튼을 탭했을 때 커리어 인터뷰 화면으로 이동한다. |
| p08 커리어 인터뷰 | `/onboarding/career-interview`에서 사용자가 6개 질문에 응답했을 때 AI가 key_insights와 ai_summary를 career_interview_results에 저장한다. |
| p09 역량 결과 | `/onboarding/career-result`에서 사용자가 역량 카드 1개를 선택했을 때 goals 테이블에 competency_code가 저장된다. |
| p10 액션아이템 | `/onboarding/action-items`에서 사용자가 액션을 확인했을 때 action_items 3~5건이 저장되고 /onboarding/complete로 이동한다. |
| p11 홈 | `/home`에서 로그인 사용자가 진입했을 때 오늘의 액션 카드와 주차 진행률이 3초 내 렌더된다. |
| p12 리플렉션 | `/reflect`에서 사용자가 평일 메모를 저장했을 때 daily_memos에 기록되고 확인 메시지가 보인다. |
| p15 프로필 | `/profile`에서 사용자가 직군을 수정했을 때 profiles 테이블이 업데이트되고 변경 내용이 즉시 화면에 반영된다. |

---

### 4-C. 다음 구현 주기 (p11 ~ p15 착수 전)

#### ④ Confirmation-first AI 패턴 적용 — #4 액션아이템 생성

spec-handoff-ai.md의 #4는 이미 시드 기반 AI 재해석으로 설계되어 있습니다. 구현 시 fevio 패턴을 적용하면 안전성이 높아집니다.

```typescript
// 현재 설계 (spec-handoff-ai.md #4)
// AI가 시드 6개 재해석 → action_items INSERT (3~5건)

// 권고 추가: 1주차 첫 생성은 즉시 저장해도 되지만
// 2주차 이후 #7 인사이트 기반 재생성 시 draft 상태로 먼저 저장
// → 사용자가 "이번 주 액션 확인" 버튼 탭 후 confirmed로 전환
// 이유: 잘못된 액션이 12주 스케줄에 박히면 수정 비용이 큼
```

#### ⑤ Daily Brief 패턴 적용 — #6 회고 코칭 사전 브리프

현재 #6는 회고 코칭 대화만 있습니다. fevio Daily Brief 패턴으로 확장:

```typescript
// /home 진입 시 오늘의 커리어 브리프 생성 (pull 패턴)
// 입력: current_week + completed_actions + 오늘 날짜
// Claude API 호출 → 오늘의 한 줄 코칭 메시지
// 저장 안 함 (ephemeral) — DB 부담 없음
// guardrail: "진단·처방·보장" 표현 출력 불가

// MVP 목적: 잘 통하는 표현 패턴 수집
// Long-term: 패턴 수집 후 deterministic template pool로 이관
```

#### ⑥ State-driven Home — weekState 기반 컴포넌트 조립

p11 홈 구현 시 AI가 UI를 생성하는 게 아니라 상태가 컴포넌트를 조립하는 구조:

```typescript
// src/domain/career-surface-engine.ts 신설 권고
type WeekState =
  | 'onboarding'       // 목표 미설정
  | 'active_week'      // 주간 진행 중 (기본)
  | 'action_due_today' // 오늘 마감 액션 있음
  | 'retro_available'  // 주말, 회고 가능
  | 'final_sprint'     // 11~12주차
  | 'completed'        // 12주 완료

// home = f(weekState, confirmedActions, todayDate)
// AI는 컨텐츠(브리프 문구)만 생성, UI 구조는 weekState가 결정
```

#### ⑦ Presentation 레인 분리

로그인 없이 화면 시연이 필요한 경우(팀 데모, 투자자 프레젠테이션):

```bash
# 환경변수 하나로 분기
NEXT_PUBLIC_CAREERPT_PRESENTATION_MODE=1 npm run build

# presentation 레인에서는 fixture 데이터로 렌더
# 실제 Supabase Auth / RLS는 사용 안 함
# Vercel 별도 프로젝트 (예: careerpt-demo.vercel.app)
```

---

### 4-D. CI/CD 강화 (medium-term)

#### ⑧ Green Evidence Guard CI 도입

```yaml
# .github/workflows/green-evidence-guard.yml
# 이슈 코멘트에 "Green" / "확인" / "배포" 감지
# → commit이 main에 있는지 자동 검증
# → branch-only면 경고 코멘트 자동 게시 + CI fail
```

#### ⑨ AI Smoke 테스트 — LLM 호출 경로 검증

briefly의 멀티 CI 워크플로 + fevio의 clinic-guide-ai-smoke 패턴을 합쳐:

```yaml
# .github/workflows/ai-smoke.yml
# PR마다 #2 커리어 인터뷰 / #4 액션아이템 생성 API 경로 검증
# 실제 Claude API 호출 (mock 아님) → 응답 형식 타입 검사
# workflow_dispatch로 수동 트리거도 가능
```

#### ⑩ Circle-based E2E 구조 도입

```
tests/e2e/
├── circle1.onboarding-ui.spec.ts        ← 프론트 격리 (Supabase mock)
├── circle2.api-integration.spec.ts      ← Next.js API Route 실제 호출
└── circle3.supabase-rls.spec.ts         ← Supabase RLS 경계 검증
```

---

## 5. 적용 우선순위 매트릭스

| 적용 항목 | 시점 | 소요 | 효과 | 담당 |
|---|---|---|---|---|
| ① spec-handoff-ai.md 4원칙 삽입 | 오늘 즉시 | 15분 | 남은 7개 MVP 화면 구현 시 자동 적용 | 개인 |
| ② CLAUDE.md 생성 | 오늘 즉시 | 30분 | 모든 Claude Code 세션 컨텍스트 자동 로드 | 개인 |
| ③ URL-action-result 기준 작성 | 오늘 팀 싱크 | 1시간 | 이슈 종료 기준 명확화, QA 기준 통일 | 팀 전체 |
| ④ Confirmation-first #4 패턴 | p10 구현 시 | 구현 내 | AI 생성 액션 오류 → 12주 영향 방지 | AI 담당 |
| ⑤ Daily Brief (ephemeral) | p11 구현 시 | 1~2일 | 홈 참여도 향상, 패턴 수집 시작 | AI 담당 |
| ⑥ weekState 기반 홈 구조 | p11 착수 전 | 반나절 | AI 생성 UI 혼재 방지, 상태 예측 가능 | 프론트 |
| ⑦ Presentation 레인 분리 | 첫 데모 전 | 1일 | 로그인 없는 시연 가능 | 프론트 |
| ⑧ Green Evidence Guard CI | 팀 합의 후 | 반나절 | branch-only 완료 선언 방지 | 팀 전체 |
| ⑨ AI Smoke 테스트 | post-MVP 착수 전 | 1~2일 | LLM 응답 형식 회귀 감지 | AI 담당 |
| ⑩ Circle-based E2E | post-MVP 안정화 후 | 2~3일 | RLS 경계 자동 검증 | 팀 전체 |

---

## 6. 핵심 인사이트

### briefly에서 배울 것

**멀티 프로바이더 AI 추상화**  
CareerPT는 현재 Claude API를 직접 호출할 예정입니다. briefly의 `SUMMARY_PROVIDER=auto` 패턴을 참고해 API 호출 레이어를 추상화하면, 나중에 모델 교체·비용 최적화·로컬 테스트가 쉬워집니다.

**Fail-open AI**  
#4 액션아이템 생성이 실패해도 사용자가 기존 시드를 직접 고를 수 있는 fallback이 spec에 이미 있습니다. 이 원칙을 모든 AI 터치포인트에 일관되게 적용하세요.

**TrendAnalyzer — AI 없는 개인화**  
#3 역량 방향 도출 Step1이 이미 코드 로직(AI 없음)으로 설계된 것은 briefly의 TrendAnalyzer와 같은 사고입니다. 사용자 행동 이력(action_completions, weekly_retros)이 쌓이면 coaching_insights 기반 액션 랭킹도 LLM 없이 계산 가능합니다.

### fevio에서 배울 것

**"LLM은 exploration tool, deterministic이 destination"**  
CareerPT의 Daily Brief(미구현)를 설계할 때 이 원칙을 처음부터 넣어야 합니다. MVP에서 LLM으로 생성하고 패턴 수집 → 이후 template pool 전환 계획을 처음부터 ADR로 박아두면, 나중에 Claude API 비용이 문제가 될 때 전환 경로가 명확합니다.

**Confirmation-first는 의료 앱만의 원칙이 아니다**  
12주 커리어 목표도 AI 생성 → 사용자 확인 → DB 저장의 흐름이 필요합니다. 잘못 생성된 역량 방향이나 액션아이템이 12주 스케줄에 저장되면 수정 비용이 큽니다. spec-handoff-ai.md의 #3 Step2가 "personalized_text를 DB 저장하지 않음"으로 설계된 것이 이미 이 원칙의 적용입니다. 같은 방향으로 일관성을 유지하세요.

**CLAUDE.md 없이는 Agent Mental Model이 없다**  
CareerPT에 CLAUDE.md가 없는 현재 상태에서 Claude Code는 매 세션마다 zero-context로 시작합니다. spec-handoff-ai.md가 사실상 CLAUDE.md 역할을 하고 있지만, AI 경계·엔지니어링 원칙·반패턴은 별도 파일로 분리하는 게 유지보수에 유리합니다.

---

## 참고 — 분석 소스 파일

| 파일 | 위치 |
|---|---|
| briefly CLAUDE.md | ~/benchmark-analysis/briefly/CLAUDE.md |
| briefly README.md | ~/benchmark-analysis/briefly/README.md |
| briefly AI 모듈 | ~/benchmark-analysis/briefly/src/ai/*.py |
| briefly CI 워크플로 | ~/benchmark-analysis/briefly/.github/workflows/ |
| fevio CLAUDE.md = AGENTS.md | ~/benchmark-analysis/fevio/CLAUDE.md |
| fevio CONTEXT.md | ~/benchmark-analysis/fevio/CONTEXT.md |
| fevio README.md | ~/benchmark-analysis/fevio/README.md |
| fevio CI 워크플로 | ~/benchmark-analysis/fevio/.github/workflows/ |
| CareerPT spec-handoff-ai.md | docs/schema/spec-handoff-ai.md |
| CareerPT ARCHITECTURE.md | docs/ARCHITECTURE.md |
| CareerPT STRUCTURE.md | docs/STRUCTURE.md |

---

*Generated by Claude Sonnet 4.6 · 2026-06-02*  
*분석 브랜치: CareerPT main (908b956)*
