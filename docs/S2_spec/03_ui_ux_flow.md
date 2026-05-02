# S2 "내 정보 업로드" - UI/UX 플로우 및 화면 설계

> **이전 문서**: `02_data_extraction.md`  
> **다음 문서**: `04_api_backend.md`

---

## 🎨 전체 사용자 여정

```
S2 진입
   ↓
[1] 파일 업로드 영역
   ↓ (파일 선택)
[2] 파일 미리보기 + 자동 분류
   ↓ (사용자 확인)
[3] 분석 시작 → 로딩
   ↓ (3-5초)
[4] Stage 1: 파일별 결과
   ↓
[5] Stage 2: 교차 분석
   ↓
[6] Interview 시작
```

---

## 📱 화면별 상세 설계

### [1] 파일 업로드 영역

```
┌────────────────────────────────────────┐
│ ← 기본 설문             2 / 4           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                        │
│ 내 정보를                               │
│ 업로드해주세요                           │
│                                        │
│ 이력서, 강점·흥미·이키가이 등 진단       │
│ 결과를 AI가 함께 분석합니다.             │
│                                        │
│ ┌────────────────────────────────┐    │
│ │  ┌────┐                        │    │
│ │  │ ⬆ │  탭해서 파일 업로드       │    │
│ │  └────┘                        │    │
│ │                                │    │
│ │  이력서 · 진단 결과 · PDF ·     │    │
│ │  JPG · DOCX                    │    │
│ └────────────────────────────────┘    │
│                                        │
│ 💡 업로드하면 좋은 것:                  │
│  ✓ Interview 질문이 개인화돼요          │
│  ✓ 분석 정확도가 높아져요 (약 30% ↑)    │
│  ✓ 온보딩 시간이 단축돼요 (약 5분 절약) │
│                                        │
│ 또는 내용을 직접 입력                   │
│ ┌────────────────────────────────┐    │
│ │ MBTI: INTJ / 강점: 공감, ...   │    │
│ │                                │    │
│ └────────────────────────────────┘    │
│                                        │
│                  [건너뛰기]  [다음 →]   │
└────────────────────────────────────────┘
```

**인터랙션:**
- 업로드 영역 탭 → 파일 선택 다이얼로그
- 드래그앤드롭 지원
- 여러 파일 한번에 선택 가능 (최대 5개)

---

### [2] 파일 미리보기 + 자동 분류

```
┌────────────────────────────────────────┐
│ 📂 업로드된 파일 (3개)                  │
├────────────────────────────────────────┤
│                                        │
│ ┌────────────────────────────────┐    │
│ │ [썸네일]  📄 이력서_홍길동.pdf  │    │
│ │  이미지   2.3MB                 │    │
│ │                                │    │
│ │  🏷️ 이력서로 인식했어요          │    │
│ │  [맞음 ✓]  [아님, 변경 →]       │    │
│ └────────────────────────────────┘    │
│                                        │
│ ┌────────────────────────────────┐    │
│ │ [썸네일]  🎯 갤럽결과.jpg        │    │
│ │  이미지   1.1MB                 │    │
│ │                                │    │
│ │  🏷️ 강점 진단으로 인식했어요     │    │
│ │  [맞음 ✓]  [아님, 변경 →]       │    │
│ └────────────────────────────────┘    │
│                                        │
│ ┌────────────────────────────────┐    │
│ │ [썸네일]  📊 MBTI_결과.png       │    │
│ │  이미지   850KB                 │    │
│ │                                │    │
│ │  🏷️ 성격 진단으로 인식했어요     │    │
│ │  [맞음 ✓]  [아님, 변경 →]       │    │
│ └────────────────────────────────┘    │
│                                        │
│            [분석 시작하기 →]            │
└────────────────────────────────────────┘
```

**[변경 →] 클릭 시 드롭다운:**
```
┌──────────────────────┐
│ ○ 이력서              │
│ ○ 갤럽 강점 진단      │
│ ◉ MBTI               │ ← 선택됨
│ ○ DISC               │
│ ○ 홀랜드 검사         │
│ ○ 기타 (직접 입력)    │
└──────────────────────┘
```

---

### [3] 분석 진행 (로딩)

```
┌────────────────────────────────────────┐
│                                        │
│         🔄 파일 분석 중...              │
│                                        │
│   ██████████████░░░░░░░░ 65%          │
│                                        │
│   이력서에서 경력 정보 추출 중...       │
│                                        │
│                                        │
│                                        │
└────────────────────────────────────────┘
```

**로딩 메시지 순서:**
1. "파일을 읽고 있어요..."
2. "이력서에서 경력 정보 추출 중..."
3. "갤럽 강점 분석 중..."
4. "강점과 경력을 교차 검증하고 있어요..."

