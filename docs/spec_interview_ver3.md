# S2 "내 정보 업로드" 완전 기능 스펙 v1.0

## 📌 확정 사항

### ✅ 동적 질문 생성 방식
**시나리오 A + B 혼합 적용**
- **시나리오 A**: 질문 건너뛰기 (정보 충분 시)
- **시나리오 B**: 질문 내용 맞춤화 (구체적 정보 삽입)

---

## 🎯 미정 항목 권장안

### Q2-2. 연동 타이밍 → 권장: **옵션 A (즉시 분석)**

#### 추천 이유
1. **사용자 기대치**: 파일 업로드하면 "뭔가 처리되고 있다"는 피드백 즉시 필요
2. **에러 조기 발견**: 파일 손상/형식 문제를 바로 알림 → 재업로드 기회
3. **참여도 유지**: 분석 결과를 보여주면서 "Interview가 개인화되었어요" 동기부여

#### 플로우
```
[파일 업로드] 
    ↓
[분석 중... 로딩 3-5초]
    ↓
[✓ 이렇게 이해했어요] ← 확인/수정 화면
    ↓
[다음 → Interview] ← 커스터마이징된 질문 세트
```

**옵션 B/C와 비교**:
- 옵션 B(백그라운드): 사용자가 분석 결과를 못 봄 → 신뢰도 ↓
- 옵션 C(완료 후): 너무 늦음, 수정 불가

---

### Q2-3. 분석 결과 피드백 → 권장: **2단계 피드백**

#### Stage 1: 즉시 피드백 (파일별)
```
┌─────────────────────────────────────┐
│ 📄 이력서_홍길동.pdf                 │
│ ✓ 분석 완료 (3초 전)                 │
│                                     │
│ 추출된 정보:                         │
│ • 이름: 홍길동                       │
│ • 경력: 4.7년 (3개 회사)             │
│ • 주요 프로젝트: 12개                │
│                                     │
│ [상세 보기] [수정]                   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🎯 갤럽강점진단.pdf                  │
│ ✓ 분석 완료 (2초 전)                 │
│                                     │
│ Top 5 강점:                         │
│ 1. 전략 (Strategic)                 │
│ 2. 분석 (Analytical)                │
│ 3. 배움 (Learner)                   │
│ 4. 성취 (Achiever)                  │
│ 5. 책임 (Responsibility)            │
│                                     │
│ [상세 보기]                          │
└─────────────────────────────────────┘
```

#### Stage 2: 종합 피드백 (전체 분석)
```
┌─────────────────────────────────────────────┐
│ 🔄 파일 간 교차 분석                         │
├─────────────────────────────────────────────┤
│                                             │
│ ✦ 강점-경력 매칭                             │
│                                             │
│ [전략] 강점이 이력서에서도 확인돼요!          │
│ └─ "로드맵 수립" 프로젝트 3건               │
│ └─ "전략적 의사결정" 키워드 5회             │
│                                             │
│ [분석] 강점이 경력에 잘 드러나요             │
│ └─ "데이터 분석" 업무 7건                   │
│ └─ 정량적 성과 지표 12개 발견               │
│                                             │
│ ⚠️ [배움] 강점 증거가 부족해요               │
│ └─ 학습/교육 관련 경험을 Interview에서       │
│    더 여쭤볼게요                            │
│                                             │
│ 📝 Interview 질문이 이렇게 바뀌었어요:       │
│ • "전략적 사고" 질문 → 구체적 프로젝트명    │
│   삽입 ("OO 로드맵 프로젝트에서...")        │
│ • "강점 탐색" 질문 → 스킵 (이미 확인됨)     │
│ • "학습 경험" 질문 → 추가                   │
│                                             │
│ [Interview 시작하기 →]                      │
└─────────────────────────────────────────────┘
```

---

### Q3-1. 파일 업로드 후 미리보기 → 권장: **썸네일 + 추출 데이터**

```html
<div class="file-preview-card">
  <!-- 썸네일 (PDF 첫 페이지, 이미지 축소) -->
  <div class="thumbnail">
    <img src="data:image/jpeg;base64,..." alt="이력서 미리보기">
    <div class="page-count">3 pages</div>
  </div>
  
  <!-- 추출 정보 -->
  <div class="extracted-info">
    <h4>✓ 이렇게 이해했어요</h4>
    <ul>
      <li><strong>이름:</strong> 홍길동 
        <button class="edit-btn">✏️</button>
      </li>
      <li><strong>경력:</strong> 4.7년 (3개 회사)</li>
      <li><strong>프로젝트:</strong> 12개</li>
    </ul>
    
    <!-- 신뢰도 표시 -->
    <div class="confidence-bar">
      <span>분석 신뢰도</span>
      <div class="bar" style="width: 85%">85%</div>
    </div>
  </div>
</div>
```

