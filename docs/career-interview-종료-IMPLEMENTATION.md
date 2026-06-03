# 커리어 인터뷰 종료 재설계 — 구현 지시서 (Claude Code 핸드오프)

> 이 문서는 **새 Claude Code 세션에 그대로 붙여넣어 구현**할 수 있도록 작성되었다.
> 사전 지식 없이 이 문서만으로 전 범위를 재현할 수 있다.
>
> **작업 원칙:**
> - 모든 경로는 레포 루트 기준. (`web/` = Next.js 앱)
> - **⚠️ 시크릿 금지:** `.env`, 키 포함 파일은 절대 Read/Edit 하지 말 것. 필요 시 사용자에게 절차만 안내.
> - 각 Part 완료 후 `cd web && npm run typecheck` 로 검증.

---

## 0. 대상 파일

| # | 파일 | 작업 |
|---|---|---|
| A1 | `web/app/api/career-interview/chat/route.ts` | 고정 턴 강제 종료 제거 + forceClose 주입 |
| A2 | `web/lib/prompts/career-interview.ts` | 종료 프롬프트 규칙 §11~§14 + forceClose 블록 |
| B1 | `web/app/onboarding/career-interview/page.tsx` | "인터뷰 종료하기" 버튼 + 확인 다이얼로그 + 1단계 finalize |
| B2 | (선택) DB | `career_interview_results.end_reason` nullable 컬럼 |

---

## Part A — 종료 로직 재설계

### A1. `route.ts`

**(1) 상수**: 고정 턴 상한(`HARD_COMPLETE_THRESHOLD` 등)을 **제거**하고 아래로 대체:

```ts
// ⚠️ 고정 턴 기반 '강제 종료'는 두지 않는다. 세션 완료(isComplete)는 오직 코치의
// 자연 종료 키워드(Path A) — 즉 코치의 '발화'로만 일어난다. turn_count 자체는 완료 신호가 아니다.
// 63턴 이후부터는 매 턴 forceClose 지시를 프롬프트에 주입해, 코치가 §14에 따라
// 스스로 따뜻하게 마무리(§9 키워드)하도록 '강하게 유도'한다(끊는 게 아니라 유도).
const FORCE_CLOSE_FROM = 63;
```

**(2) 종료 키워드** (`ENDING_KEYWORDS`)는 유지:
```ts
const ENDING_KEYWORDS = ['오늘 인터뷰는 여기서', '오늘은 여기까지', '여기서 마무리할게요'];
function detectEnding(text: string): boolean {
  return ENDING_KEYWORDS.some((k) => text.includes(k));
}
```

**(3) POST 핸들러** — `userMsgCount` 계산 후 forceClose 전달:
```ts
const userMsgCount = messages.filter((m) => m.role === 'user').length;
const forceClose = userMsgCount >= FORCE_CLOSE_FROM;

const system = buildSystemPrompt({
  /* ...기존 필드... */
  forceClose,
});
```

**(4) 완료 판정** — 턴 기반 완료 제거, 코치 발화만:
```ts
const text = extractText(message).trim();

// 완료는 오직 코치의 자연 종료 키워드(Path A)로만. turn_count로 강제 완료하지 않음.
const isComplete = detectEnding(text);

// 관측용: 매우 길어졌는데도 코치가 아직 안 닫은 경우 로그만 남김(완료 강제 아님).
if (!isComplete && userMsgCount >= FORCE_CLOSE_FROM + 7) {
  console.warn(`[career-interview/chat] ${userMsgCount} user turns and still open — coach has not emitted a closing keyword despite forceClose`);
}

const response: ChatResponse = { content: text, isInterviewComplete: isComplete };
return NextResponse.json(response);
```

> 캐싱(system / history cache_control) 로직은 기존 그대로 둔다.

### A2. `career-interview.ts`

**(1) `buildSystemPrompt` 시그니처에 `forceClose` 추가:**
```ts
export function buildSystemPrompt(opts: {
  nickname: string; jobField: string; careerLevel: string;
  mainConcern: string; strengthsKo: string[]; strengthsEn: string[];
  forceClose?: boolean; // 충분히 길어졌을 때 §14 자연 종료를 확실히 유도
}): string {
```

**(2) 반환부 직전에 forceClose 블록 정의, 마지막에 append:**
```ts
const forceCloseBlock = opts.forceClose
  ? `

---

# ⚠️ 이번 턴 지시 (대화가 충분히 길어짐)

