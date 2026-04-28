##"파일 업로드" 기능 스펙

---

## 역할 정의

> **Phase 2 AI 코치가 대화 중 활용할 순수한 재료만 준비한다**

---

## 핵심 원칙

| 원칙 | DO ✅ | DON'T ❌ |
|------|-------|---------|
| **해석하지 않는다** | 갤럽 PDF → `"전략, 분석, 배움"` (이름만 추출) | `"전략 강점이 높으므로 기획자에 적합"` |
| **판단하지 않는다** | 이력서 → `"PM, 3년"` (팩트만 추출) | `"리더십 8점, 증거 5개로 검증됨"` |
| **미리 준비하지 않는다** | Phase 2에 데이터 전달 | `"이런 질문을 할 예정입니다"` |

---

## v1.0 → v2.0 주요 변경사항

| 항목 | v1.0 | v2.0 |
|------|------|------|
| 역할 | AI 분석가 | 재료 준비자 |
| 소프트스킬 추론 | ✅ 포함 | ❌ 삭제 |
| 강점-경력 교차검증 | ✅ 포함 | ❌ 삭제 |
| 질문 미리 생성 | ✅ 포함 | ❌ 삭제 |
| 연락처 수집 | 이메일, 전화 | ❌ 제외 |
| 이력서 업로드 | 필수 | 선택 |
| 갤럽 강점 | Top 5 | Top 10 |
| UI 화면 수 | 6개 | 4개 |
| 코드량 | ~500줄 | ~150줄 |

---

## 전체 플로우

```
[Phase 1] 기본 정보 입력
        ↓
      [S2] 파일 업로드
        │
        ├── 갤럽 PDF 업로드  →  Top 10 강점 추출 (해석 없음)
        │
        ├── 이력서 업로드 (선택)  →  경력 팩트만 추출
        │
        └── 직접 입력  →  텍스트로 입력
        ↓
[Phase 2] AI 코칭 인터뷰
        └── S2 데이터를 컨텍스트로 활용
        └── AI가 대화 중 자연스럽게 연결
```

---

## S2 → Phase 2 전달 데이터

```typescript
interface S2ToPhase2Data {
  user_info: {
    name: string;
    current_role: string;
    concern_draft: string;
  };

  gallup?: {
    top10: Array<{
      rank: number;
      name_ko: string;
      name_en: string;
      category: "전략적 사고" | "실행력" | "관계 구축" | "영향력";
    }>;
  };

  career?: {
    current_company: string;
    facts: Array<{
      company: string;
      position: string;
      period: string;
    }>;
  };

  meta: {
    s2_completed_at: string;
    has_gallup: boolean;
    has_career: boolean;
  };
}
```

---

## 성공 지표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 갤럽 파싱 성공률 | > 90% | PDF 업로드 → Top 10 추출 완료 |
| 파싱 소요 시간 | < 3초 | 업로드 → 확인 화면 |
| Phase 2 진입률 | > 80% | S2 완료 → Phase 2 시작 |
| 사용자 이탈률 | < 20% | S2 중 이탈 |

---

## 차별화 포인트

| 일반 자기계발 앱 | 우리 |
|----------------|------|
| AI가 강점 분석 | 추출만 (해석 없음) |
| AI가 진로 추천 | 사용자가 탐색 |
| 결과 리포트 제공 | 대화로 발견 |
| "당신은 이런 사람" | "어떻게 느끼나요?" |

> **AI가 답을 주지 않습니다. 막연한 고민을 또렷한 언어로.**
> ICF 국제코치연맹 기준 AI 코칭

---

## 1. 데이터 추출

### 1.1 갤럽 CliftonStrengths 파싱

**목표 데이터**

```typescript
{
  top10: [
    {
      rank: 1,
      name_ko: "전략",
      name_en: "STRATEGIC",
      category: "전략적 사고"
    }
    // ... 10개
  ]
}
```

**추출 원칙**

