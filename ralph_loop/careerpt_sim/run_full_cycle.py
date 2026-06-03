"""Run the end-to-end single-persona cycle (interview → cards/actions →
selection → reflection) for one or more personas and print where the
human-readable Markdown landed.

Usage (from ralph_loop/):
    python -m careerpt_sim.run_full_cycle --one 35
    python -m careerpt_sim.run_full_cycle --one 36 --personas data/new_personas.jsonl
    python -m careerpt_sim.run_full_cycle --all --personas data/new_personas.jsonl

Requires ANTHROPIC_API_KEY (coach) and OPENAI_API_KEY (persona) in
ralph_loop/.env. Run in a clean shell — if ANTHROPIC_BASE_URL is exported
it will override the .env and the coach calls will hit the wrong endpoint.
"""
from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path

from .config import DATA_DIR, persona_dir
from .full_cycle import run_full_cycle


def load_personas(path: Path) -> dict[int, dict]:
    out = {}
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            p = json.loads(line)
            out[int(p["persona_id"])] = p
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="Run the full CareerPT week-1 cycle for a persona.")
    ap.add_argument("--personas", type=str, default=str(DATA_DIR / "new_personas.jsonl"),
                    help="JSONL of personas_with_goals. Default: data/new_personas.jsonl")
    ap.add_argument("--one", type=int, default=None, help="Run a single persona by ID.")
    ap.add_argument("--all", action="store_true", help="Run every persona in the JSONL.")
    ap.add_argument("--round", type=int, default=0, help="Round/prompt version (default: 0).")
    args = ap.parse_args(argv)

    personas = load_personas(Path(args.personas))
    if args.one is not None:
        ids = [args.one]
    elif args.all:
        ids = sorted(personas)
    else:
        ap.error("specify --one ID or --all")

    print(f"Running full cycle for {len(ids)} persona(s): {ids}", flush=True)
    failures = {}
    for pid in ids:
        if pid not in personas:
            print(f"  persona {pid} not in {args.personas} — skipped", flush=True)
            continue
        persona = personas[pid]
        print(f"\n=== persona {pid} ({persona['nickname']}) ===", flush=True)
        try:
            r = run_full_cycle(persona, round_n=args.round)
            out = persona_dir(args.round, pid)
            print(f"  interview turns={sum(1 for t in r['interview'] if t['role']=='coach')} "
                  f"closed={r['interview_closed_by_keyword']}", flush=True)
            print(f"  chose card [{r['chosen_card_slot']}] {r['chosen_card_title']} "
                  f"+ {len(r['chosen_action_titles'])} action(s)", flush=True)
            print(f"  reflect closed={r['reflect_closed_by_keyword']} "
                  f"next_action={r['reflect_insight'].get('next_action_title')!r}", flush=True)
            print(f"  → {out / 'full_cycle.md'}", flush=True)
        except Exception as e:
            failures[pid] = repr(e)
            traceback.print_exc()
            print(f"  FAILED: {e}", flush=True)

    if failures:
        print(f"\nFAILED ids: {list(failures)}")
        sys.exit(1)
    print("\nAll cycles complete.")


if __name__ == "__main__":
    main()
