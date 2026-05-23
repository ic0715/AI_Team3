"""Coach-LLM adapter.

Wraps the three coach touchpoints from the AI_Team3 repo into pure-Python
calls suitable for the sim harness:

  - interview_turn(messages, system) → assistant turn (Claude)
  - finalize_interview(transcript, persona) → {key_insights, ai_summary, ...}
  - build_cards(interview_result, persona) → 5 cards (Step1 deterministic + Step2 AI)
  - generate_actions(interview_result, cards, persona) → 3~5 actions w/ source_seed_id validation

All meta (turn_id, retry_count, fallback_triggered) is recorded on every AI
call so the Layer-B validator can read it directly.
"""
from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

import anthropic

from .config import (
    ANTHROPIC_API_KEY,
    COACH_MODEL,
    H_PATTERN_KEYWORDS,
    load_spec,
    system_prompt_for_round,
)
from .seeds import load_competencies, load_seeds


# ---------- meta records ----------
@dataclass
class TurnMeta:
    turn_id: str
    session_id: str
    role: str  # "coach" | "persona" | "judge" | "system"
    content: str
    prompt_version: int
    retry_count: int = 0
    fallback_triggered: bool = False
    extra: dict = field(default_factory=dict)


# ---------- client ----------
def _client() -> anthropic.Anthropic:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in environment")
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ---------- helpers ----------
def has_closing_keyword(text: str) -> bool:
    return any(k in text for k in H_PATTERN_KEYWORDS)


def _extract_json(text: str) -> Any:
    """Pull the first JSON object/array out of model output, stripping any
       accidental markdown fences."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.M)
    # find first { or [
    m = re.search(r"[\[{]", t)
    if not m:
        raise ValueError(f"no JSON found in: {text[:200]}")
    start = m.start()
    # walk to matching close (simple — counts braces)
    depth = 0
    in_str = False
    esc = False
    end = None
    for i in range(start, len(t)):
        c = t[i]
        if esc:
            esc = False
            continue
        if c == "\\":
            esc = True
            continue
        if c == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if c in "{[":
            depth += 1
        elif c in "}]":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        raise ValueError(f"unbalanced JSON in: {text[:200]}")
    return json.loads(t[start:end])


# ---------- system block helper ----------
def _sys_blocks(*parts: tuple[str, bool]) -> list[dict]:
    """Build an Anthropic 'system' parameter as a list of content blocks,
       marking the requested parts with ephemeral cache_control.

    parts: sequence of (text, should_cache) tuples in order.
    Empty text parts are skipped silently.
    """
    out = []
    for text, cache in parts:
        if not text:
            continue
        b = {"type": "text", "text": text}
        if cache:
            b["cache_control"] = {"type": "ephemeral"}
        out.append(b)
    return out


# Cache-stats accumulator the orchestrator can read after each session.
_LAST_USAGE: dict = {"calls": 0, "input": 0, "output": 0, "cache_create": 0, "cache_read": 0}


def reset_usage() -> None:
    for k in _LAST_USAGE:
        _LAST_USAGE[k] = 0


def get_usage() -> dict:
    return dict(_LAST_USAGE)


def _record_usage(usage) -> None:
    _LAST_USAGE["calls"] += 1
    _LAST_USAGE["input"] += getattr(usage, "input_tokens", 0) or 0
    _LAST_USAGE["output"] += getattr(usage, "output_tokens", 0) or 0
    _LAST_USAGE["cache_create"] += getattr(usage, "cache_creation_input_tokens", 0) or 0
    _LAST_USAGE["cache_read"] += getattr(usage, "cache_read_input_tokens", 0) or 0


# ---------- 1) Interview multi-turn ----------
def interview_system_blocks(
    round_n: int,
    nickname: str,
    job_field: str,
    career_years: str,
    top5_ko: list[str],
    main_concern: str,
) -> list[dict]:
    """Returns a 2-block system list:
       [0] base coach rules + 03 spec + global rules    ← CACHED (≈15K tokens, stable across personas)
       [1] this-persona context                          ← not cached (changes per persona)
    """
    base = system_prompt_for_round(round_n)
    interview_spec = load_spec("03_career_interview.md")
    base_part = f"""{base}

