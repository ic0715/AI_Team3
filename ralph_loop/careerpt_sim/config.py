"""Shared config & paths for the careerpt-sim harness.

When deployed inside AI_Team3/ralph_loop/, this module resolves spec files
from the surrounding repo rather than maintaining duplicates:

  AI_Team3/
  ├── docs/
  │   ├── ai_prompt/         ← coach specs + strength data (source of truth)
  │   └── ralph_loop/        ← persona Excel + eval/orchestration rulebooks
  ├── web/lib/constants/     ← seeds.ts + competencies.ts (TS source)
  └── ralph_loop/            ← THIS HARNESS
      ├── careerpt_sim/      ← Python package (you are here)
      ├── prompt/            ← per-round system_prompt snapshots (v1, v2, ...)
      └── data/              ← derived files (personas JSONL, atypical IDs)
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]                # AI_Team3/ralph_loop/
REPO_ROOT = ROOT.parent                                    # AI_Team3/
load_dotenv(str(ROOT / ".env"), override=True)

# Local (per-round, derived)
PROMPT_DIR = ROOT / "prompt"
DATA_DIR = ROOT / "data"

# Repo (source-of-truth, read-only from this harness)
AI_PROMPT_DIR = REPO_ROOT / "docs" / "ai_prompt"           # coach specs
RALPH_LOOP_DOCS_DIR = REPO_ROOT / "docs" / "ralph_loop"    # eval rulebooks + Excel
WEB_CONSTANTS_DIR = REPO_ROOT / "web" / "lib" / "constants"  # seeds.ts, competencies.ts

# Map our normalized filenames → real spec filenames in docs/ai_prompt/
# (the repo uses irregular spacing/punctuation in some filenames)
_SPEC_FILENAME_MAP = {
    "03_career_interview.md": "03. career_interview.md",
    "04_competency_analysis.md": "04.competency_analysis.md",
    "05_action_item.md": "05_action_item.md",
    "06_reflect_coaching.md": "06_reflect_coaching.md",
    "competency_action_map.md": "competency_action_map.md",
    "CONTRACT_v2.md": "CONTRACT_v2.md",
    "system_prompt.md": "system_prompt.md",
}

DEFAULT_SIM_HOME = Path.home() / ".careerpt-sim"
SIM_HOME = Path(os.getenv("CAREERPT_SIM_HOME") or DEFAULT_SIM_HOME)
SIM_HOME.mkdir(parents=True, exist_ok=True)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

COACH_MODEL = os.getenv("COACH_MODEL", "claude-sonnet-4-5")
PERSONA_MODEL = os.getenv("PERSONA_MODEL", "gpt-4o")
JUDGE_MODEL = os.getenv("JUDGE_MODEL", "claude-haiku-4-5")

H_PATTERN_KEYWORDS = [
    "오늘 인터뷰는 여기서 마무리할게요",
    "오늘은 여기까지 정리해볼게요",
    "여기서 마무리할게요",
]
MAX_INTERVIEW_TURNS = 14  # coach AI turns, safety cap


def round_dir(round_n: int) -> Path:
    d = SIM_HOME / f"round_{round_n}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def persona_dir(round_n: int, persona_id: int) -> Path:
    d = round_dir(round_n) / f"persona_{persona_id:02d}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def system_prompt_for_round(round_n: int) -> str:
    """Per-round snapshot from prompt/system_prompt_v{N}.md.

    Round 1 = baseline (a snapshot of docs/ai_prompt/system_prompt.md at
    the time the loop was started). Higher rounds are stored when the
    loop edits the prompt. Falls back to v1 if a higher round file is
    missing; falls back further to the live repo file if v1 is also missing.
    """
    p = PROMPT_DIR / f"system_prompt_v{round_n}.md"
    if p.exists():
        return p.read_text(encoding="utf-8")
    p = PROMPT_DIR / "system_prompt_v1.md"
    if p.exists():
        return p.read_text(encoding="utf-8")
    # last resort
    return (AI_PROMPT_DIR / "system_prompt.md").read_text(encoding="utf-8")


def load_spec(name: str) -> str:
    """Read a coach spec from docs/ai_prompt/, mapping normalized name → real filename."""
    real = _SPEC_FILENAME_MAP.get(name, name)
    return (AI_PROMPT_DIR / real).read_text(encoding="utf-8")


def excel_path() -> Path:
    """Locate the persona Excel under docs/ralph_loop/ regardless of exact filename."""
    candidates = sorted(RALPH_LOOP_DOCS_DIR.glob("CliftonStrengths_*.xlsx"))
    if not candidates:
        raise FileNotFoundError(f"No CliftonStrengths_*.xlsx in {RALPH_LOOP_DOCS_DIR}")
    return candidates[-1]  # newest by lexicographic sort (filenames include date suffix)