대화가 충분히 길어졌습니다. 보통 목표는 이미 다뤄졌을 시점이니, 새 주제를 더 열지 말고 위 §13·§14의 (나) 방식으로 **분명하게 마무리로 안내**하세요: 오늘 다룬 것을 짧게 정리하고 **"더 깊은 건 주간 회고에서 이어간다"**고 전한 뒤 **§9의 종료 키워드 중 하나를 포함해** 따뜻하게 닫으세요. ("더 하실래요?"로 무한히 열지 말 것. 단, 🔴 진행 중이면 한 문장 받아준 뒤 닫기.)`
  : '';

return `${BASE_SYSTEM}

---

${userInfoBlock}

---

${RULES}

${FEWSHOT}${forceCloseBlock}`;
```

**(3) `RULES` 템플릿에 아래 규칙들을 §10 다음에 추가/치환** (전문 그대로):

```
## 11) 합의 주제 앵커링 (삼천포 방지) — 상시 능동

합의 주제(agreed_focus)는 **매 턴 상시로 의식하는 닻**입니다. 곁가지로 빠질 때만 교정하는 게 아닙니다.

- **상시:** 응답을 만들기 전, 지금 이 발화가 agreed_focus와 어떻게 연결되는지 머릿속으로 먼저 확인하세요. 평상시 follow-up 질문도 가능한 한 합의 주제로 **수렴**하도록 방향을 잡으세요.
- **⚠️ 닻은 고정값이 아니다 — "삼천포"와 "더 깊은 진짜 주제 발견"을 구분하라:** agreed_focus는 보통 초반(Phase 2)에 사용자가 자기 문제를 아직 다 모를 때 합의한 **초기 가설**입니다. 깊게 탐색하다 *"사실 진짜 문제는 ○○인 것 같다"*가 드러나는 건 막을 곁가지가 **아니라 따라가야 할 발견**입니다.
  - 🚫 **삼천포(교정 대상):** 합의 주제와 무관한 데로 새고, 돌아올 실이 안 보임 → '교정'으로 부드럽게 데려오기.
  - ✅ **생산적 심화(따라갈 것):** 합의 주제를 파고들다 더 진짜인 주제가 떠오름 → 옛 닻으로 끌고 오지 말고 따라가고, *"그러면 오늘은 ○○보다 △△ 쪽을 다뤄보는 게 더 맞겠네요"* 처럼 **새 주제를 다시 미러링해 agreed_focus를 갱신**.
- **교정:** (삼천포일 때만) 발화에 공감·인정 뒤 부드럽게 원래 주제로. 강제로 끊지 말 것.
- **닻이 비어 있을 때 폴백:** agreed_focus가 비면, **Phase 2에서 직접 미러링했던 "그럼 오늘은 ○○를…" 주제(또는 갱신한 최신 주제)를 스스로 기억**해 닻으로 삼으세요.

## 흐름 경계 판단 — "일단락" vs "진행 중" 신호 (§12·§13·§14 공통 기준)

아래의 "자연스러운 일단락 지점"은 **turn_count 숫자가 아니라 사용자의 직전 발화 신호**로 판단합니다. 점검·마무리는 ① turn_count 구간 안 + ② 🟢 신호가 동시에 맞을 때만. 🔴 신호면 turn_count 무관하게 **보류**.

🟢 **일단락 신호:** 짧은 수긍("네, 맞아요"), 스스로 결론·통찰("결국 ~인 것 같아요"), 답을 다 하고 새 정보 없음, 직전 질문이 닫히고 확장 안 함.
🔴 **진행 중 신호:** 발화가 펼쳐지는 중, "근데/그래서/그리고…"로 이어짐, 새 사건·인물·감정을 막 꺼냄, 코치에게 되묻기/감정 고조.

## 12) 방향 점검 체크포인트 (turn_count 30~35, 🟢 신호에서만)

turn_count가 30~35이고 🟢 신호일 때, 딱 한 번: ① 지금까지를 2~3문장 요약, ② agreed_focus 재상기, ③ "이 방향이 맞는지, 아니면 더 다뤄야 할 진짜 주제가 드러난 건 아닌지" 점검하는 재정렬 질문. (진짜 주제가 나오면 §11로 agreed_focus 갱신.)
⚠️ 마무리 제안 아님. 종료 키워드 쓰지 말 것. 세션당 1회.

## 종료의 1차 기준 — 목표 완결 (turn 무관)

종료 기준은 턴 숫자가 아니라 "목표가 찼는가"입니다. 다음 둘이 모두 충족되면 오늘 목표(arc)가 완결된 것:
- ✅ ① 합의 주제에 대해 **방향·통찰**을 얻음
- ✅ ② 가장 작은 **다음 한 발(next action)**이 구체화됨
완결 전에는 턴이 쌓여도 마무리 권하지 말고 계속. 완결되면 §13으로 마무리.
⚠️ **온보딩은 "충분히"면 됩니다 — "완벽히"가 아닙니다.** 1회 온보딩 세션 = 결과 1개, 더 깊은 탐색은 이후 **주간 회고 코칭**에서 계속. 역량 도출에 충분한 재료가 모이면 닫는 게 옳다.

## 13) 목표가 찼을 때의 마무리 — 분명하게 (turn 무관, 55~62는 보조 신호일 뿐)

완결 조건 충족 + 🟢 신호이면 마무리로. (55~62는 "이쯤이면 보통 목표가 찼을 시점"이라는 보조 힌트일 뿐. 목표 안 찼으면 62턴이어도 계속.)
- 오늘 목표였던 ○○가 또렷해졌다는 점 + 또렷해진 한 가지 + 다음 한 발을 짧게 정리,
- **§9 종료 키워드로 따뜻하게 닫기.**
⚠️ **목표 충족 후에도 계속하고 싶어 할 때 ((나) 방식):** "더 하실래요?"로 끝없이 열지 말고 **분명하지만 따뜻하게 마무리로 안내**하되 "다음으로 이어진다"는 출구를 주기.
  - 예: "오늘 목표였던 ○○는 충분히 또렷해진 것 같아요. 더 깊은 이야기는 앞으로 **주간 회고**에서 계속 이어갈 수 있어요. 오늘은 여기서 정리할게요 — 오늘 인터뷰는 여기서 마무리할게요."

## 14) 매우 길어졌을 때의 마무리 유도 (turn_count 63 이후 — 보조 안전선, 맥락 우선)

turn_count 63 이상인데 아직 안 닫혔다면 보통 목표는 이미 다뤄졌고 수확이 체감 감소하는 구간. 새 주제 열지 말고 §13의 (나) 방식으로 **분명하게 마무리로 안내**. 🟢에서, 늦어도 한두 턴 안에.
- 오늘 다룬 것을 짧게 정리 + "더 깊은 건 주간 회고에서 이어간다" 안내 + **§9 종료 키워드로 닫기.**
⚠️ **🔴 진행 중 안전장치:** 사용자가 방금 새 이야기를 꺼냈거나 펼치는 중(🔴)이면, 그 발화에 먼저 한 문장 공감·응답 뒤 마무리로. 말 끊고 곧장 "정리해볼게요" 금지.
⚠️ 시스템은 턴 수로 강제 종료하지 않음 — 닫는 것은 §9 발화. 이 구간에선 묻지 말고("더 하실래요?" 금지) 분명히 닫기.
```

