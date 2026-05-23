"""Cheap rescore: re-run only Layer A (Gemini) and re-call #4 actions
(Claude) on an EXISTING persona artifact dir. Skips coach interview + persona
LLM + finalize + cards — those are reused as-is from previous run.

Usage:
    python -m careerpt_sim.rescore --round 0 --persona 1
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import coach as C
from . import eval_a as EA
from . import eval_b as EB
from . import eval_c as EC
from . import score as SC
from .config import persona_dir


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", type=int, required=True)
    ap.add_argument("--persona", type=int, required=True)
    args = ap.parse_args()

    d = persona_dir(args.round, args.persona)
    print(f"rescore: {d}", flush=True)

    # Load existing artifacts
    transcript = []
    with (d / "transcript_interview.jsonl").open(encoding="utf-8") as f:
        for line in f:
            transcript.append(json.loads(line))
    coach_turns = [t for t in transcript if t["role"] == "coach"]
    persona_turns = [t for t in transcript if t["role"] == "persona"]

    input_p = json.loads((d / "input.json").read_text(encoding="utf-8"))
    extract = json.loads((d / "interview_extract.json").read_text(encoding="utf-8"))
    key_insights = extract["raw"].get("key_insights", {})
    recs = json.loads((d / "recommendations.json").read_text(encoding="utf-8"))
    cards = recs["cards"]

    # --- Layer A: re-classify every coach turn ---
    print(f"\n[Layer A] re-classifying {len(coach_turns)} coach turns…", flush=True)
    turn_labels = []
    for i, ct in enumerate(coach_turns):
        prior = [p["content"] for p in persona_turns[:i]]
        label = EA.classify_turn(prior, ct["content"])
        label["turn_id"] = ct["turn_id"]
        turn_labels.append(label)
        print(f"  turn {i+1}: {label.get('primary')}", flush=True)
    la = EA.score_layer_a(turn_labels)
    (d / "scores_layer_a.json").write_text(
        json.dumps({"turn_labels": turn_labels, **la}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  LayerA_normalized = {la['layer_a_normalized']:.3f}", flush=True)

    # --- Re-call actions (Claude) with the wrapper-tolerant parser ---
    print(f"\n[#4 actions] re-calling Claude…", flush=True)
    seed_pool = C.select_seed_pool(cards)
    actions, meta = C.generate_actions(
        nickname=input_p["nickname"],
        job_field=input_p.get("current_job_field", ""),
        career_years=input_p.get("career_years", ""),
        main_concern=input_p.get("current_concern", ""),
        top5_ko=input_p["top5_strengths"],
        key_insights=key_insights,
        seed_pool=seed_pool,
        round_n=args.round,
    )
    (d / "actions.json").write_text(
        json.dumps({"actions": actions, "seed_pool": seed_pool, "meta": meta}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  n_actions={len(actions)} retry={meta.get('retry_count')} fallback={meta.get('fallback_triggered')}", flush=True)

    # --- Layer B ---
    s3 = EB.score_cards(cards, step2_meta=recs.get("step2_meta"))
    s4 = EB.score_actions(actions, seed_pool, meta=meta)
    lb = EB.layer_b_normalized(s3["score_3"], s4["score_4"])
    (d / "scores_layer_b.json").write_text(
        json.dumps({"cards": s3, "actions": s4, "layer_b_normalized": lb}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n[Layer B] score_3={s3['score_3']:.3f}  score_4={s4['score_4']:.3f}  LayerB_normalized={lb:.3f}", flush=True)

    # --- Layer C (already saved) ---
    layer_c = json.loads((d / "scores_layer_c.json").read_text(encoding="utf-8"))

    # --- Composite ---
    comp = SC.composite_session_score(
        layer_a_norm=la["layer_a_normalized"],
        layer_b_norm=lb,
        layer_c_norm=layer_c["layer_c_normalized"],
    )
    # preserve interview_turns/elapsed from previous file
    prev = json.loads((d / "session_score.json").read_text(encoding="utf-8"))
    comp["closed_by_keyword"] = prev.get("closed_by_keyword")
    comp["interview_turns"] = prev.get("interview_turns")
    comp["rescored"] = True
    (d / "session_score.json").write_text(json.dumps(comp, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n=== session_score = {comp['session_score']:.2f} ===")
    print(f"  A={la['layer_a_normalized']:.2f}  B={lb:.2f}  C={layer_c['layer_c_normalized']:.2f}")


if __name__ == "__main__":
    main()
