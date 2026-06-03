"""Run one full session for one persona, save all artifacts.

Phase flow:
  1. Build coach system prompt + persona system prompt
  2. Multi-turn interview until H-keyword OR MAX_INTERVIEW_TURNS
  3. Finalize interview → key_insights + ai_summary
  4. Cards Step1 (deterministic) + Step2 (AI) → recommendations.json
  5. Action generation w/ seed pool → actions.json
  6. Persona-LLM emits Layer C self-score after seeing #3 + #4
  7. Layer A (Gemini judge over interview turns)
  8. Layer B (deterministic over #3/#4)
  9. Composite session_score
"""
from __future__ import annotations

import json
import time
import traceback
from pathlib import Path

from . import coach as C
from . import eval_a as EA
from . import eval_b as EB
from . import eval_c as EC
from . import persona_llm as PL
from . import score as SC
from .config import INTERVIEW_HARD_COMPLETE_THRESHOLD, persona_dir


def _write_json(p: Path, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def _append_jsonl(p: Path, obj):
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def run_session(persona: dict, round_n: int) -> dict:
    pid = int(persona["persona_id"])
    session_id = f"round_{round_n}_persona_{pid:02d}"
    out_dir = persona_dir(round_n, pid)
    t0 = time.time()

    nickname = persona["nickname"]
    top5 = persona["top5_strengths"]

    # Reset usage accountant — we record per-session token + cache stats
    C.reset_usage()

    # 1) System prompts (interview uses CACHED blocks)
    coach_sys = C.interview_system_blocks(
        round_n=round_n,
        nickname=nickname,
        job_field=persona.get("current_job_field", ""),
        career_years=persona.get("career_years", ""),
        top5_ko=top5,
        main_concern=persona.get("current_concern", ""),
    )
    persona_sys = PL.build_persona_system(persona)

    _write_json(out_dir / "input.json", persona)
    (out_dir / "prompt_version.txt").write_text(str(round_n), encoding="utf-8")

    # 2) Interview multi-turn
    transcript: list[dict] = []
    coach_history: list[dict] = []  # for coach API: alternating user/assistant
    persona_history: list[dict] = []  # for persona API
    transcript_path = out_dir / "transcript_interview.jsonl"
    transcript_path.write_text("", encoding="utf-8")

    closed_by_keyword = False
    # Termination mirrors web/app/api/career-interview/chat: stop on a closing
    # keyword, else hard-complete once persona(user) messages hit the threshold.
    ai_turn_i = 0
    for _ in range(INTERVIEW_HARD_COMPLETE_THRESHOLD + 2):
        ai_turn_i += 1
        # Coach speaks first on turn 1 (no prior user input → seed with a system-style nudge)
        if ai_turn_i == 1:
            coach_history.append({"role": "user", "content": "(세션 시작 — 사용자가 앱에 진입했습니다. 첫 발화를 시작하세요.)"})
        user_msg_count = sum(1 for m in coach_history if m["role"] == "user")
        coach_text = C.coach_turn(coach_sys, coach_history)
        turn_rec = {"turn_id": f"{session_id}_coach_{ai_turn_i}", "role": "coach", "content": coach_text}
        transcript.append(turn_rec)
        _append_jsonl(transcript_path, turn_rec)
        coach_history.append({"role": "assistant", "content": coach_text})
        # Persona sees the coach text
        persona_history.append({"role": "user", "content": coach_text})

        if C.has_closing_keyword(coach_text):
            closed_by_keyword = True
            break
        if user_msg_count >= INTERVIEW_HARD_COMPLETE_THRESHOLD:
            break

        # Persona responds
        persona_text = PL.persona_turn(persona_sys, persona_history)
        turn_rec = {"turn_id": f"{session_id}_persona_{ai_turn_i}", "role": "persona", "content": persona_text}
        transcript.append(turn_rec)
        _append_jsonl(transcript_path, turn_rec)
        persona_history.append({"role": "assistant", "content": persona_text})
        coach_history.append({"role": "user", "content": persona_text})

    # 3) Finalize interview
    key_insights_full, ai_summary, finalize_meta = C.finalize_interview(
        transcript=transcript, nickname=nickname, top5_ko=top5,
    )
    key_insights = key_insights_full.get("key_insights", {})
    _write_json(out_dir / "interview_extract.json", {
        "raw": key_insights_full,
        "ai_summary": ai_summary,
        "meta": finalize_meta,
    })

    # 4) Cards Step1 + Step2
    mentioned = key_insights_full.get("mentioned_competencies", [])
    cards_s1 = C.cards_step1(top5_ko=top5, mentioned_competencies=mentioned)
    cards_full, cards_s2_meta = C.cards_step2(
        nickname=nickname,
        job_field=persona.get("current_job_field", ""),
        career_years=persona.get("career_years", ""),
        main_concern=persona.get("current_concern", ""),
        top5_ko=top5,
        key_insights=key_insights,
        ai_summary=ai_summary,
        cards_step1_result=cards_s1,
        round_n=round_n,
    )
    _write_json(out_dir / "recommendations.json", {
        "cards": cards_full,
        "step1_meta": {"retry_count": 0, "fallback_triggered": False},
        "step2_meta": cards_s2_meta,
    })

    # 5) Actions
    seed_pool = C.select_seed_pool(cards_full)
    actions, action_meta = C.generate_actions(
        nickname=nickname,
        job_field=persona.get("current_job_field", ""),
        career_years=persona.get("career_years", ""),
        main_concern=persona.get("current_concern", ""),
        top5_ko=top5,
        key_insights=key_insights,
        seed_pool=seed_pool,
        round_n=round_n,
    )
    _write_json(out_dir / "actions.json", {
        "actions": actions,
        "seed_pool": seed_pool,
        "meta": action_meta,
    })

    # 6) Persona Layer C self-score (show #3 + #4)
    cards_summary = "\n".join(
        f"[카드 {c['slot']}] {c['title']} ({c['badge']}): {c.get('personalized_text','')}"
        for c in cards_full
    )
    actions_summary = "\n".join(
        f"- {a['title']}\n  {a['description']}\n  tags={a['tags']}"
        for a in actions
    )
    summary_msg = (
        "[코치가 정리한 결과 — 5장 카드 + 액션 아이템]\n\n"
        f"## 추천 5장 카드\n{cards_summary}\n\n"
        f"## 이번 주 액션 아이템\n{actions_summary}\n\n"
        "이 결과를 본 페르소나로서 §2-E 형식의 자가채점 JSON을 마지막 줄에 출력하세요."
    )
    persona_history.append({"role": "user", "content": summary_msg})
    final_text = PL.persona_turn(persona_sys, persona_history, temperature=0.3)
    _append_jsonl(transcript_path, {
        "turn_id": f"{session_id}_persona_final", "role": "persona", "content": final_text,
    })
    layer_c_json = PL.parse_layer_c(final_text)

    # 7) Layer A — judge every coach turn
    coach_turns = [t for t in transcript if t["role"] == "coach"]
    persona_turns = [t for t in transcript if t["role"] == "persona"]
    turn_labels = []
    for i, ct in enumerate(coach_turns):
        prior_user = [p["content"] for p in persona_turns[:i]]
        label = EA.classify_turn(prior_user, ct["content"])
        label["turn_id"] = ct["turn_id"]
        turn_labels.append(label)
    layer_a = EA.score_layer_a(turn_labels)
    _write_json(out_dir / "scores_layer_a.json", {
        "turn_labels": turn_labels,
        **layer_a,
    })

    # 8) Layer B — deterministic
    score_3_breakdown = EB.score_cards(cards_full, step2_meta=cards_s2_meta)
    score_4_breakdown = EB.score_actions(actions, seed_pool, meta=action_meta)
    layer_b_norm = EB.layer_b_normalized(score_3_breakdown["score_3"], score_4_breakdown["score_4"])
    _write_json(out_dir / "scores_layer_b.json", {
        "cards": score_3_breakdown,
        "actions": score_4_breakdown,
        "layer_b_normalized": layer_b_norm,
    })

    # 9) Layer C
    layer_c = EC.score_layer_c(layer_c_json)
    _write_json(out_dir / "scores_layer_c.json", layer_c)

    # Composite
    composite = SC.composite_session_score(
        layer_a_norm=layer_a["layer_a_normalized"],
        layer_b_norm=layer_b_norm,
        layer_c_norm=layer_c["layer_c_normalized"],
    )
    composite["closed_by_keyword"] = closed_by_keyword
    composite["interview_turns"] = len(coach_turns)
    composite["elapsed_sec"] = time.time() - t0
    composite["coach_usage"] = C.get_usage()  # token + cache stats for cost tracking
    _write_json(out_dir / "session_score.json", composite)

    return composite
