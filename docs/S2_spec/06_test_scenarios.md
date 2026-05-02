# S2 "내 정보 업로드" - 테스트 시나리오 및 검증

> **이전 문서**: `05_interview_integration.md`  
> **시리즈 완료**

---

## 🧪 테스트 전략

### 테스트 레벨

```
Unit Tests (단위)
  ↓
Integration Tests (통합)
  ↓
End-to-End Tests (E2E)
  ↓
User Acceptance Tests (UAT)
```

---

## ✅ Unit Tests

### 1. 파일 분류 로직

```javascript
describe('classifyFile', () => {
  test('이력서 파일명 인식', () => {
    expect(classifyFile('이력서_홍길동.pdf', '')).toBe('resume');
    expect(classifyFile('resume_hong.pdf', '')).toBe('resume');
    expect(classifyFile('CV_2024.pdf', '')).toBe('resume');
  });
  
  test('갤럽 파일명 인식', () => {
    expect(classifyFile('갤럽결과.jpg', '')).toBe('gallup');
    expect(classifyFile('CliftonStrengths.pdf', '')).toBe('gallup');
  });
  
  test('MBTI 파일명 인식', () => {
    expect(classifyFile('MBTI_결과.png', '')).toBe('mbti');
    expect(classifyFile('16personalities.jpg', '')).toBe('mbti');
  });
  
  test('미분류 파일', () => {
    expect(classifyFile('random.pdf', '')).toBe('other');
  });
});
```

### 2. 데이터 추출 로직

```javascript
describe('extractResumeData', () => {
  test('기본 정보 추출', () => {
    const mockPDF = `
      홍길동
      hong@example.com
      010-1234-5678
      
      OO 스타트업
      프로덕트 매니저
      2021.03 ~ 현재
    `;
    
    const result = extractBasicInfo(mockPDF);
    
    expect(result.name).toBe('홍길동');
    expect(result.email).toBe('hong@example.com');
    expect(result.phone).toBe('010-1234-5678');
  });
  
  test('경력 기간 계산', () => {
    const career = {
      start_date: '2021-03-01',
      end_date: '2024-06-30'
    };
    
    const months = calculateDurationMonths(career);
    expect(months).toBe(40); // 3년 4개월
  });
  
  test('경력 공백 탐지', () => {
    const careers = [
      { end_date: '2020-12-31' },
      { start_date: '2021-09-01' } // 8개월 공백
    ];
    
    const gaps = detectCareerGaps(careers);
    
    expect(gaps).toHaveLength(1);
    expect(gaps[0].duration_months).toBe(8);
    expect(gaps[0].needs_interview_question).toBe(true);
  });
});
```

### 3. 강점-경력 검증

```javascript
describe('validateStrengthsWithResume', () => {
  test('강점 증거 충분', () => {
    const gallup = {
      top5: [{ name_ko: '전략', name_en: 'STRATEGIC' }]
    };
    
    const resume = {
      careers: [{
        responsibilities: [
          '3개년 로드맵 수립',
          '전략적 의사결정',
          '우선순위 설정'
        ]
      }]
    };
    
    const result = validateStrengthsWithResume(gallup.top5, resume);
    
    expect(result[0].is_validated).toBe(true);
    expect(result[0].evidence_count).toBeGreaterThanOrEqual(3);
  });
  
  test('강점 증거 부족', () => {
    const gallup = {
      top5: [{ name_ko: '배움', name_en: 'LEARNER' }]
    };
    
    const resume = {
      careers: [{
        responsibilities: ['업무 수행', '보고서 작성']
      }]
    };
    
    const result = validateStrengthsWithResume(gallup.top5, resume);
    
    expect(result[0].is_validated).toBe(false);
    expect(result[0].evidence_count).toBeLessThan(3);
  });
});
```

### 4. 질문 커스터마이징

```javascript
describe('generateCustomQuestions', () => {
  test('갤럽 있으면 강점 질문 스킵', () => {
    const analysis = {
      gallup: { top5: [...] }
    };
    
    const result = generateCustomQuestions(analysis);
    
    expect(result.find(q => q.id === 'strengths_exploration')).toBeUndefined();
  });
  
  test('프로젝트 이름 삽입', () => {
    const analysis = {
      resume: {
        projects: [{ name: 'AI 추천 시스템' }]
      }
    };
    
    const result = generateCustomQuestions(analysis);
    const achievementQ = result.find(q => q.id === 'achievement_story');
    
    expect(achievementQ.question).toContain('AI 추천 시스템');
  });
});
```

---

## 🔗 Integration Tests

### 1. 파일 업로드 → 분석 → 결과