---

### [4] Stage 1: 파일별 결과

```
┌────────────────────────────────────────┐
│ ✓ 분석 완료!                            │
├────────────────────────────────────────┤
│                                        │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ 📄 이력서                        ┃  │
│ ┃ ✓ 분석 완료 (3초 전)              ┃  │
│ ┃                                  ┃  │
│ ┃ ✦ 이렇게 이해했어요               ┃  │
│ ┃                                  ┃  │
│ ┃ • 이름: 홍길동            [✏️]    ┃  │
│ ┃ • 경력: 4.7년 (3개 회사)          ┃  │
│ ┃ • 주요 프로젝트: 12개             ┃  │
│ ┃                                  ┃  │
│ ┃ 분석 신뢰도                       ┃  │
│ ┃ ████████████████░░ 85%           ┃  │
│ ┃                                  ┃  │
│ ┃ [상세 보기 →]                     ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                        │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ 🎯 갤럽 강점 진단                 ┃  │
│ ┃ ✓ 분석 완료 (2초 전)              ┃  │
│ ┃                                  ┃  │
│ ┃ Top 5 강점:                      ┃  │
│ ┃ 1. 전략 (Strategic) [T]          ┃  │
│ ┃ 2. 분석 (Analytical) [T]         ┃  │
│ ┃ 3. 배움 (Learner) [T]            ┃  │
│ ┃ 4. 성취 (Achiever) [E]           ┃  │
│ ┃ 5. 책임 (Responsibility) [E]     ┃  │
│ ┃                                  ┃  │
│ ┃ [상세 보기 →]                     ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                        │
│            [다음: 교차 분석 →]          │
└────────────────────────────────────────┘
```

**[✏️] 인라인 수정:**
```
• 이름: [홍길동_____] ← 입력 가능 상태
       [저장] [취소]
```

---

### [5] Stage 2: 교차 분석

```
┌────────────────────────────────────────┐
│ 🔄 파일 간 교차 분석                    │
├────────────────────────────────────────┤
│                                        │
│ ✦ 강점-경력 매칭                        │
│                                        │
│ ┌────────────────────────────────┐    │
│ │ ✓ [전략] 강점이 이력서에서도     │    │
│ │   확인돼요!                     │    │
│ │                                │    │
│ │   증거:                        │    │
│ │   • "로드맵 수립" 프로젝트 3건   │    │
│ │   • "전략적 의사결정" 키워드 5회 │    │
│ └────────────────────────────────┘    │
│                                        │
│ ┌────────────────────────────────┐    │
│ │ ✓ [분석] 강점이 경력에           │    │
│ │   잘 드러나요                   │    │
│ │                                │    │
│ │   증거:                        │    │
│ │   • "데이터 분석" 업무 7건       │    │
│ │   • 정량적 성과 지표 12개 발견   │    │
│ └────────────────────────────────┘    │
│                                        │
│ ┌────────────────────────────────┐    │
│ │ ⚠️ [배움] 강점 증거가 부족해요   │    │
│ │                                │    │
│ │   학습/교육 관련 경험을          │    │
│ │   Interview에서 더 여쭤볼게요    │    │
│ └────────────────────────────────┘    │
│                                        │
│ 📝 Interview 질문이 이렇게 바뀌었어요:  │
│                                        │
│ • "전략적 사고" 질문 → 구체적 프로젝트명│
│   삽입 ("OO 로드맵 프로젝트에서...")   │
│ • "강점 탐색" 질문 → 스킵 (이미 확인됨) │
│ • "학습 경험" 질문 → 추가              │
│                                        │
│         [Interview 시작하기 →]          │
└────────────────────────────────────────┘
```

---

## 🎭 인터랙션 상세

### 파일 업로드 영역

**Idle 상태:**
```css
.upload-zone {
  border: 1.5px dashed var(--border);
  background: var(--surface);
  cursor: pointer;
}
```

**Hover 상태:**
```css
.upload-zone:hover {
  border-color: var(--accent);
  background: var(--accent-dim);
}
```

**드래그 중:**
```css
.upload-zone.drag-over {
  border-color: var(--accent);
  background: var(--accent-light);
  border-style: solid;
}
```

**업로드 중:**
```css
.upload-zone.uploading {
  pointer-events: none;
  opacity: 0.6;
}
```

---

### 분류 확인 버튼

**기본 상태:**
```html
<div class="file-classification">
  <span class="label">🏷️ 이력서로 인식했어요</span>
  <button class="confirm-btn active">맞음 ✓</button>
  <button class="change-btn">변경 →</button>
</div>
```