> §9 종료 키워드(`오늘 인터뷰는 여기서 마무리할게요` 등)와 §10 Running State 인지 규칙은 기존 그대로 둔다. 위 규칙은 §10 다음, FEWSHOT 앞에 위치.

---

## Part B — "인터뷰 종료하기" 버튼 (`page.tsx`)

### B0. 현재 구조 (참고)
- 상태: `isComplete`, `isFinalizing`, `phase`(`'opening'|'echo_agreement'|'exploration'|'closing'`), `messages`.
- 헤더(JSX): `←` 버튼 + 가운데 "커리어 인터뷰" + **우측 대칭용 빈 div(`width:44px`)** ← 여기에 버튼을 넣는다.
- 완료 처리: `handleFinalize()` → `triggerFinalize(messages)` → finalize API 호출 + DB INSERT + `router.push('/onboarding/career-result')`.
- 모달 패턴 참고: "세션 복원 프롬프트"(`showResumePrompt`) — `rgba(0,0,0,.5)` 오버레이 + 가운데 카드(`borderRadius:20px`).

### B1. 상태 추가
```tsx
const [showEndConfirm, setShowEndConfirm] = useState(false);
// 조기 종료 여부: 탐색(exploration) 진입 전이면 결과가 부실 → 경고 변형
const isEarlyExit = phase === 'opening' || phase === 'echo_agreement';
```

### B2. 헤더 우측 빈 div를 버튼으로 교체
```tsx
{/* 기존: <div style={{ width: '44px', flexShrink: 0 }} /> */}
{!isComplete && !isFinalizing ? (
  <button
    onClick={() => setShowEndConfirm(true)}
    style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600,
      padding: '0 8px', height: '44px', flexShrink: 0, whiteSpace: 'nowrap',
    }}
    aria-label="인터뷰 종료하기"
  >
    인터뷰 종료하기
  </button>
) : (
  <div style={{ width: '44px', flexShrink: 0 }} />
)}
```
> 모바일 폭이 빠듯하면 라벨을 `"종료"`로 축약.