```javascript
describe('파일 분석 전체 플로우', () => {
  test('이력서 업로드 및 분석', async () => {
    // 1. 파일 읽기
    const file = fs.readFileSync('test/fixtures/resume_sample.pdf');
    const base64 = file.toString('base64');
    
    // 2. API 호출
    const response = await request(app)
      .post('/api/analyze-file')
      .send({
        base64Data: base64,
        fileType: 'resume',
        mimeType: 'application/pdf',
        filename: 'resume_sample.pdf'
      });
    
    // 3. 응답 검증
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.basic_info).toBeDefined();
    expect(response.body.confidence).toBeGreaterThan(0.7);
  });
  
  test('여러 파일 배치 분석', async () => {
    const files = [
      { type: 'resume', file: 'resume.pdf' },
      { type: 'gallup', file: 'gallup.pdf' }
    ];
    
    const response = await request(app)
      .post('/api/analyze-batch')
      .send({ files });
    
    expect(response.body.results).toHaveLength(2);
    expect(response.body.results[0].success).toBe(true);
  });
});
```

### 2. 분석 → 커스터마이징 → 저장

```javascript
describe('분석 결과 활용', () => {
  test('커스터마이징 및 저장', async () => {
    // 1. 분석 완료 상태
    const analysisData = {
      resume: { /* ... */ },
      gallup: { /* ... */ }
    };
    
    // 2. 질문 커스터마이징
    const customQuestions = generateCustomQuestions(analysisData);
    
    // 3. DB 저장
    const saved = await saveCustomQuestions(userId, customQuestions);
    
    expect(saved.id).toBeDefined();
    
    // 4. 불러오기
    const loaded = await loadCustomQuestions(userId);
    
    expect(loaded).toEqual(customQuestions);
  });
});
```

---

## 🎭 End-to-End Tests

### 사용자 시나리오 기반

```javascript
describe('E2E: 완전한 온보딩 플로우', () => {
  test('Happy Path - 모든 파일 업로드', async () => {
    // S2 진입
    await page.goto('/onboarding/s2');
    
    // 1. 파일 업로드
    await page.setInputFiles(
      'input[type="file"]',
      ['fixtures/resume.pdf', 'fixtures/gallup.pdf']
    );
    
    // 2. 자동 분류 확인
    await page.waitForSelector('.file-classification');
    const firstLabel = await page.textContent('.file-classification:first-child .label');
    expect(firstLabel).toContain('이력서');
    
    // 3. "맞음" 클릭
    await page.click('.confirm-btn:first-child');
    
    // 4. 분석 시작
    await page.click('text=분석 시작하기');
    
    // 5. 로딩 대기
    await page.waitForSelector('.file-result-card', { timeout: 10000 });
    
    // 6. Stage 1 결과 확인
    const extractedName = await page.textContent('.data-item:has-text("이름") .value');
    expect(extractedName).toBeTruthy();
    
    // 7. Stage 2 교차 분석
    await page.click('text=다음: 교차 분석');
    await page.waitForSelector('.validation-item');
    
    // 8. Interview 진입
    await page.click('text=Interview 시작하기');
    
    // 9. 커스터마이징된 질문 확인
    const questionText = await page.textContent('.voice-q-text');
    expect(questionText).toBeTruthy();
    
    // 10. 질문 개수 확인
    const progressText = await page.textContent('.voice-q-num');
    expect(progressText).toMatch(/\d+ \/ \d+/);
  });
});
```

---

## 📋 테스트 시나리오 목록

### Happy Path

| # | 시나리오 | 입력 | 예상 출력 |
|---|---------|------|----------|
| 1 | 이력서 + 갤럽 업로드 | 2개 PDF | 분석 완료, 9개 질문 |
| 2 | 이력서만 업로드 | 1개 PDF | 분석 완료, 10개 질문 (맞춤화 2개) |
| 3 | 갤럽만 업로드 | 1개 JPG | 분석 완료, 9개 질문 |
| 4 | 모든 파일 업로드 | 3개 파일 | 분석 완료, 8개 질문 + 2개 추가 |

### Edge Cases

| # | 시나리오 | 입력 | 예상 출력 |
|---|---------|------|----------|
| 5 | 손상된 PDF | Corrupted file | 에러: "파일을 읽을 수 없습니다" |
| 6 | 크기 초과 파일 | 10MB PDF | 에러: "파일이 너무 큽니다" |
| 7 | 잘못된 분류 | 이력서를 MBTI로 분류 | 신뢰도 낮음, 재확인 요청 |
| 8 | 빈 이력서 | 내용 없는 PDF | 부분 성공, 직접 입력 유도 |

### Error Cases

| # | 시나리오 | 입력 | 예상 출력 |
|---|---------|------|----------|
| 9 | API 타임아웃 | 응답 10초 초과 | 재시도 안내 |
| 10 | 지원 안 하는 형식 | .exe 파일 | 에러: "지원하지 않는 형식" |
| 11 | Base64 오류 | 잘못된 인코딩 | 에러: "파일 형식 오류" |

---

## 🎯 UAT (사용자 수용 테스트) 체크리스트

### 파일 업로드

- [ ] 드래그앤드롭으로 파일 업로드 가능
- [ ] 여러 파일 동시 선택 가능 (최대 5개)
- [ ] 업로드 중 프로그레스 바 표시
- [ ] 파일 크기 초과 시 명확한 에러 메시지

### 자동 분류

