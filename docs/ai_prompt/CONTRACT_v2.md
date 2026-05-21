# CONTRACT v2 — 커리어 인터뷰 AI ↔ 화면·DB 인터페이스 계약

> **목적**: Phase 2(DB)·Phase 3(화면) 팀이 03. career_interview.md 전체를 읽지 않고도 자기 작업에 필요한 계약 사실만 한 페이지에서 확인하기 위한 **단일 진입점**.
> **기준**: `docs/CAREER_INTERVIEW_V2_DECISIONS.md` + `03. career_interview.md` v2.
> **변경 시**: 03. career_interview.md를 source of truth로 보고, 본 문서를 *후행 동기화*한다.

---

## 1. AI 추출 출력 JSON 스키마 (1회 호출, 인터뷰 종료 후)

```jsonc
{
  "presenting_issue":          "string (≤500자, 빈 문자열 허용)",   // 필수 키
  "agreed_focus":              "string (≤500자, 빈 문자열 허용)",   // 필수 키
  "agreement_evolution":       "string (≤800자, 빈 문자열 허용)",   // optional. 재조정 시만 채워짐
  "user_takeaway":             "string (≤500자, 빈 문자열 허용)",   // 필수 키
  "session_duration_choice":   "short" | "medium" | "long",         // 필수 키, enum 강제
  "key_insights": {                                                  // 모두 optional (드러난 만큼만)
    "current_satisfaction":    "string (≤400자)",
    "current_frustration":     "string (≤400자)",
    "future_vision":           "string (≤400자)",
    "work_style":              "string (≤400자)",
    "values":                  ["string", "..."],   // 0~5개
    "career_concern":          "string (≤400자)",
    "dream":                   "string (≤400자)"
  },
  "mentioned_competencies":    ["T-1", "..."]       // 0~3개, 12역량 enum
}
```

**12역량 enum**: `T-1, T-2, T-3, I-1, I-2, I-3, R-1, R-2, R-3, E-1, E-2, E-3`

## 2. ai_summary 출력 형식

추출 호출의 응답은 **JSON 객체 + 구분자 + 한 줄 요약** 형태로 온다.

```
{ JSON 객체 }
---SUMMARY---
{한 줄 요약 1~80자, 빈 문자열 불가}
```

파싱: `response.split("\n---SUMMARY---\n")` → 길이 2 검증 → 앞 = JSON, 뒤 = ai_summary.

## 3. DB 매핑 (Phase 2 팀)

| 출력 키 | DB 저장 위치 |
|---|---|
| 위 JSON 객체 전체 | `career_interview_results.key_insights` (JSONB 단일 컬럼에 통째 저장) |
| `session_duration_choice` | `career_interview_results.session_duration_choice` (별도 컬럼, 신규) |
| ai_summary (구분자 이후) | `career_interview_results.ai_summary` (TEXT NOT NULL) |
| (없음) | `career_interview_results.recommended_competencies` — 이 단계 NULL, #3에서 UPDATE |

**필요한 마이그레이션 SQL (Phase 2 팀이 실행)**:
```sql
ALTER TABLE career_interview_results
  ADD COLUMN session_duration_choice TEXT
  NOT NULL
  DEFAULT 'medium'
  CHECK (session_duration_choice IN ('short', 'medium', 'long'));
```

`key_insights` JSONB는 schema-less이므로 ALTER 불필요.

## 4. 클라이언트 텍스트 매칭 목록 (Phase 3 팀)

종료·정서 위기 감지는 **클라이언트 측 키워드 매칭**으로 처리한다. 정규식이 아닌 단순 `text.includes()` 또는 한국어 형태소 부분일치 수준이면 충분.

### 4.1 자연 종료 키워드 (Path A) — 코치 발화 감지
```js
const COACH_CLOSING_KEYWORDS = [
  "오늘 인터뷰는 여기서",
  "오늘은 여기까지",
  "여기서 마무리할게요",
];
```
→ 감지 시 추출 단계로 전환.

### 4.2 사용자 주도 종료 키워드 (Path B) — 사용자 발화 감지
```js
const USER_EXIT_KEYWORDS = [
  "여기까지 할게요",
  "그만하고 싶어요",
  "이제 됐어요",
  "오늘은 여기까지",
];
```
→ 감지 시 추출 단계로 전환.

