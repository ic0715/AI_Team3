# CareerPT — 유저 피드백 반영 히스토리

> 작성일: 2026-06-11 · 인터뷰 3라운드 전수 검토 기준

---

## 반영 현황 요약

| **14** | **3** | **9** | **3** |
|:---:|:---:|:---:|:---:|
| 반영 완료 | 일부 반영 | 미처리 | Post-MVP |

---

## 1차 · 유저 인터뷰 (2026-05-25 · 4명 심층)

> ms01(엔지니어 6년) · ms02(PM 6년) · wonsukster(연구원 4~7년) · 8651(IT 시니어 10년+)  
> 인터뷰어: 김민선, 차재영, 이은상

| 피드백 주제 | 원문 핵심 | 상태 | 반영 내용 · 커밋 |
|---|---|:---:|---|
| **P1** AI 인터뷰 질문 폭탄 | "물음표 살인마" "답은 안 주고 질문만" | ![반영완료](https://img.shields.io/badge/반영완료-2e7d32?style=flat-square) | 능동 코칭 v3 프롬프트 추가 — 중간 요약·해석 삽입, 꼬리물기 금지 행동 4종 이식<br>![](https://img.shields.io/badge/-c5cd674-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-aa730c8-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-75dfe6e-lightgrey?style=flat-square&logo=git) |
| **P2** 액션아이템 맥락 단절 | "인터뷰 내용과 무관" "직접 카드 만들었어요" | ![반영완료](https://img.shields.io/badge/반영완료-2e7d32?style=flat-square) | 시드 풀 선택 → 인터뷰 기반 AI 생성+검증 게이트로 전환, 부족분 재작성 폴백 추가<br>![](https://img.shields.io/badge/-bf0868a-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-85c4253-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-b2d55a3-lightgrey?style=flat-square&logo=git) |
| **P3** 랜딩 흐름 예고 없음 | "홈에서 인터뷰로 바로 넘어가 당황" "wiki 느낌" | ![반영완료](https://img.shields.io/badge/반영완료-2e7d32?style=flat-square) | 랜딩 STEP 1/2/3 카드 형식 변경, swipe deck 개선, career-intro 플로우 예고 카드 추가<br>![](https://img.shields.io/badge/-01afd59-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-abe6a78-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-955f059-lightgrey?style=flat-square&logo=git) |
| **P4** ChatGPT 대비 차별점 불명확 | "챗지피티 쓸 것 같다" | ![일부반영](https://img.shields.io/badge/일부반영-f57f17?style=flat-square) | 랜딩 카피 수정 (JOURNEY 3단계·실천 근육 문구), 역량 도출 intent-first 전환<br>![](https://img.shields.io/badge/-51a2214-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-7dcd7f0-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-5b4b87e-lightgrey?style=flat-square&logo=git)<br>_구조적 차별점 명시는 랜딩 전면 개편 필요 → 미완_ |
| **P5** 로딩 시간·표시 미흡 | "5~12초 소요" 현장 관찰 | ![반영완료](https://img.shields.io/badge/반영완료-2e7d32?style=flat-square) | 원형 스피너 추가, 분석·스켈레톤 로딩 UX 재설계, 생성 속도 36% 단축<br>![](https://img.shields.io/badge/-9122daf-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-c28d5fa-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-d819a04-lightgrey?style=flat-square&logo=git) |
| 과도한 이모지 | 현장 관찰 | ![반영완료](https://img.shields.io/badge/반영완료-2e7d32?style=flat-square) | 전체 페이지 이모지 일괄 제거<br>![](https://img.shields.io/badge/-533710e-lightgrey?style=flat-square&logo=git) |
| 역량 목표 카드 프리뷰 문구 | "선택하면 무엇을 하는지 모름" | ![반영완료](https://img.shields.io/badge/반영완료-2e7d32?style=flat-square) | 역량 목표 선택 화면 안내 문구 추가, 액션 설명 2줄 프리뷰·펼침 기능<br>![](https://img.shields.io/badge/-955f059-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-489b99c-lightgrey?style=flat-square&logo=git) |

---

## 2차 · 피어 리뷰 (수업 발표 후 · 46명)

| 피드백 주제 | 원문 핵심 | 상태 | 반영 내용 · 커밋 |
|---|---|:---:|---|
| 코칭 전문성·프레임워크 | "MCC+갤럽 결합 인상적" (9건 긍정) | ![설계검증](https://img.shields.io/badge/설계검증-1565c0?style=flat-square) | 기존 설계 방향 확인 — 추가 구현 불필요 |
| 결과 실효성 부족 | "뻔한 조언, 액션이 소프트" (5건) | ![반영완료](https://img.shields.io/badge/반영완료-2e7d32?style=flat-square) | intent-first 역량 도출, growth_competencies 앵커링 해소, 역량 추천 5→3개 축소<br>![](https://img.shields.io/badge/-5b4b87e-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-36d1dc3-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-974f925-lightgrey?style=flat-square&logo=git) |
| 인풋 부담·온보딩 진입장벽 | "입력량 과다" "설문 길이 길다" (8건) | ![일부반영](https://img.shields.io/badge/일부반영-f57f17?style=flat-square) | UX 시연 피드백 반영 4종, 자동 advance 추가<br>![](https://img.shields.io/badge/-35c62b9-lightgrey?style=flat-square&logo=git)<br>_이력서/링크드인 자동 연동은 Post-MVP_ |
| 강점 직접 선택 한계 | "자기인식 편향 가능" "선택지 설명 부족" (6건) | ![Post-MVP](https://img.shields.io/badge/Post--MVP-4527a0?style=flat-square) | 대화 기반 강점 발견 플로우 설계 필요 — 미구현 |
| 지속성·리텐션 | "일회성 탈피 장치 필요" (3건) | ![일부반영](https://img.shields.io/badge/일부반영-f57f17?style=flat-square) | 서비스 피드백 수집 모달 추가, retention 시뮬레이션 분석 실시<br>![](https://img.shields.io/badge/-c24a02c-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-b810802-lightgrey?style=flat-square&logo=git) |
| 인터뷰 종료 방식 | "고정 턴 강제 종료 어색" | ![반영완료](https://img.shields.io/badge/반영완료-2e7d32?style=flat-square) | 고정 턴 강제 종료 제거 → 목표 완결 기반 자연 종료 + 사용자 종료 버튼 추가<br>![](https://img.shields.io/badge/-3bb082d-lightgrey?style=flat-square&logo=git) ![](https://img.shields.io/badge/-850e12f-lightgrey?style=flat-square&logo=git) |
| AI 차별성 불명확 | "ChatGPT에 갤럽 넣으면 동일?" (6건) | ![일부반영](https://img.shields.io/badge/일부반영-f57f17?style=flat-square) | 랜딩 카피 강화, 구조화 플로우 시각화 추가<br>_구조적 해답은 향후 마케팅/랜딩 전면 개편 필요_ |

---

## 3차 · 실사용 피드백 (2026-06-10 · 11명)

> F1~F3 개별 · N1~N5 앱 · M1~M3 개별

### 긴급

| 피드백 주제 | 우선순위 | 상태 | 내용 · 처리 계획 |
|---|:---:|:---:|---|
| 질문 반복·대화 순환 | ![긴급](https://img.shields.io/badge/긴급-c62828?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | 3명 공통 — "1시간 대화 후 처음으로 돌아옴" Phase 전환 감지·agreed_focus 고정 로직 점검 필요 |
| 분석 대기 시간 과다 | ![긴급](https://img.shields.io/badge/긴급-c62828?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | "2분 이상 → 테스트 중단" — 스트리밍 또는 중간 피드백 추가 필요<br>![](https://img.shields.io/badge/-d819a04-lightgrey?style=flat-square&logo=git) 36% 단축 선행 완료, 추가 최적화 필요 |
| AI 응답 후 스크롤 미이동 | ![긴급](https://img.shields.io/badge/긴급-c62828?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | 메시지 전송 후 AI 응답이 뷰포트 아래로 밀림 — 자동 스크롤 추가 필요 |
| '나의 강점 5가지' 표현 오해 | ![긴급](https://img.shields.io/badge/긴급-c62828?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | 갤럽 전문가 지적 — "나머지 29개가 약점으로 오인" → '최상위 강점 Top5'로 표현 변경 필요 |

### 높음

| 피드백 주제 | 우선순위 | 상태 | 내용 · 처리 계획 |
|---|:---:|:---:|---|
| 코칭 단계 전환 없음 | ![높음](https://img.shields.io/badge/높음-f57f17?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | 탐색 → 통합 단계 전환 로직 필요, 두루뭉술한 사용자에게 선택지 제시형 경로 추가 |
| 최종 결과 개인화 안 됨 | ![높음](https://img.shields.io/badge/높음-f57f17?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | "제시된 역량이 일반적" — 대화 내 핵심 갈등·가치 우선순위를 결과에 반영하는 로직 보강 |
| 강점 선택 어려움·기준 불명확 | ![높음](https://img.shields.io/badge/높음-f57f17?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | "이게 강점인지 나조차 확신 없어" — 선택 가이드·강점 개념 설명 힌트, 강점 강화 프레이밍 명확화 필요 |
| 대화 기록 히스토리 조회 | ![높음](https://img.shields.io/badge/높음-f57f17?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | "AI가 해준 좋은 말 다시 보고 싶다" — ai_summary를 결과 화면에 노출하는 방향 검토 필요 |
| AI 질문 책임 회피 | ![높음](https://img.shields.io/badge/높음-f57f17?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | "그건 내가 생각해보라고 함" — 코치가 직접 제안을 회피하는 순간 프롬프트 패치 필요 |
| 대화 진행 상황 표시 | ![높음](https://img.shields.io/badge/높음-f57f17?style=flat-square) | ![미처리](https://img.shields.io/badge/미처리-c62828?style=flat-square) | "남은 대화량 알 수 없어 불안" — 진행률 바 또는 턴 카운터 표시 추가 |
| 토큰 비용 우려 | ![높음](https://img.shields.io/badge/높음-f57f17?style=flat-square) | ![검토중](https://img.shields.io/badge/검토중-1565c0?style=flat-square) | "30분 코칭 시 API 비용이 서비스 지속성에 부담" — 비용 구조 분석 + 세션 길이 최적화 검토 |

### Post-MVP

| 피드백 주제 | 우선순위 | 상태 | 내용 · 처리 계획 |
|---|:---:|:---:|---|
| 캐릭터 칭찬 카드 | ![낮음](https://img.shields.io/badge/낮음-6a1b9a?style=flat-square) | ![Post-MVP](https://img.shields.io/badge/Post--MVP-4527a0?style=flat-square) | "듀오링고처럼 굿잡! 해주면 지속 동기 생길 것" — Post-MVP 게이미피케이션 |
| LinkedIn 연동 강점 자동 추출 | ![낮음](https://img.shields.io/badge/낮음-6a1b9a?style=flat-square) | ![Post-MVP](https://img.shields.io/badge/Post--MVP-4527a0?style=flat-square) | 프로필 기반 강점 도출 → 온보딩 마찰 감소 — Post-MVP |
| 복수 선택·유료 BM | ![낮음](https://img.shields.io/badge/낮음-6a1b9a?style=flat-square) | ![Post-MVP](https://img.shields.io/badge/Post--MVP-4527a0?style=flat-square) | 역량 2개 이상 선택을 프리미엄 기능으로 설계하는 수익화 방안 검토 중 |

---

## 미검증 가설

1차 인터뷰에서 도출된 가설로, 아직 검증되지 않음.

- 사회 초년생(1~3년차)은 시니어와 달리 AI 인터뷰를 더 긍정적으로 받아들일 수 있다 → 인터뷰 없음
- 강점 진단 없이 바로 커리어 인터뷰로 진입하는 플로우가 더 자연스러울 수 있다 → 검증 필요
- AI 인터뷰 턴 수를 5~7개로 제한하면 완주율이 올라갈 수 있다 → 검증 필요

---

## 유저 언어 기반 서비스 정의 후보

랜딩 카피 개선 시 참고.

| 출처 | 문구 | 활용 포인트 |
|------|------|------------|
| 8651 (IT 시니어) | "지금 내가 진짜 원하는 게 뭔지 알고 싶을 때" | 반기 단위 사용자 포지셔닝에 적합 |
| ms02 (PM 6년차) | "커리어 고민을 함께 분석하고, 액션 아이템을 만드는 서비스" | 서비스 기능을 가장 명확하게 설명 |
| wonsukster (연구원) | "말해보카처럼 1일 숙제를 제시하는 서비스" | 재방문 루프 설계 방향 힌트 |
