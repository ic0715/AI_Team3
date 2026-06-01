"""CLI 진입점 — AI-native 이탈 시나리오 분석 오케스트레이터.

사용법:
  # 시나리오 생성 + hook 평가 (기본)
  python -m retention_sim.churn_runner --count 5

  # 시나리오 생성만
  python -m retention_sim.churn_runner --count 5 --skip-eval

  # 기존 결과 무시하고 강제 재실행
  python -m retention_sim.churn_runner --count 5 --force

산출물 (~/.careerpt-sim/churn_b/):
  scenarios.json   — 이탈 시나리오 목록 (churn_scenario_gen)
  evaluation.json  — 시나리오별 hook 효과 평가 (churn_evaluator)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

_RALPH_ROOT = Path(__file__).resolve().parents[1]
if str(_RALPH_ROOT) not in sys.path:
    sys.path.insert(0, str(_RALPH_ROOT))

from careerpt_sim.config import SIM_HOME
from retention_sim.churn_scenario_gen import SCENARIO_TEMPLATES, generate_scenarios, save
from retention_sim.churn_evaluator import (
    CHURN_B_DIR,
    EVAL_PATH,
    print_summary,
    run_hook_evaluation,
)

CHURN_B_DIR = SIM_HOME / "churn_b"


# ---------------------------------------------------------------------------
# 비용 추정
# ---------------------------------------------------------------------------

# claude-haiku-4-5 기준
_IN_PER_1K  = 0.0008   # 캐시 미스
_IN_CACHED  = 0.00008  # 캐시 히트
_OUT_PER_1K = 0.004

_SC_IN_TOK  = 350   # 시스템(캐시) + 유저
_SC_OUT_TOK = 350   # 시나리오 JSON
_EV_IN_TOK  = 400   # 시스템(캐시) + 유저
_EV_OUT_TOK = 200   # hook 평가 JSON (hook 1개)
_N_HOOKS    = 3     # none은 API 미호출, 나머지 3개


def _estimate_cost(count: int, skip_eval: bool) -> float:
    sc_cost = (
        _SC_IN_TOK / 1000 * _IN_PER_1K
        + _SC_IN_TOK / 1000 * _IN_CACHED * max(0, count - 1)
        + _SC_OUT_TOK / 1000 * _OUT_PER_1K
    ) * count
    ev_cost = 0.0
    if not skip_eval:
        ev_cost = (
            _EV_IN_TOK / 1000 * _IN_PER_1K
            + _EV_IN_TOK / 1000 * _IN_CACHED * max(0, count * _N_HOOKS - 1)
            + _EV_OUT_TOK / 1000 * _OUT_PER_1K
        ) * count * _N_HOOKS
    return round(sc_cost + ev_cost, 4)


# ---------------------------------------------------------------------------
# 시나리오 요약 출력
# ---------------------------------------------------------------------------

def _print_scenario_summary(scenarios: list[dict]) -> None:
    print("\n-- 시나리오 생성 결과 --")
    for sc in scenarios:
        if sc.get("parse_error") or sc.get("error"):
            print(f"  [FAIL] {sc.get('persona_type', '?')}")
        else:
            print(
                f"  [OK]   {sc.get('persona_type', '?'):<28}"
                f"  week={sc.get('week', '?')}"
                f"  churn_prob={sc.get('churn_probability', '?')}"
            )
    print("------------------------")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="CareerPT AI-native 이탈 시나리오 분석")
    parser.add_argument(
        "--count", type=int, default=5,
        help=f"생성할 시나리오 수 (최대 {len(SCENARIO_TEMPLATES)}, 기본 5)",
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

    count = min(args.count, len(SCENARIO_TEMPLATES))
    est = _estimate_cost(count, args.skip_eval)

    print("[churn_runner] 실행 계획")
    print(f"  시나리오 수: {count}개")
    print(f"  단계: 시나리오 생성" + ("" if args.skip_eval else " + hook 평가 (hook당 1회 API 호출)"))
    print(f"  예상 비용: ~${est}  (Haiku 기준, 캐시 히트 가정)")
    print(f"  출력 경로: {CHURN_B_DIR}")
    print()

    # 1단계: 시나리오 생성
    print("[1/2] 시나리오 생성")
    scenarios = generate_scenarios(count)
    scenarios_path = save(scenarios)
    _print_scenario_summary(scenarios)
    print(f"  저장: {scenarios_path}")

    # 2단계: hook 평가
    if not args.skip_eval:
        print("\n[2/2] Hook 효과 평가")
        results = run_hook_evaluation(force=args.force)
        if results:
            print_summary(results)
            print(f"  저장: {EVAL_PATH}")
    else:
        print("\n[2/2] hook 평가 생략 (--skip-eval)")

    print(f"\n완료. 결과 경로: {CHURN_B_DIR}")


if __name__ == "__main__":
    main()