- ✅ 이름만 추출 (해석 없음)
- ✅ 순서 보존 (1~10위)
- ✅ 카테고리 매핑 (E/I/R/T)
- ❌ 설명, 점수, 분석 포함 금지

**카테고리 매핑**

| 코드 | 분류 |
|------|------|
| E | 실행력 |
| I | 영향력 |
| R | 관계 구축 |
| T | 전략적 사고 |

**Claude API 프롬프트**

```
다음 갤럽 CliftonStrengths PDF에서 Top 10 강점을 추출하세요.

반드시 JSON 형식으로만 응답:
{
  "top10": [
    {
      "rank": 1,
      "name_ko": "전략",
      "name_en": "STRATEGIC",
      "category": "전략적 사고"
    }
  ]
}

규칙:
1. 이름만 추출 (해석 금지)
2. Top 10까지만
3. 못 찾으면 빈 배열
```

**파싱 실패 처리**

- Phase 2 진입 허용
- 사용자에게 재업로드 옵션 제공
- 강점 없이도 기본 코칭 진행 가능

---

### 1.2 이력서 파싱 (선택)

**목표 데이터**

```typescript
{
  basic_info: {
    name: "홍길동",
    current_position: "PM",
    current_company: "OO 스타트업"
  },
  career_facts: [
    {
      company: "OO 스타트업",
      position: "PM",
      period: "2021.03 ~ 현재",
      duration_months: 36
    }
  ]
}
```

**추출 원칙**

- ✅ 회사명, 직무명, 기간만 추출
- ❌ 업무 내용 분석 금지
- ❌ 성과 평가 금지
- ❌ 리더십 여부 판단 금지
- ❌ 이메일, 전화번호 등 개인정보 제외

---

### 1.3 직접 입력

파일 없이 텍스트로 직접 입력하는 방식. 파싱 없이 Phase 2에 그대로 전달.

```
예시: "MBTI: INTJ / 강점: 공감, 친화, 발상"
```

```typescript
{
  type: "manual",
  content: "MBTI: INTJ / 강점: 공감, 친화, 발상"
}
```

---

## 2. UI/UX 플로우

### 화면 구성 (4개)

**Screen 1 — 업로드**

```
┌────────────────────────────────────────┐
│ ← 내 정보 업로드              2 / 4    │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                        │
│ 내 정보를 업로드해주세요                │
│                                        │
│ 이력서, 강점·흥미·이키가이 등...        │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │      ⬆  탭해서 파일 업로드       │  │
│ └──────────────────────────────────┘  │
│                                        │
│  • 이력서                               │
│  • 강점 진단 결과                       │
│  • 성격·흥미 진단                       │
│                                        │
│ 또는 내용을 직접 입력                   │
│ [                                    ] │
│                                        │
│ 진단 결과나 이력서가 없다면?            │
│ 없어도 AI 코치와 대화할 수 있어요.      │
│                                        │
│             [건너뛰기]    [다음]        │
└────────────────────────────────────────┘
```

**Screen 2 — 파싱 중**

```
┌────────────────────────────────────────┐
│                                        │
│         🔄 파일 분석 중...              │
│                                        │
│   ████████████░░░░░░░░  70%           │
│                                        │
│   강점 테마 찾는 중...                  │
│                                        │
└────────────────────────────────────────┘
```

프로그레스 단계:
1. 30% — "파일을 읽고 있어요..."
2. 70% — "강점 테마 찾는 중..."
3. 100% — "거의 다 됐어요!"

**Screen 3 — 결과 확인**

```
┌────────────────────────────────────────┐
│ 확인 완료                               │
│ AI 코치가 대화 중 이 정보들을 활용해요  │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐  │
│ │ 추출된 정보                      │  │
│ │  1. 전략 (STRATEGIC)  [T]        │  │
│ │  2. 분석 (ANALYTICAL) [T]        │  │
│ │  ...                             │  │
│ │                                  │  │
│ │  T: 전략적 사고  ·  E: 실행력    │  │
│ └──────────────────────────────────┘  │
│                                        │
│                   [다음]               │
└────────────────────────────────────────┘
```

