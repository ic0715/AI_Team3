# S2 "내 정보 업로드" - API 및 백엔드 구현

> **이전 문서**: `03_ui_ux_flow.md`  
> **다음 문서**: `05_interview_integration.md`

---

## 🏗️ 백엔드 아키텍처

```
┌─────────────────┐
│   프론트엔드     │
│  (Browser)      │
└────────┬────────┘
         │ POST /api/analyze-file
         │ { base64, fileType, mimeType }
         ↓
┌─────────────────┐
│   API 서버      │
│  (Node.js/Py)   │
├─────────────────┤
│ • 파일 검증     │
│ • Base64 디코드 │
│ • Claude API   │
│   호출          │
│ • 응답 파싱     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Claude API     │
│  (Anthropic)    │
└─────────────────┘
```

---

## 📡 API 엔드포인트

### POST /api/analyze-file

**요청:**
```json
{
  "base64Data": "JVBERi0xLjQKJeLjz9...",
  "fileType": "resume",
  "mimeType": "application/pdf",
  "filename": "이력서_홍길동.pdf"
}
```

**응답 (성공):**
```json
{
  "success": true,
  "data": {
    "basic_info": { ... },
    "careers": [ ... ],
    "projects": [ ... ]
  },
  "confidence": 0.85,
  "processing_time_ms": 3200
}
```

**응답 (실패):**
```json
{
  "success": false,
  "error": {
    "code": "PARSING_FAILED",
    "message": "PDF 파일을 읽을 수 없습니다",
    "details": "Corrupted file structure"
  }
}
```

---

## 💻 백엔드 구현 (Node.js)

### 서버 설정

```javascript
// server.js
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const multer = require('multer');
const cors = require('cors');

const app = express();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 10, // 사용자당 최대 10개 파일
  message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.'
});

app.use('/api/analyze-file', limiter);
```

### 파일 분석 엔드포인트

```javascript
// routes/analyze.js
app.post('/api/analyze-file', async (req, res) => {
  try {
    const { base64Data, fileType, mimeType, filename } = req.body;
    
    // 1. 입력 검증
    const validation = validateInput(base64Data, fileType, mimeType);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: validation.error
        }
      });
    }
    
    // 2. 프롬프트 선택
    const prompt = getPromptForFileType(fileType);
    
    // 3. Claude API 호출
    const startTime = Date.now();
    const response = await callClaudeAPI(
      base64Data, 
      mimeType, 
      prompt
    );
    const processingTime = Date.now() - startTime;
    
    // 4. 응답 파싱
    const parsed = parseClaudeResponse(response);
    
    // 5. 신뢰도 계산
    const confidence = calculateConfidence(parsed, fileType);
    
    // 6. 원본 파일 데이터 폐기
    base64Data = null;
    
    // 7. DB 저장 (추출 데이터만)
    await saveExtractedData({
      userId: req.user.id,
      fileType,
      data: parsed,
      confidence,
      filename
    });
    
    // 8. 응답
    res.json({
      success: true,
      data: parsed,
      confidence,
      processing_time_ms: processingTime
    });
    
  } catch (error) {
    console.error('Analysis error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || '파일 분석 중 오류가 발생했습니다'
      }
    });
  }
});
```

### Claude API 호출

```javascript
async function callClaudeAPI(base64Data, mimeType, prompt) {
  const contentType = mimeType.includes('pdf') ? 'document' : 'image';
  
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{
      role: "user",
      content: [
        {
          type: contentType,
          source: {
            type: "base64",
            media_type: mimeType,
            data: base64Data
          }
        },
        {
          type: "text",
          text: prompt
        }
      ]
    }]
  });
  
  return response;
}
```

### 응답 파싱

```javascript
function parseClaudeResponse(response) {
  const content = response.content[0].text;
  
  // JSON 코드 블록 추출
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }
  
  // 코드 블록 없이 바로 JSON
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error('Claude 응답을 JSON으로 파싱할 수 없습니다');
  }
}
```

### 신뢰도 계산

