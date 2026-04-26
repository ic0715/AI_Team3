# S2 "내 정보 업로드" - 데이터 추출 상세 스펙

> **이전 문서**: `01_overview.md`  
> **다음 문서**: `03_ui_ux_flow.md`

---

##  이력서 데이터 추출

### Level 1: 기본 식별 정보 (필수)

```json
{
  "basic_info": {
    "name": "홍길동",
    "email": "hong@example.com",
    "phone": "010-1234-5678",
    "current_position": "프로덕트 매니저",
    "current_company": "OO 스타트업"
  }
}
```

**추출 전략:**

| 필드 | 추출 방법 | 정규식/패턴 | 신뢰도 |
|------|----------|------------|--------|
| `name` | 문서 상단, 큰 폰트, 굵은 글씨 | - | 95% |
| `email` | 이메일 패턴 매칭 | `\S+@\S+\.\S+` | 95% |
| `phone` | 전화번호 패턴 | `010-\d{4}-\d{4}` | 90% |
| `current_position` | "현재", "재직 중" 키워드 근처 | - | 75% |
| `current_company` | 최상단 경력 또는 "현재" 키워드 | - | 80% |

---

### Level 2: 경력 타임라인 + 프로젝트

#### 경력 정보
```json
{
  "careers": [
    {
      "company": "OO 스타트업",
      "position": "프로덕트 매니저",
      "period": "2021.03 ~ 현재",
      "start_date": "2021-03-01",
      "end_date": null,
      "duration_months": 36,
      "is_current": true,
      "responsibilities": [
        "SaaS 제품 기획 및 로드맵 수립",
        "크로스팀 협업 리드"
      ]
    }
  ],
  "career_summary": {
    "total_years": 4.7,
    "total_companies": 3,
    "career_gaps": []
  }
}
```

**추출 전략:**
- **연도 패턴**: `2019`, `2021.03`, `2019.06~2021.02`
- **현재 키워드**: "현재", "재직 중", "Present", "~"
- **회사-직무 구조**: 회사명 다음에 직무명 패턴
- **업무 내용**: 불릿 포인트(•, -, *) 아래 텍스트

#### 프로젝트 경험
```json
{
  "projects": [
    {
      "name": "AI 기반 추천 시스템 구축",
      "period": "2022.06 ~ 2022.12",
      "duration_months": 6,
      "role": "PM/기획",
      "keywords": ["AI", "추천 시스템", "데이터 분석"],
      "achievements": [
        "사용자 체류시간 35% 증가",
        "CTR 20% 개선"
      ],
      "metrics": [
        { "type": "증가율", "value": 35, "unit": "%" },
        { "type": "개선", "value": 20, "unit": "%" }
      ],
      "is_leadership": true
    }
  ]
}
```

**추출 전략:**
- **프로젝트명**: "프로젝트", "Project", "수행 과제" 섹션
- **성과 지표**: 숫자 + 단위 패턴 (`35%`, `2억`, `5개`)
- **성과 동사**: "증가", "개선", "달성", "기여"
- **리더십 플래그**: "리드", "주도", "기획" 키워드

---

### Level 3: 기술 스택 + 성과 지표 + 소프트 스킬

#### 기술 스택
```json
{
  "hard_skills": {
    "tools": ["Figma", "JIRA", "Notion", "GA4"],
    "methodologies": ["애자일", "스크럼", "디자인 씽킹"],
    "domains": ["SaaS", "B2B", "모바일 앱"],
    "technical": ["SQL 기초", "A/B 테스트 설계"]
  },
  "proficiency_indicators": {
    "Figma": "상",
    "JIRA": "중",
    "SQL": "하"
  }
}
```

**추출 전략:**
- "사용 기술", "Skills", "Tool Stack" 섹션
- 쉼표/불릿으로 구분된 나열
- "능숙", "상급", "활용 가능" → 숙련도 추론

#### 소프트 스킬 추론
```json
{
  "soft_skills_inferred": {
    "리더십": {
      "score": 8,
      "evidence": [
        "크로스팀 협업 리드",
        "주니어 멘토링 2명",
        "팀 온보딩 가이드 작성"
      ],
      "keyword_count": 5
    },
    "커뮤니케이션": {
      "score": 7,
      "evidence": [
        "임원 보고 월 2회",
        "기술팀-디자인팀 중재 역할"
      ],
      "keyword_count": 3
    }
  }
}
```

**키워드 매핑 테이블:**

| 소프트 스킬 | 키워드 |
|------------|--------|
| 리더십 | "리드", "주도", "멘토링", "코칭", "팀 빌딩" |
| 커뮤니케이션 | "보고", "발표", "협업", "조율", "설득" |
| 문제해결 | "분석", "개선", "해결", "최적화" |
| 의사결정 | "선정", "결정", "우선순위", "전략 수립" |

**점수 계산:**
```javascript
score = min(10, (keyword_count * 2) + (evidence_quality_bonus))
// keyword_count: 키워드 등장 횟수
// evidence_quality_bonus: 정량적 성과 포함 시 +2
```

---

##  갤럽 CliftonStrengths 추출

### 추출 목표
```json
{
  "top5": [
    {
      "rank": 1,
      "name_ko": "전략",
      "name_en": "STRATEGIC",
      "category": "T",
      "description": "앞으로 나아가기 위한 대안들을 만들어냄"
    }
  ]
}
```

### 파싱 전략

#### PDF 구조 (업로드된 갤럽 PDF 기준)
```
E  실행력  I  영향력  R  관계 구축  T  전략적 사고

E   성취 ACHIEVER®
성취(Achiever) 테마가 특히 뛰어난 사람들은...
기여하는 것: ...
필요로 하는 것: ...
```