**Screen 4 — 확인 완료**

```
┌────────────────────────────────────────┐
│ 확인 완료                               │
│ AI 코치가 대화 중 이 정보들을 활용해요  │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐  │
│ │  ✓  갤럽 Top 10 강점             │  │
│ │  ✓  직접 입력한 정보             │  │
│ └──────────────────────────────────┘  │
│                                        │
│ 이제 AI 코치와 대화를 시작할 준비가    │
│ 됐어요.                                │
│                                        │
│ AI 코치는 답을 주지 않습니다.           │
│ 막연한 고민을 또렷한 언어로.            │
│                                        │
│         [다음: AI 코치 만나기 →]       │
└────────────────────────────────────────┘
```

### 인터랙션 규칙

- **파일 업로드**: 클릭 또는 드래그앤드롭, 5MB 제한, `.pdf`만 허용
- **직접 입력**: 텍스트 입력 시 [다음] 버튼 활성화, Enter 키로 진행
- **건너뛰기**: 바로 확인 완료 화면으로 이동, 체크리스트: "기본 정보 준비 완료"

---

## 3. API 백엔드

### 3.1 엔드포인트

**`POST /api/parse-file`**

요청:

```json
{
  "base64Data": "JVBERi0xLjQK...",
  "filename": "gallup.pdf",
  "userId": "user_12345"
}
```

응답 (성공):

```json
{
  "success": true,
  "data": {
    "type": "gallup",
    "top10": [
      {
        "rank": 1,
        "name_ko": "전략",
        "name_en": "STRATEGIC",
        "category": "전략적 사고"
      }
    ]
  },
  "confidence": 0.95,
  "processing_time_ms": 2800
}
```

응답 (실패):

```json
{
  "success": false,
  "error": {
    "code": "PARSING_FAILED",
    "message": "강점 테마를 찾을 수 없습니다",
    "retry_possible": true
  }
}
```

---

### 3.2 백엔드 구현 (Node.js)

```javascript
const Anthropic = require('@anthropic-ai/sdk');

async function parseGallupPDF(base64Data) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Data
          }
        },
        {
          type: "text",
          text: GALLUP_PARSING_PROMPT
        }
      ]
    }]
  });

  return parseClaudeResponse(response);
}
```

---

### 3.3 보안

**파일 검증**

- 확장자: `.pdf`만 허용
- 크기: 5MB 제한
- Base64 형식 검증

**개인정보 보호**

```javascript
const EXCLUDED_FIELDS = ['email', 'phone', 'address', 'ssn'];

function sanitizeData(data) {
  return {
    name: data.name,
    current_position: data.current_position,
    current_company: data.current_company
  };
}
```

**Rate Limiting**: 1시간당 10개 파일, IP 기반 제한

---

## 4. Phase 2 연동

### 4.1 데이터 전달 예시

```typescript
const s2Data = {
  user_info: {
    name: "홍길동",
    current_role: "PM",
    concern_draft: "방향을 모르겠어요"
  },
  gallup: {
    top10: [
      { rank: 1, name_ko: "전략", name_en: "STRATEGIC", category: "전략적 사고" }
    ]
  },
  career: {
    current_company: "OO 스타트업",
    facts: [
      { company: "OO", position: "PM", period: "2021.03 ~ 현재" }
    ]
  },
  meta: {
    s2_completed_at: "2026-04-27T10:30:00Z",
    has_gallup: true,
    has_career: false
  }
};
```

---

### 4.2 Phase 2 System Prompt 주입

```javascript
function buildPhase2Context(s2Data) {
  let context = `
