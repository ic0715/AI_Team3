# 05. action_item.md

> CareerPT AI 명세서 #4 — 액션아이템 개인화 생성
> v0.7.1 스키마 기준 · 작성일 2026-05-07
> AI 모델: Claude Sonnet (claude-sonnet-4-7-20251201 또는 최신)

---

## 1. Purpose

**터치포인트**: AI 연동 #4 — 액션아이템 개인화 생성 (생성형)

**입력**: 사용자가 선택한 역량 목표(`goals.competency_code` + `goals.current_week`), 사용자 경력 단계(`profiles.career_level`), 최신 Top 5 강점(`strength_analyses.strengths`), 그리고 두 종류의 정적 레퍼런스 — `competency_action_map.md`의 시드 액션(WHAT, 뼈대)과 `강점코칭_테마별_실행항목.docx`의 강점 블록(HOW, 톤). 2주차 이후에는 직전 주의 회고 인사이트(`coaching_insights`)도 입력으로 받는다.

**출력**: 해당 주차에 사용자가 실행할 `action_items` 3~5건. 각 row는 `title`, `description`, `tags`, `is_custom=false`, `source_seed_id`(시드 풀 ID)를 갖는다.

**역할**:
- **시드 액션을 1차 자료(WHAT)** 로 사용해 액션의 뼈대(주제·구조·난이도)를 고정한다.
- **강점 블록을 2차 자료(HOW)** 로 사용해 사용자의 강점 결에 맞춘 표현·접근 방식·실행 형태를 입힌다.
- 매주 호출되며, 12주 동안 같은 역량 시드가 반복되지 않도록 주차별로 시드를 순환한다.
- 자유 생성을 차단하기 위해 모든 AI 추천 액션은 시드 풀의 한 항목에서 파생되어야 하고, `source_seed_id`로 추적된다.

> 사용자가 직접 추가한 액션은 `is_custom=true`로 별도 INSERT되며, 이 명세서의 AI 호출 범위 밖이다 (`source_seed_id`는 NULL).

---

## 2. Inputs

### 2.1 DB Inputs

**조회 시점**: 매주 월요일 자정 주차 자동 전환 후, 또는 사용자가 앱 재접속 시 해당 주차 `action_items`가 비어 있을 때.

```sql
-- 1) 활성 목표 + 현재 주차
SELECT id            AS goal_id,
       competency_code,
       domain,
       current_week
  FROM goals
 WHERE user_id = :current_user_id
   AND status  = 'active'
 LIMIT 1;

-- 2) 사용자 경력 단계
SELECT career_level, job_field, nickname
  FROM profiles
 WHERE id = :current_user_id;

-- 3) 최신 Top 5 강점
SELECT strengths
  FROM strength_analyses
 WHERE user_id   = :current_user_id
   AND is_latest = true
 LIMIT 1;

-- 4) 직전 주차 회고 인사이트 (있을 때만 — 2주차 이후)
SELECT topic,
       pattern_insight,
       next_action_title,
       next_action_reason,
       strength_link
  FROM coaching_insights
 WHERE goal_id     = :goal_id
   AND week_number = :current_week - 1
 LIMIT 1;

-- 5) 같은 목표에서 이미 사용한 시드 ID 목록 (중복 방지용)
SELECT DISTINCT source_seed_id
  FROM action_items
 WHERE goal_id        = :goal_id
   AND is_custom      = false
   AND source_seed_id IS NOT NULL;
```

**기대 형식 (`goals` 한 행)**:

```json
{
  "goal_id": "c3d4e5f6-...",
  "competency_code": "T-1",
  "domain": "T",
  "current_week": 3
}
```

**기대 형식 (`profiles`)**:

```json
{
  "career_level": "junior",  // junior_new | junior | senior_mid | senior
  "job_field": "IT/개발",
  "nickname": "지수"
}
```

**기대 형식 (`strengths`)** — 03 명세서와 동일:

```json
[
  {"rank": 1, "name_ko": "성취", "name_en": "Achiever",   "description": "..."},
  {"rank": 2, "name_ko": "분석", "name_en": "Analytical", "description": "..."},
  {"rank": 3, "name_ko": "체계", "name_en": "Discipline", "description": "..."},
  {"rank": 4, "name_ko": "집중", "name_en": "Focus",      "description": "..."},
  {"rank": 5, "name_ko": "전략", "name_en": "Strategic",  "description": "..."}
]
```

**기대 형식 (`coaching_insights` 직전 주차, 선택 입력)**:

```json
{
  "topic": "정리되기 전엔 말하지 않는 패턴",
  "pattern_insight": "체계 강점이 발화를 늦추고 있음",
  "next_action_title": "초안 단계에서 말로 옮기기",
  "next_action_reason": "체계 강점의 최소 단위 출력 훈련",
  "strength_link": "체계 + 분석"
}
```

**기대 형식 (이미 사용한 시드 ID 목록)**:

```json
["T-1-junior-2", "T-1-junior-3"]
```

> 1주차에는 이 배열이 빈 `[]`이므로 주차별 순환 룰이 자연스럽게 첫 시드부터 시작한다.

---

### 2.2 Static Reference Inputs

이 단계는 **두 종류의 정적 레퍼런스**를 결합한다. 각각의 역할이 명확히 다르므로 슬라이싱 룰도 분리한다.

#### 2.2.A 시드 액션 풀 (1차 자료, WHAT — 뼈대)

**소스**: `competency_action_map.md` 본문의 12역량 × 2레벨(junior/senior) × 3액션 = **72개 시드 액션**.

**시드 ID 표기법**: `{competency_code}-{seed_level}-{seed_index}` 형식.