**인라인 수정 기능**:
```javascript
// ✏️ 버튼 클릭 시
<input 
  type="text" 
  value="홍길동" 
  class="inline-edit"
  onblur="saveEdit()"
/>
```

---

### Q3-2. 여러 파일 처리 → 권장: **자동 분류 + 수동 확인**

#### 자동 분류 로직
```javascript
function classifyFile(filename, content) {
  // 1. 파일명 패턴
  if (/이력서|resume|cv/i.test(filename)) {
    return "resume";
  }
  if (/갤럽|강점|clifton|strengths/i.test(filename)) {
    return "gallup";
  }
  if (/mbti|16personalities/i.test(filename)) {
    return "mbti";
  }
  
  // 2. 내용 분석
  const text = extractText(content);
  
  // 이력서 시그널: 경력, 학력, 프로젝트
  if (text.includes("경력") && text.includes("학력")) {
    return "resume";
  }
  
  // 갤럽 시그널: 34개 테마 중 하나라도
  const gallupThemes = ["성취", "ACHIEVER", "전략", "STRATEGIC"];
  if (gallupThemes.some(theme => text.includes(theme))) {
    return "gallup";
  }
  
  // MBTI 시그널: 16가지 타입 중 하나
  const mbtiTypes = ["INTJ", "ENFP", "ISTJ", ...];
  if (mbtiTypes.some(type => text.includes(type))) {
    return "mbti";
  }
  
  return "other"; // 미분류
}
```

#### UI: 자동 분류 후 사용자 확인
```
┌────────────────────────────────────┐
│ 📂 업로드된 파일 (3개)              │
├────────────────────────────────────┤
│                                    │
│ 📄 이력서_홍길동.pdf                │
│    🏷️ 이력서로 인식했어요           │
│    [맞음 ✓] [아님, 변경 →]         │
│                                    │
│ 🎯 갤럽결과.jpg                     │
│    🏷️ 강점 진단으로 인식했어요      │
│    [맞음 ✓] [아님, 변경 →]         │
│                                    │
│ 📊 MBTI_결과.png                    │
│    🏷️ 성격 진단으로 인식했어요      │
│    [맞음 ✓] [아님, 변경 →]         │
│                                    │
└────────────────────────────────────┘
```

**[변경 →] 클릭 시 드롭다운**:
```html
<select class="file-type-selector">
  <option value="resume">이력서</option>
  <option value="gallup">갤럽 강점 진단</option>
  <option value="mbti">MBTI</option>
  <option value="disc">DISC</option>
  <option value="holland">홀랜드 검사</option>
  <option value="other">기타 (직접 입력)</option>
</select>
```

---

### Q3-3. 건너뛰기 vs 필수 → 권장: **유연한 건너뛰기**

#### 전략: 3-Tier 접근

**Tier 1: 완전 건너뛰기 가능**
- 파일 0개 업로드 → S1 설문 데이터만으로 진행
- Interview 질문 10개 그대로 (맞춤화 없음)

**Tier 2: 부분 업로드 (권장)**
- 이력서만 업로드 → 경력 기반 질문 맞춤화
- 진단 결과만 업로드 → 강점 기반 질문 스킵

**Tier 3: 완전 업로드 (최적)**
- 이력서 + 진단 결과 → 최대 맞춤화
- 강점-경력 교차 검증

#### UI 안내
```
┌────────────────────────────────────────┐
│ 💡 파일 업로드 안내                     │
├────────────────────────────────────────┤
│                                        │
│ 업로드하면 좋은 것:                     │
│ ✓ Interview 질문이 개인화돼요           │
│ ✓ 분석 정확도가 높아져요 (약 30% ↑)     │
│ ✓ 온보딩 시간이 단축돼요 (약 5분 절약)  │
│                                        │
│ 건너뛰어도 괜찮아요:                    │
│ • 기본 설문만으로도 진단 가능            │
│ • 나중에 프로필에서 추가 가능            │
│                                        │
│ [파일 업로드]  [건너뛰기 →]             │
└────────────────────────────────────────┘
```

