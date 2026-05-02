# spec-ai-coaching.md — AI 코칭 기능 명세

**최종 업데이트:** 2026-05-02  
**상태:** 신규 작성 (ADR_001 v2 기반)

---

## 개요

CareerPT의 핵심 기능인 AI 코칭 세션의 기술 명세다.
ICF MCC 기준과 갤럽 CliftonStrengths 34를 기반으로 동작한다.

코칭 설계 원칙은 `docs/02_what/COACHING_DESIGN.md`를 참고한다.

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `ai/system_prompt_v2.md` | AI 코치 행동 원칙 |
| `ai/keyword_mapping.md` | 갤럽 34 키워드 매핑 테이블 |
| `docs/02_what/COACHING_DESIGN.md` | 코칭 대화 설계 |
| `docs/02_what/USER_FLOW.md` | 전체 사용자 흐름 |

---

## 기술 스택

| 항목 | 내용 |
|---|---|
| AI 모델 | claude-sonnet-4-20250514 |
| API | Anthropic Messages API |
| 인증 | Supabase Auth |
| 대화 저장 | Supabase DB |

---

## 온보딩 단계별 AI 처리

### 기본설문 처리

3개 항목을 수집해서 세션 컨텍스트로 저장한다.

```typescript
const userContext = {
  nickname: "길동",
  current_role: "PM",
  main_concern: "열심히 하는데 방향이 없는 것 같아요"
}
```

### 보완 인터뷰 처리 (파일 없는 사용자)

5개 답변을 분석해서 갤럽 키워드 후보를 잠정 설정한다.

```typescript
// 보완 인터뷰 완료 후 AI 내부 처리
const interviewSummary = await analyzeInterview({
  q1: "기획 회의에서 아이디어 낼 때 가장 몰입돼요",
  q2: "복잡한 걸 정리해달라는 부탁을 많이 받아요",
  q3: "약속한 건 반드시 지켜야 해요",
  q4: "주로 정리하고 방향 잡아주는 역할이에요",
  q5: "이직해야 할지 모르겠어요"
})
// → keywordCandidates: ['전략', '정리', '책임', '집중']
// 사용자에게 제시하지 않고 코칭 배경 맥락으로만 활용
```

### 파일 업로드 처리

```typescript
// PDF/이미지를 base64로 변환 후 Claude에 전달
const fileContext = await processUploadedFile(file)
// → 코칭 세션의 system prompt에 배경 맥락으로 추가
// → AI가 먼저 분석 결과를 제시하지 않도록 명시
```

---

## 코칭 세션 API 구조

### 시스템 프롬프트 구성

```typescript
function buildSystemPrompt(userContext, fileContext?, interviewContext?) {
  let prompt = SYSTEM_PROMPT_BASE  // ai/system_prompt_v2.md 내용

  // 사용자 배경 맥락 추가
  prompt += `\n\n[사용자 배경 맥락 - 내부 참조용, 먼저 언급하지 말 것]`
  prompt += `\n이름: ${userContext.nickname}`
  prompt += `\n현재 역할: ${userContext.current_role}`
  prompt += `\n주요 고민: ${userContext.main_concern}`

  if (fileContext) {
    prompt += `\n업로드 파일 정보: ${fileContext}`
    prompt += `\n※ 위 정보는 대화 중 자연스럽게 연결할 때만 사용할 것`
  }

  if (interviewContext) {
    prompt += `\n보완 인터뷰 요약: ${interviewContext}`
    prompt += `\n잠정 키워드 후보: ${interviewContext.keywordCandidates}`
    prompt += `\n※ 키워드를 먼저 제시하지 말 것. 대화로 발견하게 할 것`
  }

  return prompt
}
```

### 메시지 API 호출

```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: buildSystemPrompt(userContext, fileContext, interviewContext),
    messages: conversationHistory
  })
})
```

---

## DB 스키마

### onboarding_interviews 테이블 (신규)

```sql
CREATE TABLE onboarding_interviews (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 보완 인터뷰 5개 답변
  q1_energy     text,   -- 몰입 순간
  q2_strengths  text,   -- 타인이 인식하는 강점
  q3_values     text,   -- 핵심 가치
  q4_role       text,   -- 관계/역할 스타일
  q5_concern    text,   -- 커리어 고민 (= 기본설문 3번과 연결)

  -- AI 분석 결과 (내부용)
  keyword_candidates  text[],  -- 잠정 갤럽 키워드 후보

  created_at  timestamptz DEFAULT now()
);
```

