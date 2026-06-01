"""Claude API로 페르소나별 12주 이탈 시나리오를 생성한다.

호출 단위: 페르소나 1명 → Claude 1회 → 12주 JSON
프롬프트 캐싱: SYSTEM 블록은 모든 호출에서 동일 → ephemeral cache 적용

산출물: ~/.careerpt-sim/churn_ai/scenarios/persona_{id:02d}.json
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from typing import Any

_RALPH_ROOT = Path(__file__).resolve().parents[1]
if str(_RALPH_ROOT) not in sys.path:
    sys.path.insert(0, str(_RALPH_ROOT))

import anthropic
from careerpt_sim.config import ANTHROPIC_API_KEY, COACH_MODEL, DATA_DIR, SIM_HOME
from retention_sim.prompts.scenario_gen import (
    SCENARIO_GEN_SYSTEM,
    SCENARIO_GEN_USER_TEMPLATE,
)
from retention_sim.simulate import _load_atypical_ids, _synthetic_scores

AI_OUT_DIR = SIM_HOME / "churn_ai"
SCENARIOS_DIR = AI_OUT_DIR / "scenarios"


# ---------------------------------------------------------------------------
# 클라이언트
# ---------------------------------------------------------------------------

def _client() -> anthropic.Anthropic:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in .env")
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ---------------------------------------------------------------------------
# 페르소나 메타 로드
# ---------------------------------------------------------------------------

def _load_persona_full(personas_jsonl: Path) -> dict[int, dict]:
    """JSONL에서 persona 전체 필드를 로드."""
    result: dict[int, dict] = {}
    if not personas_jsonl.exists():
        return result
    with personas_jsonl.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            p = json.loads(line)
            result[int(p["persona_id"])] = p
    return result


def _format_persona_user(
    persona: dict,
    scores: dict,
    is_atypical: bool,
) -> str:
    """SCENARIO_GEN_USER_TEMPLATE을 채워 반환."""
    g = persona.get("selected_goal") or {}
    top5 = persona.get("top5_strengths", [])
    top5_str = " / ".join(top5) if top5 else "정보 없음"

    # 역량 카드·액션은 스코어 데이터에 없으면 placeholder
    top_cards = scores.get("top_cards", "데이터 없음 (합성 스코어 모드)")
    action_items = scores.get("action_items", "데이터 없음 (합성 스코어 모드)")

    return SCENARIO_GEN_USER_TEMPLATE.format(
        nickname=persona.get("nickname", "unknown"),
        job_field=persona.get("current_job_field", ""),
        career_years=persona.get("career_years", ""),
        concern=persona.get("current_concern", ""),
        top5=top5_str,
        strength_core=persona.get("strength_combo_core", ""),
        trigger_type=persona.get("trigger_type", ""),
        session_score=scores.get("session_score", "N/A"),
        desire_to_return=scores.get("desire_to_return", "N/A"),
        emotional_safety=scores.get("emotional_safety", "N/A"),
        insight_novelty=scores.get("insight_novelty", "N/A"),
        top_cards=top_cards,
        action_items=action_items,
        is_atypical="예 (단답·이탈 경향 있음)" if is_atypical else "아니오",
        simulation_note=persona.get("simulation_note") or g.get("emotional_tone", ""),
    )


# ---------------------------------------------------------------------------
# Claude 호출
# ---------------------------------------------------------------------------

def _call_claude(client: anthropic.Anthropic, user_msg: str, model: str) -> tuple[str, dict]:
    """시나리오 생성 Claude 호출. (응답 텍스트, usage 딕셔너리) 반환."""
    response = client.messages.create(
        model=model,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": SCENARIO_GEN_SYSTEM,
                "cache_control": {"type": "ephemeral"},  # 시스템 프롬프트 캐싱
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


def _parse_scenario(text: str) -> dict | None:
    """Claude 응답에서 JSON 파싱. 실패 시 None."""
    # JSON 블록 추출 (```json ... ``` 또는 raw JSON)
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    raw = m.group(1) if m else text
    # 맨 앞 { 부터 맨 끝 } 까지만 추출
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        return None
    try:
        return json.loads(raw[start:end])
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# 메인 생성 함수
# ---------------------------------------------------------------------------

def generate_scenario(
    persona_id: int,
    persona: dict,
    scores: dict,
    is_atypical: bool,
    client: anthropic.Anthropic,
    model: str,
    out_dir: Path,
    force: bool = False,
) -> dict:
    """페르소나 1명의 시나리오를 생성하고 저장한다. 이미 있으면 로드."""
    out_path = out_dir / f"persona_{persona_id:02d}.json"
    if out_path.exists() and not force:
        return json.loads(out_path.read_text(encoding="utf-8"))

    user_msg = _format_persona_user(persona, scores, is_atypical)
    t0 = time.time()
    raw_text, usage = _call_claude(client, user_msg, model)
    elapsed = round(time.time() - t0, 2)

    parsed = _parse_scenario(raw_text)
    if parsed is None:
        parsed = {"parse_error": True, "raw": raw_text}

    result = {
        "persona_id": persona_id,
        "nickname": persona.get("nickname", f"persona_{persona_id:02d}"),
        "is_atypical": is_atypical,
        "scores": {k: scores.get(k) for k in ("session_score", "desire_to_return", "emotional_safety", "insight_novelty")},
        "scenario": parsed,
        "meta": {
            "model": model,
            "elapsed_sec": elapsed,
            "usage": usage,
        },
    }
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def run_scenario_gen(
    persona_ids: list[int] | None = None,
    model: str | None = None,
    force: bool = False,
) -> list[dict]:
    """지정한 페르소나(기본: 전체)의 시나리오를 생성한다."""
    SCENARIOS_DIR.mkdir(parents=True, exist_ok=True)

    personas_jsonl = DATA_DIR / "personas_with_goals.jsonl"
    atypical_ids = _load_atypical_ids(DATA_DIR)
    scores_map = _synthetic_scores(personas_jsonl, seed=42, atypical_ids=atypical_ids)
    personas_map = _load_persona_full(personas_jsonl)

    if persona_ids is None:
        persona_ids = sorted(scores_map.keys())

    client = _client()
    model = model or COACH_MODEL

    results: list[dict] = []
    total = len(persona_ids)
    for i, pid in enumerate(persona_ids, 1):
        persona = personas_map.get(pid, {"persona_id": pid, "nickname": f"persona_{pid:02d}"})
        scores = scores_map.get(pid, {})
        is_atypical = pid in atypical_ids

        print(f"  [{i}/{total}] persona_{pid:02d} {persona.get('nickname','')} ...", end=" ", flush=True)
        result = generate_scenario(
            persona_id=pid,
            persona=persona,
            scores=scores,
            is_atypical=is_atypical,
            client=client,
            model=model,
            out_dir=SCENARIOS_DIR,
            force=force,
        )
        cached = result["meta"]["usage"].get("cache_read_input_tokens", 0)
        print(f"완료 ({result['meta']['elapsed_sec']}s, cache_read={cached}tok)")
        results.append(result)

    return results
