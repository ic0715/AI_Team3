# 비정형 이력서 데이터 추출 스펙

## 📄 갤럽 CliftonStrengths 분석 결과

업로드해주신 PDF 분석:
- **34개 강점 테마** 각각에 대한 정형화된 구조
- **4개 카테고리**: E(실행력), I(영향력), R(관계 구축), T(전략적 사고)
- **각 테마별 추출 정보**:
  - 한글명 + 영문명 (예: "성취 ACHIEVER")
  - 설명문
  - "기여하는 것"
  - "필요로 하는 것"

### 갤럽 파싱 전략
```javascript
// 갤럽 PDF/이미지에서 추출할 패턴
{
  "strengths": [
    {
      "name_ko": "성취",
      "name_en": "ACHIEVER",
      "category": "E", // 실행력
      "rank": 1 // Top 5인 경우에만
    }
  ],
  "top5": ["성취", "전략", "배움", "분석", "책임"]
}
```

---

## 📋 비정형 이력서에서 추출 가능한 데이터

### Level 1: 기본 식별 정보 (필수)

| 항목 | 추출 방법 | 예시 | 신뢰도 |
|------|----------|------|--------|
| **이름** | 문서 상단, 굵은 글씨, 큰 폰트 | "홍길동" | 95% |
| **연락처** | 전화번호 패턴 (010-XXXX-XXXX) | "010-1234-5678" | 90% |
| **이메일** | 이메일 패턴 (@포함) | "hong@example.com" | 95% |
| **현재 직무** | "현재", "재직 중" 키워드 근처 | "프로덕트 매니저" | 75% |
| **현재 회사** | 최상단 경력 또는 "현재" 키워드 | "OO 스타트업" | 80% |

### Level 2: 경력 타임라인 + 프로젝트 (중요)

#### 2-1. 경력 정보
```json
{
  "careers": [
    {
      "company": "OO 스타트업",
      "position": "프로덕트 매니저",
      "period": "2021.03 ~ 현재",
      "duration_months": 36,
      "is_current": true,
      "responsibilities": [
        "SaaS 제품 기획 및 로드맵 수립",
        "크로스팀 협업 리드"
      ]
    },
    {
      "company": "XX 기업",
      "position": "주니어 PM",
      "period": "2019.06 ~ 2021.02",
      "duration_months": 20,
      "is_current": false
    }
  ],
  "total_experience_years": 4.7,
  "career_gap": [] // 경력 공백 탐지
}
```

**추출 전략:**
- 연도 패턴 (`2019`, `2021.03`, `2019.06~2021.02`)
- "현재", "재직 중", "Present" 키워드
- 회사명 앞에 주로 등장하는 직무명
- 불릿 포인트(•, -, *) 아래의 업무 내용

#### 2-2. 프로젝트 경험
```json
{
  "projects": [
    {
      "name": "AI 기반 추천 시스템 구축",
      "period": "2022.06 ~ 2022.12",
      "role": "PM/기획",
      "keywords": ["AI", "추천 시스템", "데이터 분석"],
      "achievements": [
        "사용자 체류시간 35% 증가",
        "CTR 20% 개선"
      ],
      "is_leadership": true // 리드 역할 여부
    }
  ]
}
```

**추출 전략:**
- "프로젝트", "Project", "수행 과제" 섹션
- 숫자를 포함한 성과 문장 (%, 증가, 개선, 달성)
- "리드", "주도", "기획" → 리더십 경험 플래그

### Level 3: 기술 스택 + 성과 지표 + 소프트 스킬 (심화)

#### 3-1. 기술 스택 / 도메인 전문성
```json
{
  "hard_skills": {
    "tools": ["Figma", "JIRA", "Notion", "GA4"],
    "methodologies": ["애자일", "스크럼", "디자인 씽킹"],
    "domains": ["SaaS", "B2B", "모바일 앱"],
    "technical": ["SQL 기초", "A/B 테스트 설계"]
  },
  "proficiency_indicators": {
    // 숙련도 추론
    "Figma": "상" // "능숙", "활용" 키워드
  }
}
```

**추출 전략:**
- "사용 기술", "Skills", "역량" 섹션
- 나열된 툴/기술명 (쉼표, 불릿 포인트로 구분)
- "능숙", "상급", "활용 가능" → 숙련도 추론

