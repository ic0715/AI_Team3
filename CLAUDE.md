# CareerPT — Agent Mental Model

이 파일은 Claude Code 세션이 시작될 때 자동으로 로드됩니다.
진행 상황·임시 결정·이슈 현황은 이 파일에 기록하지 않습니다.
제품과 엔지니어링 철학이 바뀔 때만 수정합니다.

---

## 제품 정체성

CareerPT는 갤럽 CliftonStrengths 기반 **12주 AI 커리어 코칭 앱**입니다.

강점을 "아는 것"에서 끝나지 않고, 실제 업무 행동(Action Item)으로 연결합니다.

```
DISCOVER → DIRECTION → DO
강점 발견    방향 설정     실행
```

핵심 흐름:
```
강점 인터뷰 (#1)
→ 커리어 인터뷰 (#2)
→ 역량 방향 도출 (#3, 결정적 매칭 + AI 카드 개인화)
→ 액션아이템 생성 (#4, 시드 기반 AI 재해석)
→ 매주 메모·완료·회고 (#5 컨텍스트 주입)
→ 회고 AI 코칭 (#6, 브라우저 메모리)
→ 인사이트 요약 + 다음 주 액션 (#7)
```

---

## Source Hierarchy

구현 결정 시 아래 순서로 읽습니다. 앞 문서가 뒤 문서보다 우선합니다.