[사용자 정보]
- 이름: ${s2Data.user_info.name}
- 현재 직무: ${s2Data.user_info.current_role}
- 고민 초안: ${s2Data.user_info.concern_draft}
`;

  if (s2Data.gallup) {
    context += `\n[갤럽 CliftonStrengths Top 10]\n`;
    s2Data.gallup.top10.forEach((s, i) => {
      context += `${i + 1}. ${s.name_ko} (${s.name_en}) [${getCategoryCode(s.category)}]\n`;
    });
    context += `\n카테고리: T=전략적 사고, E=실행력, R=관계 구축, I=영향력\n`;
  }

  return context;
}
```

---

### 4.3 AI 활용 가이드

| 구분 | 예시 | 판단 |
|------|------|------|
| ✅ Good | "전략 강점이 있으시다고 했는데, 지금 상황에서 어떻게 느껴지세요?" | 강점을 탐색 시작점으로 사용, 해석 없음 |
| ❌ Bad | "전략 강점이 1순위시네요. 이건 기획자에게 중요한 능력이에요." | AI가 먼저 의미 부여, 직무 추천 |

---

### 4.4 갤럽 코치 검증 체크리스트

| 항목 | ❌ Bad | ✅ Good |
|------|--------|---------|
| AI가 강점을 먼저 해석하는가? | "전략형 인재입니다" | "전략이 어떻게 느껴지나요?" |
| 강점을 라벨링 도구로 쓰는가? | "당신은 전략형" | "전략이라는 단어가 와닿나요?" |
| 대화 흐름보다 강점을 우선하는가? | 억지로 끼워넣기 | 자연스러울 때만 언급 |
| 사용자가 거부해도 계속 언급하는가? | "그래도 강점이..." | 즉시 사용자 발화로 전환 |

> **검증 시점**: Phase 2 QA 시 필수 / 갤럽 코치 2명 승인 필요

---

## 5. 테스트 시나리오

### 5.1 Unit Tests

```javascript
describe('Gallup PDF Parsing', () => {
  test('정상 PDF - Top 10 추출', async () => {
    const result = await parseGallupPDF(samplePDF);

    expect(result.top10).toHaveLength(10);
    expect(result.top10[0].rank).toBe(1);
    expect(result.top10[0].name_ko).toBeTruthy();
  });

  test('파싱 실패 처리', async () => {
    const result = await parseGallupPDF(imagePDF);

    expect(result.top10).toHaveLength(0);
    expect(result.error).toBeDefined();
  });
});
```

### 5.2 E2E Tests

```javascript
test('완전한 플로우', async () => {
  await page.goto('/onboarding/s2');
  await page.setInputFiles('input[type="file"]', 'gallup.pdf');
  await page.waitForSelector('.strength-list');

  const strengths = await page.$$('.strength-item');
  expect(strengths.length).toBe(10);

  await page.click('text=다음');
  await page.waitForURL('/phase2');
});
```

### 5.3 UAT 체크리스트

**파일 업로드**
- [ ] 드래그앤드롭 동작
- [ ] 파일 크기 초과 시 에러 메시지
- [ ] 프로그레스 바 표시

**파싱 결과**
- [ ] 3초 이내 완료
- [ ] Top 10 정확히 표시
- [ ] 카테고리 표시 (T/E/R/I)

**Phase 2 연동**
- [ ] 데이터 정확히 전달
- [ ] 강점 없이도 진행 가능

---

## 6. 성능 목표 및 제약사항

### 성능 목표

| 지표 | 목표 |
|------|------|
| 파싱 성공률 | > 90% |
| 평균 처리 시간 | < 3초 |
| Phase 2 진입률 | > 80% |
| 사용자 이탈률 | < 20% |

### 알려진 제약사항

| 제약 | 내용 | 해결 방법 |
|------|------|----------|
| 이미지 PDF | 텍스트 추출 어려움 → 파싱 실패 가능 | 파싱 실패 시 재업로드 유도 |
| 비표준 리포트 | 회사 커스텀 리포트 → 일부만 추출 | 공식 리포트 권장 안내 |
| 파일 크기 | 5MB 제한 | 강점 없이도 Phase 2 진입 허용 |