**[변경 →] 클릭 후:**
```html
<div class="file-classification expanded">
  <select class="type-selector">
    <option value="resume" selected>이력서</option>
    <option value="gallup">갤럽 강점 진단</option>
    <option value="mbti">MBTI</option>
    <option value="disc">DISC</option>
    <option value="other">기타</option>
  </select>
  <button class="save-btn">저장</button>
</div>
```

---

### 분석 진행 프로그레스 바

```javascript
// 단계별 진행률
const ANALYSIS_STAGES = [
  { progress: 20, message: "파일을 읽고 있어요..." },
  { progress: 40, message: "이력서에서 경력 정보 추출 중..." },
  { progress: 60, message: "갤럽 강점 분석 중..." },
  { progress: 80, message: "강점과 경력을 교차 검증하고 있어요..." },
  { progress: 100, message: "분석 완료!" }
];

// 애니메이션
function animateProgress(stages) {
  let currentStage = 0;
  
  const interval = setInterval(() => {
    if (currentStage >= stages.length) {
      clearInterval(interval);
      return;
    }
    
    const stage = stages[currentStage];
    updateProgressBar(stage.progress);
    updateMessage(stage.message);
    
    currentStage++;
  }, 1000); // 1초마다 진행
}
```

---

### 인라인 수정 UI

```html
<!-- 기본 상태 -->
<div class="data-item">
  <label>이름</label>
  <span class="value">홍길동</span>
  <button class="edit-btn">✏️</button>
</div>

<!-- 수정 모드 -->
<div class="data-item editing">
  <label>이름</label>
  <input 
    class="value-input" 
    value="홍길동"
    autofocus
  />
  <button class="save-btn">저장</button>
  <button class="cancel-btn">취소</button>
</div>
```

**JavaScript:**
```javascript
function enableEdit(element) {
  const dataItem = element.closest('.data-item');
  const value = dataItem.querySelector('.value').textContent;
  
  dataItem.classList.add('editing');
  const input = dataItem.querySelector('.value-input');
  input.value = value;
  input.focus();
  input.select();
}

function saveEdit(element) {
  const dataItem = element.closest('.data-item');
  const input = dataItem.querySelector('.value-input');
  const valueSpan = dataItem.querySelector('.value');
  
  valueSpan.textContent = input.value;
  dataItem.classList.remove('editing');
  
  // 백엔드에 저장
  updateExtractedData({
    field: dataItem.dataset.field,
    value: input.value
  });
}
```

---

## 🎨 컴포넌트 스타일 가이드

### 파일 결과 카드

```css
.file-result-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px;
  margin-bottom: 14px;
  box-shadow: var(--shadow-md);
}

.file-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.file-icon {
  font-size: 20px;
}

.file-type {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
}

.status.success {
  font-size: 11px;
  color: var(--green);
  font-weight: 600;
}
```

### 교차 분석 카드

```css
.validation-item {
  background: var(--surface);
  border-left: 4px solid var(--green);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  margin-bottom: 10px;
}

.validation-item.warning {
  border-left-color: var(--yellow);
  background: var(--yellow-light);
}

.strength-badge {
  display: inline-block;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 6px;
}

.evidence-list {
  margin-top: 8px;
  padding-left: 20px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}
```

### 신뢰도 바

```css
.confidence-bar {
  margin-top: 12px;
}

.confidence-bar span {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 4px;
}

.confidence-bar .bar {
  height: 6px;
  background: linear-gradient(
    90deg, 
    var(--accent) 0%, 
    var(--green) 100%
  );
  border-radius: 99px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 10px;
  font-weight: 700;
  color: white;
}
```

---

## 📱 반응형 고려사항

현재 프로토타입은 모바일 우선 (390px)이지만, 태블릿/데스크톱 확장 시:

```css
/* 모바일 (기본) */
.file-result-card {
  padding: 18px;
}

/* 태블릿 (768px+) */
@media (min-width: 768px) {
  .file-result-card {
    padding: 24px;
  }
  
  .uploaded-files-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

/* 데스크톱 (1024px+) */
@media (min-width: 1024px) {
  .uploaded-files-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## ⚡ 애니메이션 타이밍

```css
/* 페이드인 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.file-result-card {
  animation: fadeIn 0.3s ease-out;
}

/* 순차 애니메이션 */
.file-result-card:nth-child(1) { animation-delay: 0s; }
.file-result-card:nth-child(2) { animation-delay: 0.1s; }
.file-result-card:nth-child(3) { animation-delay: 0.2s; }

/* 프로그레스 바 */
.progress-bar {
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 신뢰도 바 */
.confidence-bar .bar {
  transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

**다음 문서**: `04_api_backend.md` - API 및 백엔드 구현