### sessions 테이블 (신규)

```sql
CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  started_at  timestamptz DEFAULT now(),
  ended_at    timestamptz,

  -- 세션 결과 (사용자가 직접 선택)
  keywords      text[],  -- 사용자가 선택한 갤럽 키워드
  first_action  text,    -- 사용자가 정한 첫 번째 행동

  created_at  timestamptz DEFAULT now()
);
```

### messages 테이블 (신규)

```sql
CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role        text NOT NULL,  -- 'user' | 'assistant'
  content     text NOT NULL,

  created_at  timestamptz DEFAULT now()
);
```

### profiles 테이블 변경

```sql
-- 기존에서 유지되는 컬럼
-- id, user_id, nickname, created_at, updated_at

-- 새로 추가되는 컬럼
ALTER TABLE profiles
  ADD COLUMN current_role          text,      -- 현재 직무/역할
  ADD COLUMN main_concern          text,      -- 기본설문 3번
  ADD COLUMN has_file_upload       boolean DEFAULT false,
  ADD COLUMN accumulated_keywords  text[];    -- 전체 세션 누적 키워드

-- 폐기되는 컬럼
-- age, company, job_description, tenure
-- interests, current_problem, emotions
-- onboarding_step, onboarding_done
```

---

## 세션 흐름 구현

### 1. 보완 인터뷰 저장 및 분석

```typescript
// 인터뷰 완료 시
const { data: interview } = await supabase
  .from('onboarding_interviews')
  .insert({
    user_id: userId,
    q1_energy: answers.q1,
    q2_strengths: answers.q2,
    q3_values: answers.q3,
    q4_role: answers.q4,
    q5_concern: answers.q5,
  })
  .select()
  .single()

// AI로 키워드 후보 분석 (내부용)
const keywordCandidates = await analyzeForKeywords(answers)
await supabase
  .from('onboarding_interviews')
  .update({ keyword_candidates: keywordCandidates })
  .eq('id', interview.id)
```

### 2. 코칭 세션 시작

```typescript
const { data: session } = await supabase
  .from('sessions')
  .insert({ user_id: userId })
  .select()
  .single()

// 오프닝 메시지 저장
await supabase.from('messages').insert({
  session_id: session.id,
  user_id: userId,
  role: 'assistant',
  content: '요즘 일이나 커리어에서 가장 마음에 걸리는 게 뭔가요?'
})
```

### 3. 대화 진행

```typescript
// 전체 히스토리로 Claude 호출
const { data: messages } = await supabase
  .from('messages')
  .select('role, content')
  .eq('session_id', sessionId)
  .order('created_at', { ascending: true })

const aiResponse = await callClaude({
  system: buildSystemPrompt(userContext, fileContext, interviewContext),
  messages: messages
})
```

### 4. 세션 종료

```typescript
// 사용자가 선택한 키워드와 첫 행동 저장
await supabase
  .from('sessions')
  .update({
    ended_at: new Date().toISOString(),
    keywords: selectedKeywords,
    first_action: userFirstAction,
  })
  .eq('id', sessionId)

// 누적 키워드 업데이트
await supabase.rpc('update_accumulated_keywords', {
  p_user_id: userId,
  p_new_keywords: selectedKeywords
})
```

---

## 보안

```typescript
// Next.js API Route (서버사이드에서만 API 키 사용)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY  // 서버 환경변수만
    }
  })
}
```

파일 업로드 제한: 5MB, PDF/JPG/PNG/DOCX만 허용

---

## RLS 정책

```sql
CREATE POLICY "본인 인터뷰만" ON onboarding_interviews
  USING (auth.uid() = user_id);

CREATE POLICY "본인 세션만" ON sessions
  USING (auth.uid() = user_id);

CREATE POLICY "본인 메시지만" ON messages
  USING (auth.uid() = user_id);
```

---

## 미구현 / 추후 개발

| 항목 | 내용 |
|---|---|
| 스트리밍 응답 | 현재 전체 응답 후 표시 → 스트리밍으로 개선 필요 |
| 세션 간 맥락 요약 | 세션이 많아질 때 히스토리 압축 필요 |
| 키워드 진화 추적 | 시간에 따른 키워드 변화 시각화 |
| 음성 입력 | 텍스트 우선, 이후 음성 추가 검토 |