### 4.3 정서 위기 🔴 키워드 (Path C, 백업 가드) — 사용자 발화 감지
```js
const CRISIS_RED_KEYWORDS = [
  "죽고 싶다",
  "사라지고 싶다",
  "끝내고 싶다",
  "이 세상에서 없어졌으면",
  "스스로 다치게",
  "해치고 싶다",
];
```
→ 감지 시:
1. AI 응답 출력은 그대로 진행 (AI가 1차로 redirect 멘트 출력)
2. AI 응답 종료 후 **추출 호출 스킵**
3. DB INSERT (Path C 특수 처리):
   ```sql
   INSERT INTO career_interview_results
     (user_id, interviewed_at, key_insights, session_duration_choice, ai_summary)
   VALUES
     (:user_id, now(), NULL, 'medium', '정서 위기 가드레일 작동으로 인터뷰 중단');
   ```
4. 화면: 결과 화면 진입 차단. 외부 자원(1393, 1577-0199) 안내 화면으로 라우팅.

> Path C는 **백업 가드**다. 1차 가드는 AI가 시스템 프롬프트로 처리. 클라이언트 매칭은 AI가 놓친 경우의 안전망.

## 5. Running State Injection (Phase 3 팀)

매 턴 AI 진행 호출(`messages` API) 시, **user 메시지 직전에** 다음 system role 메시지 또는 user 메시지 prefix로 주입:

```
<현재_상태>
phase: opening | echo_agreement | exploration | closing
agreed_focus: "{문자열, Phase 2에서 합의된 한 줄. 미합의 시 빈 문자열}"
turn_count: {정수, 사용자 발화 누적 횟수}
session_duration: short | medium | long
</현재_상태>
```

**Phase 판단 룰** (클라이언트 측 상태 머신):
- `turn_count == 0` → `phase = "opening"`
- 사용자 첫 시간 응답 후 코치가 오프닝 질문 발화 → `phase` 유지하다 사용자 다음 응답에서 `phase = "echo_agreement"`로 전환
- 코치 발화에 합의 미러링 표현 (예: "그럼 오늘은 ○○를 같이 다뤄볼게요") → `phase = "exploration"`로 전환, `agreed_focus` 추출해서 저장
- 코치 발화에 G 패턴 키워드 ("오늘 어떤 게 손에 잡히셨어요" 등) → `phase = "closing"`로 전환

> 정확한 phase 전환 룰은 Phase 3 화면팀 구현 시 보강 가능. AI는 phase 값을 *참고*만 하고 절대 의존하지 않으므로, 머신이 약간 틀려도 인터뷰 품질은 흔들리지 않음.

**session_duration 분류 룰**: §6 참조.

## 6. session_duration_choice 분류 (참고)

추출 단계에서 AI가 JSON 키로 출력하지만, 화면팀이 `Running State`의 `session_duration` 값을 매 턴 주입하려면 첫 시간 응답을 *대략적으로* 미리 분류해 둬야 한다.

| 사용자 첫 응답 패턴 | session_duration 값 |
|---|---|
| "15분", "20분", "짧게", "급해요" | `short` |
| "30분", "40분", "보통" | `medium` |
| "1시간", "충분히", "시간 많아요" | `long` |
| 시간 안 밝힘, 모호, 또는 분류 실패 | `medium` (기본값) |

> 클라이언트 분류는 *Running State 주입용 추정치*다. DB 저장값은 **AI 추출 단계의 JSON 키**가 source of truth. 두 값이 다르면 AI 추출 값을 따른다.

## 7. 세션 무효 처리 (Phase 3 화면팀)

다음 조건을 만족하면 인터뷰 결과 화면 진입을 차단하고 "다시 시도하기" 화면으로 라우팅:

```
extraction.presenting_issue === "" AND
extraction.agreed_focus    === "" AND
extraction.user_takeaway   === ""
```

DB INSERT는 그대로 진행하되, 다음 단계(역량 방향 도출 #3)로의 전이는 막는다.

## 8. 진행도 표시

자유 흐름이므로 **진행도 표시는 폐기**한다. v0.7.1의 "Q3/Q6" 같은 UI 요소 제거. 신규 진행도 표시 없음.

## 9. 의존성·완료 체크리스트

**Phase 2 (DB)**
- [ ] `session_duration_choice` 컬럼 ALTER
- [ ] `key_insights` JSONB는 schema-less 유지 (ALTER 불필요)
- [ ] `recommended_competencies`는 이 단계 NULL 유지

**Phase 3 (화면)**
- [ ] 진행도 표시 UI 제거
- [ ] 종료 키워드 매칭 (Path A·B·C) 구현
- [ ] Running State Injection 클라이언트 머신 구현
- [ ] 세션 무효 라우팅 구현
- [ ] Path C 시 외부 자원 안내 화면 라우팅

**Phase 1 (AI, 본 PR로 완료 예정)**
- [x] system_prompt.md 패턴 카테고리·정서 위기 가드레일 반영
- [x] 03. career_interview.md v2 본격 개정
- [x] CONTRACT_v2.md 작성