```javascript
function calculateConfidence(data, fileType) {
  if (fileType === 'resume') {
    let score = 0;
    
    // 기본 정보 완성도
    if (data.basic_info?.name) score += 0.2;
    if (data.basic_info?.email) score += 0.1;
    if (data.basic_info?.phone) score += 0.1;
    
    // 경력 정보
    if (data.careers && data.careers.length > 0) {
      score += 0.3;
      
      // 경력 상세도
      const hasResponsibilities = data.careers.some(
        c => c.responsibilities && c.responsibilities.length > 0
      );
      if (hasResponsibilities) score += 0.1;
    }
    
    // 프로젝트
    if (data.projects && data.projects.length > 0) {
      score += 0.2;
    }
    
    return Math.min(1.0, score);
  }
  
  if (fileType === 'gallup') {
    // Top 5 강점이 모두 있으면 95%
    if (data.top5 && data.top5.length === 5) {
      return 0.95;
    }
    // 일부만 있으면 비례
    return (data.top5?.length || 0) / 5 * 0.95;
  }
  
  if (fileType === 'mbti') {
    // MBTI 타입이 정확하면 90%
    return data.type ? 0.9 : 0.3;
  }
  
  return 0.5; // 기타
}
```

---

## 📝 Claude 프롬프트

### 이력서 분석 프롬프트

```javascript
const RESUME_PROMPT = `
다음 이력서에서 정보를 추출해주세요.

반드시 아래 JSON 형식으로 응답하세요:

\`\`\`json
{
  "basic_info": {
    "name": "string | null",
    "email": "string | null",
    "phone": "string | null",
    "current_position": "string | null",
    "current_company": "string | null"
  },
  "career_summary": {
    "total_years": number,
    "total_companies": number,
    "career_gaps": [
      {
        "period": "YYYY.MM ~ YYYY.MM",
        "duration_months": number
      }
    ]
  },
  "careers": [
    {
      "company": "string",
      "position": "string",
      "period": "YYYY.MM ~ YYYY.MM",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD | null",
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
  "hard_skills": {
    "tools": ["string"],
    "methodologies": ["string"],
    "domains": ["string"],
    "technical": ["string"]
  },
  "soft_skills_inferred": {
    "리더십": {
      "score": 1-10,
      "evidence": ["string"],
      "keyword_count": number
    },
    "커뮤니케이션": { ... },
    "문제해결": { ... },
    "의사결정": { ... }
  }
}
\`\`\`

추출 규칙:
1. 없는 정보는 null 반환
2. 경력 기간은 개월 수로 환산
3. "현재", "재직 중", "Present" → is_current: true
4. 정량적 성과는 숫자만 추출 ("35% 증가" → 35)
5. 소프트 스킬은 다음 키워드 빈도 기반:
   - 리더십: "리드", "주도", "멘토링", "코칭"
   - 커뮤니케이션: "보고", "발표", "협업", "조율"
   - 문제해결: "분석", "개선", "해결", "최적화"
   - 의사결정: "선정", "결정", "우선순위", "전략"

점수 계산: min(10, keyword_count * 2)
`;
```

### 갤럽 강점 프롬프트

```javascript
const GALLUP_PROMPT = `
이 갤럽 CliftonStrengths 결과에서 Top 5 강점을 추출해주세요.

반드시 아래 JSON 형식으로 응답하세요:

\`\`\`json
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
\`\`\`

카테고리:
- E: 실행력 (Executing)
- I: 영향력 (Influencing)
- R: 관계 구축 (Relationship Building)
- T: 전략적 사고 (Strategic Thinking)

34개 강점 테마 (참고):
성취(Achiever), 행동(Activator), 적응(Adaptability), 분석(Analytical),
정리(Arranger), 신념(Belief), 주도력(Command), 커뮤니케이션(Communication),
승부(Competition), 연결성(Connectedness), 공정성(Consistency), 회고(Context),
심사숙고(Deliberative), 개발(Developer), 체계(Discipline), 공감(Empathy),
집중(Focus), 미래지향(Futuristic), 화합(Harmony), 발상(Ideation),
포용(Includer), 개별화(Individualization), 수집(Input), 지적사고(Intellection),
배움(Learner), 최상화(Maximizer), 긍정(Positivity), 절친(Relator),
책임(Responsibility), 복구(Restorative), 자기확신(Self-Assurance),
존재감(Significance), 전략(Strategic), 사교성(Woo)
`;
```

### MBTI 추출 프롬프트

```javascript
const MBTI_PROMPT = `
이 MBTI 결과에서 타입을 추출해주세요.

반드시 아래 JSON 형식으로 응답하세요:

\`\`\`json
{
  "type": "INTJ",
  "traits": {
    "I": 67,
    "N": 82,
    "T": 73,
    "J": 55
  }
}
\`\`\`

16가지 MBTI 타입:
INTJ, INTP, ENTJ, ENTP,
INFJ, INFP, ENFJ, ENFP,
ISTJ, ISFJ, ESTJ, ESFJ,
ISTP, ISFP, ESTP, ESFP

traits는 각 지표별 점수가 명시되어 있을 때만 포함하세요.
없으면 생략 가능합니다.
`;
```

---

## 🔒 보안 구현

### 파일 검증

```javascript
function validateInput(base64Data, fileType, mimeType) {
  // 1. 필수 필드 체크
  if (!base64Data || !fileType || !mimeType) {
    return {
      valid: false,
      error: '필수 필드가 누락되었습니다'
    };
  }
  
  // 2. MIME 타입 화이트리스트
  const ALLOWED_MIMES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ];
  
  if (!ALLOWED_MIMES.includes(mimeType)) {
    return {
      valid: false,
      error: '지원하지 않는 파일 형식입니다'
    };
  }
  
  // 3. Base64 크기 체크 (대략적인 바이트 크기)
  const sizeBytes = (base64Data.length * 3) / 4;
  const sizeMB = sizeBytes / 1024 / 1024;
  
  const MAX_SIZE_MB = {
    'application/pdf': 5,
    'image/jpeg': 3,
    'image/png': 3,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 5
  };
  
  if (sizeMB > MAX_SIZE_MB[mimeType]) {
    return {
      valid: false,
      error: `파일이 너무 큽니다 (최대 ${MAX_SIZE_MB[mimeType]}MB)`
    };
  }
  
  // 4. Base64 형식 검증
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Data)) {
    return {
      valid: false,
      error: 'Base64 형식이 올바르지 않습니다'
    };
  }
  
  return { valid: true };
}
```

### 악성 파일 스캔 (선택)

```javascript
const NodeClam = require('clamscan');