---

### Q4-1. AI 분석 백엔드 → 권장: **실제 Claude API 호출**

#### 이유
1. **실제 동작 검증**: 프로토타입이지만 실제 파싱 정확도 테스트 가능
2. **사용자 테스트**: 실제 파일로 피드백 받을 수 있음
3. **기술 PoC**: Claude Vision API (이미지) + Documents (PDF) 활용도 검증

#### 아키텍처
```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Browser    │      │  Backend     │      │ Claude API  │
│             │      │  (Node/Py)   │      │             │
│ [File]──────┼─────→│ FileReader   │      │             │
│             │      │      ↓       │      │             │
│             │      │ Base64 변환  │      │             │
│             │      │      ↓       │──────→│ Vision/Docs │
│             │      │ API 호출     │      │             │
│             │      │      ↓       │←──────│ JSON 응답   │
│             │←─────┤ 파싱 결과    │      │             │
│             │      │              │      │             │
└─────────────┘      └──────────────┘      └─────────────┘
```

#### 프롬프트 예시 (이력서 분석)
```javascript
const prompt = `
다음 이력서에서 정보를 추출해주세요.

추출 형식 (JSON):
{
  "basic_info": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "current_position": "string",
    "current_company": "string"
  },
  "careers": [
    {
      "company": "string",
      "position": "string",
      "period": "YYYY.MM ~ YYYY.MM",
      "duration_months": number,
      "is_current": boolean,
      "responsibilities": ["string"]
    }
  ],
  "projects": [
    {
      "name": "string",
      "period": "string",
      "role": "string",
      "achievements": ["string"],
      "is_leadership": boolean
    }
  ],
  "soft_skills_inferred": {
    "리더십": {
      "score": 1-10,
      "evidence": ["string"]
    }
  }
}

규칙:
1. 없는 정보는 null 반환
2. 경력 기간은 개월 수로 환산
3. 정량적 성과는 숫자 추출 (예: "35% 증가" → 35)
4. 소프트 스킬은 키워드 빈도 기반 점수
`;

// API 호출
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4000,
  messages: [{
    role: "user",
    content: [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64Resume
        }
      },
      { type: "text", text: prompt }
    ]
  }]
});
```

#### 프롬프트 예시 (갤럽 분석)
```javascript
const gallupPrompt = `
이 갤럽 CliftonStrengths 결과에서 Top 5 강점을 추출해주세요.

추출 형식 (JSON):
{
  "top5": [
    {
      "rank": 1,
      "name_ko": "전략",
      "name_en": "STRATEGIC",
      "category": "T",
      "description": "앞으로 나아가기 위한 대안들을 만들어냄"
    }
  ],
  "all_strengths": [ /* 34개 전체 있으면 */ ]
}

카테고리:
- E: 실행력
- I: 영향력
- R: 관계 구축
- T: 전략적 사고
`;
```

---

### Q4-2. 프라이버시/보안 → 권장: **하이브리드 방식**

#### 전략
1. **브라우저에서 Base64 변환** (민감 정보 노출 최소화)
2. **백엔드는 프록시 역할**만 (파일 저장 안 함)
3. **API 응답만 저장** (원본 파일 폐기)

#### 데이터 흐름
```
[사용자 PC]
   ↓ (파일 선택)
[Browser FileReader]
   ↓ (Base64 인코딩)
[Backend API] ← 메모리에만 보관, 디스크 저장 X
   ↓ (Claude API 호출)
[Claude API] ← Anthropic 서버, 30일 후 자동 삭제
   ↓ (JSON 응답)
[Backend] ← 파싱 결과만 저장
   ↓
[Database] ← 추출된 정보만 (원본 파일 없음)
```

#### 파일 크기 제한
```javascript
const FILE_SIZE_LIMITS = {
  pdf: 5 * 1024 * 1024,      // 5MB
  jpg: 3 * 1024 * 1024,      // 3MB
  png: 3 * 1024 * 1024,
  docx: 5 * 1024 * 1024
};

function validateFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const limit = FILE_SIZE_LIMITS[ext];
  
  if (!limit) {
    return { valid: false, error: "지원하지 않는 파일 형식입니다" };
  }
  
  if (file.size > limit) {
    return { 
      valid: false, 
      error: `파일이 너무 큽니다 (최대 ${limit / 1024 / 1024}MB)` 
    };
  }
  
  return { valid: true };
}
```

