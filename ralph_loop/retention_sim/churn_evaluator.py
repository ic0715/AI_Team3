"""생성된 시나리오를 바탕으로 각 hook의 재방문 효과를 Claude가 평가한다.

입력: ~/.careerpt-sim/churn_b/scenarios.json   (churn_scenario_gen.py 산출물)
출력: ~/.careerpt-sim/churn_b/evaluation.json  (시나리오별 hook 평가 전체)

평가 단위:
  - scenarios.json 내 시나리오 1개 × hook 1개 = Claude 호출 1회
  - 4개 hook(none / push_notification / weekly_coaching_cta / streak_badge)
  - none hook은 API 호출 없이 기본값 처리 (비용 절감)
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

_RALPH_ROOT = Path(__file__).resolve().parents[1]
if str(_RALPH_ROOT) not in sys.path:
    sys.path.insert(0, str(_RALPH_ROOT))

import anthropic
from careerpt_sim.config import ANTHROPIC_API_KEY, SIM_HOME
from retention_sim.prompts.scenario_gen import HOOK_EVAL_SYSTEM, HOOK_MESSAGES

CHURN_B_DIR = SIM_HOME / "churn_b"
SCENARIOS_PATH = CHURN_B_DIR / "scenarios.json"
EVAL_PATH = CHURN_B_DIR / "evaluation.json"

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 400

HOOKS = list(HOOK_MESSAGES.keys())


# ---------------------------------------------------------------------------
# 클라이언트
# ---------------------------------------------------------------------------

def _client() -> anthropic.Anthropic:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in .env")
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ---------------------------------------------------------------------------
# 유틸
# ---------------------------------------------------------------------------

def _parse_json(text: str) -> dict | None:
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    raw = m.group(1) if m else text
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        return None
    try:
        return json.loads(raw[start:end])
    except json.JSONDecodeError:
        return None


def _build_user_msg(scenario: dict, hook_type: str, hook_msg: str | None) -> str:
    """시나리오 + hook 1개를 유저 메시지로 조립."""
    hook_str = hook_msg if hook_msg is not None else "(메시지 없음)"
    return "\n".join([
        f"[유저 상황]",
        f"페르소나 타입: {scenario.get('persona_type', '')}",
        f"이탈 위기 주차: Week {scenario.get('week', '?')}",
        f"감정 상태: {scenario.get('emotional_tone', '')}",
        f"이탈 트리거: {scenario.get('trigger', '')}",
        f"상황: {scenario.get('situation', '')}",
        f"마지막 앱 행동: {scenario.get('last_app_behavior', '')}",
        f"현재 이탈 확률: {scenario.get('churn_probability', '?')}",
        "",
        f"[받은 hook]",
        f"hook_type: {hook_type}",
        f"메시지: {hook_str}",
    ])


# ---------------------------------------------------------------------------
# hook 1개 평가
# ---------------------------------------------------------------------------

def _eval_one_hook(
    client: anthropic.Anthropic,
    scenario: dict,
    hook_type: str,
    hook_msg: str | None,
) -> dict:
    """hook 1개에 대한 Claude 평가를 반환한다."""
    # none hook은 API 호출 없이 기본값
    if hook_type == "none":
        return {
            "hook_type": "none",
            "hook_responded": False,
            "response_reason": "아무 메시지도 받지 않아 앱을 열 계기가 없다.",
            "churn_probability_after_hook": scenario.get("churn_probability", 0.7),
            "suggested_improvement": None,
        }

    user_msg = _build_user_msg(scenario, hook_type, hook_msg)
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=[
            {
                "type": "text",
                "text": HOOK_EVAL_SYSTEM,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_msg}],
    )
    text = response.content[0].text.strip()
    parsed = _parse_json(text)
    if parsed is None:
        parsed = {"parse_error": True, "raw": text, "hook_type": hook_type}
    else:
        parsed.setdefault("hook_type", hook_type)
    return parsed


# ---------------------------------------------------------------------------
# 시나리오 1개 평가
# ---------------------------------------------------------------------------

def evaluate_scenario(
    client: anthropic.Anthropic,
    scenario: dict,
) -> dict:
    """시나리오 1개에 대해 모든 hook을 평가하고 결과를 반환한다."""
    hook_evals: dict[str, dict] = {}
    for hook_type, hook_msg in HOOK_MESSAGES.items():
        result = _eval_one_hook(client, scenario, hook_type, hook_msg)
        hook_evals[hook_type] = result

    return {
        "scenario_id": scenario.get("scenario_id", ""),
        "persona_type": scenario.get("persona_type", ""),
        "week": scenario.get("week"),
        "emotional_tone": scenario.get("emotional_tone", ""),
        "churn_probability_before": scenario.get("churn_probability"),
        "churn_reason": scenario.get("churn_reason", ""),
        "hook_evaluations": hook_evals,
    }


# ---------------------------------------------------------------------------
# 메인 실행 함수
# ---------------------------------------------------------------------------

def run_hook_evaluation(force: bool = False) -> list[dict]:
    """scenarios.json을 읽어 전체 hook 평가를 실행하고 evaluation.json에 저장한다."""
    if not SCENARIOS_PATH.exists():
        print(f"오류: {SCENARIOS_PATH} 없음. churn_scenario_gen.py를 먼저 실행하세요.")
        return []

    if EVAL_PATH.exists() and not force:
        print(f"[churn_evaluator] 기존 결과 로드: {EVAL_PATH}")
        return json.loads(EVAL_PATH.read_text(encoding="utf-8"))

    scenarios = json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))
    client = _client()
    results: list[dict] = []
    total = len(scenarios)

    print(f"[churn_evaluator] 모델: {MODEL}  시나리오: {total}개 × {len(HOOKS)}개 hook")
    for i, scenario in enumerate(scenarios, 1):
        pid = scenario.get("persona_type", f"scenario_{i}")
        week = scenario.get("week", "?")
        print(f"  [{i}/{total}] {pid} (week {week})")
        for hook_type in HOOKS:
            if hook_type == "none":
                print(f"    - {hook_type:<28} 기본값 처리")
                continue
            print(f"    - {hook_type:<28} ...", end=" ", flush=True)
            t0 = time.time()
            one = _eval_one_hook(client, scenario, hook_type, HOOK_MESSAGES[hook_type])
            elapsed = round(time.time() - t0, 2)
            responded = one.get("hook_responded", "?")
            prob_after = one.get("churn_probability_after_hook", "?")
            print(f"응답={responded}  이탈확률={prob_after}  ({elapsed}s)")

        result = evaluate_scenario(client, scenario)
        # hook_evals 중 none은 이미 기본값이 들어가 있음
        results.append(result)

    CHURN_B_DIR.mkdir(parents=True, exist_ok=True)
    EVAL_PATH.write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n[churn_evaluator] 저장: {EVAL_PATH}")
    return results


# ---------------------------------------------------------------------------
# 요약 출력
# ---------------------------------------------------------------------------

def print_summary(results: list[dict]) -> None:
    print("\n-- Hook 효과 요약 --")
    hook_stats: dict[str, list] = {h: [] for h in HOOKS}
    for r in results:
        for hook_type, ev in r.get("hook_evaluations", {}).items():
            if not ev.get("parse_error"):
                hook_stats[hook_type].append({
                    "responded": ev.get("hook_responded", False),
                    "prob_after": ev.get("churn_probability_after_hook", 0.0),
                })

    for hook_type in HOOKS:
        items = hook_stats[hook_type]
        if not items:
            continue
        reopen_rate = sum(1 for x in items if x["responded"]) / len(items)
        avg_prob = sum(x["prob_after"] for x in items) / len(items)
        print(
            f"  {hook_type:<28}"
            f"  재방문률 {reopen_rate*100:5.1f}%"
            f"  평균 이탈확률(hook후) {avg_prob:.2f}"
        )
    print("-------------------")


# ---------------------------------------------------------------------------
# CLI (단독 실행용)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Hook 효과 평가")
    parser.add_argument("--force", action="store_true", help="기존 결과 무시하고 재평가")
    args = parser.parse_args()

    results = run_hook_evaluation(force=args.force)
    if results:
        print_summary(results)
