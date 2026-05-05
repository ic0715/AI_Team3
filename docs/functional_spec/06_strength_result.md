# 06. 강점 결과

> 05 강점 인터뷰 또는 04에서 업로드한 갤럽 결과지를 통해 도출된 강점 Top 5를 시각적으로 제시하고, 다음 커리어 인터뷰 단계로 자연스럽게 유도.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 06_strength_result |
| 페이즈 | DISCOVER |
| 역할 | 갤럽 CliftonStrengths 기반 Top 5 강점 시각화 + 다음 단계 유도 |
| 이전 화면 | 05 강점 인터뷰 (인터뷰 경로) / 04 강점 진단 방식 선택 (업로드 경로) |
| 다음 화면 | 07 커리어 인터뷰 인트로 |

## 2. 진입 조건

- 05 인터뷰 완료 + 분석 완료 (`strength_analyses` INSERT 완료)
- 또는 04 파일 업로드 + 파싱 완료 (`strength_analyses` INSERT 완료)
- 또는 15에서 "이전 결과 보기" 진입 시 (읽기 전용 모드)

> ⚠️ **schema 불일치 수정**: `strength_results` → `strength_analyses` (테이블명)

## 3. UI 구성

### 3.1 상단 바

- 뒤로가기 → 04 또는 15
- 페이지 타이틀: "강점 결과"

### 3.2 Hero

- 그라데이션 배경
- "🎉 분석 완료"
- "당신의 Top 5 강점이에요"
- "갤럽 CliftonStrengths 34 테마 기반"

### 3.3 강점 요약 (Chips)

- Top 5 강점명 + 순위 배지
- 가로 스크롤 가능

### 3.4 강점 상세 카드 (5개)

각 카드 구성 (갤럽 34 테마 기반):

| 요소 | 내용 |
| --- | --- |
| 순위 | 1~5 |
| 강점명 | 갤럽 34 테마명 (한국어 + 영문 보조). 예: "전략(Strategic)", "성취(Achiever)" |
| 도메인 | 4대 도메인 표시: 실행력 / 영향력 / 대인관계 형성 / 전략적 사고 |
| 강점 설명 | 갤럽 정의 기반, 2~3문장 |
| 활용 예시 | 직군·경력 컨텍스트에 맞춘 1~2개 시나리오 |
| 신뢰도 배지 | 인터뷰 경로 시 노출. 60% 미만 시 "조금 더 알아보기" 권장 |

### 3.5 안내 박스

- "이 강점은 당신의 답변/결과지를 기반으로 도출되었어요. 실제 활용 경험에 따라 변할 수 있어요"
- "강점은 언제든 다시 분석할 수 있어요" + 재분석 보조 버튼

### 3.6 Bottom CTA

- Primary: "커리어 방향 찾기로 →" → 07
- Secondary: "🔄 강점 분석 다시하기" → 04 (재진입, 이전 결과 비활성화 처리)

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 카드 순차 등장 | fade-up 애니메이션, stagger delay (reduce-motion 대응) |
| 카드 탭 | 상세 모달 (갤럽 정의, 활용 팁, 다른 강점과의 시너지) |
| 다음 클릭 | 07로 이동 |
| 재분석 클릭 | 확인 다이얼로그 → 04로 이동 (새 결과 INSERT 시 트리거가 자동으로 기존 `is_latest` → false 처리) |
| 공유 (선택) | 결과 카드 이미지 공유 (개인정보 노출 주의) |

## 5. 데이터

- 표시 데이터: `strength_analyses` (`is_latest = true` row 1개)
- `strengths` JSONB 구조: `[{rank, name_ko, name_en, description}]`
- `method` 컬럼: `"ai_interview"` (05 경로) 또는 `"gallup_upload"` (04 업로드 경로)
- 갤럽 34 테마 도메인(4대 도메인) 데이터: 클라이언트 상수로 관리 (테마명 기반 매핑)
- 결과 저장: 분석 완료 시 자동 저장된 상태로 진입

> ⚠️ **schema 불일치 수정**:
> - `strength_results` → `strength_analyses` (테이블명)
> - `is_active` → `is_latest` (컬럼명)
> - `themes` → `strengths` (컬럼명)
> - `source` → `method` (컬럼명), 허용값 `"interview"`/`"upload"` → `"ai_interview"`/`"gallup_upload"`
> - `strength_master` 테이블 미존재 → 클라이언트 상수로 대체
> - `domain` 필드는 schema의 `strengths` JSONB에 없음 → 클라이언트에서 테마명 기반으로 도메인 매핑 처리

## 6. 갤럽 라이선스 관련 주의

> 갤럽 CliftonStrengths 34 테마는 갤럽사의 자산입니다. 사용 시 다음 사항을 준수해야 합니다.

- 테마명·정의·설명문은 갤럽 공식 문서 기반으로 정확히 사용
- "진단" 표현 대신 "관찰된 강점 후보" 또는 "강점 추정"으로 표현 권장
- 상업적 이용 시 갤럽 정식 라이선스 또는 파트너십 검토 필요
- 파일 업로드 경로의 경우 사용자가 이미 보유한 결과지를 단순 시각화하는 것이므로 라이선스 위험 낮음
- AI 인터뷰 경로의 경우 갤럽 진단을 모방하지 않고 "갤럽 34 테마에 매핑"하는 방식임을 명시

## 7. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 강점 결과 없음 (분석 실패) | "분석에 실패했어요. 다시 시도해주세요" + 04로 이동 CTA |
| 5개 미만 도출 | 가능한 데이터만 표시, "추가 인터뷰 권장" 안내 |
| 신뢰도 낮음 (3개 이상 60% 미만) | "더 정확한 분석을 위해 추가 인터뷰를 추천해요" 배너 |
| 페이지 새로고침 | DB에서 복원 |
| 재분석 실패 | 토스트 + 재시도 |
| 애니메이션 reduce-motion | 즉시 표시 |

## 8. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| strength_result_view | source=interview/upload, is_first_view |
| strength_card_expanded | rank, theme_name |
| strength_reanalysis_requested | - |
| strength_share_clicked | - |

## 9. 접근성

- 카드는 <article> 또는 role="article"
- 순위는 텍스트로도 명시 (스크린 리더 "1위", "2위" 읽기)
- reduce-motion 대응

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.1 | 2026-05-05 | schema 검증 반영: `strength_results`→`strength_analyses`, `is_active`→`is_latest`, `themes`→`strengths`, `source`→`method`, 허용값 수정, `strength_master` 테이블 미존재(클라이언트 상수 대체) 명시, `domain` 필드 클라이언트 매핑 처리 명시, 재분석 시 트리거 자동 처리 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