#### 3-2. 정량적 성과 지표
```json
{
  "achievements": [
    {
      "metric": "사용자 증가율",
      "value": "35%",
      "context": "AI 추천 시스템 도입 후"
    },
    {
      "metric": "프로젝트 완료",
      "value": "5개",
      "context": "2022년 한 해"
    },
    {
      "metric": "매출 기여",
      "value": "2억원",
      "context": "신규 기능 출시"
    }
  ]
}
```

**추출 전략:**
- 숫자 + 단위 패턴: `35%`, `2억`, `5개`, `3배`
- "증가", "개선", "달성", "기여" 동사
- 문맥에서 지표 의미 파악

#### 3-3. 소프트 스킬 추론
```json
{
  "soft_skills_inferred": {
    "리더십": {
      "score": 8,
      "evidence": [
        "크로스팀 협업 리드",
        "주니어 멘토링 2명",
        "팀 온보딩 가이드 작성"
      ]
    },
    "커뮤니케이션": {
      "score": 7,
      "evidence": [
        "임원 보고 월 2회",
        "기술팀-디자인팀 중재 역할"
      ]
    },
    "문제해결": {
      "score": 9,
      "evidence": [
        "지표 하락 원인 분석 및 개선안 도출",
        "기술 부채 해결을 위한 우선순위 수립"
      ]
    }
  }
}
```

**추출 전략:**
- **키워드 매칭**:
  - 리더십: "리드", "주도", "멘토링", "코칭", "팀 빌딩"
  - 커뮤니케이션: "보고", "발표", "협업", "조율", "설득"
  - 문제해결: "분석", "개선", "해결", "최적화"
  - 의사결정: "선정", "결정", "우선순위", "전략 수립"
- **빈도 카운트**: 같은 키워드가 여러 번 등장 → 높은 점수

---

## 🎯 이력서 vs 갤럽 강점 연결 로직

### 1. 강점-경력 매핑 테이블

| 갤럽 강점 | 이력서에서 찾을 키워드 | 증거 예시 |
|----------|---------------------|----------|
| **전략 (Strategic)** | "전략", "로드맵", "우선순위", "기획" | "제품 로드맵 수립", "전략적 의사결정" |
| **성취 (Achiever)** | "달성", "완료", 숫자 성과, "목표" | "목표 120% 달성", "프로젝트 10개 완료" |
| **책임 (Responsibility)** | "담당", "책임", "주인의식", "완수" | "엔드투엔드 책임", "프로젝트 완수율 100%" |
| **분석 (Analytical)** | "분석", "데이터", "인사이트", "근거" | "데이터 기반 의사결정", "지표 분석" |
| **배움 (Learner)** | "학습", "교육", "자격증", "독학" | "SQL 독학", "PMP 자격증 취득" |
| **커뮤니케이션** | "발표", "보고", "설득", "공유" | "월간 전사 발표", "임원 보고" |
| **개발 (Developer)** | "멘토링", "육성", "코칭", "온보딩" | "신입 2명 멘토링", "온보딩 가이드 작성" |
| **최상화 (Maximizer)** | "개선", "최적화", "효율", "퀄리티" | "전환율 35% 개선", "프로세스 효율화" |

### 2. 자동 매칭 알고리즘

```javascript
function matchStrengthsToResume(resume, gallupResults) {
  const matches = [];
  
  // 갤럽 Top 5 강점 각각에 대해
  gallupResults.top5.forEach(strength => {
    const keywords = STRENGTH_KEYWORDS[strength]; // 위 테이블 참조
    const evidence = [];
    
    // 이력서 전체 텍스트에서 키워드 검색
    resume.careers.forEach(career => {
      career.responsibilities.forEach(resp => {
        keywords.forEach(keyword => {
          if (resp.includes(keyword)) {
            evidence.push({
              text: resp,
              matched_keyword: keyword,
              context: career.company + " - " + career.position
            });
          }
        });
      });
    });
    
    // 증거가 3개 이상이면 "검증된 강점"
    matches.push({
      strength: strength,
      evidence_count: evidence.length,
      is_validated: evidence.length >= 3,
      examples: evidence.slice(0, 3) // 상위 3개만
    });
  });
  
  return matches;
}
```

---

## 📊 추출 데이터 활용 예시

### 케이스: 갤럽 강점 "전략" + 이력서 분석

**갤럽 결과:**
```json
{
  "top5": ["전략", "분석", "배움", "성취", "책임"]
}
```

