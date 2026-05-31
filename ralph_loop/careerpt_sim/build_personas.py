"""Build personas_with_goals.jsonl from the CliftonStrengths Excel.

Source: docs/ralph_loop/CliftonStrengths_*.xlsx (located under the repo)

Sheets used:
  - "페르소나 전체"        (36x23, rows 3-36 are the 34 personas)
  - "Goal"                  (103x7, 34 personas x 3 goals)
  - "시뮬레이션 주의사항"   (36x1, rows 2-36, persona-aligned text notes)

Output:
  - ralph_loop/data/personas_with_goals.jsonl  (one JSON object per line, persona_id 1..34)
  - ralph_loop/data/atypical_personas.txt      (7 IDs, one per line)

Goal-selection rule (docs/ralph_loop/ralph_loop_spec.md §4.1):
  1. Among the 3 goal rows for the persona, pick rows where specificity_level == "medium".
  2. If exactly one matches, use it.
  3. If zero or 2+, fall back to the row with the smallest original sheet index.
"""
from __future__ import annotations

import json
from pathlib import Path

import openpyxl

from .config import DATA_DIR, excel_path

OUT = DATA_DIR / "personas_with_goals.jsonl"
ATYP_OUT = DATA_DIR / "atypical_personas.txt"

PERSONA_SHEET = "페르소나 전체"
GOAL_SHEET = "Goal"
NOTE_SHEET = "시뮬레이션 주의사항"

# Persona sheet columns (row 2 = header, rows 3..36 = 34 personas)
PERSONA_COLS = [
    ("persona_id", 1),
    ("nickname", 2),
    ("birthdate", 3),
    ("gender", 4),
    ("current_job_field", 5),
    ("career_years", 6),
    ("current_concern", 7),
    ("strength_1", 8),
    ("strength_2", 9),
    ("strength_3", 10),
    ("strength_4", 11),
    ("strength_5", 12),
    ("company_size", 13),
    ("industry", 14),
    ("specific_role", 15),
    ("domain_distribution", 16),
    ("primary_domain", 17),
    ("personality", 18),
    ("strength_combo_core", 19),
    ("trigger_type", 20),
    ("trigger_event", 21),
    ("three_months_before", 22),
    ("remarks", 23),
]

ATYPICAL_NICKNAMES = {
    "박서연", "이채린", "김하은", "강현수", "한가람", "김다은", "조시현",
}


def _cell(ws, r, c):
    v = ws.cell(r, c).value
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def load_personas(wb):
    ws = wb[PERSONA_SHEET]
    personas = {}
    for r in range(3, 37):  # rows 3..36
        pid = _cell(ws, r, 1)
        if pid is None:
            continue
        rec = {name: _cell(ws, r, col) for name, col in PERSONA_COLS}
        rec["top5_strengths"] = [
            rec.pop(f"strength_{i}") for i in range(1, 6)
        ]
        personas[int(pid)] = rec
    return personas


def load_goals(wb):
    """Return {persona_id: [goal_dict, ...]} in sheet order."""
    ws = wb[GOAL_SHEET]
    goals = {}
    for r in range(2, ws.max_row + 1):
        pid = _cell(ws, r, 1)
        if pid is None:
            continue
        pid = int(pid)
        entry = {
            "axis_code": _cell(ws, r, 3),
            "goal": _cell(ws, r, 4),
            "secret_goal": _cell(ws, r, 5),
            "specificity_level": _cell(ws, r, 6),
            "emotional_tone": _cell(ws, r, 7),
            "_row": r,
        }
        goals.setdefault(pid, []).append(entry)
    return goals


def load_notes(wb):
    ws = wb[NOTE_SHEET]
    notes = {}
    # rows 2..36, persona_id assumed aligned with persona sheet order (1..34)
    for i, r in enumerate(range(2, 36), start=1):
        v = _cell(ws, r, 1)
        if v:
            notes[i] = v
    return notes


def pick_goal(goal_list):
    """ralph_loop_spec.md §4.1 deterministic pick: medium-first, else smallest index."""
    medium = [g for g in goal_list if (g.get("specificity_level") or "").lower() == "medium"]
    if len(medium) == 1:
        chosen = medium[0]
    else:
        chosen = min(goal_list, key=lambda g: g["_row"])
    chosen = dict(chosen)
    chosen.pop("_row", None)
    return chosen


def main():
    wb = openpyxl.load_workbook(excel_path(), data_only=True)
    personas = load_personas(wb)
    goals = load_goals(wb)
    notes = load_notes(wb)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    atypical_ids = []
    with OUT.open("w", encoding="utf-8") as f:
        for pid in sorted(personas):
            rec = personas[pid]
            gl = goals.get(pid, [])
            if not gl:
                print(f"WARN: persona {pid} ({rec.get('nickname')}) has no goal entries")
                continue
            chosen = pick_goal(gl)
            rec["selected_goal"] = chosen
            rec["all_goals"] = [
                {k: v for k, v in g.items() if k != "_row"} for g in gl
            ]
            rec["simulation_note"] = notes.get(pid)
            rec["is_atypical"] = rec["nickname"] in ATYPICAL_NICKNAMES
            if rec["is_atypical"]:
                atypical_ids.append(pid)
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    ATYP_OUT.write_text(
        "\n".join(str(p) for p in atypical_ids) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(personas)} personas → {OUT}")
    print(f"Atypical 7 persona_ids: {atypical_ids} → {ATYP_OUT}")


if __name__ == "__main__":
    main()
