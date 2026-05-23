"""Pilot round: run the 7 atypical personas through one full session each,
   then aggregate the scores into a round_summary.json.

Usage:
    python -m careerpt_sim.run_pilot              # all 7 atypical
    python -m careerpt_sim.run_pilot --one 30     # single persona by ID (smoke test)
    python -m careerpt_sim.run_pilot --round 0    # custom round number
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import traceback
from pathlib import Path

from .config import DATA_DIR, round_dir
from .session import run_session


def load_personas() -> dict[int, dict]:
    out = {}
    with (DATA_DIR / "personas_with_goals.jsonl").open(encoding="utf-8") as f:
        for line in f:
            p = json.loads(line)
            out[int(p["persona_id"])] = p
    return out


def load_atypical_ids() -> list[int]:
    txt = (DATA_DIR / "atypical_personas.txt").read_text(encoding="utf-8").strip()
    return [int(x) for x in txt.split() if x.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--one", type=int, default=None, help="Run a single persona by ID")
    ap.add_argument("--round", type=int, default=0, help="Round number (default: 0 for pilot)")
    args = ap.parse_args()

    personas = load_personas()

    if args.one is not None:
        ids = [args.one]
    else:
        ids = load_atypical_ids()

    print(f"Running {len(ids)} persona(s) — round {args.round}: {ids}", flush=True)

    results = {}
    failures = {}
    for pid in ids:
        persona = personas[pid]
        print(f"\n=== persona {pid} ({persona['nickname']}) ===", flush=True)
        try:
            res = run_session(persona, round_n=args.round)
            results[pid] = res
            print(
                f"  session_score={res['session_score']:.2f} "
                f"(A={res['layer_a_normalized']:.2f} B={res['layer_b_normalized']:.2f} C={res['layer_c_normalized']:.2f}) "
                f"turns={res.get('interview_turns')} closed={res.get('closed_by_keyword')} "
                f"elapsed={res.get('elapsed_sec',0):.1f}s",
                flush=True,
            )
        except Exception as e:
            failures[pid] = repr(e)
            traceback.print_exc()
            print(f"  FAILED: {e}", flush=True)

    rdir = round_dir(args.round)
    summary = {
        "round": args.round,
        "n_attempted": len(ids),
        "n_succeeded": len(results),
        "n_failed": len(failures),
        "failures": failures,
        "per_persona": {pid: r for pid, r in results.items()},
    }
    if results:
        scores = [r["session_score"] for r in results.values()]
        summary["mean_session_score"] = statistics.mean(scores)
        summary["min_session_score"] = min(scores)
        summary["stdev_session_score"] = statistics.stdev(scores) if len(scores) > 1 else 0.0

    (rdir / "round_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nSummary → {rdir / 'round_summary.json'}")
    if results:
        print(f"  mean={summary.get('mean_session_score'):.2f}  min={summary.get('min_session_score'):.2f}")
    if failures:
        print(f"  FAILED ids: {list(failures)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
