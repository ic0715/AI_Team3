# CareerPT ralph-loop 시뮬레이션 명세서 v1

> 34 페르소나 × 1차 세션(인터뷰 + 역량선택 + 액션아이템)을 반복 시뮬레이션하여
> CareerPT 코칭 `system_prompt`를 `session_score ≥ 9.0`까지 끌어올리는 ralph-loop의 운영 룰북.
>
> 작성일 2026-05-14 · 범위: 1차 세션만. 회고·12주·강점 인터뷰는 범위 외.
> 평가 룰은 `AI_COACH_SCORING_v2.md` (이하 **[B]**) 를 인용. 새 KPI 발명 금지.

---

## 1. Purpose

### 1.1 왜 ralph-loop인가
CareerPT의 코칭 약속("답을 주지 않고 사용자가 스스로 답을 찾게")은 LLM의 본성("답을 생성")과 정면 충돌한다. 프롬프트 엔지니어링만으로 이 경향을 누르려면 **반복 측정 → 원인 분석 → 프롬프트 수정**을 다회 돌려야 한다. 실사용자로 이걸 하면 비용·시간·윤리 모두 불가능 → **34 페르소나 시뮬레이션**으로 대체한다.

### 1.2 검증 대상
- **개선 대상 1개**: `C:\Users\innch\Downloads\.md 파일\system_prompt.md`
- **고정 (이번 루프에서 안 건드림)**: `03. career_interview.md`, `04.competency_analysis.md`, `05_action_item.md`, 페어 20문장, 시드 72개

이번 루프가 끝나면 **프롬프트 한 개의 최종본 + CHANGELOG_PROMPT.md**가 산출물.

