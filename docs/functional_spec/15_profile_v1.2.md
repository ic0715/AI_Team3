# 15. 프로필

> 유저의 강점 요약·커리어 방향·기본정보를 확인하고, 알림 설정·재인터뷰·비밀번호 변경·로그아웃·회원 탈퇴를 제공.

## 1. 화면 개요

| 항목 | 내용 |
| --- | --- |
| 화면 ID | 15_profile |
| 페이즈 | MAINTAIN |
| 역할 | 프로필 + 설정 + 데이터 권리 + 계정 관리 |
| 진입 경로 | 탭바 "프로필", 11 헤더 프로필 아이콘 |
| 다음 화면 | 06(강점 상세) / 04(강점 재분석) / 07(커리어 재설정) / 03(정보 수정) / NEW04(알림) / NEW07(비밀번호) / 회원 탈퇴 |

## 2. 진입 조건

- 사용자 상태 = ACTIVE 또는 COMPLETED
- 탭바 "프로필" 또는 헤더 프로필 아이콘

## 3. UI 구성

### 3.1 상단 바

- 페이지 타이틀: "프로필"

### 3.2 프로필 헤더

- 아바타 (이니셜 또는 업로드 이미지)
- 이름
- 이메일
- 배지: 연속 활동 streak, 직무

### 3.3 내 강점 Top 5 섹션

- 갤럽 34 테마 기반 Top 5 강점 chips (`strength_analyses` WHERE `is_latest=true`의 `strengths JSONB` 기반)
- "강점 상세 보기" → 06 (읽기 전용)
- "강점 다시 분석하기" → 확인 다이얼로그 → 04

### 3.4 커리어 방향 섹션

- 현재 시즌: `goals.goal_title` (active 목표) + 진행 주차 (`goals.current_week / goals.total_weeks`)
- "커리어 방향 재설정" 버튼 → 확인 다이얼로그 → 07
- 버튼 하단 안내 문구 (작은 글씨, 회색): "재설정 시 새롭게 12주가 시작됩니다"

### 3.5 기본 정보 섹션

- 표시: 이름 / 나이대 / 직군 / 경력 / 현재 커리어 고민
- "정보 수정" 버튼 → 03 (수정 모드)로 이동
- 수정 가능 필드: 이름, 나이대, 성별, 직군, 경력, 현재 고민 (이메일·생년월일은 수정 불가)
- 수정 완료 후 15 프로필로 자동 복귀 + 토스트 "정보가 수정되었어요"
- 변경된 직군/고민은 다음 AI 인터뷰(05/08/13) 시스템 프롬프트 컨텍스트에 즉시 반영됨

### 3.6 설정 섹션

- 알림 설정 (일일/주간/마케팅 토글, 알림 시간 설정) → NEW04 푸시 알림 권한 화면 진입 가능
- 비밀번호 변경 → NEW07 비밀번호 변경 화면
- 데이터 다운로드 (GDPR 대응)
- 약관 보기
- 개인정보 처리방침 보기

### 3.7 계정 관리 (Danger Zone)

- 로그아웃
- 회원 탈퇴 → 회원 탈퇴 화면 (확인 모달 2단계, 오탈퇴 방지)

### 3.8 하단 탭바 (프로필 active)

## 4. 기능

| 기능 | 동작 |
| --- | --- |
| 강점 상세 보기 | 06 (읽기 전용 모드)으로 이동 → 15 복귀 |
| 강점 다시 분석 | 확인: "현재 12주 사이클은 영향 없어요" → 04로 이동, 새 `strength_analyses` INSERT 시 트리거가 기존 행의 `is_latest`를 자동으로 false로 변경 |
| 커리어 방향 재설정 | 확인 다이얼로그: "현재 사이클이 종료되고 새 사이클이 시작돼요. 지금까지 데이터는 히스토리에 보관돼요" → 현재 `goals.status='abandoned'` UPDATE → 07로 이동 (전체 흐름 07 → 08 → 09 → 10 → NEW02 → 11 W1부터 새 사이클) |
| 정보 수정 | 03 (수정 모드)로 이동 → 기존 값 prefill → 변경된 필드만 `profiles` 테이블 UPDATE → 15 복귀 + 토스트 "정보가 수정되었어요" |
| 알림 설정 | 토글 즉시 반영, 시간 저장. 푸시 권한이 필요한 경우 NEW04로 이동 후 15 복귀 |
| 비밀번호 변경 | NEW07 비밀번호 변경 화면으로 이동 → 변경 또는 취소 후 15 복귀 |
| 데이터 다운로드 | JSON/CSV export, 이메일 발송 |
| 로그아웃 | 확인 다이얼로그 → Supabase signOut → 02 이동 |
| 회원 탈퇴 | 확인 모달 2단계 → `profiles` 및 관련 데이터 삭제 후 Supabase Auth deleteUser → 01 랜딩으로 이동 |