#### 보안 체크리스트
- [x] 파일 업로드 시 MIME type 검증
- [x] 악성 코드 스캔 (ClamAV 등)
- [x] Rate limiting (사용자당 시간당 10개 파일)
- [x] HTTPS 필수
- [x] 원본 파일 저장 안 함
- [x] 추출 데이터 암호화 (DB 저장 시)

---

## 🔄 통합 플로우 다이어그램

### 전체 사용자 여정

```
S2 진입
   ↓
┌─────────────────────────────────────┐
│ 파일 업로드 영역                     │
│ [탭해서 파일 업로드]                 │
│                                     │
│ 또는                                │
│ [직접 입력하기]  [건너뛰기 →]        │
└─────────────────────────────────────┘
   ↓ (파일 선택)
┌─────────────────────────────────────┐
│ 📄 이력서.pdf (2.3MB)                │
│ 🎯 갤럽결과.jpg (1.1MB)              │
│                                     │
│ [🏷️ 자동 분류 중...]                 │
└─────────────────────────────────────┘
   ↓ (3초)
┌─────────────────────────────────────┐
│ ✓ 파일 분류 완료                     │
│                                     │
│ 📄 이력서로 인식 [맞음✓] [변경]      │
│ 🎯 갤럽 강점 진단 [맞음✓]            │
│                                     │
│ [분석 시작하기 →]                    │
└─────────────────────────────────────┘
   ↓ (사용자 확인)
┌─────────────────────────────────────┐
│ 🔄 파일 분석 중...                   │
│                                     │
│ ██████████░░░░ 65%                  │
│ 이력서에서 경력 정보 추출 중...       │
└─────────────────────────────────────┘
   ↓ (5초)
┌─────────────────────────────────────┐
│ ✓ 분석 완료!                         │
│                                     │
│ [Stage 1: 파일별 결과]               │
│ [Stage 2: 종합 분석]                 │
│                                     │
│ 📝 Interview 질문이 개인화됐어요      │
│ • 10개 → 8개로 축소 (2개 스킵)       │
│ • 3개 질문에 구체적 정보 삽입         │
│ • 1개 질문 추가 (경력 공백)          │
│                                     │
│ [다음: Interview 시작 →]             │
└─────────────────────────────────────┘
   ↓
S3 Interview (맞춤화된 질문)
```

---

## 💻 핵심 구현 코드

### 1. 파일 업로드 핸들러