---

# 인터뷰 진행 명세 (이 세션 전용)

아래는 이 커리어 인터뷰 세션의 구체 진행 규칙입니다. 위의 일반 코칭 원칙을 따르되, 이 세션 동안은 아래 흐름을 반드시 지키세요.

{interview_spec}

---

# 🚨 최우선 규칙

1) 평소 2~3문장. 깊이 파고드는 follow-up일 때 최대 4문장.
2) 마무리 시 종료 발화 키워드 중 하나를 반드시 포함하세요:
   - "오늘 인터뷰는 여기서 마무리할게요"
   - "오늘은 여기까지 정리해볼게요"
   - "여기서 마무리할게요"
3) 한 번에 하나의 질문만.
"""

    persona_part = f"""---

## 이 사용자의 정보

- 호칭: {nickname}님
- 직무: {job_field or '(미입력)'} / 경력: {career_years or '(미입력)'}
- 강점 Top 5: {', '.join(top5_ko)}
- 사전 입력한 커리어 고민: {main_concern or '(미입력)'}

이 정보를 인지하되 인터뷰에서 강조하거나 다시 확인받으려 하지 마세요.
응답은 반드시 한국어로, 사용자에게 그대로 보여줄 텍스트만. 메타 설명·태그·마크다운 펜스 금지.
"""
    return _sys_blocks((base_part, True), (persona_part, False))


# Backward-compat shim for any caller using the string version.
def interview_system_prompt(*args, **kwargs) -> str:  # pragma: no cover
    blocks = interview_system_blocks(*args, **kwargs)
    return "\n\n".join(b["text"] for b in blocks)


def coach_turn(
    system,
    history: list[dict],
    max_tokens: int = 500,
    temperature: float = 0.7,
) -> str:
    """system can be str OR list-of-blocks (preferred — enables prompt caching).
       history = list of {"role": "user"|"assistant", "content": str}.
    """
    client = _client()
    if isinstance(system, str):
        system = [{"type": "text", "text": system}]
    resp = client.messages.create(
        model=COACH_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=history,
    )
    _record_usage(resp.usage)
    return resp.content[0].text.strip()


# ---------- 2) Finalize ----------
def finalize_interview(
    transcript: list[dict],
    nickname: str,
    top5_ko: list[str],
) -> tuple[dict, str, dict]:
    """Extract key_insights JSON + 60-char summary. Returns (parsed, summary, meta)."""
    interview_spec = load_spec("03_career_interview.md")
    sys = _sys_blocks(
        (interview_spec, True),  # CACHED: 03 spec (~47KB, shared across all personas)
        ("""---

# 지금 작업

위 명세서의 §4.6.B 형식에 따라 코치-사용자 대화 전체를 분석해서 출력하세요.
응답 형식: 순수 JSON 객체 하나 + 줄바꿈 + "---SUMMARY---" 줄 + 줄바꿈 + 한 줄 요약 텍스트.
다른 설명·마크다운 펜스 금지.

스키마:
{"presenting_issue":string,"agreed_focus":string,"agreement_evolution":string,
  "user_takeaway":string,"session_duration_choice":"short"|"medium"|"long",
  "key_insights":{"current_satisfaction"?:string,"current_frustration"?:string,
                    "future_vision"?:string,"work_style"?:string,
                    "values"?:string[],"career_concern"?:string,"dream"?:string},
  "mentioned_competencies":string[]}
""", False),
    )
    transcript_str = "\n".join(
        f"[{t['role']}] {t['content']}" for t in transcript
    )
    user = f"""[사용자] {nickname}님 / 강점 Top 5: {', '.join(top5_ko)}

[대화 전체]
{transcript_str}

