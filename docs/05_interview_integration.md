# S2 "내 정보 업로드" - Interview 질문 커스터마이징

> **이전 문서**: `04_api_backend.md`  
> **다음 문서**: `06_test_scenarios.md`

---

##  커스터마이징 전략

### 기본 질문 세트 (10개)

```javascript
const DEFAULT_QUESTIONS = [
  {
    id: 'self_keywords',
    category: '자기 이해',
    question: '본인을 짤막한 세 개 문구로 설명해 주시겠어요?',
    order: 1
  },
  {
    id: 'others_view',
    category: '자기 이해',
    question: '주변 사람들은 나를 어떻게 표현하나요?',
    order: 2
  },
  {
    id: 'strengths_exploration',
    category: '강점',
    question: '본인이 가장 두각을 나타내는 영역은 어디인가요?',
    order: 3,
    skippable: true // 갤럽 결과 있으면 스킵 가능
  },
  {
    id: 'energy_source',
    category: '강점 패턴',
    question: '어떤 활동을 할 때 가장 활기가 넘치나요?',
    order: 4
  },
  {
    id: 'improvement_areas',
    category: '개선 영역',
    question: '스스로 부족하다고 느끼거나 반복적으로 받는 피드백이 있나요?',
    order: 5
  },
  {
    id: 'current_role_likes',
    category: '현재 역할',
    question: '현재 하시는 일에서 가장 좋아하는 점과 싫어하는 점은?',
    order: 6
  },
  {
    id: 'achievement_story',
    category: '성과',
    question: '지난 12개월 중 가장 의미 있었던 성과와 그 이유는?',
    order: 7,
    customizable: true // 프로젝트명 삽입 가능
  },
  {
    id: 'obstacles',
    category: '장애요인',
    question: '목표를 향해 나아갈 때 반복적으로 방해가 되는 요소가 있나요?',
    order: 8
  },
  {
    id: 'future_vision',
    category: '장기 목표',
    question: '5년 후 커리어에서 어떤 모습이 되어 있기를 바라시나요?',
    order: 9
  },
  {
    id: 'competency_gap',
    category: '역량 GAP',
    question: '그 목표를 이루기 위해 지금 가장 부족하다고 느끼는 역량이나 경험은?',
    order: 10
  }
];
```

---

##  시나리오 A: 질문 건너뛰기

### 건너뛰기 조건

```javascript
function shouldSkipQuestion(question, analysisResults) {
  const { resume, gallup, mbti } = analysisResults;
  
  // Q3: 강점 탐색 - 갤럽 결과 있으면 스킵
  if (question.id === 'strengths_exploration' && gallup?.top5) {
    return {
      skip: true,
      reason: '갤럽 강점 진단 결과로 대체'
    };
  }
  
  // Q7: 성과 스토리 - 이력서에 충분한 프로젝트 있으면 스킵
  if (question.id === 'achievement_story' && 
      resume?.projects?.length >= 3) {
    return {
      skip: true,
      reason: '이력서에서 3개 이상 프로젝트 확인'
    };
  }
  
  return { skip: false };
}
```

### 적용 예시

```javascript
// 입력: 기본 10개 질문 + 갤럽 결과
// 출력: 9개 질문 (Q3 스킵)

const customized = DEFAULT_QUESTIONS.filter(q => {
  const skipResult = shouldSkipQuestion(q, analysisResults);
  return !skipResult.skip;
});

// 결과
[
  { id: 'self_keywords', ... },      // Q1
  { id: 'others_view', ... },        // Q2
  // Q3 'strengths_exploration' 스킵됨
  { id: 'energy_source', ... },      // Q4
  ...
]
```

---

##  시나리오 B: 질문 내용 맞춤화

### 맞춤화 패턴

#### 패턴 1: 구체적 정보 삽입

```javascript
function customizeQuestion(question, analysisResults) {
  const { resume } = analysisResults;
  
  if (question.id === 'achievement_story') {
    // 기존: "지난 12개월 중 가장 의미 있었던 성과와 그 이유는?"
    
    if (resume?.projects && resume.projects.length > 0) {
      const recentProject = resume.projects[0];
      
      return {
        ...question,
        question: `"${recentProject.name}" 프로젝트에서 어떤 강점을 발휘하셨나요?`,
        context: {
          original_question: question.question,
          customized: true,
          inserted_data: {
            type: 'project_name',
            value: recentProject.name
          }
        }
      };
    }
  }
  
  return question;
}
```

#### 패턴 2: 갤럽 강점 기반

```javascript
function addStrengthContext(question, gallup) {
  if (question.id === 'energy_source' && gallup?.top5) {
    const topStrength = gallup.top5[0];
    
    return {
      ...question,
      question: `"${topStrength.name_ko}" 강점이 가장 발휘되는 활동은 무엇인가요?`,
      hint: `갤럽 진단 결과, "${topStrength.name_ko}"이 1순위 강점으로 나왔어요`,
      context: {
        strength: topStrength,
        customized: true
      }
    };
  }
  
  return question;
}
```