async function scanFile(base64Data) {
  const clamscan = await new NodeClam().init({
    removeInfected: true,
    debugMode: false
  });
  
  // Base64 → Buffer
  const buffer = Buffer.from(base64Data, 'base64');
  
  // 스캔
  const { isInfected, viruses } = await clamscan.scanStream(buffer);
  
  if (isInfected) {
    throw new Error(`악성 파일 감지: ${viruses.join(', ')}`);
  }
}
```

---

## 💾 데이터베이스 스키마

### 추출 데이터 저장

```sql
CREATE TABLE extracted_files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  file_type VARCHAR(20) NOT NULL,
  filename VARCHAR(255),
  
  -- 추출된 데이터 (JSON)
  extracted_data JSONB NOT NULL,
  
  -- 메타데이터
  confidence DECIMAL(3,2),
  processing_time_ms INTEGER,
  
  -- 타임스탬프
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_user_files ON extracted_files(user_id, created_at DESC);
CREATE INDEX idx_file_type ON extracted_files(file_type);
```

### 데이터 저장 함수

```javascript
async function saveExtractedData({
  userId,
  fileType,
  data,
  confidence,
  filename
}) {
  const query = `
    INSERT INTO extracted_files 
    (user_id, file_type, filename, extracted_data, confidence, processing_time_ms)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  
  const result = await db.query(query, [
    userId,
    fileType,
    filename,
    JSON.stringify(data),
    confidence,
    null // processing_time은 별도 업데이트
  ]);
  
  return result.rows[0].id;
}
```

---

## ⚡ 성능 최적화

### 응답 캐싱

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // 1시간

async function analyzeWithCache(fileHash, analyzeFn) {
  // 캐시 확인
  const cached = cache.get(fileHash);
  if (cached) {
    return cached;
  }
  
  // 분석 실행
  const result = await analyzeFn();
  
  // 캐시 저장
  cache.set(fileHash, result);
  
  return result;
}

// 사용
const fileHash = crypto
  .createHash('sha256')
  .update(base64Data)
  .digest('hex');

const result = await analyzeWithCache(fileHash, () =>
  callClaudeAPI(base64Data, mimeType, prompt)
);
```

### 배치 처리

```javascript
// 여러 파일 한번에 처리
app.post('/api/analyze-batch', async (req, res) => {
  const { files } = req.body; // 최대 5개
  
  // 병렬 처리
  const results = await Promise.all(
    files.map(file => 
      analyzeFile(file).catch(err => ({
        success: false,
        error: err.message
      }))
    )
  );
  
  res.json({ results });
});
```

---

## 📊 모니터링 & 로깅

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// 사용
logger.info('File analysis started', {
  userId: req.user.id,
  fileType,
  fileSize: base64Data.length
});

logger.error('Analysis failed', {
  userId: req.user.id,
  error: error.message,
  stack: error.stack
});
```

---

**다음 문서**: `05_interview_integration.md` - Interview 질문 커스터마이징