위 대화를 분석하여 명세서 §4.6.B 형식대로 출력하세요. JSON + 줄바꿈 + ---SUMMARY--- + 줄바꿈 + 요약."""

    meta = {"retry_count": 0, "fallback_triggered": False}
    last_err = None
    for attempt in range(3):
        try:
            text = coach_turn(sys, [{"role": "user", "content": user}], max_tokens=1500, temperature=0.3)
            if "---SUMMARY---" in text:
                json_part, _, summary_part = text.partition("---SUMMARY---")
                parsed = _extract_json(json_part)
                summary = summary_part.strip().splitlines()[0][:80] if summary_part.strip() else ""
            else:
                parsed = _extract_json(text)
                summary = ""
            return parsed, summary, meta
        except Exception as e:
            last_err = e
            meta["retry_count"] = attempt + 1
    # fallback
    meta["fallback_triggered"] = True
    return (
        {
            "presenting_issue": "",
            "agreed_focus": "",
            "agreement_evolution": "",
            "user_takeaway": "",
            "session_duration_choice": "medium",
            "key_insights": {},
            "mentioned_competencies": [],
        },
        "",
        meta,
    )


# ---------- 3) Cards Step 1 (deterministic) ----------
KO_TO_EN_STRENGTH = {
    # Best-effort mapping. Used for match_score against linked_strengths (Korean names).
}


def cards_step1(
    top5_ko: list[str],
    mentioned_competencies: list[str],
) -> list[dict]:
    """
    Deterministic 5-card builder (04 spec §6.1).

    Rules:
      - slot 1~3: top 3 competencies by match_score (strength_match badge)
      - slot 4:   first item from mentioned_competencies not already in slots 1~3
                  (user_interest badge). Fallback: 4th-highest match_score (strength_match).
      - slot 5:   highest-match competency from a domain NOT represented in slots 1~4
                  (growth_potential badge). Fallback: 5th-highest match_score (strength_match).

    match_score = number of top5 Korean strengths that appear in linked_strengths,
                  capped at 5.
    """
    comps = load_competencies()
    scored = []
    for c in comps:
        ms = sum(1 for s in top5_ko if s in c["linked_strengths"])
        ms = min(ms, 5)
        scored.append({**c, "match_score": ms})
    scored.sort(key=lambda c: (-c["match_score"], c["code"]))  # tie-break by code

    cards = []
    used_ids = set()
    used_domains = set()

    # slot 1-3
    for slot in (1, 2, 3):
        c = next(c for c in scored if c["id"] not in used_ids)
        cards.append({
            "slot": slot,
            "code": c["code"],
            "id": c["id"],
            "domain": c["domain_code"],
            "title": c["title"],
            "match_score": c["match_score"],
            "badge": "strength_match",
            "mentioned": list(top5_ko[: c["match_score"]]) if c["match_score"] else [],
        })
        used_ids.add(c["id"])
        used_domains.add(c["domain_code"])

    # slot 4: user_interest from mentioned, fallback strength_match
    slot4 = None
    for code in mentioned_competencies or []:
        c = next((c for c in scored if c["code"] == code and c["id"] not in used_ids), None)
        if c:
            slot4 = {**c, "badge": "user_interest"}
            break
    if slot4 is None:
        c = next(c for c in scored if c["id"] not in used_ids)
        slot4 = {**c, "badge": "strength_match"}
    cards.append({
        "slot": 4,
        "code": slot4["code"],
        "id": slot4["id"],
        "domain": slot4["domain_code"],
        "title": slot4["title"],
        "match_score": slot4["match_score"],
        "badge": slot4["badge"],
        "mentioned": list(top5_ko[: slot4["match_score"]]) if slot4["match_score"] else [],
    })
    used_ids.add(slot4["id"])
    used_domains.add(slot4["domain_code"])

    # slot 5: growth_potential — new domain
    slot5 = next((c for c in scored if c["id"] not in used_ids and c["domain_code"] not in used_domains), None)
    if slot5:
        badge = "growth_potential"
    else:
        slot5 = next(c for c in scored if c["id"] not in used_ids)
        badge = "strength_match"
    cards.append({
        "slot": 5,
        "code": slot5["code"],
        "id": slot5["id"],
        "domain": slot5["domain_code"],
        "title": slot5["title"],
        "match_score": slot5["match_score"],
        "badge": badge,
        "mentioned": list(top5_ko[: slot5["match_score"]]) if slot5["match_score"] else [],
    })

    return cards


# ---------- 3b) Cards Step 2 (AI personalized_text) ----------
def cards_step2(
    nickname: str,
    job_field: str,
    career_years: str,
    main_concern: str,
    top5_ko: list[str],
    key_insights: dict,
    ai_summary: str,
    cards_step1_result: list[dict],
    round_n: int,
) -> tuple[list[dict], dict]:
    base_sys = system_prompt_for_round(round_n)
    spec = load_spec("04_competency_analysis.md")
    cached_block = f"""{base_sys}

