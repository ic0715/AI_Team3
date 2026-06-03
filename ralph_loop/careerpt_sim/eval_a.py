"""Layer A — per-turn LLM-as-judge using Gemini.

Implements AI_COACH_SCORING_v2.md §3 prompt and §4.1 normalization.
"""
from __future__ import annotations

import json
import re
import time

from .config import GEMINI_API_KEY, JUDGE_MODEL, ANTHROPIC_API_KEY, OPENAI_API_KEY


COACHING_CATS = {"powerful_question", "reflection", "acknowledgment", "hold_space"}
ANTI_CATS = {"advice", "solution", "interpretation", "premature_closure", "praise_inflation"}
ALL_CATS = COACHING_CATS | ANTI_CATS

PROMPT = """당신은 ICF 코칭 윤리 강령에 정통한 평가자입니다.
다음은 AI 코치와 사용자 간 대화의 일부입니다.

[직전 사용자 발화 1~3턴]:
{prior}

[평가 대상 AI 발화]:
{ai_turn}

이 AI 발화를 다음 카테고리 중 하나로 주(primary) 분류하세요.
- powerful_question / reflection / acknowledgment / hold_space (권장)
- advice / solution / interpretation / premature_closure / praise_inflation (안티패턴)

규칙:
1. "조언 같은 질문"(예: "X 해보는 건 어떠세요?")은 advice 로 분류합니다.
2. 사용자 단어를 그대로 되돌려주는 건 reflection 입니다.
3. 부 카테고리(secondary)는 최대 2개. 안티패턴이 부에라도 등장하면 "혼합 패턴"이 됩니다.
4. 분류 근거를 한 문장(rationale)에 적으세요.

JSON으로만 답하세요:
{{"primary": "<category>", "secondary": ["<category>", ...], "rationale": "<string>"}}
"""


def _judge_call(prompt: str) -> str:
    """Backend-aware single LLM call. Returns raw text."""
    if JUDGE_MODEL.startswith("claude"):
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model=JUDGE_MODEL,
            max_tokens=400,
            temperature=0.0,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text
    elif JUDGE_MODEL.startswith("gpt") or JUDGE_MODEL.startswith("o"):
        from openai import OpenAI
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not set")
        client = OpenAI(api_key=OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model=JUDGE_MODEL,
            temperature=0.0,
            max_tokens=400,
            response_format={"type": "json_object"},  # force valid JSON
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content or ""
    elif JUDGE_MODEL.startswith("gemini"):
        import google.generativeai as genai
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY not set")
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(JUDGE_MODEL)
        resp = model.generate_content(prompt, generation_config={"temperature": 0.0, "max_output_tokens": 400})
        return resp.text or ""
    else:
        raise RuntimeError(f"Unsupported JUDGE_MODEL: {JUDGE_MODEL}")


def classify_turn(prior_user_turns: list[str], ai_turn: str) -> dict:
    """Return {primary, secondary, rationale}. Falls back to {primary: 'unknown'} on parse fail."""
    prior = "\n".join(prior_user_turns[-3:]) if prior_user_turns else "(첫 턴, 직전 사용자 발화 없음)"
    prompt = PROMPT.format(prior=prior, ai_turn=ai_turn)
    last_err = None
    last_raw = None
    for attempt in range(3):
        try:
            text = _judge_call(prompt).strip()
            last_raw = text
            # strip fences anywhere
            text = re.sub(r"```(?:json)?", "", text)
            text = text.replace("```", "").strip()
            # find first balanced {...}
            m = re.search(r"\{.*\}", text, flags=re.S)
            if m:
                text = m.group(0)
            data = json.loads(text)
            if data.get("primary") in ALL_CATS:
                return data
            last_err = f"primary={data.get('primary')!r} not in enum"
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
            time.sleep(1)
    return {
        "primary": "unknown",
        "secondary": [],
        "rationale": f"judge parse failure: {last_err}; raw[:200]={(last_raw or '')[:200]!r}",
    }


def score_layer_a(turn_labels: list[dict]) -> dict:
    """Compute 4 KPIs and LayerA_normalized per §4.1.

    If too many turns are 'unknown' (judge failures), refuse to score —
    a denominator-of-zero KPI would otherwise inflate score_ap/score_mt to 1.0.
    """
    total = len(turn_labels)
    if total == 0:
        return {"coaching_ratio": 0, "anti_pattern_rate": 0, "question_density": 0,
                "mixed_turn_rate": 0, "layer_a_normalized": 0, "total_turns": 0,
                "judge_invalid": True, "reason": "no turns"}
    unknown_n = sum(1 for t in turn_labels if t.get("primary") == "unknown")
    if unknown_n / total > 0.30:  # > 30% judge failures → bail
        return {"total_turns": total, "unknown_turns": unknown_n,
                "judge_invalid": True, "layer_a_normalized": 0.0,
                "reason": f"{unknown_n}/{total} turns unclassified by judge (>30% threshold)"}
    coach_n = sum(1 for t in turn_labels if t.get("primary") in COACHING_CATS)
    anti_n = sum(1 for t in turn_labels if t.get("primary") in ANTI_CATS)
    q_n = sum(1 for t in turn_labels if t.get("primary") == "powerful_question")
    mixed_n = sum(
        1 for t in turn_labels
        if any(s in ANTI_CATS for s in (t.get("secondary") or []))
    )

    cr = coach_n / total
    ap = anti_n / total
    qd = q_n / total
    mt = mixed_n / total

    def _clip(v, lo, hi):
        return max(0.0, min(1.0, (v - lo) / (hi - lo) if hi != lo else 0.0))

    score_cr = _clip(cr, 0.50, 0.80)
    score_ap = _clip(0.30 - ap, 0.0, 0.20)  # 30% → 0, 10% → 1  ⇒ (0.30-ap)/0.20
    score_qd = _clip(qd, 0.20, 0.40)
    score_mt = _clip(0.35 - mt, 0.0, 0.20)

    norm = 0.35 * score_cr + 0.25 * score_ap + 0.25 * score_qd + 0.15 * score_mt

    return {
        "total_turns": total,
        "coaching_ratio": cr,
        "anti_pattern_rate": ap,
        "question_density": qd,
        "mixed_turn_rate": mt,
        "score_cr": score_cr,
        "score_ap": score_ap,
        "score_qd": score_qd,
        "score_mt": score_mt,
        "layer_a_normalized": norm,
    }