```javascript
// S2 화면 - 파일 업로드
async function handleFileUpload(files) {
  const uploadedFiles = [];
  
  // 1. 파일 검증
  for (const file of files) {
    const validation = validateFile(file);
    if (!validation.valid) {
      showToast(validation.error, 'error');
      continue;
    }
    
    // 2. Base64 변환
    const base64 = await fileToBase64(file);
    
    // 3. 파일 분류
    const fileType = await classifyFile(file.name, base64);
    
    uploadedFiles.push({
      name: file.name,
      size: file.size,
      type: fileType,
      base64: base64,
      status: 'pending'
    });
  }
  
  // 4. UI 업데이트 - 분류 결과 표시
  renderFileClassification(uploadedFiles);
  
  // 5. 사용자 확인 대기
  // "분석 시작하기" 버튼 활성화
  document.getElementById('analyzeBtn').disabled = false;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

### 2. 분석 실행

```javascript
async function analyzeFiles(uploadedFiles) {
  const results = {
    resume: null,
    gallup: null,
    mbti: null,
    other: []
  };
  
  // 진행률 UI 초기화
  showProgressBar(0);
  
  for (let i = 0; i < uploadedFiles.length; i++) {
    const file = uploadedFiles[i];
    
    try {
      // API 호출
      const analysisResult = await callClaudeAPI(file);
      
      // 결과 저장
      results[file.type] = analysisResult;
      
      // 진행률 업데이트
      showProgressBar((i + 1) / uploadedFiles.length * 100);
      
    } catch (error) {
      console.error(`분석 실패: ${file.name}`, error);
      results.other.push({
        filename: file.name,
        error: error.message
      });
    }
  }
  
  // 분석 완료 후 결과 표시
  renderAnalysisResults(results);
  
  // Interview 질문 커스터마이징
  const customizedQuestions = generateCustomQuestions(results);
  saveToLocalStorage('interviewQuestions', customizedQuestions);
  
  return results;
}
```

### 3. Claude API 호출 (백엔드)

```javascript
// Backend API Endpoint
app.post('/api/analyze-file', async (req, res) => {
  const { base64Data, fileType, mimeType } = req.body;
  
  try {
    let prompt;
    
    // 파일 타입별 프롬프트 선택
    switch(fileType) {
      case 'resume':
        prompt = PROMPTS.RESUME_ANALYSIS;
        break;
      case 'gallup':
        prompt = PROMPTS.GALLUP_EXTRACTION;
        break;
      case 'mbti':
        prompt = PROMPTS.MBTI_EXTRACTION;
        break;
      default:
        prompt = PROMPTS.GENERIC_ANALYSIS;
    }
    
    // Claude API 호출
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [
          {
            type: mimeType.includes('pdf') ? 'document' : 'image',
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64Data
            }
          },
          { type: "text", text: prompt }
        ]
      }]
    });
    
    // 응답 파싱
    const content = response.content[0].text;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    const parsed = jsonMatch 
      ? JSON.parse(jsonMatch[1]) 
      : JSON.parse(content);
    
    // 원본 파일 데이터는 즉시 폐기 (메모리 해제)
    base64Data = null;
    
    res.json({
      success: true,
      data: parsed,
      confidence: calculateConfidence(parsed)
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### 4. Interview 질문 커스터마이징

```javascript
function generateCustomQuestions(analysisResults) {
  const { resume, gallup } = analysisResults;
  let questions = [...DEFAULT_QUESTIONS]; // 기본 10개 질문
  
  // 시나리오 A: 질문 건너뛰기
  if (gallup && gallup.top5) {
    // 강점이 이미 확인되면 관련 질문 제거
    questions = questions.filter(q => {
      // 예: "본인의 강점은?" 질문 제거
      if (q.id === 'strengths_exploration') {
        return false;
      }
      return true;
    });
  }
  
  // 시나리오 B: 질문 내용 맞춤화
  if (resume && resume.projects && resume.projects.length > 0) {
    const recentProject = resume.projects[0];
    
    questions = questions.map(q => {
      if (q.id === 'achievement_story') {
        // 기존: "최근 의미 있었던 성과는?"
        // 맞춤: "{프로젝트명}에서 어떤 강점을 발휘했나요?"
        return {
          ...q,
          question: `"${recentProject.name}" 프로젝트에서 어떤 강점을 발휘하셨나요?`,
          context: {
            project: recentProject.name,
            customized: true
          }
        };
      }
      return q;
    });
  }
  
  // 시나리오 B2: 갤럽 + 이력서 교차 검증
  if (gallup && resume) {
    const validation = validateStrengthsWithResume(
      gallup.top5, 
      resume
    );
    
    validation.forEach(v => {
      if (!v.is_validated) {
        // 증거 부족한 강점에 대해 질문 추가
        questions.push({
          id: `validate_${v.strength}`,
          category: '강점 검증',
          question: `"${v.strength}" 강점을 발휘한 구체적인 경험을 들려주시겠어요?`,
          context: {
            strength: v.strength,
            reason: '이력서에서 관련 증거를 충분히 찾지 못했어요'
          }
        });
      }
    });
  }
  
  // 경력 공백 질문 추가
  if (resume && resume.career_gaps && resume.career_gaps.length > 0) {
    resume.career_gaps.forEach(gap => {
      if (gap.needs_interview_question) {
        questions.push({
          id: `gap_${gap.period}`,
          category: '경력 공백',
          question: `${gap.period} 기간에는 어떤 활동을 하셨나요?`,
          context: {
            period: gap.period,
            duration: gap.duration_months
          }
        });
      }
    });
  }
  
  return questions;
}
```

### 5. 분석 결과 UI 렌더링

```javascript
function renderAnalysisResults(results) {
  const container = document.getElementById('analysisResults');
  
  // Stage 1: 파일별 결과
  let html = '<div class="stage-1">';
  
  if (results.resume) {
    html += `
      <div class="file-result-card">
        <div class="file-header">
          <span class="file-icon">📄</span>
          <span class="file-type">이력서</span>
          <span class="status success">✓ 분석 완료</span>
        </div>
        <div class="extracted-data">
          <div class="data-item">
            <label>이름</label>
            <span class="editable" data-field="name">
              ${results.resume.basic_info.name}
            </span>
            <button class="edit-btn">✏️</button>
          </div>
          <div class="data-item">
            <label>경력</label>
            <span>${results.resume.career_summary.total_years}년 
              (${results.resume.career_summary.total_companies}개 회사)</span>
          </div>
          <div class="data-item">
            <label>프로젝트</label>
            <span>${results.resume.projects.length}개</span>
          </div>
        </div>
        <div class="confidence-bar">
          <span>분석 신뢰도</span>
          <div class="bar" style="width: ${results.resume.confidence * 100}%">
            ${Math.round(results.resume.confidence * 100)}%
          </div>
        </div>
        <button class="expand-btn" onclick="showDetailedResume()">
          상세 보기 →
        </button>
      </div>
    `;
  }
  
  if (results.gallup) {
    html += `
      <div class="file-result-card">
        <div class="file-header">
          <span class="file-icon">🎯</span>
          <span class="file-type">갤럽 강점 진단</span>
          <span class="status success">✓ 분석 완료</span>
        </div>
        <div class="strengths-list">
          <h4>Top 5 강점</h4>
          ${results.gallup.top5.map((s, i) => `
            <div class="strength-item">
              <span class="rank">${i + 1}</span>
              <span class="name">${s.name_ko} (${s.name_en})</span>
              <span class="category ${s.category}">${getCategoryName(s.category)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  
  // Stage 2: 종합 분석
  if (results.resume && results.gallup) {
    const crossAnalysis = analyzeCrossValidation(results);
    
    html += `
      <div class="stage-2">
        <h3>🔄 파일 간 교차 분석</h3>
        
        ${crossAnalysis.validated.map(v => `
          <div class="validation-item success">
            <span class="strength-badge">[${v.strength}]</span>
            <span>강점이 이력서에서도 확인돼요!</span>
            <ul class="evidence-list">
              ${v.evidence.slice(0, 2).map(e => `<li>${e}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
        
        ${crossAnalysis.needs_validation.map(v => `
          <div class="validation-item warning">
            <span class="strength-badge">[${v.strength}]</span>
            <span>강점 증거가 부족해요</span>
            <p class="hint">→ Interview에서 더 여쭤볼게요</p>
          </div>
        `).join('')}
        
        <div class="interview-changes">
          <h4>📝 Interview 질문이 이렇게 바뀌었어요</h4>
          <ul>
            <li>• "전략적 사고" 질문 → 구체적 프로젝트명 삽입</li>
            <li>• "강점 탐색" 질문 → 스킵 (이미 확인됨)</li>
            <li>• "배움 경험" 질문 → 추가</li>
          </ul>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // 다음 버튼 활성화
  document.getElementById('nextToInterviewBtn').disabled = false;
}
```

---

## 📊 성능 지표

### 목표 KPI
- **분석 완료 시간**: 파일당 3-5초 이내
- **정확도**: 기본 정보 95% 이상
- **사용자 만족도**: 분석 결과 확인 후 "맞음" 선택률 80% 이상

### 에러율 목표
- **파일 분류 오류**: 5% 이하
- **파싱 실패율**: 10% 이하
- **API 타임아웃**: 2% 이하

---

## 🧪 테스트 시나리오

### 1. Happy Path
```
사용자: 이력서(PDF) + 갤럽 결과(PDF) 업로드
→ 자동 분류 정확
→ 5초 내 분석 완료
→ 교차 검증 성공
→ Interview 8개 질문으로 축소
→ 3개 질문 맞춤화
```

### 2. 부분 업로드
```
사용자: 이력서만 업로드
→ 경력 정보 추출
→ 소프트 스킬 추론 (신뢰도 낮음)
→ Interview 9개 질문 (1개만 스킵)
→ 2개 질문 맞춤화
```

### 3. 파싱 실패
```
사용자: 손상된 PDF 업로드
→ OCR 실패 감지
→ "⚠️ 파일을 읽을 수 없어요" 알림
→ [직접 입력] 옵션 제안
```

### 4. 분류 오류
```
사용자: 갤럽 결과를 "이력서"로 잘못 분류
→ 이력서 파싱 시도 → 경력 정보 없음
→ 신뢰도 30% (낮음)
→ "분류가 맞나요?" 재확인 요청
```

---
