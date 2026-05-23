"""Load action seeds and 12-competency definitions from the repo's TS files
   by light regex parsing — keeps a single source of truth (the repo)
   and avoids JSON/TS drift."""
from __future__ import annotations

import json
import re
from pathlib import Path

from .config import AI_PROMPT_DIR, WEB_CONSTANTS_DIR


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def load_competencies() -> list[dict]:
    """Parse web/lib/constants/competencies.ts → list of competency dicts."""
    txt = _read(WEB_CONSTANTS_DIR / "competencies.ts")
    # find every "{ id: '...', code: '...', ... linkedStrengths: [...] }"
    pattern = re.compile(
        r"\{\s*"
        r"id:\s*'(?P<id>[^']+)',\s*"
        r"code:\s*'(?P<code>[^']+)',\s*"
        r"domain:\s*'(?P<domain>[^']+)',\s*"
        r"domainCode:\s*'(?P<dcode>[^']+)',\s*"
        r"title:\s*'(?P<title>[^']+)',\s*"
        r"tags:\s*\[(?P<tags>[^\]]*)\],\s*"
        r"emoji:\s*'(?P<emoji>[^']+)',\s*"
        r"linkedStrengths:\s*\[(?P<links>[^\]]*)\],",
        re.S,
    )
    out = []
    for m in pattern.finditer(txt):
        links = re.findall(r"'([^']+)'", m["links"])
        tags = re.findall(r"'([^']+)'", m["tags"])
        out.append({
            "id": m["id"],
            "code": m["code"],
            "domain": m["domain"],
            "domain_code": m["dcode"],
            "title": m["title"],
            "tags": tags,
            "emoji": m["emoji"],
            "linked_strengths": links,
        })
    if len(out) != 12:
        raise RuntimeError(f"expected 12 competencies, parsed {len(out)}")
    return out


def load_seeds() -> dict[str, list[dict]]:
    """Parse web/lib/constants/seeds.ts → {competency_id: [seed_dict, ...]}.

    Note: the repo currently ships only 5 of the 12 competency seed lists
    (= 25 seeds). The full 72-seed spec mentioned in `05_action_item.md`
    is partially populated. We work with whatever the repo provides; the
    pilot validator uses the loaded pool, not the spec count.
    """
    txt = _read(WEB_CONSTANTS_DIR / "seeds.ts")
    # split by "competencyId:" anchors
    # Match competency blocks: competencyId: "xxx" or 'xxx'
    block_pat = re.compile(r"\{\s*competencyId:\s*['\"]([^'\"]+)['\"]", re.S)
    # Capture each "{ id: X, title: Y, description: Z, tags: [...] }" item.
    # Strings may use either ' or " delimiters; the content side can contain the OTHER quote.
    str_val = r"(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")"
    item_pat = re.compile(
        rf"id:\s*{str_val},\s*"
        rf"title:\s*{str_val},\s*"
        rf"description:\s*{str_val},\s*"
        r"tags:\s*\[(?P<tags>[^\]]*)\]",
        re.S,
    )
    out: dict[str, list[dict]] = {}
    matches = list(block_pat.finditer(txt))
    for i, bm in enumerate(matches):
        cid = bm.group(1)
        start = bm.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(txt)
        chunk = txt[start:end]
        items = []
        for im in item_pat.finditer(chunk):
            sid = im.group(1) or im.group(2)
            stitle = im.group(3) or im.group(4)
            sdesc = im.group(5) or im.group(6)
            tags_raw = im.group("tags")
            tags = [t for pair in re.findall(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"", tags_raw) for t in pair if t]
            items.append({
                "id": sid,
                "title": stitle,
                "description": sdesc,
                "tags": tags,
            })
        if items:
            out[cid] = items
    return out


def load_strength_blocks() -> dict:
    return json.loads((AI_PROMPT_DIR / "strength_blocks.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    cs = load_competencies()
    sd = load_seeds()
    print(f"competencies: {len(cs)}")
    print(f"seeds (competency keys): {list(sd.keys())}  total items={sum(len(v) for v in sd.values())}")
