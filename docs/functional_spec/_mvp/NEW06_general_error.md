# NEW06. 일반 오류 화면 (신규)

> 404 Not Found, JS 런타임 오류 등 네트워크 외 모든 비정상 상태를 처리하는 통합 fallback 화면.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | NEW06_general_error |
| 페이즈 | ERROR (전역) |
| 역할 | 404 + 런타임 에러 + 기타 예외 통합 처리 |
| 진입 경로 | 잘못된 URL, 삭제된 리소스, React Error Boundary, unhandled promise rejection |

## 2. UI 구성

### 2.1 공통 영역

- 일러스트 (잃어버린 지도 또는 에러 아이콘)
- 메인 메시지: 케이스별로 다름 (아래 변형 케이스 참조)
- CTA 1차: "처음으로" (사용자 상태 기반 라우팅 — 비로그인 시 01 랜딩, 로그인 상태 시 사용자 상태별 진입 화면)
- 보조 링크: "고객센터 문의" + 에러 ID 표시

> ※ 기존에 있던 "새로고침" 보조 CTA는 v1.1에서 제거됨. `location.reload()`는 결국 사용자 상태 기반 라우팅을 거쳐 같은 화면 또는 다른 화면으로 이동하므로 "처음으로" 한 개 CTA로 통합.

### 2.2 변형 케이스

| 케이스 | 메인 메시지 | 추가 동작 |
| --- | --- | --- |
| 404 Not Found | "찾을 수 없는 페이지에요" | - |
| JS 런타임 오류 (Error Boundary) | "예상치 못한 문제가 발생했어요" | Sentry 자동 보고, 에러 ID 표시 |
| unhandled promise rejection | "문제가 발생했어요" | Sentry 자동 보고 |
| 알 수 없는 상태 | "잠시 후 다시 시도해주세요" | - |

## 3. 기능

- "처음으로" 클릭 시 사용자 상태에 따라 라우팅 분기
  -    · GUEST → 01 랜딩
  -    · UNVERIFIED → NEW01 이메일 인증
  -    · ONBOARDING → 마지막 진행 단계 화면
  -    · ACTIVE → 11 홈
  -    · COMPLETED → NEW03 12주 완료 화면
- 런타임 에러 자동 보고: Sentry 등 모니터링 도구로 stack trace 전송
- 에러 상세는 사용자에게 노출하지 않음 (보안)
- 에러 ID 표시 (CS 문의 시 추적용)

## 4. 예외 처리

| 상황 | 처리 |
| --- | --- |
| Error Boundary 자체가 실패 | 브라우저 기본 에러 페이지로 fallback |
| 홈 라우팅 실패 | 강제 새로고침 또는 01로 이동 |
| 에러 보고 실패 | 클라이언트 메모리에 저장 후 다음 세션에서 재전송 |

## 5. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| error_occurred | error_type=404/runtime/unhandled, requested_url, component, error_id |
| error_home_clicked | redirect_target |
| error_support_clicked | error_id |

## 6. 접근성

- CTA는 키보드 포커스 가능
- 에러 메시지는 aria-live="assertive"로 즉시 알림
- 에러 ID는 복사 가능한 형태로 표시 (CS 문의 편의)

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.1 | 2026-05-10 | NEW 프로토타입 v1 정합성 정렬: **2.1 공통 영역** CTA 1차 "홈으로 돌아가기" → "처음으로"로 라벨 변경, **CTA 2차 "새로고침" 제거** (location.reload()는 결국 사용자 상태 기반 라우팅을 거치므로 단일 CTA로 통합). **3번 기능** 라벨 정렬. **5번 분석 이벤트** error_reload_clicked 제거. |
| v1.0 | 2026-05-04 | 최초 작성 |