| 토큰 | 값 | 예 |
| --- | --- | --- |
| `competency_code` | 12개 enum (T-1 ~ E-3) | `T-1` |
| `seed_level` | `junior` 또는 `senior` | `junior` |
| `seed_index` | 1, 2, 3 (`competency_action_map.md` 각 표의 # 컬럼 그대로) | `2` |

**예시**: `T-1-junior-2` = 비판적 사고 기르기 / 주니어 / 두 번째 시드 = "읽은 자료에서 사실(Fact)과 의견(Opinion)을 구분해 표시하기"

> 빌드 시점에 `competency_action_map.md`를 파싱해 `seeds.json`(72개 항목)으로 번들링한다. 각 항목 스키마:
>
> ```json
> {
>   "seed_id": "T-1-junior-2",
>   "competency_code": "T-1",
>   "seed_level": "junior",
>   "seed_index": 2,
>   "title": "읽은 자료에서 사실(Fact)과 의견(Opinion)을 구분해 표시하기",
>   "purpose": "논리·감정 분리 기초"
> }
> ```

**`career_level` → `seed_level` 매핑** (bootstrap.md 결정사항 + spec-schema.md `profiles.career_level` 표):

| `profiles.career_level` (DB) | `seed_level` (시드 조회용) |
| --- | --- |
| `junior_new` | `junior` |
| `junior` | `junior` |
| `senior_mid` | `senior` |
| `senior` | `senior` |

**슬라이싱 룰 (시드 액션 풀)**:

```python
# 입력: goals.competency_code, profiles.career_level
# 매핑: career_level → seed_level
seed_level = "junior" if career_level in ("junior_new", "junior") else "senior"

# 해당 역량 × 레벨의 시드 3개 추출
matched_seeds = [s for s in SEEDS
                 if s["competency_code"] == competency_code
                 and s["seed_level"] == seed_level]
# → 정확히 3개

# 참고용으로 같은 역량의 다른 레벨 3개도 함께 슬라이싱 (총 6개)
# 사용 목적: AI가 난이도 폭을 이해하도록 보조 컨텍스트로만 제공
other_level_seeds = [s for s in SEEDS
                     if s["competency_code"] == competency_code
                     and s["seed_level"] != seed_level]
# → 정확히 3개
```

**출력**: 매칭 시드 3개(주력 풀) + 같은 역량 다른 레벨 3개(보조 컨텍스트). 합 6개.

**토큰 추정**: 시드 6개 × 약 60토큰 = ~360토큰.

#### 2.2.B 강점 블록 (2차 자료, HOW — 톤)

**소스**: `강점코칭_테마별_실행항목.docx` — 34개 강점 챕터, 각 챕터에 5~10개의 실천 가이드 bullet.

**중요**: 이 자료는 **양방향 페어가 아니다**. 1번 명세서의 강점 페어(`강점코칭_테마별_조합.docx`)와 혼동 금지. 여기서는 **단일 강점 블록 5개** (Top 5의 각 강점에 해당하는 챕터 한 덩어리씩)만 사용한다.

**한국어 정규명 → 챕터 인덱스 매핑** (빌드 시점에 docx 파싱하여 `strength_action_blocks.json`으로 번들):

```json
{
  "성취":     { "chapter_index": 1,  "name_en": "Achiever",       "bullets": ["...", "..."] },
  "행동":     { "chapter_index": 2,  "name_en": "Activator",      "bullets": [...] },
  "적응":     { "chapter_index": 3,  "name_en": "Adaptability",   "bullets": [...] },
  "분석":     { "chapter_index": 4,  "name_en": "Analytical",     "bullets": [...] },
  "정리":     { "chapter_index": 5,  "name_en": "Arranger",       "bullets": [...] },
  "신념":     { "chapter_index": 6,  "name_en": "Belief",         "bullets": [...] },
  "주도력":   { "chapter_index": 7,  "name_en": "Command",        "bullets": [...] },
  "커뮤니케이션": { "chapter_index": 8,  "name_en": "Communication", "bullets": [...] },
  "승부":     { "chapter_index": 9,  "name_en": "Competition",    "bullets": [...] },
  "연결성":   { "chapter_index": 10, "name_en": "Connectedness",  "bullets": [...] },
  "공정성":   { "chapter_index": 11, "name_en": "Consistency",    "bullets": [...] },
  "회고":     { "chapter_index": 12, "name_en": "Context",        "bullets": [...] },
  "심사숙고": { "chapter_index": 13, "name_en": "Deliberative",   "bullets": [...] },
  "개발":     { "chapter_index": 14, "name_en": "Developer",      "bullets": [...] },
  "체계":     { "chapter_index": 15, "name_en": "Discipline",     "bullets": [...] },
  "공감":     { "chapter_index": 16, "name_en": "Empathy",        "bullets": [...] },
  "집중":     { "chapter_index": 17, "name_en": "Focus",          "bullets": [...] },
  "미래지향": { "chapter_index": 18, "name_en": "Futuristic",     "bullets": [...] },
  "화합":     { "chapter_index": 19, "name_en": "Harmony",        "bullets": [...] },
  "발상":     { "chapter_index": 20, "name_en": "Ideation",       "bullets": [...] },
  "포용":     { "chapter_index": 21, "name_en": "Includer",       "bullets": [...] },
  "개별화":   { "chapter_index": 22, "name_en": "Individualization", "bullets": [...] },
  "수집":     { "chapter_index": 23, "name_en": "Input",          "bullets": [...] },
  "지적사고": { "chapter_index": 24, "name_en": "Intellection",   "bullets": [...] },
  "배움":     { "chapter_index": 25, "name_en": "Learner",        "bullets": [...] },
  "최상화":   { "chapter_index": 26, "name_en": "Maximizer",      "bullets": [...] },
  "긍정":     { "chapter_index": 27, "name_en": "Positivity",     "bullets": [...] },
  "절친":     { "chapter_index": 28, "name_en": "Relator",        "bullets": [...] },
  "책임":     { "chapter_index": 29, "name_en": "Responsibility", "bullets": [...] },
  "복구":     { "chapter_index": 30, "name_en": "Restorative",    "bullets": [...] },
  "자기확신": { "chapter_index": 31, "name_en": "Self-Assurance", "bullets": [...] },
  "존재감":   { "chapter_index": 32, "name_en": "Significance",   "bullets": [...] },
  "전략":     { "chapter_index": 33, "name_en": "Strategic",      "bullets": [...] },
  "사교성":   { "chapter_index": 34, "name_en": "Woo",            "bullets": [...] }
}
```

**슬라이싱 룰 (강점 블록)**:

```python
# 입력: Top 5 강점 한글명 리스트
top5_names = [s["name_ko"] for s in strengths]   # ["성취", "분석", "체계", "집중", "전략"]

# 5개 강점 블록 추출 (단일 강점 블록, 양방향 페어 아님)
top5_blocks = [STRENGTH_ACTION_BLOCKS[name] for name in top5_names]
# → 5개 블록, 각 블록에 5~10개 bullet
```

**토큰 추정**: 강점 블록 5개 × 평균 160토큰 = **~800토큰**.

> 1번 명세서 페어 슬라이싱(20문장 ~1,200토큰)과는 별개의 자료다. 페어는 1번 인터뷰 follow-up용, 실행항목은 3번 액션 톤 보강용.

---

## 3. Persona & Voice

**페르소나**: 12주 코칭 프로그램의 코치. 매주 월요일 사용자에게 이번 주 과제를 짧은 메모로 건네주는 톤. 사용자의 강점 결을 알고 있고, 시드 액션의 의도를 사용자의 일하는 방식에 맞춰 살짝 옮겨 적어준다.

**핵심 자세**:
- **시드의 의도(`purpose`)는 보존**한다. 시드의 핵심 행동을 임의로 다른 행동으로 바꾸지 않는다.
- **강점 블록의 표현·접근 방식**을 빌려 액션의 형태와 동기 부여 문구를 사용자 결에 맞춘다.
- 액션 1건당 `title` 1줄 + `description` 1~2문장. 짧고 또렷하게.
- 사용자의 강점이 자연스럽게 호명되어도 좋지만, 강점 진단·평가는 하지 않는다 ("당신은 분석가형입니다" 금지).

**톤**:
- 존댓말, 따뜻하지만 군더더기 없는 코치 톤. 행동 동사로 끝맺음 (`~해보기`, `~정리하기`, `~기록하기`).
- 한국어, 이모지·감탄사 자제. `description`도 마침표로 끝맺음.

**금지 표현**:
- "AI로서 말씀드리면…" / "분석 결과…"
- "정답은 ~입니다" / "~해야 합니다"
- 강점 페어 명칭 (이번 단계에서 페어는 입력으로 받지 않음)
- 시드 풀에 없는 자유 행동 (예: 시드가 "뉴스 1개 읽기"인데 "팟캐스트 듣기"로 바꾸는 것 — 시드의 핵심 행동을 보존)
- 다른 액션 항목을 깎아내리는 표현

**필수 표현 패턴**:
- `title`: 시드 `title`을 강점 결에 맞춰 살짝 다듬은 한 줄 (15~30자 권장).
- `description`: 시드 `purpose`를 사용자의 강점·맥락에 연결하는 1~2문장.
- `tags`: 2~4개. 형식 자유지만 카테고리는 통일된 어휘에서 — 행동 형식(예: "📝 메모", "📹 영상", "💬 대화"), 소요 시간(예: "⏱ 10분", "⏱ 1시간"), 진행 형태(예: "🌱 매일 루틴", "🎯 1회").

---

## 4. Logic / Pipeline

이 단계는 **결정적 단계 4.1(시드 선택·검증)** 과 **AI 호출 단계 4.2(시드 재해석)** 의 2단 파이프라인이다.

### 4.1 결정적 단계 (코드, AI 호출 없음)

**처리 의사코드**:

```python
# 0) 입력 정규화
career_level = profile["career_level"]
seed_level = "junior" if career_level in ("junior_new", "junior") else "senior"
competency_code = goal["competency_code"]
current_week = goal["current_week"]      # 1~12
top5_names = [s["name_ko"] for s in strengths]

# 1) 주력 시드 풀 추출 — 해당 역량 × 레벨의 시드 3개
primary_pool = [s for s in SEEDS
                if s["competency_code"] == competency_code
                and s["seed_level"] == seed_level]
assert len(primary_pool) == 3   # 시드 데이터 정합성

# 2) 보조 컨텍스트 — 같은 역량의 다른 레벨 시드 3개
secondary_pool = [s for s in SEEDS
                  if s["competency_code"] == competency_code
                  and s["seed_level"] != seed_level]
assert len(secondary_pool) == 3

# 3) 주차별 시드 순환 룰
#    - 같은 역량 시드 3개를 12주 동안 반복하지 않기 위해 주차에 시드 순환 인덱스를 할당
#    - 주력 풀(3개)을 우선 소진 → 그 다음 보조 풀(3개)로 확장 → 다시 주력으로 순환
#    - 사용자가 시드를 "주력 → 보조 → 주력 → 보조" 순으로 만나는 12주 흐름을 의도적으로 설계
def seed_rotation_for_week(week, primary_pool, secondary_pool, used_seed_ids):
    """
    주차별로 그 주에 활용할 시드 후보를 결정한다.
    반환: AI에게 1차 추천으로 제시할 시드 1~2개 + 보조로 참고할 시드 4~5개
    """
    full_cycle = primary_pool + secondary_pool        # 6개 시드
    # 12주를 6개 시드의 2바퀴로 매핑
    # 주차 1~6: 1바퀴 (주력 3개 → 보조 3개)
    # 주차 7~12: 2바퀴 (난이도·각도를 다르게 재해석)
    cycle_index = (week - 1) % 6                      # 0~5
    primary_seed = full_cycle[cycle_index]            # 그 주의 주력 시드 1개

    # 같은 주차에 시드 1개에서만 액션을 뽑으면 단조롭다 — 인접 시드 1개를 보조로 함께 제시
    secondary_index = (cycle_index + 1) % 6
    secondary_seed = full_cycle[secondary_index]

    return {
        "primary_seed": primary_seed,
        "secondary_seed": secondary_seed,
        "context_seeds": [s for i, s in enumerate(full_cycle)
                          if i not in (cycle_index, secondary_index)],
    }

rotation = seed_rotation_for_week(current_week, primary_pool, secondary_pool, used_seed_ids)

# 4) Top 5 강점 블록 추출 (단일 강점 블록 5개)
top5_blocks = []
for name in top5_names:
    block = STRENGTH_ACTION_BLOCKS.get(normalize_strength_name(name))
    if block is not None:
        top5_blocks.append(block)
# → 정상이면 5개 블록. 매핑 실패 강점은 조용히 스킵 (Edge Case 3 참조)

# 5) 직전 회고 인사이트 (있을 때만)
prior_insight = coaching_insight  # None or dict

# 6) AI 프롬프트 변수 패키징
prompt_vars = {
    "competency_title":   COMPETENCY_TITLE_BY_CODE[competency_code],   # "비판적 사고 기르기"
    "competency_code":    competency_code,
    "current_week":       current_week,
    "career_level":       career_level,
    "nickname":           profile["nickname"],
    "job_field":          profile["job_field"],
    "top5_strengths":     strengths,                                   # 5개 객체
    "top5_blocks":        top5_blocks,                                 # 5개 블록
    "primary_seed":       rotation["primary_seed"],
    "secondary_seed":     rotation["secondary_seed"],
    "context_seeds":      rotation["context_seeds"],                   # 4개
    "prior_insight":      prior_insight,                               # None 가능
    "is_first_week":      (current_week == 1),
}

# → AI 호출 (4.2)
```

> **주차별 시드 순환 설계 의도**: 같은 역량을 12주 동안 단계적으로 깊어지게 하려면, 단일 시드를 12번 반복하면 단조롭고, 매주 무작위로 흩뿌리면 맥락이 끊긴다. 6개 시드(주력 3 + 보조 3)를 2바퀴로 도는 구조는 (a) 1~6주차에는 첫 만남으로 시도하고, (b) 7~12주차에는 같은 시드를 다른 각도로 재해석하게 된다. AI는 2바퀴째에는 직전 회고 인사이트를 더 무겁게 반영해 변주한다.

### 4.2 AI Prompt Template

**System Prompt** (변수는 `{{...}}`):

```
당신은 12주 커리어 코칭 프로그램의 코치입니다. 매주 월요일,
사용자에게 그 주 한 주의 액션 아이템 3~5개를 짧은 메모로 건네줍니다.

[이번 주 컨텍스트]
- 사용자: {{nickname}} ({{job_field}}, {{career_level}})
- 목표 역량: {{competency_title}} ({{competency_code}})
- 현재 주차: {{current_week}} / 12

[Top 5 강점]
{{#each top5_strengths}}
{{rank}}. {{name_ko}} ({{name_en}}) — {{description}}
{{/each}}

[강점별 실천 가이드 — 톤·접근 방식 참고용 (HOW)]
이 가이드는 사용자의 강점이 자연스럽게 발휘되는 행동 결을 보여줍니다.
액션의 표현·진행 형태·동기 부여 문구를 이 결에 맞춰 다듬으세요.
{{#each top5_blocks}}
## {{name_ko}} ({{name_en}})
{{#each bullets}}
- {{this}}
{{/each}}
{{/each}}

[이번 주 시드 액션 — 1차 자료 (WHAT, 뼈대)]
아래 시드는 그 자체가 액션의 핵심 행동입니다.
시드의 의도(purpose)와 핵심 행동을 보존하면서 사용자 결에 맞춰 다듬으세요.
시드 외의 다른 행동을 새로 만들어내지 마세요.

▶ 주력 시드 (1개)
- seed_id: {{primary_seed.seed_id}}
- 행동: {{primary_seed.title}}
- 의도: {{primary_seed.purpose}}

▶ 보조 시드 (1개) — 인접 결의 액션, 함께 활용 가능
- seed_id: {{secondary_seed.seed_id}}
- 행동: {{secondary_seed.title}}
- 의도: {{secondary_seed.purpose}}

▶ 참고 시드 (4개) — 같은 역량 안에서 시드 폭을 이해하기 위한 컨텍스트
{{#each context_seeds}}
- {{seed_id}}: {{title}} (의도: {{purpose}})
{{/each}}

{{#if prior_insight}}
[직전 주 회고 인사이트]
- 주제: {{prior_insight.topic}}
- 발견 패턴: {{prior_insight.pattern_insight}}
- 추천 방향: {{prior_insight.next_action_title}} ({{prior_insight.next_action_reason}})
- 강점 연결: {{prior_insight.strength_link}}
이번 주 액션은 위 인사이트를 한 걸음 이어가는 결로 다듬으세요.
{{else}}
[직전 주 회고 없음 — 1주차 또는 회고 미작성]
이번 주는 첫 출발점입니다. 부담 없는 시작이 되도록 액션 1개는
가장 가벼운 시드(주로 주력 시드 또는 보조 시드)로 잡으세요.
{{/if}}

[작성 규칙]
1. 액션은 정확히 3~5개를 출력합니다.
2. 모든 액션은 위에 제시된 [주력 시드 1개 + 보조 시드 1개 + 참고 시드 4개 = 총 6개] 중 하나에서 파생되어야 합니다.
   같은 시드에서 2개 액션을 만들 수 있습니다 (각도를 바꿔서).
   시드 외 자유 행동을 만들지 마세요.
3. 각 액션의 source_seed_id는 파생된 시드의 seed_id를 그대로 적습니다.
4. title은 15~30자, 행동 동사로 끝맺습니다 ("~해보기", "~정리하기" 등).
5. description은 1~2문장. 시드의 의도(purpose)를 사용자의 강점·맥락에 연결합니다.
6. tags는 2~4개. 행동 형식·소요 시간·진행 형태 중 골라 적습니다.
7. 출력은 다음 JSON 스키마를 정확히 따릅니다. JSON 외 텍스트 금지.

[출력 JSON 스키마]
{
  "actions": [
    {
      "title": "string",
      "description": "string",
      "tags": ["string", ...],
      "source_seed_id": "T-1-junior-2"
    }
  ]
}
```

**User Turn**: 별도 사용자 발화 없이 위 System Prompt만 보내고, Assistant가 JSON으로 응답한다 (단발 호출).

#### 4.2.A Few-shot 예시 — 일반 케이스 (1주차)

**입력 변수 (요약)**:

```json
{
  "competency_title": "비판적 사고 기르기",
  "competency_code": "T-1",
  "current_week": 1,
  "career_level": "junior",
  "nickname": "지수",
  "job_field": "IT/개발",
  "top5_strengths": [
    {"rank": 1, "name_ko": "성취", "name_en": "Achiever",   "description": "..."},
    {"rank": 2, "name_ko": "분석", "name_en": "Analytical", "description": "..."},
    {"rank": 3, "name_ko": "체계", "name_en": "Discipline", "description": "..."},
    {"rank": 4, "name_ko": "집중", "name_en": "Focus",      "description": "..."},
    {"rank": 5, "name_ko": "전략", "name_en": "Strategic",  "description": "..."}
  ],
  "primary_seed":   { "seed_id": "T-1-junior-1",
                      "title":   "하루 1개 뉴스·보고서 읽고 \"이 주장의 근거는 무엇인가?\" 메모하기",
                      "purpose": "수동적 소비 → 능동적 분석 전환" },
  "secondary_seed": { "seed_id": "T-1-junior-2",
                      "title":   "읽은 자료에서 사실(Fact)과 의견(Opinion)을 구분해 표시하기",
                      "purpose": "논리·감정 분리 기초" },
  "is_first_week": true,
  "prior_insight": null
}
```

**AI 출력**:

```json
{
  "actions": [
    {
      "title": "하루 1개 뉴스·보고서 읽고 근거 한 줄 메모하기",
      "description": "분석·전략 강점이 자연스럽게 발휘되는 시작이에요. 하루 한 번, 본 자료에서 '주장 1줄 + 근거 1줄'만 짧게 적어보세요. 부담은 작게, 루틴은 단단하게.",
      "tags": ["📝 메모", "⏱ 10분", "🌱 매일 루틴"],
      "source_seed_id": "T-1-junior-1"
    },
    {
      "title": "읽은 보고서 1개에 사실·의견 표시해보기",
      "description": "정확함을 중시하는 결과 잘 맞아요. 한 자료 안에서 데이터·수치 부분과 해석·판단 부분을 색깔로 분리해보면, 다음에 같은 자료를 다시 볼 때 핵심이 또렷해집니다.",
      "tags": ["✏️ 표시", "⏱ 20분", "🎯 주 1회"],
      "source_seed_id": "T-1-junior-2"
    },
    {
      "title": "이번 주 결정 1개 \"내가 놓친 관점\" 적어보기",
      "description": "체계·분석 강점이 깊이를 만들어내는 분이세요. 이번 주 직접 내린 의사결정 1개를 골라, 그 결정에서 검토하지 못한 시야를 한 줄로 적어두세요. 다음 주차의 출발점이 됩니다.",
      "tags": ["📝 회고 메모", "⏱ 15분", "🎯 주 1회"],
      "source_seed_id": "T-1-junior-3"
    }
  ]
}
```

> 시드 3개에서 정확히 1개씩 파생. 강점 블록의 톤(분석 강점의 "패턴 발견·체계화" 결, 체계 강점의 "정확성·구조" 결)이 description에 자연스럽게 녹아 있다.

#### 4.2.B Few-shot 예시 — 엣지 케이스 (5주차, 회고 인사이트 있음)

**입력 변수 (요약)**:

```json
{
  "competency_code": "T-1",
  "current_week": 5,
  "primary_seed":   {"seed_id": "T-1-junior-2", "title": "읽은 자료에서 사실(Fact)과 의견(Opinion)을 구분해 표시하기", "purpose": "논리·감정 분리 기초"},
  "secondary_seed": {"seed_id": "T-1-junior-3", "title": "이번 주 내린 결정 1개를 되돌아보고 \"내가 놓친 관점은?\" 기록하기", "purpose": "자기 사고 맹점 인식"},
  "prior_insight": {
    "topic": "결론을 미루는 패턴",
    "pattern_insight": "체계 강점이 충분한 정리 전엔 결론을 미룸",
    "next_action_title": "초안 단계에서 잠정 결론 적어보기",
    "next_action_reason": "체계 강점의 최소 단위 출력 훈련",
    "strength_link": "체계 + 분석"
  }
}
```

**AI 출력**:

```json
{
  "actions": [
    {
      "title": "읽은 자료의 사실·의견 표시 후 잠정 결론 1줄 적기",
      "description": "지난 주 인사이트에서 보였듯, 정리가 끝나기 전엔 결론이 미뤄지는 결이 있어요. 자료를 읽고 사실·의견을 분리한 직후, 완벽하지 않아도 괜찮으니 한 줄 잠정 결론을 적어보세요.",
      "tags": ["✏️ 표시", "⏱ 25분", "🎯 주 2회"],
      "source_seed_id": "T-1-junior-2"
    },
    {
      "title": "이번 주 결정 1개 \"미리 알았다면\" 한 줄 기록",
      "description": "직전 주에 발견한 '결론 미루기' 패턴을 풀어가는 한 걸음이에요. 결정 후 24시간 안에, 미리 알았으면 좋았을 한 가지를 짧게 기록해두면 같은 패턴이 다음에 줄어듭니다.",
      "tags": ["📝 회고 메모", "⏱ 10분", "🎯 주 1회"],
      "source_seed_id": "T-1-junior-3"
    },
    {
      "title": "회의 1번 \"이 전제가 맞나요?\" 직접 물어보기",
      "description": "체계·분석 강점이 팀 차원에서 발휘되기 시작하는 시점이에요. 이번 주 회의 1번에서, 자연스러운 타이밍에 전제를 한 번만 짚는 질문을 던져보세요.",
      "tags": ["💬 대화", "⏱ 1분", "🎯 1회"],
      "source_seed_id": "T-1-senior-2"
    }
  ]
}
```

> 5주차이므로 순환 인덱스 = (5-1) % 6 = 4 → 주력 시드는 보조 풀에서. 직전 인사이트 ("결론 미루기")가 첫 두 액션의 description에 일관되게 녹아 있다. 세 번째 액션은 참고 시드(`T-1-senior-2`)에서 파생되어 난이도가 살짝 확장됐다.

---

## 5. Output Schema

### 5.1 DB 저장 필드

**대상 테이블**: `action_items` (spec-schema v0.7.1, §4.5).

**INSERT 의사코드**:

```sql
INSERT INTO action_items
  (user_id, goal_id, week_number, title, description, tags, is_custom, source_seed_id)
VALUES
  (:user_id, :goal_id, :current_week, :title, :description, :tags, false, :source_seed_id);
```

**AI 출력 JSON → DB 컬럼 매핑**:

| AI 출력 키 | DB 컬럼 | 변환 |
| --- | --- | --- |
| `title` | `action_items.title` | 그대로 |
| `description` | `action_items.description` | 그대로 |
| `tags` (배열) | `action_items.tags` (text[]) | 그대로 |
| `source_seed_id` | `action_items.source_seed_id` | 그대로, 시드 풀에 존재해야 함 |
| (코드 측) | `action_items.is_custom` | 항상 `false` |
| (코드 측) | `action_items.user_id`, `goal_id`, `week_number` | 입력 변수에서 채움 |

**`source_seed_id` 표기 규칙** (재확인):

| 케이스 | 값 | 비고 |
| --- | --- | --- |
| AI 추천 (`is_custom=false`) | `T-1-junior-2` 형식 (필수) | 시드 풀의 정확한 ID |
| 사용자 직접 추가 (`is_custom=true`) | `NULL` | 이 명세서 범위 밖 |

**JSON Schema (AI 출력 검증용)**:

```json
{
  "type": "object",
  "required": ["actions"],
  "properties": {
    "actions": {
      "type": "array",
      "minItems": 3,
      "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["title", "description", "tags", "source_seed_id"],
        "properties": {
          "title":          { "type": "string", "minLength": 8,  "maxLength": 60  },
          "description":    { "type": "string", "minLength": 20, "maxLength": 120 },
          "tags":           { "type": "array",
                              "minItems": 2, "maxItems": 4,
                              "items": { "type": "string", "minLength": 2, "maxLength": 20 } },
          "source_seed_id": { "type": "string",
                              "pattern": "^(T-[1-3]|I-[1-3]|R-[1-3]|E-[1-3])-(junior|senior)-[1-3]$" }
        }
      }
    }
  }
}
```

### 5.2 화면 표시용 (DB 미저장)

N/A — 이 단계의 모든 출력은 DB에 저장된다. 화면에는 `action_items` 레코드를 그대로 렌더한다.

---

## 6. Validation & Fallback

### 6.1 출력 형식 검증

| 검증 항목 | 룰 | 실패 시 |
| --- | --- | --- |
| JSON 파싱 | `JSON.parse` 성공 | 재시도 |
| 스키마 적합 | `actions` 배열 길이 3~5, 각 항목 4개 키 모두 존재 | 재시도 |
| `title` 길이 | 8~60자 | 재시도 |
| `description` 길이 | 20~120자 | 재시도 |
| `tags` 개수 | 2~4개 | 재시도 |
| `source_seed_id` 패턴 | `^(T-[1-3]|I-[1-3]|R-[1-3]|E-[1-3])-(junior|senior)-[1-3]$` | 재시도 |

### 6.2 시드 풀 검증 — 자유 생성 차단

이 검증이 **이 명세서의 핵심 가드레일**이다. AI가 시드 풀에 없는 ID를 적어 자유 생성을 시도하는 경우를 차단한다.

```python
ALLOWED_SEED_IDS = {
    rotation["primary_seed"]["seed_id"],
    rotation["secondary_seed"]["seed_id"],
    *(s["seed_id"] for s in rotation["context_seeds"]),
}   # 6개 ID 집합

for action in ai_output["actions"]:
    if action["source_seed_id"] not in ALLOWED_SEED_IDS:
        raise ValidationError(f"Disallowed seed: {action['source_seed_id']}")
    if action["source_seed_id"] not in {s["seed_id"] for s in SEEDS}:
        raise ValidationError(f"Unknown seed: {action['source_seed_id']}")
```

**룰**:
1. `source_seed_id`는 이번 호출에서 AI에게 노출된 6개 시드(주력 1 + 보조 1 + 참고 4) 중 하나여야 한다.
2. 노출되지 않은 다른 역량의 시드 ID(예: `I-1-junior-1`)를 적어내도 거부.
3. 시드 풀에 없는 가짜 ID(예: `T-1-junior-9`)를 만들어내도 거부.

> 이 검증이 통과해야만 DB INSERT를 허용한다. AI의 자유 생성을 구조적으로 막는다.

### 6.3 의미 검증 (선택)

| 검증 항목 | 룰 | 실패 시 |
| --- | --- | --- |
| `title` 행동 동사 종결 | `~기`, `~하기` 등 명사형 종결 권장 (강제 아님) | 경고 로그, 통과 |
| 같은 시드에서 3개 이상 파생 | 한 시드에서 액션이 3개 이상 나오면 단조로움 의심 | 경고 로그, 통과 |
| 텍스트 안전성 | 욕설·차별 표현 없음 (선택적 모더레이션) | 재시도 |

### 6.4 재시도 정책

**재시도 트리거**:
- JSON 파싱 실패
- 스키마 부적합 (필수 키 누락, 길이 위반)
- `source_seed_id` 시드 풀 검증 실패 (6.2)

**재시도**: 최대 **2회**. 같은 입력·System Prompt로 재호출.

**2회 모두 실패 시 fallback**:

AI 호출을 포기하고 **결정적 fallback**으로 시드 3개를 그대로 액션으로 변환한다 (강점 톤 미적용 plain 버전). 서비스 흐름 단절 방지가 우선.

```python
def deterministic_fallback(rotation):
    actions = []
    for seed in [rotation["primary_seed"], rotation["secondary_seed"]] + rotation["context_seeds"][:1]:
        actions.append({
            "title": seed["title"],
            "description": f"{seed['purpose']}을(를) 위한 이번 주 시도예요.",
            "tags": ["🎯 주 1회"],
            "source_seed_id": seed["seed_id"],
        })
    return {"actions": actions}
```

> Fallback은 강점 톤 보강은 빠지지만 시드의 본질은 유지된다. 사용자가 화면에서 액션을 받아 진행하는 것은 가능.

### 6.5 직전 회고 인사이트 부재 처리

| 케이스 | 처리 |
| --- | --- |
| `current_week == 1` | `prior_insight = null`로 명시. System Prompt의 1주차 분기 안내가 활성화됨 ("부담 없는 시작") |
| `current_week >= 2` 인데 직전 주 `coaching_insights` 없음 (회고 미작성) | 동일하게 `prior_insight = null` 처리. AI에게는 "직전 주 회고 없음 — 회고 미작성"으로 안내. 1주차와 동일 분기 |
| `current_week >= 2` 이고 직전 주 인사이트 있음 | `prior_insight` 객체 전달. 인사이트를 이번 주 액션의 결로 이어가도록 안내 |

---

## 7. Edge Cases

| # | 케이스 | 처리 |
| --- | --- | --- |
| 1 | `goals` 활성 레코드 없음 | 호출 자체를 차단. 목표 선택 화면(p10)으로 리다이렉트 |
| 2 | `strength_analyses` 레코드 없음 | 호출 차단. 강점 진단 화면으로 리다이렉트 (#3 단계에서 이미 가드됐어야 함) |
| 3 | Top 5 강점 한글명이 정규명과 미세하게 다름 (예: "지적 사고" vs "지적사고") | 정규화 함수로 공백·중점 제거 후 매핑. 그래도 매핑 실패한 강점은 `top5_blocks`에서 조용히 제외. 5개 미만이어도 호출 진행 |
| 4 | 1주차 (`current_week == 1`) | `prior_insight = null`. System Prompt의 1주차 분기 활성. AI는 가장 가벼운 시드 1개를 첫 액션으로 우선 |
| 5 | 회고 인사이트 없는 2주차+ | 1주차와 동일 분기. AI는 "회고 없음" 안내를 받고 시드만 기반으로 생성 |
| 6 | 12주차 도달 (`current_week == 12`) | 정상 처리. 순환 인덱스 = (12-1) % 6 = 5 → 마지막 보조 시드. 12주차 액션 생성 후 `goals.current_week`은 더 증가시키지 않음 (spec-schema 주차 자동 전환 정책) |
| 7 | 같은 주차에 이미 `action_items`이 있음 (재호출 상황) | 클라이언트가 `SELECT count(*) WHERE goal_id = ? AND week_number = ?`로 사전 체크. 이미 있으면 호출 스킵 (idempotent 보장) |
| 8 | 직전 주 `weekly_retros`는 있지만 `coaching_insights`는 없음 (회고만 작성, 코칭 미진행) | `prior_insight = null` 처리. 회고 한 줄만으로는 직접 컨텍스트 주입하지 않음 (`weekly_retros`는 #5 회고 코칭 단계의 입력일 뿐) |
| 9 | `career_level`이 enum 외 값 (마이그레이션 잔재) | 정규화 단계에서 `junior`로 fallback. 에러 로그 기록 |
| 10 | AI 출력의 `source_seed_id`가 노출된 6개 외(예: `I-1-junior-1`) | 6.2 검증 실패 → 재시도. 2회 실패 시 결정적 fallback |
| 11 | AI 출력의 `source_seed_id`가 시드 풀에 없는 가짜 ID(예: `T-1-junior-9`) | 6.2 검증 실패 → 재시도 |
| 12 | AI가 `actions` 2개만 반환 (3 미만) | 스키마 검증 실패 → 재시도 |
| 13 | AI가 `actions` 6개 이상 반환 | 스키마 검증 실패 → 재시도 |
| 14 | 같은 호출에서 `source_seed_id`가 모두 같은 시드 (단조로움) | 6.3 경고 로그, 통과. UX 품질 모니터링 후 v0.8에서 명시적 다양성 룰 검토 |
| 15 | 사용자가 한 주에 액션을 직접 추가 (`is_custom=true`) | 별도 INSERT. AI 호출 흐름과 무관. `source_seed_id`는 NULL |
| 16 | 같은 `goal_id`에서 12주 동안 사용한 `source_seed_id` 다양성 점검 | 사후 분석용 메트릭. 매 호출에 영향 없음 (정보용 로깅만) |
| 17 | `coaching_insights`의 `next_action_title`이 시드와 명확히 다른 자유 생성 텍스트 | 정상. AI는 인사이트의 방향성만 참고하고, 구체 액션은 항상 시드 풀에서 파생. 시드 풀 검증(6.2)은 그대로 적용 |

---

## 8. Examples

### 8.1 일반 케이스 — 1주차, 회고 없음

**입력 컨텍스트**:

```json
{
  "user_id": "a1b2c3d4-...",
  "goal_id": "c3d4e5f6-...",
  "competency_code": "T-1",
  "current_week": 1,
  "career_level": "junior",
  "nickname": "지수",
  "job_field": "IT/개발",
  "top5_strengths": ["성취", "분석", "체계", "집중", "전략"],
  "prior_insight": null
}
```

**4.1 결정적 처리**:

- `seed_level = junior`
- `primary_pool` = `[T-1-junior-1, T-1-junior-2, T-1-junior-3]`
- `secondary_pool` = `[T-1-senior-1, T-1-senior-2, T-1-senior-3]`
- `cycle_index = (1-1) % 6 = 0` → 주력 시드 = `T-1-junior-1`, 보조 시드 = `T-1-junior-2`, 참고 시드 = `[T-1-junior-3, T-1-senior-1, T-1-senior-2, T-1-senior-3]`
- `top5_blocks` = 성취·분석·체계·집중·전략 5개 블록

**AI 호출 결과 (JSON)**:

위 4.2.A의 출력 그대로. 액션 3개, 각각 `source_seed_id`가 `T-1-junior-1`, `T-1-junior-2`, `T-1-junior-3`.

**6.2 시드 풀 검증**:
- `T-1-junior-1` ∈ ALLOWED_SEED_IDS ✓
- `T-1-junior-2` ∈ ALLOWED_SEED_IDS ✓
- `T-1-junior-3` ∈ ALLOWED_SEED_IDS ✓

**DB INSERT (3건)**:

```sql
INSERT INTO action_items VALUES
  (..., 1, '하루 1개 뉴스·보고서 읽고 근거 한 줄 메모하기', '...', '{"📝 메모","⏱ 10분","🌱 매일 루틴"}', false, 'T-1-junior-1'),
  (..., 1, '읽은 보고서 1개에 사실·의견 표시해보기',           '...', '{"✏️ 표시","⏱ 20분","🎯 주 1회"}',     false, 'T-1-junior-2'),
  (..., 1, '이번 주 결정 1개 "내가 놓친 관점" 적어보기',         '...', '{"📝 회고 메모","⏱ 15분","🎯 주 1회"}', false, 'T-1-junior-3');
```

### 8.2 엣지 케이스 — 5주차, 회고 인사이트 있음, 시니어

**입력 컨텍스트**:

```json
{
  "competency_code": "T-1",
  "current_week": 5,
  "career_level": "senior_mid",
  "nickname": "민호",
  "job_field": "IT/기획",
  "top5_strengths": ["전략", "미래지향", "분석", "주도력", "집중"],
  "prior_insight": {
    "topic": "팀 결정에서 내 의견을 미루는 패턴",
    "pattern_insight": "분석 강점이 충분한 데이터 전엔 결론을 미룸",
    "next_action_title": "초안 단계에서 잠정 결론 공유하기",
    "next_action_reason": "분석 강점의 출력 단계 압축",
    "strength_link": "분석 + 전략"
  }
}
```

**4.1 결정적 처리**:

- `seed_level = senior` (senior_mid → senior 매핑)
- `primary_pool` = `[T-1-senior-1, T-1-senior-2, T-1-senior-3]`
- `secondary_pool` = `[T-1-junior-1, T-1-junior-2, T-1-junior-3]`
- `full_cycle = primary + secondary = [senior-1, senior-2, senior-3, junior-1, junior-2, junior-3]`
- `cycle_index = (5-1) % 6 = 4` → 주력 시드 = `T-1-junior-2`, 보조 시드 = `T-1-junior-3`, 참고 시드 = `[T-1-senior-1, T-1-senior-2, T-1-senior-3, T-1-junior-1]`
- `prior_insight`가 있으므로 1주차 분기는 비활성, 회고 연결 분기 활성

**AI 출력 예 (요약)**:

```json
{
  "actions": [
    {
      "title": "회의 1번 \"이 전제가 맞나요?\" 직접 묻기",
      "description": "분석·전략·주도력 강점이 팀 결정에 더 또렷하게 닿는 결이에요. 직전 주 인사이트(결론 미루기)를 풀어가는 한 걸음으로, 회의 1번에 자연스러운 타이밍에 전제 1개만 짚어보세요.",
      "tags": ["💬 회의 발화", "⏱ 1분", "🎯 1회"],
      "source_seed_id": "T-1-senior-2"
    },
    {
      "title": "한 달간 결정 3개 패턴 분석 메모 시작",
      "description": "전략·미래지향 강점이 메타적 시야로 확장되는 시점이에요. 이번 주 1개 결정부터 \"근거-과정-결과\" 3줄로 적어두면, 다음 분기엔 결정 패턴이 보입니다.",
      "tags": ["📝 메모", "⏱ 15분", "🌱 매일 루틴"],
      "source_seed_id": "T-1-senior-3"
    },
    {
      "title": "팀 결정 1개에 반론 3가지 정리하기",
      "description": "직전 주 인사이트의 \"잠정 결론을 공유하기\" 결을 그대로 잇는 액션이에요. 한 결정에 대해 분석·전략 강점이 떠올린 반론 3가지를 정리해 팀에 공유하면, 결론을 미루지 않고 검증을 분산시킬 수 있습니다.",
      "tags": ["📋 정리", "⏱ 30분", "🎯 1회"],
      "source_seed_id": "T-1-senior-1"
    }
  ]
}
```

**6.2 시드 풀 검증**: 3개 모두 ALLOWED_SEED_IDS(주력 `T-1-junior-2`, 보조 `T-1-junior-3`, 참고 `T-1-senior-1/2/3, T-1-junior-1`) 안에 포함 → 통과.

**관찰**:
- 5주차 시니어이므로 시드는 senior 풀이 주력이지만, 순환 인덱스가 4라서 그 주의 주력 시드는 junior 쪽이다. AI는 senior 시드 3개도 참고로 받아 그 중에서 액션을 더 뽑았다 (`T-1-senior-1`, `T-1-senior-2`, `T-1-senior-3`).
- 직전 주 인사이트(결론 미루기, 분석 강점 그림자)가 모든 액션의 description에 일관되게 녹아 있다.

### 8.3 엣지 케이스 — 6.2 검증 실패 → 재시도

**시나리오**: 1번째 AI 호출에서 출력 중 한 액션이 `source_seed_id: "T-1-junior-9"` (가짜 ID)를 적음.

**처리 흐름**:
1. JSON 파싱 통과, 스키마 통과.
2. 6.2 시드 풀 검증 → `T-1-junior-9` 미존재 → 검증 실패.
3. 재시도 (1차): 같은 System Prompt로 재호출.
4. 2번째 출력은 정상 → DB INSERT.

**시나리오 B**: 2번 모두 실패 → 결정적 fallback (6.4) 활성. 주력 시드 1 + 보조 시드 1 + 참고 시드 1 = 3개 액션을 plain text로 INSERT. 사용자에게는 정상 화면이 보이지만, 강점 톤은 약하게 적용됨.

---

## 9. Token Budget

### 9.1 입력 토큰

| 블록 | 추정 토큰 |
| --- | ---: |
| System Prompt 본문 (작성 규칙 포함) | ~700 |
| 사용자 컨텍스트 블록 (nickname, job_field, week 등) | ~80 |
| Top 5 강점 메타 블록 | ~250 |
| 강점 블록 5개 (실행항목 docx 슬라이스, 2.2.B) | ~800 |
| 시드 블록 (주력 1 + 보조 1 + 참고 4 = 6개, 2.2.A) | ~360 |
| 직전 회고 인사이트 (있을 때) | ~120 (없으면 ~30) |
| 출력 스키마 안내 | ~150 |

**입력 합계**: 약 **2,400~2,600토큰** (회고 인사이트 유무에 따라 ±100).

### 9.2 출력 토큰

- 액션 3~5개 × 평균 (title 25자 + description 100자 + tags 50자) = 항당 약 175자.
- 한국어 1자 ≈ 1.5~2토큰 → 항당 약 260~350토큰.
- JSON 구조 오버헤드 포함 → **약 1,000~1,800토큰**.

### 9.3 호출 빈도와 비용 (Sonnet 기준)

> Anthropic Sonnet 4 가격: 입력 $3/MTok, 출력 $15/MTok. 환율 1,300원/$ 가정.

**1회 호출 비용**:

| 항목 | 입력 토큰 | 출력 토큰 | 호출당 비용 |
| --- | ---: | ---: | ---: |
| 정상 호출 | ~2,500 | ~1,400 | ~$0.029 (~38원) |
| 재시도 1회 추가 | +2,500 | +1,400 | +~$0.029 |
| 최대 (재시도 2회 모두) | ~7,500 | ~4,200 | ~$0.086 (~112원) |

**한 사용자당 12주 누적**:
- 매주 1회 호출 × 12주 = 12회.
- 일반적으로 재시도 거의 없음 가정 → 12 × 38원 = **약 460원**.

**Prompt caching 가능성**:
- 강점 블록(800토큰)은 같은 사용자의 12주 호출에서 동일 → cache 적용 시 입력 비용 약 30% 절감 가능.
- v1에서는 우선 비활성. 사용자 1만 명 이상 도달 시 도입 검토.

---

*CareerPT 명세서 #4 · v1.0 · 2026-05-07*