---

# 역량 방향 결과 카드 생성 명세 (이 세션 전용)

{spec}"""
    sys = _sys_blocks(
        (cached_block, True),  # CACHED: system_prompt + 04 spec (~50KB, stable per round)
        ("""---

# 출력 형식 (강제)

JSON 배열로만 응답. 마크다운 펜스·서두 금지.
[
  {"slot": 1, "personalizedText": "..."},
  {"slot": 2, "personalizedText": "..."},
  {"slot": 3, "personalizedText": "..."},
  {"slot": 4, "personalizedText": "..."},
  {"slot": 5, "personalizedText": "..."}
]
각 personalizedText는 2~3문장, 60~200자.""", False),
    )

    insights_lines = []
    for k, v in (key_insights or {}).items():
        if v:
            insights_lines.append(f"- {k}: {v if not isinstance(v, list) else ', '.join(v)}")
    insights_block = "\n".join(insights_lines) or "(없음)"

    user = f"""<사용자_프로필>
닉네임: {nickname}
직무/분야: {job_field}
경력: {career_years}
사전 입력 고민: {main_concern}
</사용자_프로필>

<Top5_강점>
{', '.join(top5_ko)}
</Top5_강점>

<인터뷰_요약>
{('한 줄: ' + ai_summary) if ai_summary else ''}
{insights_block}
</인터뷰_요약>

<5장_카드>
{chr(10).join(f"[카드 {c['slot']}] title={c['title']} badge={c['badge']} domain={c['domain']}" for c in cards_step1_result)}
</5장_카드>

각 슬롯의 personalizedText를 슬롯 순서대로 작성. 각 60~200자."""

    meta = {"retry_count": 0, "fallback_triggered": False}
    enriched = list(cards_step1_result)
    for attempt in range(3):
        try:
            text = coach_turn(sys, [{"role": "user", "content": user}], max_tokens=1200, temperature=0.5)
            arr = _extract_json(text)
            if not isinstance(arr, list) or len(arr) != 5:
                raise ValueError("expected 5-item array")
            by_slot = {a["slot"]: a.get("personalizedText", "") for a in arr if isinstance(a, dict)}
            for c in enriched:
                pt = by_slot.get(c["slot"], "")
                if not (60 <= len(pt) <= 200):
                    raise ValueError(f"slot {c['slot']} personalizedText length {len(pt)} not in 60~200")
                c["personalized_text"] = pt
            return enriched, meta
        except Exception:
            meta["retry_count"] = attempt + 1
    # fallback to static text
    meta["fallback_triggered"] = True
    for c in enriched:
        c["personalized_text"] = (
            f"{c['title']}은 {nickname}님의 강점과 잘 연결될 수 있는 방향이에요. "
            f"이번 주에는 작은 한 걸음부터 시도해보면 어떨까요? 어떤 모습이 되면 충분하다고 느낄지 생각해보세요."
        )[:200]
    return enriched, meta


# ---------- 4) Actions ----------
def select_seed_pool(
    cards: list[dict],
    primary_card_slot: int = 1,
    secondary_card_slot: int = 2,
) -> list[dict]:
    """Return up to 6 seeds: primary(1) + secondary(1) + reference(4).

    Seeds are looked up by competency_id from the cards' chosen competencies.
    If a competency has no seeds in seeds.ts, that bucket is silently skipped
    — the pool may end up < 6 (we record the actual count).
    """
    seeds_by_comp = load_seeds()
    pool: list[dict] = []
    seen = set()
    order = [primary_card_slot, secondary_card_slot] + [c["slot"] for c in cards if c["slot"] not in (primary_card_slot, secondary_card_slot)]
    card_by_slot = {c["slot"]: c for c in cards}
    for slot in order:
        c = card_by_slot.get(slot)
        if not c:
            continue
        bucket = seeds_by_comp.get(c["id"], [])
        for s in bucket:
            if s["id"] in seen:
                continue
            pool.append({
                "source_seed_id": s["id"],
                "competency_id": c["id"],
                "from_card_slot": slot,
                "title": s["title"],
                "description": s["description"],
                "tags": s["tags"],
            })
            seen.add(s["id"])
            if len(pool) >= 6:
                return pool
    return pool


def generate_actions(
    nickname: str,
    job_field: str,
    career_years: str,
    main_concern: str,
    top5_ko: list[str],
    key_insights: dict,
    seed_pool: list[dict],
    round_n: int,
) -> tuple[list[dict], dict]:
    base_sys = system_prompt_for_round(round_n)
    spec = load_spec("05_action_item.md")
    cached_block = f"""{base_sys}

