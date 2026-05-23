"""Layer B — deterministic validation of #3 cards + #4 actions.

AI_COACH_SCORING_v2.md §5.
"""
from __future__ import annotations

BADGE_ENUM = {"strength_match", "user_interest", "growth_potential"}


def score_cards(
    cards: list[dict],
    step1_meta: dict | None = None,
    step2_meta: dict | None = None,
) -> dict:
    """§5.1. Returns nested score breakdown + score_3."""
    step1_meta = step1_meta or {"retry_count": 0, "fallback_triggered": False}
    step2_meta = step2_meta or {"retry_count": 0, "fallback_triggered": False}

    # Step 1 checks (all 1/0, failure = code bug → session invalid)
    s1_checks = {
        "card_count_5": int(len(cards) == 5),
        "slot_distribution": int(sorted(c.get("slot") for c in cards) == [1, 2, 3, 4, 5]),
        "code_distinct": int(len({c.get("code") for c in cards}) == 5),
        "match_score_range": int(all(isinstance(c.get("match_score"), int) and 0 <= c["match_score"] <= 5 for c in cards)),
        "badge_enum": int(all(c.get("badge") in BADGE_ENUM for c in cards)),
        "slot_1_3_badge": int(all(next(c for c in cards if c["slot"] == s)["badge"] == "strength_match" for s in (1, 2, 3))),
        "slot_4_badge": int(next(c for c in cards if c["slot"] == 4)["badge"] in ("user_interest", "strength_match")),
        "slot_5_badge": int(next(c for c in cards if c["slot"] == 5)["badge"] in ("growth_potential", "strength_match")),
    }
    s1_score = sum(s1_checks.values()) / len(s1_checks)
    session_invalid = s1_score < 1.0

    # Step 2 checks
    s2_checks = {
        "json_parsed": int(all("personalized_text" in c for c in cards)),
        "five_cards": int(len(cards) == 5),
        "slot_distribution": s1_checks["slot_distribution"],
        "text_length": int(all(60 <= len(c.get("personalized_text", "")) <= 200 for c in cards)),
    }
    s2_score = sum(s2_checks.values()) / len(s2_checks)

    retry = step2_meta.get("retry_count", 0)
    s3_retry_penalty = max(0.0, 1.0 - 0.3 * retry)
    s3_fallback_penalty = 0.5 if step2_meta.get("fallback_triggered") else 1.0

    score_3 = s1_score * s2_score * s3_retry_penalty * s3_fallback_penalty

    return {
        "session_invalid": session_invalid,
        "s1_checks": s1_checks,
        "s1_score": s1_score,
        "s2_checks": s2_checks,
        "s2_score": s2_score,
        "retry_count": retry,
        "fallback_triggered": step2_meta.get("fallback_triggered", False),
        "s3_retry_penalty": s3_retry_penalty,
        "s3_fallback_penalty": s3_fallback_penalty,
        "score_3": score_3,
    }


def score_actions(
    actions: list[dict],
    seed_pool: list[dict],
    meta: dict | None = None,
) -> dict:
    """§5.2. Returns score_4 with seed-pool nonlinear penalty."""
    meta = meta or {"retry_count": 0, "fallback_triggered": False}
    pool_ids = {s["source_seed_id"] for s in seed_pool}

    n = len(actions)
    violations = [a for a in actions if a.get("source_seed_id") not in pool_ids]
    violation_rate = (len(violations) / n) if n else 1.0
    score_seed = (1 - violation_rate) ** 2

    f_checks = {
        "json_schema": int(3 <= n <= 5 and all({"source_seed_id", "title", "description", "tags"}.issubset(a) for a in actions)),
        "title_length": int(all(8 <= len(a.get("title", "")) <= 60 for a in actions)) if n else 0,
        "description_length": int(all(20 <= len(a.get("description", "")) <= 240 for a in actions)) if n else 0,
        "tag_count": int(all(2 <= len(a.get("tags", [])) <= 4 for a in actions)) if n else 0,
    }
    s4_format = sum(f_checks.values()) / len(f_checks)

    retry = meta.get("retry_count", 0)
    s4_retry_penalty = max(0.0, 1.0 - 0.3 * retry)
    s4_fallback_penalty = 0.3 if meta.get("fallback_triggered") else 1.0

    score_4 = score_seed * s4_format * s4_retry_penalty * s4_fallback_penalty

    return {
        "n_actions": n,
        "violations": [a.get("source_seed_id") for a in violations],
        "violation_rate_seed": violation_rate,
        "score_seed": score_seed,
        "format_checks": f_checks,
        "s4_format": s4_format,
        "retry_count": retry,
        "fallback_triggered": meta.get("fallback_triggered", False),
        "s4_retry_penalty": s4_retry_penalty,
        "s4_fallback_penalty": s4_fallback_penalty,
        "score_4": score_4,
    }


def layer_b_normalized(score_3: float, score_4: float) -> float:
    return 0.30 * score_3 + 0.70 * score_4