**이력서 추출 데이터:**
```json
{
  "projects": [
    {
      "name": "신규 서비스 론칭 전략 수립",
      "achievements": ["시장 분석 기반 3개년 로드맵 작성"]
    }
  ],
  "soft_skills_inferred": {
    "전략적 사고": {
      "score": 9,
      "evidence": ["로드맵", "전략", "우선순위" 키워드 5회 등장]
    }
  }
}
```

**매칭 결과:**
```json
{
  "strength": "전략 (Strategic)",
  "gallup_says": "앞으로 나아가기 위한 대안들을 만들어냄",
  "resume_validates": true,
  "evidence": [
    "신규 서비스 론칭 전략 수립 (프로젝트명)",
    "3개년 로드맵 작성 (성과)",
    "'전략' 키워드 5회 등장"
  ],
  "recommendation": "전략적 사고 강점이 경력에서 잘 드러나고 있습니다. Interview에서 '미래지향' 질문을 추가해보세요."
}
```

---

## 🔍 경력 공백 탐지 로직

```javascript
function detectCareerGaps(careers) {
  const gaps = [];
  const sortedCareers = careers.sort((a, b) => 
    new Date(a.start_date) - new Date(b.start_date)
  );
  
  for (let i = 0; i < sortedCareers.length - 1; i++) {
    const current = sortedCareers[i];
    const next = sortedCareers[i + 1];
    
    const gapMonths = monthsDiff(current.end_date, next.start_date);
    
    if (gapMonths > 2) { // 2개월 초과 공백
      gaps.push({
        period: `${current.end_date} ~ ${next.start_date}`,
        duration_months: gapMonths,
        needs_clarification: gapMonths > 6 // 6개월 이상은 질문 추가
      });
    }
  }
  
  return gaps;
}
```

**활용:**
- 6개월 이상 공백 발견 시 → Interview에 질문 추가
  - 예: "2021-2022년에는 어떤 활동을 하셨나요?"

---

## 📝 최종 추출 데이터 스키마

```json
{
  "basic_info": {
    "name": "홍길동",
    "email": "hong@example.com",
    "phone": "010-1234-5678",
    "current_position": "프로덕트 매니저",
    "current_company": "OO 스타트업"
  },
  
  "career_summary": {
    "total_years": 4.7,
    "total_companies": 3,
    "total_projects": 12,
    "career_gaps": [
      {
        "period": "2020.03 ~ 2020.08",
        "duration_months": 5,
        "needs_interview_question": false
      }
    ]
  },
  
  "careers": [ /* Level 2 데이터 */ ],
  "projects": [ /* Level 2 데이터 */ ],
  "hard_skills": { /* Level 3 데이터 */ },
  "achievements": [ /* Level 3 데이터 */ ],
  
  "soft_skills_inferred": {
    "리더십": { "score": 8, "evidence": [...] },
    "커뮤니케이션": { "score": 7, "evidence": [...] },
    "문제해결": { "score": 9, "evidence": [...] },
    "의사결정": { "score": 6, "evidence": [...] }
  },
  
  "extraction_confidence": {
    "basic_info": 0.95,
    "careers": 0.85,
    "soft_skills": 0.70 // 추론이라 낮음
  }
}
```

---

## 🎨 UI에 표시할 "추출 결과 확인" 화면

### 파일 업로드 직후 (S2 화면)

```
┌─────────────────────────────────────────┐
│ ✓ 이력서 분석 완료                       │
├─────────────────────────────────────────┤
│                                         │
│ 📊 이렇게 이해했어요                     │
│                                         │
│ • 이름: 홍길동                          │
│ • 현재: OO 스타트업 프로덕트 매니저     │
│ • 경력: 4.7년 (3개 회사)                │
│ • 주요 프로젝트: 12개                   │
│                                         │
│ 🎯 발견한 강점 (이력서 기반 추론)       │
│ • 전략적 사고 (★★★★★ 9/10)           │
│   └ "로드맵", "전략" 키워드 5회        │
│ • 문제 해결 (★★★★★ 9/10)             │
│   └ "분석", "개선" 관련 성과 7건       │
│ • 리더십 (★★★★☆ 8/10)               │
│   └ 멘토링, 팀 리드 경험 3건           │
│                                         │
│ ⚠️ 확인이 필요해요                      │
│ • 2020.03~2020.08 경력 공백            │
│   → Interview에서 여쭤볼게요           │
│                                         │
│ [수정하기]  [이대로 진행 →]             │
└─────────────────────────────────────────┘
```

---

## 다음 단계: Interview 연동

1. **동적 질문 생성 로직**
2. **질문 커스터마이징 예시**
3. **분석 결과 → Interview 플로우**

