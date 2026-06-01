"""생성된 시나리오를 바탕으로 각 hook의 재방문 효과를 Claude가 평가한다.

입력: ~/.careerpt-sim/churn_ai/scenarios/persona_{id}.json
출력: ~/.careerpt-sim/churn_ai/hook_eval/persona_{id}.json
      ~/.careerpt-sim/churn_ai/hook_eval/summary.json

평가 단위:
  - 이탈 위기 주차(churn_week)가 있는 페르소나만 평가
  - 4가지 hook(none / push_notification / weekly_coaching_cta / streak_badge)을 한 번에 제시
  - Claude가 각 hook별로 재방문 여부 + 이유를 판단
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
from careerpt_sim.config import ANTHROPIC_API_KEY, COACH_MODEL, SIM_HOME
from retention_sim.prompts.scenario_gen import HOOK_EVAL_SYSTEM, HOOK_MESSAGES

AI_OUT_DIR = SIM_HOME / "churn_ai"
SCENARIOS_DIR = AI_OUT_DIR / "scenarios"
EVAL_DIR = AI_OUT_DIR / "hook_eval"

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

def _parse_eval(text: str) -> dict | None:
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


def _build_hooks_block() -> str:
    """hook 목록을 유저 메시지용 텍스트로 포맷."""
    lines = []
    for hook_id, msg in HOOK_MESSAGES.items():
        msg_str = msg if msg is not None else "(메시지 없음)"
        lines.append(f"- hook_type: {hook_id}\n  메시지: {msg_str}")
    return "\n".join(lines)


def _extract_churn_context(scenario_result: dict) -> dict | None:
    """시나리오에서 이탈 위기 컨텍스트를 추출. 없으면 None."""
    sc = scenario_result.get("scenario", {})
    if sc.get("parse_error"):
        return None

    churn_week = sc.get("churn_week")
    weeks = sc.get("weeks", [])

    # churn_week이 없으면 (12주 내내 잔존) → 이탈 위기 주차를 retention_prob 최저 주차로 대체
    if churn_week is None:
        if not weeks:
            return None
        worst = min(weeks, key=lambda w: w.get("retention_prob", 1.0))
        churn_week = worst["week"]
        churn_reason = worst.get("reason", "명시적 이탈 없음")
        emotional_state = worst.get("emotional_state", "")
        # 12주 잔존 → hook 효과 분석 의미 낮음을 표시
        is_eventual_churn = False
    else:
        # churn_week 직전 주의 감정 상태 사용
        prev_weeks = [w for w in weeks if w["week"] == churn_week - 1]
        if prev_weeks:
            emotional_state = prev_weeks[0].get("emotional_state", "")
        else:
            emotional_state = weeks[0].get("emotional_state", "") if weeks else ""
        churn_reason = sc.get("primary_churn_reason", "")
        is_eventual_churn = True

    return {
        "churn_week": churn_week,
        "emotional_state": emotional_state,
        "churn_reason": churn_reason,
        "is_eventual_churn": is_eventual_churn,
    }


# ---------------------------------------------------------------------------
# Claude 호출
# ---------------------------------------------------------------------------

def _call_hook_eval(
    client: anthropic.Anthropic,
    persona_result: dict,
    churn_ctx: dict,
    model: str,
) -> tuple[str, dict]:
    nickname = persona_result.get("nickname", "unknown")
    scores = persona_result.get("scores", {})

    hooks_block = _build_hooks_block()
    user_msg = "\n".join([
        f"닉네임: {nickname}",
        f"이탈/위기 주차: Week {churn_ctx['churn_week']}",
        f"이 시점의 감정 상태: {churn_ctx['emotional_state']}",
        f"이탈 이유: {churn_ctx['churn_reason']}",
        f"desire_to_return: {scores.get('desire_to_return', 'N/A')}/10",
        f"emotional_safety: {scores.get('emotional_safety', 'N/A')}/10",
        "",
        "평가할 hook 목록:",
        hooks_block,
    ])

    response = client.messages.create(
        model=model,
        max_tokens=1024,
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
    usage = {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "cache_creation_input_tokens": getattr(response.usage, "cache_creation_input_tokens", 0),
        "cache_read_input_tokens": getattr(response.usage, "cache_read_input_tokens", 0),
    }
    return text, usage


# ---------------------------------------------------------------------------
# 메인 평가 함수
# ---------------------------------------------------------------------------

def evaluate_hooks(
    persona_result: dict,
    client: anthropic.Anthropic,
    model: str,
    out_dir: Path,
    force: bool = False,
) -> dict | None:
    pid = persona_result["persona_id"]
    out_path = out_dir / f"persona_{pid:02d}.json"

    if out_path.exists() and not force:
        return json.loads(out_path.read_text(encoding="utf-8"))

    churn_ctx = _extract_churn_context(persona_result)
    if churn_ctx is None:
        print("  (시나리오 파싱 실패 또는 데이터 없음 — 스킵)")
        return None

    t0 = time.time()
    raw_text, usage = _call_hook_eval(client, persona_result, churn_ctx, model)
    elapsed = round(time.time() - t0, 2)

    parsed = _parse_eval(raw_text)
    if parsed is None:
        parsed = {"parse_error": True, "raw": raw_text}

    result = {
        "persona_id": pid,
        "nickname": persona_result.get("nickname"),
        "is_atypical": persona_result.get("is_atypical", False),
        "churn_context": churn_ctx,
        "hook_eval": parsed,
        "meta": {
            "model": model,
            "elapsed_sec": elapsed,
            "usage": usage,
        },
    }
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def run_hook_evaluation(
    persona_ids: list[int] | None = None,
    model: str | None = None,
    force: bool = False,
) -> list[dict]:
    """시나리오가 있는 페르소나의 hook 효과를 평가한다."""
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    client = _client()
    model = model or COACH_MODEL

    # 시나리오 파일 수집
    if persona_ids:
        sc_files = [SCENARIOS_DIR / f"persona_{pid:02d}.json" for pid in persona_ids]
    else:
        sc_files = sorted(SCENARIOS_DIR.glob("persona_*.json"))

    if not sc_files:
        print("시나리오 파일 없음. churn_scenario_gen.py를 먼저 실행하세요.")
        return []

    results: list[dict] = []
    total = len(sc_files)
    for i, sc_file in enumerate(sc_files, 1):
        if not sc_file.exists():
            print(f"  [{i}/{total}] {sc_file.name} 없음 — 스킵")
            continue
        persona_result = json.loads(sc_file.read_text(encoding="utf-8"))
        pid = persona_result["persona_id"]
        nickname = persona_result.get("nickname", "")
        print(f"  [{i}/{total}] persona_{pid:02d} {nickname} hook 평가 ...", end=" ", flush=True)
        r = evaluate_hooks(persona_result, client, model, EVAL_DIR, force=force)
        if r:
            cached = r["meta"]["usage"].get("cache_read_input_tokens", 0)
            print(f"완료 ({r['meta']['elapsed_sec']}s, cache_read={cached}tok)")
            results.append(r)

    if results:
        _save_summary(results)
    return results


def _save_summary(results: list[dict]) -> None:
    """hook별 평균 reopen_prob + 재방문 성공률 요약."""
    hook_stats: dict[str, dict] = {h: {"reopen_probs": [], "would_reopen": []} for h in HOOKS}

    for r in results:
        hooks_data = r.get("hook_eval", {}).get("hooks", [])
        for h in hooks_data:
            hid = h.get("hook_id")
            if hid in hook_stats:
                hook_stats[hid]["reopen_probs"].append(h.get("reopen_prob", 0.0))
                hook_stats[hid]["would_reopen"].append(1 if h.get("would_reopen") else 0)

    summary: dict[str, dict] = {}
    for hid, stats in hook_stats.items():
        probs = stats["reopen_probs"]
        reopens = stats["would_reopen"]
        summary[hid] = {
            "label": HOOK_MESSAGES.get(hid, hid),
            "n_evaluated": len(probs),
            "mean_reopen_prob": round(sum(probs) / len(probs), 3) if probs else 0.0,
            "reopen_rate": round(sum(reopens) / len(reopens), 3) if reopens else 0.0,
        }

    out = {"n_personas": len(results), "hook_summary": summary}
    (EVAL_DIR / "summary.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n  요약 저장: {EVAL_DIR / 'summary.json'}")