- [ ] 이력서 파일 90% 이상 정확 분류
- [ ] 갤럽 결과 85% 이상 정확 분류
- [ ] MBTI 결과 85% 이상 정확 분류
- [ ] 잘못 분류 시 수동 변경 가능

### 분석 결과

- [ ] 3-5초 내 분석 완료
- [ ] Stage 1: 파일별 결과 명확히 표시
- [ ] Stage 2: 교차 분석 이해하기 쉬움
- [ ] 추출된 정보 인라인 수정 가능

### Interview 커스터마이징

- [ ] 질문 개수 변화 명확히 안내
- [ ] 맞춤화된 질문이 자연스러움
- [ ] 추가 질문의 이유 이해 가능

### 전체 플로우

- [ ] S2 → S3 전환이 부드러움
- [ ] 뒤로가기 시 데이터 유지
- [ ] 에러 발생 시 복구 경로 명확

---

## 📊 성능 벤치마크

### 목표 지표

```
파일 업로드 → 분류: < 1초
분류 → 분석 시작: < 0.5초
분석 처리 (Claude API): 3-5초
결과 렌더링: < 1초

총 소요 시간: < 7초
```

### 실제 측정

```javascript
const performanceTest = async () => {
  const start = performance.now();
  
  // 1. 파일 업로드 & 분류
  const t1 = performance.now();
  await uploadFile(file);
  console.log(`Upload + Classify: ${t1 - start}ms`);
  
  // 2. 분석 시작
  const t2 = performance.now();
  const result = await analyzeFile(file);
  console.log(`Analysis: ${t2 - t1}ms`);
  
  // 3. 렌더링
  const t3 = performance.now();
  renderResults(result);
  console.log(`Render: ${t3 - t2}ms`);
  
  console.log(`Total: ${t3 - start}ms`);
};
```

---

## 🐛 알려진 이슈 & 해결 방안

### 이슈 1: OCR 정확도

**문제**: 이미지 기반 갤럽 결과 인식률 70%  
**해결**: 
1. PDF 업로드 권장 안내
2. 신뢰도 낮으면 직접 입력 유도
3. Phase 2에서 OCR 엔진 개선

### 이슈 2: 비정형 이력서

**문제**: 디자인 이력서는 텍스트 추출 어려움  
**해결**:
1. "구조화된 이력서 권장" 안내
2. 실패 시 직접 입력 필드 강화
3. 최소한의 정보만 요구

### 이슈 3: API 비용

**문제**: Claude API 호출당 비용  
**해결**:
1. 캐싱으로 중복 분석 방지
2. 무료 사용자는 파일당 제한
3. Pro 사용자는 무제한

---

## ✅ 출시 전 체크리스트

### 기능

- [ ] 모든 Unit Tests 통과
- [ ] 모든 Integration Tests 통과
- [ ] E2E 시나리오 5개 이상 통과
- [ ] UAT 체크리스트 100% 완료

### 성능

- [ ] 평균 분석 시간 < 7초
- [ ] 99th percentile < 15초
- [ ] API 성공률 > 95%

### 보안

- [ ] 파일 검증 로직 검증 완료
- [ ] Rate limiting 테스트 완료
- [ ] 민감 정보 로깅 제거
- [ ] HTTPS 필수 설정

### UX

- [ ] 모바일 테스트 완료
- [ ] 다양한 브라우저 테스트
- [ ] 에러 메시지 명확성 검증
- [ ] 로딩 상태 적절성 검증

### 문서

- [ ] API 문서 작성
- [ ] 사용자 가이드 작성
- [ ] 에러 코드 정리
- [ ] FAQ 작성

---

## 📈 모니터링 지표

### 출시 후 추적

```javascript
// 분석 성공률
const successRate = (successCount / totalCount) * 100;

// 평균 처리 시간
const avgTime = totalProcessingTime / successCount;

// 파일 타입별 분포
const typeDistribution = {
  resume: resumeCount / totalCount,
  gallup: gallupCount / totalCount,
  mbti: mbtiCount / totalCount
};

// 사용자 만족도
const satisfactionRate = (correctClassificationCount / totalCount) * 100;
```

### 알림 설정

```
성공률 < 90% → Slack 알림
평균 시간 > 10초 → 경고
에러율 > 5% → 긴급 알림
```

---

## 🔄 개선 로드맵

### Phase 1 (MVP) - 완료
- [x] PDF/DOCX/JPG 지원
- [x] 이력서 Level 3 추출
- [x] 갤럽 Top 5 추출
- [x] MBTI 타입 추출
- [x] Interview 커스터마이징

### Phase 2 (개선)
- [ ] DISC, 홀랜드 지원
- [ ] OCR 정확도 개선
- [ ] 영문 이력서 지원
- [ ] 다중 언어 진단 결과

### Phase 3 (확장)
- [ ] 파일 비교 기능
- [ ] 이력서 자동 생성
- [ ] AI 코칭 제안
- [ ] 경력 시뮬레이션

---

**문서 시리즈 완료**  
**처음으로 돌아가기**: `01_overview.md`