1. `docs/schema/spec-handoff-ai.md` — 7개 AI 터치포인트 · DB 입출력 · 저장 포맷
2. `docs/functional_spec/_post_mvp_v2/` — post-MVP 구현 기준 스펙 (p11·p12·p13·p15)
3. `docs/functional_spec/_mvp/` — MVP 구현 기준 스펙
4. `docs/ARCHITECTURE.md` — 라우트 구조 · 데이터 레이어 · 스타일 시스템
5. `docs/STRUCTURE.md` — 현재 구현 현황 · 팀 체크리스트
6. `docs/schema/spec-schema.md` — DB 스키마 (v0.9 기준)
7. `docs/ai_prompt/` — AI 프롬프트 명세 (#6 회고 코칭은 `06_reflect_coaching.md`)
8. 기존 코드 · 테스트

> `_post_mvp_v1/`은 pivot 이전 보존용입니다. 구현 기준으로 사용하지 않습니다.

---

## AI 경계

**대화 원문은 DB에 저장하지 않습니다.** 브라우저 메모리에서 대화 진행 후 AI가 구조화된 결과만 DB에 저장합니다.

AI가 해도 되는 것:
- 강점 인터뷰 대화 진행 → Top 5 추출
- 커리어 인터뷰 대화 진행 → key_insights 구조화
- 역량 카드 personalized_text 생성 (화면 표시용, DB 저장 안 함)
- competency_action_map 시드 6개를 강점 결에 맞춰 재해석
- 회고 대화 진행 → coaching_insights 구조화

AI가 해서는 안 되는 것:
- 새로운 competency_code 자유 생성 (12개 고정값만 사용)
- goal_title LLM 자유 생성 (앱 상수 한글명 그대로 INSERT)
- 역량 매칭 점수 계산 (Step 1은 코드 로직, AI 없음)
- 시드 없이 액션아이템 자유 생성 (반드시 source_seed_id 추적)

AI 없이도 핵심 흐름이 동작해야 합니다. AI는 개인화 품질을 높이는 보조 수단입니다.

---

## 핵심 개발 규칙

### Supabase 클라이언트
```ts
// ✅
import { supabase } from '@/lib/supabase/client'

// ❌ 페이지 안에서 직접 createClient() 호출 금지
// (예외: app/auth/callback/route.ts — 서버 Route Handler)
```

### 경로 alias
```ts
// ✅
import { STRENGTHS } from '@/lib/constants/strengths'

// ❌
import { STRENGTHS } from '../../lib/constants/strengths'
```

### 상수 데이터
페이지 파일 안에 강점·역량·액션 데이터를 직접 작성하지 않습니다.
```
lib/constants/strengths.ts     → 갤럽 34개 테마 (p04)
lib/constants/competencies.ts  → 12개 역량 카드 (p09)
lib/constants/seeds.ts         → 역량별 액션 아이템 시드 (p10)
```

### 스타일
```tsx
// ✅ CSS 변수 방식
<div style={{ color: 'var(--accent)', borderRadius: 'var(--radius-lg)' }}>

// Tailwind는 layout.tsx 구조 레벨에서만 사용
// post-MVP 구현 전 fix/css-variables-sync PR 머지 확인 필요
// (--ink-soft, --line, --line-strong, --accent-soft, --accent-tint)
```

### 모바일 레이아웃
모든 페이지는 width 390px 고정 카드, 화면 중앙 배치.
```tsx
<div style={{ width: '390px', minHeight: '100dvh', margin: '0 auto' }}>
```

---

## AI 코딩 4원칙

이 레포에서 구현 작업을 할 때는 아래 원칙을 먼저 적용합니다.

### 1. Think Before Coding
assumption을 명시하고, 불분명하면 먼저 질문합니다.
- 여러 해석이 가능하면 선택지를 제시합니다. 묵묵히 하나를 선택하지 않습니다.
- 더 단순한 접근이 있으면 먼저 말합니다.
- 불분명한 것이 있으면 구현 전에 명확히 합니다.

### 2. Simplicity First
요청된 것만 구현합니다. 투기성 abstraction은 만들지 않습니다.
- 요청하지 않은 flexibility, configurability를 추가하지 않습니다.
- 200줄로 쓴 코드가 50줄로 가능하면 다시 씁니다.
- "시니어 엔지니어라면 과하다고 할까?" — Yes면 단순화합니다.

### 3. Surgical Changes
요청한 라인만 수정합니다. 인접 코드를 함께 개선하지 않습니다.
- 기존 코드 스타일이 마음에 들지 않아도 맞춥니다.
- 내 변경으로 생긴 orphan(미사용 import·변수·함수)만 정리합니다.
- 기존 dead code는 언급만 하고 삭제하지 않습니다.
- 모든 변경 라인은 사용자 요청으로 직접 추적 가능해야 합니다.

### 4. Goal-Driven Execution
성공 기준을 먼저 정의하고, 검증 후에만 완료를 선언합니다.
- 멀티스텝 작업은 시작 전에 계획을 먼저 제시합니다.
  ```
  1. [Step] → verify: [확인 방법]
  2. [Step] → verify: [확인 방법]
  ```
- "완료됐습니다"는 실제 검증 후에만 선언합니다.

---

## Implementation Anti-patterns

아래 패턴이 발생하면 구현을 멈추고 다시 설계합니다.

### 1. 페이지 안에 도메인 데이터 하드코딩
```tsx
// ❌ 페이지 파일에 역량·강점·시드 데이터 직접 작성
const competencies = [{ code: 'T-1', title: '비판적 사고' }, ...]

// ✅ lib/constants/ 참조
import { COMPETENCIES } from '@/lib/constants/competencies'
```

### 2. AI 생성 결과를 확인 없이 즉시 저장
```
// ❌ AI 생성 → 바로 DB INSERT
// ✅ AI 생성 → 사용자 확인 → DB INSERT
// spec-handoff-ai.md의 #3 personalized_text = DB 미저장 원칙과 동일
```

### 3. competency_code / goal_title 자유 생성
```
// ❌ AI가 새 역량 코드나 목표 제목을 자유롭게 만들기
// ✅ 12개 고정 코드만 사용, goal_title은 앱 상수에서 조회
// 허용값: T-1~T-3, I-1~I-3, R-1~R-3, E-1~E-3
```

### 4. source_seed_id 없는 action_items 생성
```
// ❌ action_items INSERT without source_seed_id
// ✅ 모든 AI 생성 액션은 어느 시드에서 파생됐는지 추적
```

### 5. Type widening for convenience
```ts
// ❌ 도메인 모델·컴포넌트 props 안에서
const result: Record<string, unknown> = ...
const data: any = ...

// ✅ 정확한 인터페이스·discriminated union 사용
```

---

## 완료 기준 (Definition of Done)

화면 구현이 완료됐다고 선언하려면 아래를 확인합니다.

**최소 기준 (모든 변경):**
```bash
cd web
npm run typecheck   # 타입 오류 0
npm run build       # 빌드 성공
```

**UI 변경 포함 시 추가:**
- Vercel preview URL에서 실제 화면 확인
- 모바일(390px) viewport 기준 레이아웃 확인

**DB 연동 포함 시 추가:**
- Supabase RLS 정책이 적용된 실제 데이터 흐름 확인
- spec-schema.md의 저장 포맷과 일치 여부 확인

**이슈 종료 기준:**
```
[URL]에서 [사용자 역할]이 [행동]했을 때 [기대 결과]를 본다.

예시:
/onboarding/career-result에서 사용자가 역량 카드 1개를 탭했을 때
선택한 카드에 체크 표시가 생기고 "다음" 버튼이 활성화된다.
```

아래는 완료 기준이 아닙니다:
- "컴포넌트가 존재한다"
- "API가 200을 반환한다"
- "테스트가 통과한다" (URL-action-result 검증 없이)

---

## 현재 구현 현황

> 최신 현황은 `docs/STRUCTURE.md`를 참조하세요. 이 파일에는 기록하지 않습니다.

진행 중인 작업, 이슈 상태, 브랜치 현황 → GitHub Issues / `docs/STRUCTURE.md`

---

## 브랜치 전략

| 브랜치 | 용도 |
|---|---|
| `main` | 배포 브랜치. 직접 커밋 금지, PR로만 머지 |
| `feature/<화면ID>` | 화면 단위 구현 |
| `fix/<내용>` | 버그 수정 |
| `docs/<내용>` | 문서 작업 |