#### 패턴 3: 경력 공백 기반

```javascript
function addGapQuestions(questions, resume) {
  const additionalQuestions = [];
  
  if (resume?.career_gaps) {
    resume.career_gaps.forEach((gap, index) => {
      if (gap.needs_interview_question) {
        additionalQuestions.push({
          id: `gap_${index}`,
          category: '경력 공백',
          question: `${gap.period} 기간에는 어떤 활동을 하셨나요?`,
          order: 999 + index, // 맨 뒤에 추가
          context: {
            type: 'career_gap',
            gap: gap
          },
          added: true
        });
      }
    });
  }
  
  return [...questions, ...additionalQuestions];
}
```

---

##  강점-경력 교차 검증 기반

### 검증 부족 시 질문 추가

```javascript
function addValidationQuestions(questions, validation) {
  const additionalQuestions = [];
  
  // validation = validateStrengthsWithResume() 결과
  validation.forEach((v, index) => {
    if (!v.is_validated) {
      additionalQuestions.push({
        id: `validate_${v.strength}`,
        category: '강점 검증',
        question: `"${v.strength}" 강점을 발휘한 구체적인 경험을 들려주시겠어요?`,
        hint: `이력서에서 관련 증거를 충분히 찾지 못했어요`,
        order: 900 + index,
        context: {
          type: 'strength_validation',
          strength: v.strength,
          evidence_count: v.evidence_count
        },
        added: true
      });
    }
  });
  
  return [...questions, ...additionalQuestions];
}
```

---

##  통합 커스터마이징 함수

```javascript
function generateCustomQuestions(analysisResults) {
  const { resume, gallup, mbti } = analysisResults;
  
  let questions = [...DEFAULT_QUESTIONS];
  
  // 1. 시나리오 A: 건너뛰기
  questions = questions.filter(q => {
    const skipResult = shouldSkipQuestion(q, analysisResults);
    if (skipResult.skip) {
      console.log(`스킵: ${q.id} - ${skipResult.reason}`);
    }
    return !skipResult.skip;
  });
  
  // 2. 시나리오 B: 맞춤화
  questions = questions.map(q => {
    let customized = customizeQuestion(q, analysisResults);
    customized = addStrengthContext(customized, gallup);
    return customized;
  });
  
  // 3. 추가 질문
  if (gallup && resume) {
    const validation = validateStrengthsWithResume(
      gallup.top5, 
      resume
    );
    questions = addValidationQuestions(questions, validation);
  }
  
  if (resume?.career_gaps) {
    questions = addGapQuestions(questions, resume);
  }
  
  // 4. 순서 재정렬
  questions.sort((a, b) => a.order - b.order);
  
  return questions;
}
```

---

##  커스터마이징 결과 예시

### 입력

```javascript
const analysisResults = {
  resume: {
    projects: [
      { name: "AI 추천 시스템 구축" },
      { name: "모바일 앱 리뉴얼" }
    ],
    career_gaps: [
      {
        period: "2021.03 ~ 2021.08",
        duration_months: 5,
        needs_interview_question: false
      }
    ]
  },
  gallup: {
    top5: [
      { name_ko: "전략", name_en: "STRATEGIC" },
      { name_ko: "분석", name_en: "ANALYTICAL" },
      { name_ko: "배움", name_en: "LEARNER" }
    ]
  }
};
```

### 출력

```javascript
const customizedQuestions = [
  {
    id: 'self_keywords',
    question: '본인을 짤막한 세 개 문구로 설명해 주시겠어요?',
    order: 1
  },
  {
    id: 'others_view',
    question: '주변 사람들은 나를 어떻게 표현하나요?',
    order: 2
  },
  // Q3 'strengths_exploration' - 스킵됨 (갤럽 있음)
  {
    id: 'energy_source',
    question: '"전략" 강점이 가장 발휘되는 활동은 무엇인가요?',
    hint: '갤럽 진단 결과, "전략"이 1순위 강점으로 나왔어요',
    order: 4,
    context: { customized: true }
  },
  // ... 중략 ...
  {
    id: 'achievement_story',
    question: '"AI 추천 시스템 구축" 프로젝트에서 어떤 강점을 발휘하셨나요?',
    order: 7,
    context: {
      customized: true,
      inserted_data: {
        type: 'project_name',
        value: 'AI 추천 시스템 구축'
      }
    }
  },
  // ... 중략 ...
  {
    id: 'validate_배움',
    category: '강점 검증',
    question: '"배움" 강점을 발휘한 구체적인 경험을 들려주시겠어요?',
    hint: '이력서에서 관련 증거를 충분히 찾지 못했어요',
    order: 900,
    context: {
      type: 'strength_validation',
      strength: '배움'
    },
    added: true
  }
];

// 결과: 10개 → 9개 (1개 스킵, 1개 추가)
```