### 1.3 비범위 명시 (scope guard)
- 회고(#6/#7), 12주 진행, 강점 인터뷰(#1)는 평가 대상 아님
- [B]의 평가 룰 paraphrase 금지 (인용만)
- 새로운 KPI 발명 금지
- 페르소나의 secret_goal을 정답으로 두지 않는다 (이는 §6의 disclosure 안티패턴 탐지에만 사용)

---

## 2. 시뮬레이션 1회 구조

### 2.1 흐름도
```
[입력: 페르소나 1명]
   ├─ profile (Top5 강점, 닉네임, axis_code, specificity_level, emotional_tone)
   ├─ goal      (페르소나가 코치에게 말할 표면 목표)
   └─ secret_goal (페르소나만 알고 있는 진짜 동기 — 코치가 알면 안 됨)
        │
        ▼
[#2 커리어 인터뷰 — 03. career_interview.md]
   페르소나-LLM ↔ 코치-LLM 멀티턴
   6 메인 질문 + 페어 follow-up + 명확화 1회
   → transcript_interview.jsonl
   → key_insights JSON + ai_summary 60자
        │
        ▼
[#3 역량 5장 카드 — 04.competency_analysis.md]
   Step 1: 결정적 코드 (match_score + 슬롯 배정)
   Step 2: AI 1회 호출 (personalized_text 80~140자 × 5)
   → recommendations.json
        │
        ▼
[#4 액션아이템 3~5건 — 05_action_item.md, week=1 고정]
   주력 시드 1 + 보조 시드 1 + 참고 시드 4 (총 6개 노출)
   → actions.json (각 action에 source_seed_id 필수)
        │
        ▼
[평가 — AI_COACH_SCORING_v2.md]
   Layer A: 인터뷰 매 턴을 cross-vendor LLM-as-judge 로 4 KPI 채점
            → scores_layer_a.json
   Layer B: #3 JSON + #4 JSON 결정적 검증 + retry/fallback 카운트
            → scores_layer_b.json
   Layer C: 페르소나-LLM (cross-vendor) 자가채점 4축
            → scores_layer_c.json
        │
        ▼
[session_score 산출 — [B] §7.1 환산식 그대로]
```

### 2.2 1회 세션의 입력 명세

| 필드 | 출처 | 용도 |
|---|---|---|
| `persona_id` (1~34) | `personas_with_goals.jsonl` | 격리 디렉터리 키 |
| `nickname`, `Top5` | `CliftonStrengths_34_페르소나_*.xlsx` | 코칭 입력 |
| `goal` | Goal Sheet (§4.1 선택 룰) | 페르소나-LLM의 표면 발화 동기 |
| `secret_goal` | Goal Sheet | **페르소나-LLM에게만 주입**. 코치-LLM에는 절대 노출 금지 |
| `axis_code`, `specificity_level`, `emotional_tone` | Goal Sheet | 페르소나-LLM의 발화 스타일 제어 |
| `system_prompt_version` | `prompt_version.txt` | 라운드 추적 |

### 2.3 모델 분리 룰 ([B] §3.1, §6.2 인용)
- **코치-LLM (생성)**: Claude Sonnet
- **페르소나-LLM (생성)**: **GPT-4o** (코치와 다른 벤더). [D] §2-E 의 인라인 자가채점이 이 모델에서 그대로 나오므로 Layer C 가 자동으로 cross-vendor 충족됨.
- **Layer A judge**: Gemini 또는 Claude Sonnet 중 1개 선택 (코치·페르소나 둘 다와 다른 벤더 권장 — 3-way 분리가 이상적이나 실무상 코치 = Claude Sonnet 이면 judge = Gemini 권장).
- **Layer C 자가채점**: 별도 호출 없음. 페르소나-LLM(GPT-4o)이 [D] §2-E 형식으로 #4 응답 직후 인라인 출력.
- **원칙**: 같은 벤더 LLM 이 자기 출력물을 채점하지 않을 것 ([B] §6.2 cross-vendor self-judging bias 방지).

---

## 3. 격리 디렉터리 구조

페르소나별로 완전히 격리된 폴더에서 1회 세션을 실행한다. 다른 페르소나 결과가 절대 흘러들어가지 않게.

```
~/.careerpt-sim/
├── prompt/
│   └── system_prompt_v{N}.md           # 라운드별 프롬프트 스냅샷
├── round_{N}/
│   ├── persona_01/
│   │   ├── input.json                  # profile + goal + secret_goal
│   │   ├── prompt_version.txt          # 이 세션이 쓴 프롬프트 버전 = N
│   │   ├── transcript_interview.jsonl  # 매 턴 1줄, role/content/turn_id/timestamp
│   │   ├── recommendations.json        # #3 산출물 (5장 카드)
│   │   ├── actions.json                # #4 산출물 (3~5건, source_seed_id 포함)
│   │   ├── scores_layer_a.json         # 턴별 라벨 + 4 KPI 비율 + LayerA_normalized
│   │   ├── scores_layer_b.json         # #3/#4 검증 결과 + retry/fallback + LayerB_normalized
│   │   ├── scores_layer_c.json         # 4축 자가채점 + rationale + LayerC_normalized
│   │   ├── session_score.json          # 최종 환산값 (Layer A/B/C 합성)
│   │   └── meta.json                   # 모델 ID, 토큰, 비용, 실행 시간
│   ├── persona_02/
│   └── ...
│   ├── persona_34/
│   └── round_summary.json              # 34명 평균/표준편차/비정형 7명 최솟값
└── CHANGELOG_PROMPT.md                 # 라운드 간 프롬프트 diff + 점수 변화
```

### 3.1 메타데이터 ([B] §10 인용)
모든 AI 응답에 `turn_id`, `session_id` (= `round_N_persona_NN`), `prompt_version`, `retry_count`, `fallback_triggered` 부착.

### 3.2 재현성
- 페르소나-LLM 온도: **0.7** (자연스러운 변동 허용)
- 코치-LLM 온도: 명세서 권장값 그대로 (`03.` `04.` `05.` 참조)
- judge 온도: **0** (Layer A) / **0.3** (Layer C, [B] §6.2)
- 시드: `seed = round_N * 100 + persona_id`

---

## 4. MVP (N=1) 실행 절차

### 4.1 페르소나 입력 준비 — Goal 선택 룰
Goal Sheet에 `persona_id`당 goal 3개가 붙어 있다. 라운드 간 변수 통제를 위해 **결정적**으로 1개만 선택:

```
1. goal 3개 중 specificity_level == "medium" 인 것을 우선 선택.
2. medium이 0개거나 2개 이상이면 가장 작은 index 사용.
3. 이렇게 뽑힌 goal을 모든 라운드에서 동일하게 사용 (랜덤 금지).
```

**근거**: high specificity는 echo-back만으로도 풀려서 코칭 실력 변별이 약함. low specificity는 페르소나 책임이 됨. medium이 코치 변별력이 가장 큼. 나머지 2개는 §9 (N=3 확장)에서 활용.

### 4.2 비정형 페르소나 7명 식별
[B] §7.2의 "비정형 7명"은 평균에 가려질 위험이 큰 코너 케이스. 다음 기준으로 지정 (라운드 시작 전 1회 고정):
- `axis_code` 가 희소한 그룹(단어 답·영어 혼용·정서 톤 강함 등)
- `emotional_tone ∈ {exhausted, anxious, defiant, withdrawn}` 등 정서 부담이 큰 페르소나
- `specificity_level == "low"` 이면서 문장이 짧은 페르소나

> **운영자 결정**: 첫 라운드 전에 34명 중 7명을 골라 `~/.careerpt-sim/atypical_personas.txt` 에 persona_id 나열. **루프 중간에 바꾸지 않는다** (종료조건 일관성).
>
> **MVP 초기값 (단일 source of truth)**: `persona_simulator_prompt.md` §4 에 명시된 7명 — 박서연 / 이채린 / 김하은 / 강현수 / 한가람 / 김다은 / 조시현 — 을 그대로 사용하고 동결한다. 비정형 7명 정의는 [D] §4 가 정본이며, baseline 측정 후에도 변경 금지.

### 4.3 실행 순서
```
for round in 1..N_max:
    snapshot system_prompt → prompt/system_prompt_v{round}.md
    for persona_id in 1..34:                       # 병렬 가능. 디렉터리 격리됨
        run_session(persona_id, round)             # §2 흐름
        compute scores_layer_{a,b,c}.json
        compute session_score.json
    aggregate → round_summary.json
    check stop criteria (§5)
    if not met:
        run failure analysis (§6)
        update system_prompt (§7)
        log to CHANGELOG_PROMPT.md
```

병렬도: 페르소나 격리되어 있어 thread/process로 안전하게 병렬. 다만 LLM API rate limit 고려해서 **동시 8 페르소나 권장**.

### 4.4 한 라운드의 정의
**라운드 = 34 페르소나 × 1 세션 + round_summary 생성 + (미달 시) 프롬프트 수정 1회**.
프롬프트 수정이 일어나면 라운드 번호가 +1.

---

## 5. 루프 종료 조건

[B] §7.2 를 그대로 인용:

> 1. **평균 조건**: 34 페르소나 평균 `session_score ≥ 9.0`
> 2. **비정형 안전망**: 비정형 페르소나 7명이 **모두** `session_score ≥ 8.0`

`session_score` 환산식은 [B] §7.1 인용:

> `session_score = 10 × (0.5·LayerA_normalized + 0.3·LayerB_normalized + 0.2·LayerC_normalized)`

각 Layer의 정규화 환산은 [B] §4.1 / §5.3 / §6.3 인용. **본 문서는 환산식을 재정의하지 않는다.**

[B] §7.3 의 한계 박스가 살아있음 — baseline 측정(라운드 1) 후 가중치/임계값 1회 재조정 가능. 그 외에는 동결.

---

## 6. Failure 분석 룰 (9점 미달 시)

라운드 종료 후 `session_score < 9.0` 이면 다음 4개 질문에 **순서대로** 답한다. 답은 `round_{N}/failure_report.md` 에 저장.

### Q1. 어느 Layer가 가장 낮은가?
```
worst_layer = argmin( mean(LayerA_norm), mean(LayerB_norm), mean(LayerC_norm) )
```
- `worst_layer == A` → Q2 로
- `worst_layer == B` → Q3 으로 (#4 시드 풀 위반이 압도적으로 흔함)
- `worst_layer == C` → Q4 로

### Q2. (Layer A) 어떤 안티패턴이 가장 많은가?
[B] §2.2 의 5개 안티패턴 빈도를 집계:
```
top_antipattern = argmax over { advice, solution, interpretation,
                                premature_closure, praise_inflation }
```
각 페르소나별로도 같은 집계. **한 페르소나에서 ≥ 30% 비율**이면 그 페르소나-안티패턴 쌍을 §7의 negative example 시드로 등록.

### Q3. (Layer B) 어떤 명세 위반인가?
다음 순서로 진단:
1. `#4 시드 풀 위반율 > 0` 인 페르소나 명단 — **가장 시급**. `source_seed_id` 가 노출 6개 외 / 가짜 ID 케이스를 따로 집계.
2. `#4 retry_count ≥ 1` 빈도 — 형식 위반 (title/description 길이, tags 개수).
3. `#4 fallback_triggered == true` 페르소나 — 결정적 fallback 발동 (강한 감점).
4. `#3 Step2 retry/fallback` 빈도 — personalized_text 길이/JSON 파싱 실패.

### Q4. (Layer C) 어떤 축이 어떤 페르소나에서 무너지나?
4축 (`overall_value`, `insight_novelty`, `emotional_safety`, `desire_to_return`) × 34 페르소나 행렬. 가장 낮은 cell 5개를 추출. **`emotional_safety ≤ 5` 페르소나는 우선 처리** (ICF 원칙 직접 위반 신호).

### Q5. (모든 Layer 공통) Secret_goal disclosure 가 일어났는가?
- 코치 발화에 페르소나의 `secret_goal` 키워드/표현이 등장했는지 정규식 + 의미 매칭으로 스캔.
- disclosure 발생 시 즉시 **루프 무효** 처리 — 코치-LLM 에 secret_goal 이 새고 있다는 뜻이므로 입력 파이프라인 버그. 프롬프트 수정으로 해결되지 않음.

### 6.1 어떤 페르소나에서 깨지나
모든 Q에 공통으로 `per_persona_score = session_score` 행렬을 보고:
- 하위 5명: 다음 라운드의 negative example 후보
- 비정형 7명 중 < 8.0: **반드시** §7 의 프롬프트 수정에서 다뤄야 함 (종료조건 직결)

### 6.2 어떤 안티패턴이 사라졌나 (회귀 체크)
직전 라운드에서 잡혔던 안티패턴이 이번 라운드에서 부활했는지 비교. 부활하면 §7의 수정이 **다른 문제를 새로 만들었다**는 신호 — 그 수정을 부분 롤백.

---

## 7. Prompt 개선 사이클

### 7.1 1라운드의 수정 절차
```
1. failure_report.md (§6) 읽기
2. 가장 빈도 높은 1~2개 문제만 골라 수정 (한 라운드에 3개 이상 동시 수정 금지)
3. 수정 방식 우선순위:
   a. negative example 추가 (system_prompt 내 "이런 발화는 하지 마세요" 블록)
   b. positive few-shot 추가 또는 교체
   c. 규칙 문구 강화 (예: "한 응답 ≤ 3문장" → "한 응답 정확히 1~3문장")
   d. 가장 마지막: 글로벌 페르소나 원칙 자체 수정 (5원칙 등)
4. diff 를 CHANGELOG_PROMPT.md 에 기록
5. system_prompt_version 증가 → 다음 라운드 실행
```

### 7.2 한 라운드에 3개 이상 수정 금지 이유
여러 변수를 동시에 바꾸면 어느 수정이 효과를 냈는지 분리 불가. Ralph는 "한 수정 → 한 측정"의 인과 추적이 본질.

### 7.3 CHANGELOG_PROMPT.md 형식
```markdown
## v{N} (round {N}, 2026-MM-DD)

**Triggered by**: failure_report.md round_{N-1} 의 [Layer A / 안티패턴 advice]

**Hypothesis**: 페르소나 03·14·22 에서 "X 해보는 건 어때요?" 형식의 advice-as-question 이
                반복됨. 코치 프롬프트에 명시적 금지 예시가 없음.

**Change** (system_prompt §3 안티패턴 블록):
- 추가: '~해보는 건 어떠세요?', '~하시면 좋을 것 같아요' 는 advice 로 분류됨.
       대신 '그 선택을 떠올렸을 때 어떤 느낌이 드세요?' 같은 탐색 질문으로 바꾸세요.

**Expected effect**: advice 비율 12% → 5% 미만. Coaching Ratio 75% → 82% 이상.

**Observed effect (round {N} 측정)**:
- mean session_score: 8.4 → 8.7 (+0.3)
- advice rate: 12% → 6%
- 비정형 7명 최솟값: 7.2 → 7.6 (아직 8.0 미달)

**Decision**: KEEP. 다음 라운드는 비정형 7명 중 최저 페르소나(persona_22)에 집중.
```

### 7.4 A/B 검증 ([B] §9.7 인용)
**v{N-1} vs v{N}** 를 동일한 34 페르소나 + 동일 시드로 비교. session_score 차이가 0.2 미만이면 "효과 없음"으로 판정하고 그 변경은 롤백 후보.

### 7.5 라운드 상한
N_max = 10 라운드. 10라운드 후에도 9.0 미달이면 **루프 일시 중단** → [B] §7.3 의 한계 박스에 따라 가중치/임계값 재조정 검토.

---

## 8. Archetype 클러스터링 (N=1 결과 활용)

라운드 1 완료 후 34명의 session_score + Layer A/B/C 세부 점수 + 발화 길이/태도 메트릭으로 **3~5개 행동 클러스터**를 만든다.

### 8.1 클러스터링 입력 피처
- mean turn length (페르소나 발화)
- emotional_tone × specificity_level 조합
- Layer A 4 KPI
- Layer C 4축 자가점수
- Top5 강점 도메인 분포 (T/I/R/E 비율)

### 8.2 방법
HDBSCAN 또는 KMeans(k=4 가정). 결과는 `~/.careerpt-sim/archetypes_round_{N}.json`:
```json
{
  "cluster_0": { "label": "짧고 방어적", "personas": [3, 14, 22, ...], "weak_layer": "C-emotional_safety" },
  "cluster_1": { "label": "장황하고 분석적", "personas": [...], "weak_layer": "A-premature_closure" },
  ...
}
```

### 8.3 용도
- §6 Failure 분석에서 "어떤 페르소나에서 깨지나"를 **개별 페르소나가 아니라 클러스터 단위**로 본다.
- §9 N=3 확장 단계에서 비정형 클러스터에 가중치.

---

## 9. N=3 확장 단계

N=1 으로 `session_score ≥ 9.0` (또는 충분히 안정) 도달 후 진행.

### 9.1 목적
같은 페르소나를 3회 반복했을 때 **점수 분산(variance)** 을 측정. 평균은 9.0인데 표준편차가 1.5라면 운에 가까운 9.0임.

### 9.2 실행
- 34 페르소나 × 3 반복 = 102 세션 = 1 라운드
- 3 반복은:
  1. Goal Sheet 의 goal_1 (medium, §4.1 으로 뽑힌 것)
  2. Goal Sheet 의 goal_2 (남은 2개 중 첫 번째)
  3. Goal Sheet 의 goal_3 (남은 2개 중 두 번째)
- 각 반복의 시드 다름. 코치 프롬프트는 동일.

### 9.3 합격 기준
- 각 페르소나의 3회 평균 `session_score ≥ 9.0`
- 각 페르소나의 3회 표준편차 `≤ 0.5`
- 비정형 7명의 3회 평균 `≥ 8.0` AND 표준편차 `≤ 0.7`

### 9.4 N=3 단계의 클러스터 가중치
§8 에서 만든 비정형 클러스터 페르소나는 N=3 에서 **추가로 2회 더 돌려 총 5회** 측정. 분산 추정 신뢰도 보강.

---

## 10. 비용 추정 (Sonnet 기준)

### 10.1 1 세션 비용 (코칭 spec §4 인용 + judge 비용 추가)
| 항목 | 비용 | 메모 |
|---|---:|---|
| #2 인터뷰 (캐시 사용) | $0.034 | 페어 컨텍스트 캐시 |
| #3 역량 도출 (Step 2 AI) | $0.023 | |
| #4 액션 (week=1 1회) | $0.029 | |
| 페르소나-LLM 발화 (인터뷰 6턴+페어 follow-up) | $0.040 | Sonnet 가정 |
| Layer A judge (GPT-4o, 평균 12턴) | $0.015 | cross-vendor |
| Layer C 자가채점 (GPT-4o, 트랜스크립트 1회) | $0.012 | |
| **합계 / 세션** | **$0.153** | ≈ 약 210원 |

### 10.2 1 라운드 (N=1 = 34 세션)
- $0.153 × 34 = **$5.20 / 라운드**

### 10.3 10 라운드 (N=1 만으로 종료조건 도달 가정)
- $5.20 × 10 = **$52**

### 10.4 N=3 확장 1 라운드 (102 세션)
- $0.153 × 102 = **$15.60 / 라운드**

### 10.5 전체 예산 (보수적 추정)
- N=1 10 라운드 + N=3 3 라운드 = $52 + $47 = **약 $100**
- 비정형 클러스터 추가 2회 + 인간 라벨링(kappa 측정) 비용은 별도

> 캐시 미스, 재시도, 토큰 초과 등을 감안하면 **× 1.5 버퍼**해서 $150 예산 잡는 게 안전.

---

## 부록 A. 입력/산출물 파일 목록 (요약)

**입력**:
- `personas_with_goals.jsonl` — persona_id 1~34, 각 3 goal 변형
- `CliftonStrengths_34_페르소나_*.xlsx` — Top5 강점 + 시뮬레이션 주의사항 시트
- `system_prompt.md` — 개선 대상
- `03. career_interview.md`, `04.competency_analysis.md`, `05_action_item.md` — 고정
- `AI_COACH_SCORING_v2.md` — 평가 룰북 (인용 전용)

**산출물**:
- `~/.careerpt-sim/prompt/system_prompt_v{N}.md`
- `~/.careerpt-sim/round_{N}/persona_NN/*` (§3 트리)
- `~/.careerpt-sim/round_{N}/round_summary.json`
- `~/.careerpt-sim/round_{N}/failure_report.md`
- `~/.careerpt-sim/CHANGELOG_PROMPT.md`
- `~/.careerpt-sim/atypical_personas.txt` (라운드 시작 전 1회 고정)
- `~/.careerpt-sim/archetypes_round_{N}.json` (§8)

---

*v1 — 2026-05-14 작성. ralph-loop 운영 룰북. [B] AI_COACH_SCORING_v2 의 평가 룰을 그대로 인용하며, 본 문서는 평가식을 재정의하지 않는다.*
