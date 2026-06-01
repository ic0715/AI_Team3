"""CLI 진입점 — AI-native 이탈 시나리오 분석 오케스트레이터.

사용법:
  # 전체 34명 시나리오 생성 + hook 평가
  python -m retention_sim.churn_runner

  # 특정 페르소나만 (빠른 테스트)
  python -m retention_sim.churn_runner --personas 1 3 5

  # 시나리오 생성만 (hook 평가 생략)
  python -m retention_sim.churn_runner --personas 1 2 3 --skip-eval

  # 기존 결과 무시하고 강제 재생성
  python -m retention_sim.churn_runner --personas 1 --force

산출물 (~/.careerpt-sim/churn_ai/):
  scenarios/persona_{id:02d}.json   — 12주 이탈 시나리오
  hook_eval/persona_{id:02d}.json   — hook별 재방문 평가
  hook_eval/summary.json            — hook 효과 집계
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_RALPH_ROOT = Path(__file__).resolve().parents[1]
if str(_RALPH_ROOT) not in sys.path:
    sys.path.insert(0, str(_RALPH_ROOT))

from careerpt_sim.config import COACH_MODEL, SIM_HOME
from retention_sim.churn_scenario_gen import SCENARIOS_DIR, run_scenario_gen
from retention_sim.churn_evaluator import EVAL_DIR, run_hook_evaluation

AI_OUT_DIR = SIM_HOME / "churn_ai"


# ---------------------------------------------------------------------------
# 비용 추정 (실행 전 출력)
# ---------------------------------------------------------------------------

_COST_PER_1K_INPUT  = 0.003   # claude-sonnet-4-5 기준 (캐시 미스)
_COST_PER_1K_CACHED = 0.0003  # 캐시 히트 시
_COST_PER_1K_OUTPUT = 0.015

_SCENARIO_INPUT_TOK  = 900    # 시스템 프롬프트(캐시) + 유저 메시지
_SCENARIO_OUTPUT_TOK = 700    # 12주 JSON
_EVAL_INPUT_TOK      = 700    # 시스템(캐시) + 유저
_EVAL_OUTPUT_TOK     = 400    # 4 hook JSON


def _estimate_cost(n: int, skip_eval: bool) -> float:
    # 첫 호출만 캐시 미스, 나머지는 캐시 히트 가정
    sc_cost = (
        _SCENARIO_INPUT_TOK / 1000 * _COST_PER_1K_INPUT     # 캐시 미스 첫 1회
        + _SCENARIO_INPUT_TOK / 1000 * _COST_PER_1K_CACHED * max(0, n - 1)
        + _SCENARIO_OUTPUT_TOK / 1000 * _COST_PER_1K_OUTPUT
    ) * n
    eval_cost = 0.0
    if not skip_eval:
        eval_cost = (
            _EVAL_INPUT_TOK / 1000 * _COST_PER_1K_INPUT
            + _EVAL_INPUT_TOK / 1000 * _COST_PER_1K_CACHED * max(0, n - 1)
            + _EVAL_OUTPUT_TOK / 1000 * _COST_PER_1K_OUTPUT
        ) * n
    return round(sc_cost + eval_cost, 4)


# ---------------------------------------------------------------------------
# 결과 요약 출력
# ---------------------------------------------------------------------------

def _print_scenario_summary(scenario_results: list[dict]) -> None:
    print("\n── 시나리오 생성 결과 ──────────────────────────────")
    churn_weeks = []
    for r in scenario_results:
        sc = r.get("scenario", {})
        cw = sc.get("churn_week")
        churn_weeks.append(cw)
        cw_str = f"Week {cw}" if cw else "잔존(12주+)"
        reason = (sc.get("primary_churn_reason") or "")[:40]
        print(f"  persona_{r['persona_id']:02d} {r.get('nickname',''):<8}"
              f"  이탈:{cw_str:<12}  {reason}")

    actual_churns = [w for w in churn_weeks if w is not None]
    if actual_churns:
        print(f"\n  12주 내 이탈 {len(actual_churns)}/{len(scenario_results)}명"
              f"  평균 이탈 주차: Week {sum(actual_churns)/len(actual_churns):.1f}")
    else:
        print(f"\n  12주 내 이탈 0/{len(scenario_results)}명")


def _print_hook_summary(eval_results: list[dict]) -> None:
    summary_path = EVAL_DIR / "summary.json"
    if not summary_path.exists():
        return
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    print("\n── Hook 효과 평가 결과 ─────────────────────────────")
    for hid, s in summary["hook_summary"].items():
        print(f"  {hid:<28}  재방문률 {s['reopen_rate']*100:5.1f}%"
              f"  평균 확률 {s['mean_reopen_prob']*100:5.1f}%"
              f"  (n={s['n_evaluated']})")
    print("────────────────────────────────────────────────────")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="CareerPT AI-native 이탈 시나리오 분석"
    )
    parser.add_argument(
        "--personas", type=int, nargs="+", metavar="ID",
        help="분석할 페르소나 ID (기본: 전체 34명). 예: --personas 1 3 5",
    )
    parser.add_argument(
        "--model", type=str, default=COACH_MODEL,
        help=f"사용할 Claude 모델 (기본: {COACH_MODEL})",
    )
    parser.add_argument(
        "--skip-eval", action="store_true",
        help="hook 효과 평가 생략 (시나리오 생성만)",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="기존 결과 파일 무시하고 재생성",
    )
    args = parser.parse_args()

    persona_ids: list[int] | None = args.personas
    n = len(persona_ids) if persona_ids else 34

    # 비용 안내
    est = _estimate_cost(n, args.skip_eval)
    print(f"[churn_runner] 실행 계획")
    print(f"  페르소나: {persona_ids or '전체 34명'}")
    print(f"  모델: {args.model}")
    print(f"  단계: 시나리오 생성" + ("" if args.skip_eval else " + hook 평가"))
    print(f"  예상 비용: ~${est} (캐시 히트 가정, 실제 달라질 수 있음)")
    print(f"  출력 경로: {AI_OUT_DIR}")
    print()

    # 1단계: 시나리오 생성
    print("[1/2] 시나리오 생성 (Claude API)")
    scenario_results = run_scenario_gen(
        persona_ids=persona_ids,
        model=args.model,
        force=args.force,
    )
    _print_scenario_summary(scenario_results)

    # 2단계: hook 평가
    if not args.skip_eval:
        print("\n[2/2] Hook 효과 평가 (Claude API)")
        eval_results = run_hook_evaluation(
            persona_ids=persona_ids,
            model=args.model,
            force=args.force,
        )
        _print_hook_summary(eval_results)
    else:
        print("\n[2/2] hook 평가 생략 (--skip-eval)")

    print(f"\n완료. 결과: {AI_OUT_DIR}")


if __name__ == "__main__":
    main()
