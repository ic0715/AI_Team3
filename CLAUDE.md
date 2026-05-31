# AI_Team3 / CareerPT

Next.js 16 + React 19 + TypeScript + Supabase 기반 AI 커리어 코칭 앱.

## Health Stack

`/health` 스킬이 사용하는 도구. 모든 명령은 `web/` 디렉토리에서 실행.

- typecheck: `npm run typecheck` (tsc --noEmit)
- lint: `npm run lint` (eslint .)
- test: `npm test` (vitest run)
- coverage: `npm run test:coverage`

CI(.github/workflows/test.yml)가 PR 마다 typecheck + lint + test를 자동 실행.

## Testing Conventions

### 위치 (Co-location)
테스트 파일은 **소스 파일과 같은 디렉토리에** 둔다. 별도 `__tests__/` 폴더 쓰지 않음.

```
lib/utils/week.ts
lib/utils/week.test.ts     ← 같은 위치
```

이유: 파일 이동 시 테스트도 자연히 따라옴. import 경로 짧음.

### 무엇을 테스트하나
우선순위:
1. **순수 함수 (lib/utils, lib/constants)** — 가장 쉽고 ROI 높음. 의존성 없어 mock 불필요.
2. **비즈니스 룰** — 강점 5개 제약, 만 14세 검증, 코칭 시드 72개 검증 등.
3. **컴포넌트 렌더** — `@testing-library/react` 사용. 사용자 관점에서 보이는 것 검증.
4. **API 라우트** — `/api/*` 핸들러. Anthropic/Supabase mock 필요.

E2E(사용자가 클릭해서 끝까지 가는 흐름)는 별도 도구(Playwright) — 현재 미설치.

### 패턴 본보기

- 순수 함수 + 경계 케이스: [`lib/utils/auth-validation.test.ts`](web/lib/utils/auth-validation.test.ts)
- 시간 의존 함수 (fake timers): 같은 파일의 `isOver14` 테스트
- 주차 계산: [`lib/utils/week.test.ts`](web/lib/utils/week.test.ts)

새 테스트 쓸 때 위 두 파일을 보고 같은 스타일 따르기.

### 컴포넌트 안의 순수 함수
`app/foo/page.tsx` 안에 갇힌 순수 함수가 있으면 **`lib/utils/`로 추출**한 후 테스트한다.
컴포넌트 안의 private 함수는 export하지 않는 편이 깨끗함.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool.

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