## 5. 회원 탈퇴 절차

- 1단계: 확인 다이얼로그 + 비밀번호 재인증
- 2단계: 사유 수집 (선택)
- 3단계: 데이터 삭제 안내 ("삭제되는 데이터 / 보관되는 데이터")
- 4단계: 최종 확인 (오탈퇴 방지 위해 2단계 모달)
- 5단계: `profiles` 및 관련 테이블 데이터 삭제 → Supabase Auth deleteUser → 01 랜딩으로 이동

## 6. 예외 처리

| 상황 | 처리 |
| --- | --- |
| 사용자 데이터 없음 | placeholder + 재로딩 |
| 강점 데이터 없음 | "아직 분석된 강점이 없어요" + 04 CTA |
| 커리어 데이터 없음 | "아직 커리어 방향이 없어요" + 07 CTA |
| 정보 수정 실패 | 토스트 + 재시도 |
| 비밀번호 변경 실패 | NEW07에서 자체 처리 (사유별 메시지 + 재시도) |
| 알림 권한 미허용 | "설정에서 권한을 허용해주세요" 안내 또는 NEW04로 진입 |
| 로그아웃 실패 (네트워크) | 로컬 토큰 강제 폐기 후 02 |

## 7. 분석 이벤트

| 이벤트 | 속성 |
| --- | --- |
| profile_view | - |
| strength_detail_viewed | from_screen=profile |
| strength_reanalysis_started | from_screen=profile |
| career_reset_started | from_screen=profile |
| profile_info_edit_started | from_screen=profile |
| profile_info_updated | changed_fields(array) |
| notification_setting_changed | kind, value |
| notification_permission_requested | (NEW04 진입) |
| password_change_started | from_screen=profile |
| data_export_requested | - |
| logout | session_duration |
| account_deletion_started | reason |

## 8. 접근성

- 설정 토글 ARIA 패턴
- Danger Zone은 시각/스크린 리더 모두 명확
- 비밀번호 변경 진입 버튼은 키보드 접근 가능

> ⚠️ **schema 불일치 수정 (v1.1 팀원 정렬, v1.2 유지)**:
> - `selected_direction` 컬럼 없음 → `goals.goal_title` (active 목표) 사용
> - `strength_results.is_active` → `strength_analyses.is_latest` (트리거 자동 관리)
> - `users 데이터 삭제` → `profiles 데이터 삭제` (테이블명 통일)
> - 커리어 재설정 시 현재 `goals.status='abandoned'` UPDATE 명시 (사용자가 의도적으로 중단했으므로 'completed'가 아닌 'abandoned')

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
| --- | --- | --- |
| v1.2 | 2026-05-05 | UX 강화: 커리어 방향 재설정 버튼 하단 안내 문구 추가 / 기본 정보 섹션 수정 가능 필드 명시(이메일·생년월일 잠금) / NEW07 비밀번호 변경 화면 연결 / 강점 상세 보기 분기 추가 / 정보 수정 → 03 수정 모드 + 토스트 / 분석 이벤트 확장(strength_detail_viewed, profile_info_edit_started, profile_info_updated, notification_permission_requested, password_change_started) |
| v1.1 | 2026-05-05 | schema 검증 반영: `selected_direction`→`goals.goal_title`, `strength_results.is_active`→`strength_analyses.is_latest`(트리거 자동 관리), `users 데이터`→`profiles 데이터`, 커리어 재설정 시 `goals.status='abandoned'` UPDATE 명시, 강점 Top 5 데이터 소스(`strength_analyses is_latest=true`) 명시 |
| v1.0 | 2026-05-04 | 최초 작성 |