### B3. 확인 다이얼로그 (모달) — resume 프롬프트와 동일 패턴
헤더 아래 적절한 위치(다른 모달들 근처)에 추가:
```tsx
{showEndConfirm && (
  <div style={{
    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
    width: 'min(430px, 100vw)', height: '100dvh',
    background: 'rgba(0,0,0,.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px',
  }}>
    <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '28px 24px', width: '100%' }}>
      <div style={{ fontSize: '17px', fontWeight: 700, textAlign: 'center', marginBottom: '8px', color: 'var(--text-primary)' }}>
        {isEarlyExit ? '조금 더 이어가 볼까요?' : '인터뷰를 종료할까요?'}
      </div>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: '24px' }}>
        {isEarlyExit
          ? '아직 충분히 이야기 나누지 못했어요. 지금 종료하면 결과가 간단할 수 있어요.'
          : '지금 종료하면 지금까지 나눈 내용으로 커리어 결과를 만들어 드려요.'}
      </p>
      {/* 강조 버튼: 조기면 [계속하기], 일반이면 [종료하고 결과 보기] */}
      <button
        onClick={() => {
          if (isEarlyExit) { setShowEndConfirm(false); return; }   // 계속하기
          setShowEndConfirm(false);
          handleFinalize();                                         // 1단계: 곧장 finalize
        }}
        style={btnPrimary}
      >
        {isEarlyExit ? '계속하기' : '종료하고 결과 보기'}
      </button>
      {/* 보조 버튼 */}
      <button
        onClick={() => {
          if (isEarlyExit) { setShowEndConfirm(false); handleFinalize(); } // 그래도 종료
          else { setShowEndConfirm(false); }                               // 계속하기
        }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px', width: '100%', padding: '12px', marginTop: '4px' }}
      >
        {isEarlyExit ? '그래도 종료' : '계속하기'}
      </button>
    </div>
  </div>
)}
```
> `btnPrimary`는 파일 내 기존 스타일 상수(“진단 완료하기” 버튼이 사용)를 재사용.

### B4. 동작 요약
- 일반(탐색 후): [종료하고 결과 보기] → `handleFinalize()` → 기존 🔍 로딩 오버레이 → 결과 페이지.
- 조기(탐색 전): [계속하기](강조)로 되돌리고, [그래도 종료] 선택 시에만 finalize.
- finalize 진행 중(`isFinalizing`)에는 헤더 버튼이 숨겨짐(B2 조건).

### B5. (선택) `end_reason` 기록
DB에 `end_reason` 컬럼을 추가했다면, `triggerFinalize`/`finalizeInterview`의 INSERT에 값 전달:
- 사용자 버튼 종료: `'user_button'`
- 키워드 종료(Path B): `'user_keyword'`
- 코치 자연 종료: `'coach_natural'`
(미추가 시 이 단계 생략 — 기능에 영향 없음.)

---

## Part B2 — (선택) DB

DB 설계자/마이그레이션 담당에게 요청:
```sql
ALTER TABLE career_interview_results
  ADD COLUMN end_reason text;  -- nullable. 'coach_natural' | 'user_button' | 'user_keyword'
```
> 기능 필수 아님(분석용). RLS/스키마 정책은 기존 테이블과 동일하게.

---

## 검증 체크리스트

- [ ] `cd web && npm run typecheck` 통과 (특히 `buildSystemPrompt`에 `forceClose` optional 추가 후)
- [ ] `npm run dev` 후 `/onboarding/career-interview`:
  - [ ] 헤더 우상단 "인터뷰 종료하기" 노출
  - [ ] 1턴(탐색 전) 종료 시 **조기 경고** 다이얼로그
  - [ ] 합의/탐색 후 종료 시 **일반** 다이얼로그 → [종료하고 결과 보기] → 결과 페이지
  - [ ] 30턴 이상 진행해도 **강제 종료되지 않음** (입력창 유지)
  - [ ] 63턴 이상에서 코치가 **스스로 자연스럽게 마무리**(§9 키워드)로 닫음
- [ ] (선택) `end_reason` 값이 의도대로 기록됨

## 주의
- **⚠️ `.env` 등 시크릿 파일 Read/Edit 금지.** dev 실행 시 키 노출 주의. (`ANTHROPIC_API_KEY`/`_BASE_URL` 이 Next.js `.env.local`을 덮어쓸 수 있으니 dev 띄울 때 unset 필요할 수 있음.)
- 본 변경의 prompt 규칙은 **web 앱 전용**(`career-interview.ts`)이며, sim 하니스(`ralph_loop`)의 `docs/ai_prompt/*.md`에는 반영되지 않는다(별도 작업).
