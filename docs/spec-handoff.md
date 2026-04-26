# spec-handoff.md — 파트 간 연결 지점 정의

> **이 문서는 각 파트의 입력·출력 계약서입니다.**
> 내 파트가 끝나는 시점과 다음 파트가 시작하는 시점을 명확하게 정의합니다.
> 화면 전환, 데이터 전달 방식, Supabase 의존 관계를 포함합니다.

---

## 전체 유저 플로우

```
[로그인/회원가입]  →  [온보딩]  →  [진단 결과 확인]  →  [메인 앱]
  Auth               Phase A        Phase B              Phase C
  (Mingsunny)        (Jaeyoung)     (Inchae)             (Eunsang)
  login.html         ↓              ↓                    ↓
                     profiles       weekly_plans          action_items
                     diagnoses                            retrospectives
```

---

## 연결 지점 1: Auth → Onboarding

**출발:** `login.html`
**도착:** `career_coaching_prototype_ver2.html` (Phase A: Onboarding)

### 전환 조건
```
로그인 완료 OR 구글 소셜 로그인 완료
→ Supabase session 생성됨
→ career_coaching_prototype_ver2.html 로 이동
```

### Auth가 보장하는 것
- `session.user.id` — 이후 모든 Supabase insert에 `user_id`로 사용
- `session.user.email`
- `session.user.user_metadata.name` — 온보딩 닉네임 필드 기본값으로 활용 가능

### 세션 읽는 법 (모든 파트 공통)
```javascript
const { data: { session } } = await sb.auth.getSession()
if (!session) {
  // 로그인 안 된 상태 → login.html로 보내기
  window.location.href = 'login.html'
  return
}
const userId = session.user.id
const userName = session.user.user_metadata?.name ?? ''
```

### Auth가 보장하지 않는 것
- `profiles` 테이블 row 존재 여부 — 온보딩 완료 전에는 없을 수 있음
- 온보딩 완료 여부 — `profiles.onboarding_done`으로 확인

---

## 연결 지점 2: Onboarding → Result Confirm

**출발:** Phase A Step 4 (진단 결과 확인 화면)
**도착:** Phase B (Result Confirm — Inchae)

### 전환 조건
```
진단 결과 화면에서 "여기서 느낀 점 이야기하기 →" 버튼 클릭
→ Phase B로 전환
```

### Onboarding이 저장해야 하는 것 (Phase A 끝날 때)

**`profiles` upsert:**
```javascript
await sb.from('profiles').upsert({
  user_id: userId,
  nickname: '홍길동',
  age: 32,
  company: 'OO스타트업',
  job_description: 'SaaS 스타트업에서 프로덕트 매니저로 일하고 있어요',
  tenure: '3~5년',
  interests: '...',
  current_problem: '...',
  emotions: ['불안하다', '성장하고 싶다'],
  onboarding_step: 4,
  onboarding_done: true,
  updated_at: new Date().toISOString()
}, { onConflict: 'user_id' })
```

**`diagnoses` insert:**
```javascript
const { data: diagnosis } = await sb.from('diagnoses').insert({
  user_id: userId,
  summary: '전략적 사고와 분석 역량은 탁월하지만...',
  keywords: ['전략가', '학습자', '분석형 크리에이터'],
  strengths: ['복잡한 문제 구조화', '빠른 학습과 적응력'],
  weaknesses: ['의사결정 속도', '자기 표현·영향력'],
  competencies: [
    { name: '의사결정 & 실행력', score: 27, priority: 'high' },
    { name: '커뮤니케이션 & 영향력', score: 41, priority: 'high' }
  ],
  goals: [
    { period: '1년 후', goal: '시니어 레벨 성장...' }
  ]
}).select().single()

// diagnosis.id 를 Phase B에 전달 (아래 참고)
```

### Phase B에 전달하는 것

`diagnosis.id`를 localStorage 또는 인메모리 변수로 Phase B에 전달:
```javascript
// Onboarding 끝날 때
localStorage.setItem('latest_diagnosis_id', diagnosis.id)

// Phase B에서 읽을 때
const diagnosisId = localStorage.getItem('latest_diagnosis_id')
```

---

## 연결 지점 3: Result Confirm → Main App