**정규식 패턴:**
```javascript
// 테마 이름 추출
const themePattern = /([EIRT])\s+(\S+)\s+([A-Z]+)®/g;
// 예: "E   성취 ACHIEVER®" → E, 성취, ACHIEVER

// Top 5 판단
// PDF 첫 페이지 또는 "Top 5" 텍스트 근처
// 또는 사용자가 직접 체크한 항목
```

#### 이미지 (스크린샷) 처리
```
1. OCR로 텍스트 추출
2. "INTJ", "전략", "STRATEGIC" 등 키워드 검색
3. 신뢰도 계산:
   - 한글명 + 영문명 둘 다 발견 → 90%
   - 하나만 발견 → 60%
   - 애매 → 사용자 확인 요청
```

---

##  MBTI 추출

### 추출 목표
```json
{
  "type": "INTJ",
  "traits": {
    "I": 67,  // 선택적
    "N": 82,
    "T": 73,
    "J": 55
  },
  "source": "16personalities" // 선택적
}
```

### 파싱 전략

**16가지 타입 리스트:**
```javascript
const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP"
];
```

**추출 로직:**
```javascript
function extractMBTI(text) {
  // 1. 정확한 4글자 타입 찾기
  for (const type of MBTI_TYPES) {
    if (text.includes(type)) {
      return { type, confidence: 0.95 };
    }
  }
  
  // 2. 분리된 글자 조합 (I-N-T-J)
  const separated = text.match(/([IE])-([NS])-([TF])-([JP])/);
  if (separated) {
    return { 
      type: separated.slice(1).join(''), 
      confidence: 0.85 
    };
  }
  
  // 3. 실패
  return { type: null, confidence: 0 };
}
```

---

##  강점-경력 교차 검증

### 매핑 테이블

| 갤럽 강점 | 이력서 키워드 | 증거 예시 |
|----------|--------------|----------|
| **전략 (Strategic)** | "전략", "로드맵", "우선순위", "기획" | "제품 로드맵 수립" |
| **성취 (Achiever)** | "달성", "완료", 숫자 성과, "목표" | "목표 120% 달성" |
| **책임 (Responsibility)** | "담당", "책임", "주인의식" | "엔드투엔드 책임" |
| **분석 (Analytical)** | "분석", "데이터", "인사이트" | "데이터 기반 의사결정" |
| **배움 (Learner)** | "학습", "교육", "자격증", "독학" | "SQL 독학" |
| **커뮤니케이션** | "발표", "보고", "설득", "공유" | "월간 전사 발표" |
| **개발 (Developer)** | "멘토링", "육성", "코칭" | "신입 2명 멘토링" |
| **최상화 (Maximizer)** | "개선", "최적화", "효율" | "전환율 35% 개선" |

### 검증 알고리즘

```javascript
function validateStrengthsWithResume(gallupTop5, resume) {
  const results = [];
  
  gallupTop5.forEach(strength => {
    const keywords = STRENGTH_KEYWORDS[strength.name_en];
    const evidence = [];
    
    // 이력서 전체 텍스트 검색
    resume.careers.forEach(career => {
      career.responsibilities.forEach(resp => {
        keywords.forEach(keyword => {
          if (resp.includes(keyword)) {
            evidence.push({
              text: resp,
              keyword: keyword,
              context: `${career.company} - ${career.position}`
            });
          }
        });
      });
    });
    
    // 검증 결과
    results.push({
      strength: strength.name_ko,
      is_validated: evidence.length >= 3,
      evidence_count: evidence.length,
      evidence: evidence.slice(0, 3)
    });
  });
  
  return results;
}
```

**출력 예시:**
```json
[
  {
    "strength": "전략",
    "is_validated": true,
    "evidence_count": 5,
    "evidence": [
      {
        "text": "3개년 제품 로드맵 수립",
        "keyword": "로드맵",
        "context": "OO 스타트업 - PM"
      }
    ]
  },
  {
    "strength": "배움",
    "is_validated": false,
    "evidence_count": 1,
    "evidence": [...]
  }
]
```

---

##  경력 공백 탐지

### 로직
```javascript
function detectCareerGaps(careers) {
  const gaps = [];
  
  // 경력을 시작일 기준 정렬
  const sorted = careers.sort((a, b) => 
    new Date(a.start_date) - new Date(b.start_date)
  );
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    const gapMonths = monthsDiff(
      current.end_date, 
      next.start_date
    );
    
    if (gapMonths > 2) {
      gaps.push({
        period: `${current.end_date} ~ ${next.start_date}`,
        duration_months: gapMonths,
        needs_interview_question: gapMonths > 6
      });
    }
  }
  
  return gaps;
}
```

**Interview 연동:**
- 6개월 이상 공백 → 질문 추가
- 예: "2021-2022년에는 어떤 활동을 하셨나요?"

---

##  최종 추출 데이터 스키마

```typescript
interface ExtractedData {
  // 기본 정보
  basic_info: {
    name: string;
    email: string;
    phone: string;
    current_position: string;
    current_company: string;
  };
  
  // 경력 요약
  career_summary: {
    total_years: number;
    total_companies: number;
    total_projects: number;
    career_gaps: CareerGap[];
  };
  
  // 경력 상세
  careers: Career[];
  projects: Project[];
  
  // 역량
  hard_skills: HardSkills;
  soft_skills_inferred: SoftSkills;
  
  // 진단 결과
  gallup?: {
    top5: GallupStrength[];
  };
  mbti?: {
    type: string;
    traits?: object;
  };
  
  // 메타 정보
  extraction_confidence: {
    basic_info: number;
    careers: number;
    soft_skills: number;
  };
}
```

---

**다음 문서**: `03_ui_ux_flow.md` - UI/UX 플로우 및 화면 설계