---

##  저장 및 불러오기

### LocalStorage 저장

```javascript
function saveCustomQuestions(questions) {
  const data = {
    version: 1,
    questions,
    generated_at: new Date().toISOString()
  };
  
  localStorage.setItem('interviewQuestions', JSON.stringify(data));
}
```

### S3 화면에서 불러오기

```javascript
function loadCustomQuestions() {
  try {
    const stored = localStorage.getItem('interviewQuestions');
    if (!stored) return DEFAULT_QUESTIONS;
    
    const data = JSON.parse(stored);
    
    // 버전 체크
    if (data.version !== 1) {
      console.warn('버전 불일치, 기본 질문 사용');
      return DEFAULT_QUESTIONS;
    }
    
    return data.questions;
  } catch (e) {
    console.error('질문 로드 실패:', e);
    return DEFAULT_QUESTIONS;
  }
}
```

---

##  UI 표시

### S2 → S3 전환 시 안내

```
┌────────────────────────────────────────┐
│ 📝 Interview 준비 완료!                 │
├────────────────────────────────────────┤
│                                        │
│ 질문이 이렇게 바뀌었어요:               │
│                                        │
│ ✓ 10개 → 9개로 축소                    │
│   └ "강점 탐색" 질문 스킵              │
│                                        │
│ ✓ 3개 질문 맞춤화                      │
│   └ "AI 추천 시스템" 프로젝트 언급     │
│   └ "전략" 강점 구체화                 │
│                                        │
│ ✓ 1개 질문 추가                        │
│   └ "배움" 강점 검증                   │
│                                        │
│         [Interview 시작 →]              │
└────────────────────────────────────────┘
```

### S3 Interview 화면

```
┌────────────────────────────────────────┐
│ 🎙️ 커리어 인터뷰                       │
├────────────────────────────────────────┤
│                                        │
│ 질문 4 / 9                              │
│                                        │
│ "전략" 강점이 가장 발휘되는             │
│ 활동은 무엇인가요?                      │
│                                        │
│ 💡 갤럽 진단 결과, "전략"이             │
│    1순위 강점으로 나왔어요              │
│                                        │
│    [🎤 답변하기]                        │
│                                        │
│                                        │
│ 자기 이해 · 4/9        [다음 →]         │
└────────────────────────────────────────┘
```

---

##  커스터마이징 통계

### 추적 지표

```javascript
function calculateCustomizationStats(original, customized) {
  return {
    total_original: original.length,
    total_customized: customized.length,
    skipped: original.length - customized.filter(q => !q.added).length,
    customized_count: customized.filter(q => q.context?.customized).length,
    added: customized.filter(q => q.added).length,
    reduction_rate: (
      (original.length - customized.length) / original.length * 100
    ).toFixed(1) + '%'
  };
}

// 사용
const stats = calculateCustomizationStats(
  DEFAULT_QUESTIONS, 
  customizedQuestions
);

console.log(stats);
// {
//   total_original: 10,
//   total_customized: 9,
//   skipped: 1,
//   customized_count: 3,
//   added: 1,
//   reduction_rate: "10.0%"
// }
```

---

##  테스트 케이스

### 케이스 1: 갤럽만 있음

```javascript
const result1 = generateCustomQuestions({
  gallup: { top5: [...] },
  resume: null,
  mbti: null
});

// 예상: 9개 질문 (1개 스킵, 추가 없음)
assert(result1.length === 9);
assert(!result1.find(q => q.id === 'strengths_exploration'));
```

### 케이스 2: 이력서만 있음

```javascript
const result2 = generateCustomQuestions({
  resume: { 
    projects: [{ name: "프로젝트A" }],
    career_gaps: []
  },
  gallup: null,
  mbti: null
});

// 예상: 10개 질문 (스킵 없음, 맞춤화 1개)
assert(result2.length === 10);
assert(result2.find(q => q.id === 'achievement_story').question.includes('프로젝트A'));
```

### 케이스 3: 갤럽 + 이력서 + 경력 공백

```javascript
const result3 = generateCustomQuestions({
  resume: {
    projects: [...],
    career_gaps: [
      { period: "2021~2022", needs_interview_question: true }
    ]
  },
  gallup: { top5: [...] },
  mbti: { type: "INTJ" }
});

// 예상: 9개 + 1개 (경력 공백) + α (검증 질문)
assert(result3.length >= 10);
assert(result3.find(q => q.id.startsWith('gap_')));
```

---

**다음 문서**: `06_test_scenarios.md` - 테스트 시나리오 및 검증
