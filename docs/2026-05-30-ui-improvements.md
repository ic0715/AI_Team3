# UI 개선 작업 정리
> 브랜치: `fix/remove-excessive-emoji`
> 날짜: 2026-05-30
> 배경: 유저인터뷰 피드백 반영 — 전문적인 코칭 맥락에 맞게 과도한 이모지와 불필요한 UI 요소 제거

---

## 변경 파일 요약

| 파일 | 커밋 수 |
|------|--------|
| `web/app/onboarding/career-result/page.tsx` | 2 |
| `web/app/onboarding/action-items/page.tsx` | 2 |
| `web/app/onboarding/complete/page.tsx` | 1 |
| `web/app/home/page.tsx` | 1 |
| `web/app/reflect/coach/page.tsx` | 1 |

---

## 파일별 변경 내역

### 1. `career-result/page.tsx`

| # | 변경 위치 | Before | After |
|---|-----------|--------|-------|
| 1 | 배너 eyebrow | `🎯 AI 분석 완료` | `AI 분석 완료` |
| 2 | 역량 카드 헤더 | `{slot.emoji} {slot.goalTitle}` | `{slot.goalTitle}` |
| 3 | 카드 태그 렌더링 | `{tag}` | `{tag.replace(/^\p{Emoji}\s*/u, '')}` |
| 4 | 제목-부제목 간격 | `marginBottom: 14px` | `marginBottom: 4px` |
| 5 | 부제목-카드 간격 | 없음 | `marginBottom: 14px` 추가 |

### 2. `action-items/page.tsx`

| # | 변경 위치 | Before | After |
|---|-----------|--------|-------|
| 1 | CTA 버튼 | `시작하기 🚀` | `시작하기` |
| 2 | ActionCard 태그 블록 | 태그 렌더링 div 존재 | 블록 전체 삭제 |
| 3 | EmptySeeds | `📭` 이모지 div 존재 | 삭제 |
| 4 | 목표 배너 | `{seedEmoji} {goal.goal_title}` | `{goal.goal_title}` |
| 5 | Step 인디케이터 | `STEP 3` 텍스트 존재 | 삭제 |

### 3. `complete/page.tsx`

| # | 변경 위치 | Before | After |
|---|-----------|--------|-------|
| 1 | 요약 라벨 | `🎯 강점` `🗺 방향` `✅ 액션` `📅 일정` | `강점` `방향` `액션` `일정` |
| 2 | 라벨 색상 | `var(--text-secondary)` | `var(--text-primary)` |
| 3 | 라벨 사이즈 | `13px` | `14px` (우측 값 텍스트와 통일) |

### 4. `home/page.tsx`

| # | 변경 위치 | Before | After |
|---|-----------|--------|-------|
| 1 | 인사말 | `안녕하세요, {nickname}님 👋` | `안녕하세요, {nickname}님` |
| 2 | 체크 안내 문구 | `실행한 요일에 체크해주세요 ✅` | `실행한 요일에 체크해주세요` |
| 3 | 메모 카드 제목 | `오늘의 메모, 짧게라도 남겨볼까요? ✏️` | `오늘의 메모, 짧게라도 남겨볼까요?` |
| 4 | 타임라인 W# 레이블 | `W1` ~ `W12` 텍스트 표시 | 삭제 (숫자 배지 유지) |
| 5 | future 카드 | `🌱 코치와 함께 정해요` | `코치와 함께 정해요` |
| 6 | current 카드 | 요일 버튼(월~일) 존재 | 블록 전체 삭제 |

### 5. `reflect/coach/page.tsx`

| # | 변경 위치 | Before | After |
|---|-----------|--------|-------|
| 1 | AI 오프닝 메시지 | `안녕하세요, ${ctx.nickname}님 🌱` | `안녕하세요, ${ctx.nickname}님` |

---

## 변경하지 않은 것 (유지 이유)

| 항목 | 유지 이유 |
|------|----------|
| 역량 카드 대표 이모지 (🧠 📊 🗺️ 등) | 12개 역량을 시각적으로 구분하는 핵심 아이콘 |
| 액션 섹션 상단 `seedEmoji` | 어떤 역량의 액션인지 맥락 제공 |
| 타임라인 done badge (🔥 👍 😊 🌱) | DB 데이터 기반 완료율 피드백 기능 |
| 완료 시 `🎉 오늘 완료했어요!` | 긍정 피드백 순간, 의도된 micro-reward |
| 메모 유도 카드 `💌` 아이콘 | 스펙 명시 UI 요소, 행동 유도 역할 |
| `seeds.ts` / `competencies.ts` 원본 데이터 | AI 개인화 로직이 태그를 참조함 |

---

## 커밋 히스토리

```
2adbfd1  fix: complete 요약 라벨 정리 및 home 타임라인 UI 개선
38e4d65  fix: action-items STEP 3 인디케이터 제거
ec46672  Revert "fix: action-items UI 개선 (p09 디자인 통일)"
32cff78  fix: career-result 선택 안내 간격 조정 및 카드 헤더 이모지 제거
533710e  fix: 과도한 이모지 제거 (유저인터뷰 피드백 반영)
```
