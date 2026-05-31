# ralph_loop — CareerPT 코치 평가 하니스

`AI_Team3` 안에서 **`docs/ai_prompt/system_prompt.md` 코치 프롬프트를 34 페르소나 시뮬레이션으로 평가·개선하는 ralph-loop 하니스**.

이 폴더는 Python 패키지이며 **Next.js 앱(`web/`)과는 무관**합니다 — 추가만 될 뿐 기존 빌드·배포에 영향 없음.

## 명세서 위치 (source of truth)

| 무엇 | 어디 | 비고 |
|---|---|---|
| 평가 룰북 | `docs/ralph_loop/AI_COACH_SCORING_v2.md` | 3-Layer 평가 (A/B/C) 정의 + 종료 조건 |
| 페르소나-LLM 룰북 | `docs/ralph_loop/persona_simulator_prompt.md` | GPT-4o가 페르소나 연기할 때 따라야 할 규칙 |
| 운영 룰북 | `docs/ralph_loop/ralph_loop_spec.md` | 라운드 흐름, failure 분석, 비용 추정 |
| 페르소나 엑셀 | `docs/ralph_loop/CliftonStrengths_*.xlsx` | 34명 × 23 컬럼 + Goal 시트 102행 |
| 코치 명세서 | `docs/ai_prompt/03./04./05.*.md` | 인터뷰/카드/액션 명세 (코치-LLM 컨텍스트) |
| 12 역량 / 시드 액션 | `web/lib/constants/competencies.ts`, `seeds.ts` | TS 원본을 Python에서 regex로 파싱 |

이 하니스는 **원본을 절대 수정하지 않음** — 라운드 별 system_prompt 개선분은 `ralph_loop/prompt/system_prompt_v{N}.md`에 스냅샷으로 누적되고, 적용은 별도 PR로 `docs/ai_prompt/system_prompt.md` 에 반영합니다.

## 폴더 구조

```
ralph_loop/
├── README.md                  ← 이 파일
├── requirements.txt
├── .env.example               (.env 는 .gitignore — 실제 API 키)
├── .gitignore
├── careerpt_sim/              Python 패키지
│   ├── config.py              repo 안 상대경로로 spec/엑셀/시드 참조
│   ├── build_personas.py      엑셀 → personas_with_goals.jsonl
│   ├── coach.py               Claude Sonnet 코치 (prompt caching 적용)
│   ├── persona_llm.py         GPT-4o 페르소나 시뮬레이터 + Layer C 인라인 채점 파서
│   ├── eval_a.py              Layer A judge (Gemini 또는 Claude Haiku 선택 가능)
│   ├── eval_b.py              Layer B 결정적 검증 (#3 카드 + #4 시드 풀)
│   ├── eval_c.py              Layer C 정규화
│   ├── score.py               composite session_score
│   ├── session.py             1세션 풀 파이프라인
│   ├── run_pilot.py           파일럿 진입점 (--one ID / 비정형 7명 / 전체 34명)
│   ├── rescore.py             기존 세션 트랜스크립트 재채점 (cheap)
│   ├── export_transcripts.py  세션 → 마크다운 (대화 + 라벨 + 점수)
│   └── seeds.py / score.py / __init__.py
├── prompt/
│   └── system_prompt_v1.md    Round 1 baseline (live docs/ai_prompt/system_prompt.md 스냅샷)
└── data/
    ├── personas_with_goals.jsonl  엑셀 변환 산출물
    └── atypical_personas.txt      비정형 7명 ID (4, 10, 15, 17, 22, 30, 31)
```

## 설치

```powershell
cd ralph_loop
pip install -r requirements.txt
copy .env.example .env
# .env 편집: ANTHROPIC_API_KEY, OPENAI_API_KEY, (선택) GEMINI_API_KEY
```

⚠️ **Claude Code 셸 환경변수가 .env 를 덮어쓸 수 있음**. 별도 PowerShell 세션에서 실행 권장.

## 사용

```powershell
# 페르소나 JSONL 빌드 (한 번만)
python -m careerpt_sim.build_personas

# 단일 페르소나 스모크 (라운드 1 = 캐싱 활성화 후 첫 실행 권장)
python -m careerpt_sim.run_pilot --one 1 --round 1

# 비정형 7명 파일럿
python -m careerpt_sim.run_pilot --round 1

# 결과 마크다운으로
python -m careerpt_sim.export_transcripts --round 1
```

산출물은 `~/.careerpt-sim/round_{N}/persona_{NN}/` 에 격리 저장됩니다 (워크스페이스 외부 — 리포 size 영향 없음).

## 평가 구조 (3-Layer)

| Layer | 대상 | 도구 | 모델 (기본값) |
|---|---|---|---|
| A | 코치 1턴 발화 | LLM-as-judge | Claude Haiku (env: `JUDGE_MODEL`) |
| B | #3 카드 + #4 액션 JSON | 결정적 코드 | (AI 호출 없음) |
| C | 페르소나 자가평가 4축 | 페르소나-LLM 인라인 출력 | GPT-4o |

`session_score = 10 × (0.5·A + 0.3·B + 0.2·C)`

**종료 조건** (`docs/ralph_loop/ralph_loop_spec.md §5`):
- 34명 평균 `session_score ≥ 9.0`
- AND 비정형 7명 모두 `session_score ≥ 8.0`

⚠️ **Judge 모델 주의**: cross-vendor 원칙(`AI_COACH_SCORING_v2.md §3.1`) 충족하려면 코치(Anthropic) ≠ 페르소나(OpenAI) ≠ judge 가 이상적. Gemini billing 미등록 시 Claude Haiku 사용 가능하지만 self-judging bias 위험.

## 비용 (Sonnet 4.5 + prompt caching 적용 후)

| 항목 | 비용 |
|---|---|
| 1세션 (인터뷰 14턴 + 카드 + 액션 + 페르소나 + judge) | **~$0.50** |
| 비정형 7명 파일럿 | ~$3.5 |
| 34명 baseline 1라운드 | ~$17 |
| 10라운드 N=1 | ~$170 |

(`docs/ralph_loop/ralph_loop_spec.md §10` 의 $52 추정은 더 적극적인 캐싱·짧은 인터뷰 가정 — 실제는 위가 보수적 추정)

## 알려진 한계

1. **시드 풀 25/72**: `web/lib/constants/seeds.ts` 가 5 역량만 채워짐. 슬롯 4·5 액션 다양성 제한
2. **Step 1 match_score**: `linked_strengths` 교집합 크기 (단순화)
3. **`finalize → cards Step1`**: `mentioned_competencies` 가 finalize 호출 결과에 의존 — 빈 배열이면 slot 4 자동 fallback
4. **인터뷰 종료**: H-키워드 미감지 시 14턴 상한에서 강제 종료 (`MAX_INTERVIEW_TURNS` 조정 가능)

## 다음 단계 (구현 안 됨)

- `failure_report.md` 자동 생성 (`docs/ralph_loop/ralph_loop_spec.md §6`)
- 프롬프트 개선 사이클 자동화 (현재 라운드 1 baseline만; v2/v3 작성·diff는 수동)
- secret_goal disclosure 자동 스캔 (§6 Q5)
- archetype 클러스터링 (§8)
- N=3 확장 (§9)
- kappa 측정용 인간 라벨링 도구
