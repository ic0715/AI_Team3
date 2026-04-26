# S2 "내 정보 업로드" 기능 스펙 문서

##  문서 구조

총 **6개의 마크다운 파일**로 구성된 완전한 기능 스펙입니다.

```
s2_spec/
├── README.md (현재 문서)
├── 01_overview.md
├── 02_data_extraction.md
├── 03_ui_ux_flow.md
├── 04_api_backend.md
├── 05_interview_integration.md
└── 06_test_scenarios.md
```

---

##  읽는 순서

### 1️.먼저 읽어야 할 문서

**`01_overview.md`** - 개요 및 의사결정 요약
- 전체 목표 및 성공 지표
- 확정된 의사결정 사항
- 아키텍처 개요
- 핵심 기능 목록

 **시작점**: 프로젝트 전체 맥락 이해

---

### 2️. 데이터 관련 문서

**`02_data_extraction.md`** - 데이터 추출 상세 스펙
- 이력서 Level 1~3 추출
- 갤럽 CliftonStrengths 파싱
- MBTI 추출
- 강점-경력 교차 검증
- 경력 공백 탐지

 **대상**: 데이터 엔지니어, 백엔드 개발자

---

### 3️. 프론트엔드 관련 문서

**`03_ui_ux_flow.md`** - UI/UX 플로우 및 화면 설계
- 전체 사용자 여정
- 화면별 상세 설계 (ASCII 다이어그램)
- 인터랙션 상세
- 컴포넌트 스타일 가이드
- 애니메이션 타이밍

 **대상**: 프론트엔드 개발자, UI/UX 디자이너

---

### 4️. 백엔드 구현 문서

**`04_api_backend.md`** - API 및 백엔드 구현
- 백엔드 아키텍처
- API 엔드포인트 상세
- Node.js 구현 예시
- Claude API 프롬프트
- 보안 구현
- 성능 최적화

 **대상**: 백엔드 개발자, DevOps

---

### 5️. 비즈니스 로직 문서

**`05_interview_integration.md`** - Interview 질문 커스터마이징
- 커스터마이징 전략
- 시나리오 A: 질문 건너뛰기
- 시나리오 B: 질문 맞춤화
- 통합 알고리즘
- 저장/불러오기

 **대상**: 프로덕트 매니저, 풀스택 개발자

---

### 6️. QA 관련 문서

**`06_test_scenarios.md`** - 테스트 시나리오 및 검증
- Unit Tests
- Integration Tests
- E2E Tests
- UAT 체크리스트
- 성능 벤치마크
- 출시 전 체크리스트

 **대상**: QA 엔지니어, 프로젝트 매니저

---

##  역할별 추천 읽기 순서

### 프로덕트 매니저
```
01_overview.md → 05_interview_integration.md → 03_ui_ux_flow.md
```

### 프론트엔드 개발자
```
01_overview.md → 03_ui_ux_flow.md → 05_interview_integration.md
```

### 백엔드 개발자
```
01_overview.md → 02_data_extraction.md → 04_api_backend.md
```

### QA 엔지니어
```
01_overview.md → 06_test_scenarios.md → 03_ui_ux_flow.md
```

### 풀스택 개발자
```
순서대로 전체 읽기 (01 → 06)
```

---

##  확정 사항 요약

### 파일 분석
- **지원 형식**: PDF, DOCX, JPG
- **추출 수준**: Level 3 (기술스택 + 성과지표 + 소프트스킬)
- **우선 진단 도구**: MBTI, 갤럽 강점

### Interview 연동
- **동적 질문**: 시나리오 A (건너뛰기) + B (맞춤화) 혼합
- **연동 타이밍**: 파일 업로드 직후 즉시 분석
- **피드백**: Stage 1 (파일별) + Stage 2 (교차분석)

### 기술 스택
- **백엔드**: Node.js + Claude API (Vision + Documents)
- **보안**: 브라우저 Base64 변환 + 서버 프록시 (파일 미저장)
- **제한**: PDF 5MB, JPG 3MB

---

##  외부 참조

### 관련 문서
- 전체 프로토타입: `career_coaching_prototype_ver2` (HTML)
- 전체 피드백: `career_coaching_feedback.md`
- 질문 정의: `s2_upload_additional_questions.md`

### API 문서
- [Anthropic Claude API](https://docs.anthropic.com/)
- Claude Vision API
- Claude Documents API

---

##  버전 히스토리

- **v1.0** (2026-04-26): 초안 완성
  - 6개 문서로 분리
  - 모든 의사결정 확정
  - 구현 가이드 포함

---
4. ✅ **테스트 작성** (`06_test_scenarios.md` 참조)
5. ⏳ **통합 및 배포**

---

**작성자**: Claude  
**최종 수정**: 2026-04-26  
**문서 타입**: 기능 스펙  
**상태**: 완료