**출발:** Phase B Step 4 (알림 설정 → "시작하기 🚀" 버튼)
**도착:** Phase C (Main App — Eunsang)

### 전환 조건
```
"시작하기 🚀" 클릭
→ weekly_plans insert 완료
→ phase-app으로 전환 (enterApp() 함수)
```

### Result Confirm이 저장해야 하는 것 (Phase B 끝날 때)

**`weekly_plans` insert:**
```javascript
const diagnosisId = localStorage.getItem('latest_diagnosis_id')

const { data: plan } = await sb.from('weekly_plans').insert({
  user_id: userId,
  diagnosis_id: diagnosisId,
  week_start: getMondayOfThisWeek(),  // 이번 주 월요일 날짜
  reflection_on_diagnosis: '공감이 많이 됐어요...',
  action_plan: '팀 회의에서 의견을 먼저 시도하기...',
  success_criteria: '발언을 3번 이상 했다면...',
  notification_time: '09:00',
  status: 'active'
}).select().single()

localStorage.setItem('active_plan_id', plan.id)
```

### Main App에 전달하는 것

```javascript
// Result Confirm 끝날 때
localStorage.setItem('active_plan_id', plan.id)

// Main App에서 읽을 때
const planId = localStorage.getItem('active_plan_id')
```

---

## 연결 지점 4: Main App 내부

**담당:** Phase C (Eunsang)
**참고용 — 다른 파트는 직접 관여 없음**

### action_items 저장
```javascript
// 할 일 추가 시
await sb.from('action_items').insert({
  user_id: userId,
  weekly_plan_id: planId,   // 현재 주간 계획 연결
  title: '팀 회의에서 의견을 먼저 제시해보기',
  tags: ['루틴'],
  competency: '의사결정 & 실행력',
  competency_points: 3,
  due_date: today
})

// 체크 시
await sb.from('action_items')
  .update({ is_completed: true, completed_at: new Date().toISOString() })
  .eq('id', itemId)
```

### retrospectives 저장
```javascript
// 회고 저장 시
await sb.from('retrospectives').insert({
  user_id: userId,
  retro_date: today,
  keep: '팀 회의에서 의견을 먼저 냈다',
  problem: '완벽하게 준비하려다 발표가 늦었다',
  try: '60% 완성도로 먼저 공유하고 피드백 받기',
  tags: ['의사결정', '커뮤니케이션']
})
```

---

## 로그아웃

모든 파트에서 로그아웃 후 `login.html`로 이동:
```javascript
async function handleLogout() {
  localStorage.removeItem('latest_diagnosis_id')
  localStorage.removeItem('active_plan_id')
  await sb.auth.signOut()
  window.location.href = 'login.html'
}
```

---

## 자주 쓰는 코드 스니펫

### 현재 유저 ID 가져오기
```javascript
const { data: { session } } = await sb.auth.getSession()
if (!session) { window.location.href = 'login.html'; return }
const userId = session.user.id
```

### 이번 주 월요일 날짜 계산
```javascript
function getMondayOfThisWeek() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]  // 'YYYY-MM-DD'
}
```

### 오늘 날짜
```javascript
const today = new Date().toISOString().split('T')[0]  // 'YYYY-MM-DD'
```

---

## 미구현 / 추후 개발 항목

| 항목 | 연결 위치 | 비고 |
|---|---|---|
| 온보딩 재진입 처리 | Auth → Onboarding | `profiles.onboarding_done` 확인 후 분기 |
| 이미 완료된 온보딩 건너뛰기 | login.html 세션 체크 시 | profiles 조회 후 분기 |
| 주간 계획 갱신 (매주) | Main App | 매주 월요일 새 `weekly_plans` row 생성 |
| 체크인 알림 발송 | 서버 or Edge Function | `weekly_plans.notification_time` 기반 |
| 파일 업로드 저장 | Onboarding S2 | Supabase Storage 사용 예정 |

---

## 변경 이력

| 날짜 | 변경 내용 | 담당 |
|---|---|---|
| 2026-04-26 | 최초 작성 | Mingsunny |

> 연결 지점이 바뀌거나 데이터 전달 방식이 달라지면 이 표에 추가해주세요.