---

# 액션 아이템 생성 명세 (이 세션 전용)

{spec}"""
    # ~74KB — cache it (one cache block; competency_action_map is in the spec already)
    sys = _sys_blocks((cached_block, True))

    seeds_block = "\n\n".join(
        f"{i+1}. id={s['source_seed_id']}\n   title: {s['title']}\n   description: {s['description']}\n   tags: [{', '.join(s['tags'])}]"
        for i, s in enumerate(seed_pool)
    )

    user = f"""[사용자 컨텍스트]
- 닉네임: {nickname}
- 직무: {job_field} / 경력: {career_years}
- 강점: {', '.join(top5_ko)}
- 커리어 고민: {main_concern}
- 인터뷰 인사이트: {json.dumps(key_insights, ensure_ascii=False)}

[베이스 시드 {len(seed_pool)}개 — 반드시 이 안에서만 source_seed_id를 골라]
{seeds_block}

위 시드 중 3~5개를 골라 사용자에게 맞춰 재작성. JSON 배열로만 응답.
각 항목: {{"source_seed_id":"...","title":"...","description":"...","tags":[...]}}.
- title 8~60자, description 20~240자, tags 2~4개.
- source_seed_id 는 반드시 위 목록의 id와 정확히 일치해야 함."""

    meta = {"retry_count": 0, "fallback_triggered": False}
    valid_ids = {s["source_seed_id"] for s in seed_pool}

    def _validate(arr) -> list[dict]:
        if not isinstance(arr, list) or not (3 <= len(arr) <= 5):
            raise ValueError(f"expected 3~5 actions, got {len(arr) if isinstance(arr, list) else type(arr)}")
        for a in arr:
            for k in ("source_seed_id", "title", "description", "tags"):
                if k not in a:
                    raise ValueError(f"missing key {k}")
            if not (8 <= len(a["title"]) <= 60):
                raise ValueError(f"title length {len(a['title'])}")
            if not (20 <= len(a["description"]) <= 240):
                raise ValueError(f"description length {len(a['description'])}")
            if not (2 <= len(a["tags"]) <= 4):
                raise ValueError(f"tags count {len(a['tags'])}")
        return arr

    for attempt in range(3):
        try:
            text = coach_turn(sys, [{"role": "user", "content": user}], max_tokens=1500, temperature=0.5)
            arr = _extract_json(text)
            # Accept both bare array and {"actions": [...]} / {"items": [...]} wrappers.
            if isinstance(arr, dict):
                arr = arr.get("actions") or arr.get("items") or arr.get("data") or arr
            _validate(arr)
            return arr, meta
        except Exception as e:
            meta["retry_count"] = attempt + 1
            meta.setdefault("retry_errors", []).append(repr(e)[:200])

    # deterministic fallback: take first 3 seeds as-is
    meta["fallback_triggered"] = True
    fallback = []
    for s in seed_pool[:3]:
        fallback.append({
            "source_seed_id": s["source_seed_id"],
            "title": s["title"][:60],
            "description": s["description"][:240] if len(s["description"]) >= 20 else (s["description"] + " 이번 주에 한 걸음만 시도해보세요.")[:240],
            "tags": s["tags"][:4] if len(s["tags"]) >= 2 else (s["tags"] + ["✨ 한 걸음"])[:4],
        })
    return fallback, meta
