"""End-to-end single-persona cycle orchestrator.

Runs the four phases the CareerPT product flow goes through for week 1, for
ONE persona, and writes both machine artifacts (JSON) and a human-readable
Markdown transcript.

Phases (maps to the user's requested cycle):
  ① 1주차 인터뷰          interview multi-turn  (coach ↔ persona)
  ② 역량 pool + 액션      cards step1/step2 + seed pool + generate_actions
  ③ 페르소나 선택         persona_select (1 card + N actions) + week-1 report
  ④ 회고 인터뷰           reflect chat loop → reflect_finalize (next-week action)

Unlike session.py this does NOT run the A/B/C scoring layers — the goal here
is to observe the qualitative cycle, not to grade the coach.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from . import coach as C
from . import persona_llm as PL
from . import reflect as R
from .config import (
    INTERVIEW_HARD_COMPLETE_THRESHOLD,
    REFLECT_HARD_FAILSAFE,
    persona_dir,
)


def _write_json(p: Path, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def _append_jsonl(p: Path, obj):
    with p.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def run_full_cycle(persona: dict, round_n: int = 0) -> dict:
    pid = int(persona["persona_id"])
    session_id = f"cycle_r{round_n}_p{pid:02d}"
    out_dir = persona_dir(round_n, pid)
    t0 = time.time()

    nickname = persona["nickname"]
    top5 = persona["top5_strengths"]
    job_field = persona.get("current_job_field", "")
    career_years = persona.get("career_years", "")
    main_concern = persona.get("current_concern", "")

    C.reset_usage()
    persona_sys = PL.build_persona_system(persona)
    _write_json(out_dir / "input.json", persona)

    # ── ① Interview ───────────────────────────────────────────────────────
    coach_sys = C.interview_system_blocks(
        round_n=round_n, nickname=nickname, job_field=job_field,
        career_years=career_years, top5_ko=top5, main_concern=main_concern,
    )
    interview: list[dict] = []
    coach_hist: list[dict] = []
    persona_hist: list[dict] = []
    closed_iv = False
    # Termination mirrors career-interview/chat: stop on a closing keyword, else
    # hard-complete once persona(user) messages reach the threshold (soft cap).
    for _ in range(INTERVIEW_HARD_COMPLETE_THRESHOLD + 2):
        if not coach_hist:
            coach_hist.append({"role": "user", "content": "(세션 시작 — 사용자가 앱에 진입했습니다. 첫 발화를 시작하세요.)"})
        user_msg_count = sum(1 for m in coach_hist if m["role"] == "user")
        coach_text = C.coach_turn(coach_sys, coach_hist)
        interview.append({"role": "coach", "content": coach_text})
        coach_hist.append({"role": "assistant", "content": coach_text})
        persona_hist.append({"role": "user", "content": coach_text})
        if C.has_closing_keyword(coach_text):
            closed_iv = True
            break
        if user_msg_count >= INTERVIEW_HARD_COMPLETE_THRESHOLD:
            break
        persona_text = PL.persona_turn(persona_sys, persona_hist)
        interview.append({"role": "persona", "content": persona_text})
        persona_hist.append({"role": "assistant", "content": persona_text})
        coach_hist.append({"role": "user", "content": persona_text})

    key_full, ai_summary, _ = C.finalize_interview(transcript=interview, nickname=nickname, top5_ko=top5)
    key_insights = key_full.get("key_insights", {})

    # ── ② Competency pool + actions ───────────────────────────────────────
    mentioned = key_full.get("mentioned_competencies", [])
    cards_s1 = C.cards_step1(top5_ko=top5, mentioned_competencies=mentioned)
    cards, cards_meta = C.cards_step2(
        nickname=nickname, job_field=job_field, career_years=career_years,
        main_concern=main_concern, top5_ko=top5, key_insights=key_insights,
        ai_summary=ai_summary, cards_step1_result=cards_s1, round_n=round_n,
    )
    seed_pool = C.select_seed_pool(cards)
    actions, actions_meta = C.generate_actions(
        nickname=nickname, job_field=job_field, career_years=career_years,
        main_concern=main_concern, top5_ko=top5, key_insights=key_insights,
        seed_pool=seed_pool, round_n=round_n,
    )

    # ── ③ Persona selection + week-1 execution report ─────────────────────
    selection, sel_raw = PL.persona_select(persona, cards, actions)
    chosen_card = next((c for c in cards if c["slot"] == selection["selected_card_slot"]), cards[0])
    chosen_actions = [actions[i - 1] for i in selection["selected_action_indices"] if 1 <= i <= len(actions)]
    week_report, week_raw = PL.persona_week_report(persona, chosen_card, chosen_actions)

    # ── ④ Reflection interview ────────────────────────────────────────────
    ctx = R.ReflectContext(
        nickname=nickname,
        goal_title=chosen_card["title"],
        competency_code=chosen_card["code"],
        current_week=1,
        action_title="; ".join(a["title"] for a in chosen_actions) or "(선택 없음)",
        done_count_week=int(week_report.get("done_count", 0)),
        weekly_retro=week_report.get("weekly_retro", ""),
        top_strength=top5[0] if top5 else None,
    )
    reflect_iv: list[dict] = []
    r_coach_hist: list[dict] = []
    r_persona_hist: list[dict] = []
    closed_reflect = False
    week_primer = (
        f"(회고 코칭 세션 시작 — 당신은 지난 1주차에 '{ctx.action_title}' 액션을 골라 한 주를 보냈습니다. "
        f"당신의 솔직한 한 주 회고: \"{ctx.weekly_retro}\". 이제 코치가 회고 코칭을 시작합니다. "
        f"코치 발화에 페르소나 본인으로서 답하세요.)\n\n"
    )
    # Termination mirrors reflect-coach/chat: SOFT_CAP injects a wrap-up hint
    # (rebuilt per turn from the live user-msg count); HARD_FAILSAFE force-closes.
    for _ in range(REFLECT_HARD_FAILSAFE + 2):
        if not r_coach_hist:
            r_coach_hist.append({"role": "user", "content": "(회고 코칭 세션 시작 — 코치가 먼저 오프닝 질문을 합니다.)"})
        user_msg_count = sum(1 for m in r_coach_hist if m["role"] == "user")
        reflect_blocks = R.build_reflect_chat_blocks(round_n, ctx, user_msg_count=user_msg_count)
        coach_text = R.reflect_coach_turn(reflect_blocks, r_coach_hist)
        reflect_iv.append({"role": "coach", "content": coach_text})
        r_coach_hist.append({"role": "assistant", "content": coach_text})
        if len(reflect_iv) == 1:
            r_persona_hist.append({"role": "user", "content": week_primer + coach_text})
        else:
            r_persona_hist.append({"role": "user", "content": coach_text})
        if R.has_reflect_closing(coach_text):
            closed_reflect = True
            break
        if user_msg_count >= REFLECT_HARD_FAILSAFE:
            break
        persona_text = PL.persona_turn(persona_sys, r_persona_hist)
        reflect_iv.append({"role": "persona", "content": persona_text})
        r_persona_hist.append({"role": "assistant", "content": persona_text})
        r_coach_hist.append({"role": "user", "content": persona_text})

    insight, reflect_summary, _ = R.reflect_finalize(
        transcript=reflect_iv, nickname=nickname, goal_title=ctx.goal_title,
        current_week=1, top_strength=ctx.top_strength, done_count_week=ctx.done_count_week,
    )

    # ── Persist ───────────────────────────────────────────────────────────
    result = {
        "persona_id": pid,
        "nickname": nickname,
        "interview": interview,
        "interview_closed_by_keyword": closed_iv,
        "ai_summary": ai_summary,
        "key_insights": key_insights,
        "mentioned_competencies": mentioned,
        "cards_step1": cards_s1,
        "cards_step2_meta": cards_meta,
        "cards": cards,
        "seed_pool": seed_pool,
        "seed_pool_size": len(seed_pool),
        "actions_meta": actions_meta,
        "actions": actions,
        "selection": selection,
        "selection_raw": sel_raw,
        "chosen_card_slot": chosen_card["slot"],
        "chosen_card_title": chosen_card["title"],
        "chosen_action_titles": [a["title"] for a in chosen_actions],
        "week_report": week_report,
        "week_report_raw": week_raw,
        "reflect_interview": reflect_iv,
        "reflect_closed_by_keyword": closed_reflect,
        "reflect_insight": insight,
        "reflect_summary": reflect_summary,
        "elapsed_sec": time.time() - t0,
        "coach_usage": C.get_usage(),
    }
    _write_json(out_dir / "full_cycle.json", result)
    md = render_markdown(result)
    (out_dir / "full_cycle.md").write_text(md, encoding="utf-8")
    return result


def render_markdown(r: dict) -> str:
    L: list[str] = []
    L.append(f"# 풀 사이클 — {r['nickname']} (persona {r['persona_id']})\n")

    L.append("## ① 1주차 커리어 인터뷰\n")
    for t in r["interview"]:
        who = "🧑‍🏫 코치" if t["role"] == "coach" else f"🙋 {r['nickname']}"
        L.append(f"**{who}**: {t['content']}\n")
    L.append(f"> 인터뷰 종료: {'정상 클로징' if r['interview_closed_by_keyword'] else '턴 상한 도달'}\n")
    L.append(f"> 한 줄 요약: {r.get('ai_summary') or '(없음)'}\n")
    if r.get("key_insights"):
        L.append("> 추출된 인사이트:")
        for k, v in r["key_insights"].items():
            if v:
                vv = ", ".join(v) if isinstance(v, list) else v
                L.append(f">   - {k}: {vv}")
        L.append("")

    L.append("## ② 역량 추천 카드 + 액션 아이템\n")
    s1 = r.get("cards_step1") or []
    if s1:
        L.append("### 0단계 — 결정론적 후보 도출 (cards_step1)\n")
        L.append(f"> 언급된 역량: {', '.join(r.get('mentioned_competencies', [])) or '(없음)'}")
        for c in s1:
            ment = ", ".join(c.get("mentioned", []))
            L.append(f">   - [{c.get('slot')}] {c.get('title')} `({c.get('badge')}, "
                     f"match={c.get('match_score')})`" + (f" ← {ment}" if ment else ""))
        L.append("")
    L.append("### 추천 카드 5장 (cards_step2, AI 개인화)\n")
    for c in r["cards"]:
        L.append(f"- **[{c['slot']}] {c['title']}** `({c['badge']}, match={c.get('match_score')})`")
        L.append(f"  - {c.get('personalized_text','')}")
    L.append("")
    pool = r.get("seed_pool") or []
    if pool:
        L.append(f"### 시드풀 ({len(pool)}개 — 액션 생성의 원천)\n")
        for s in pool:
            if isinstance(s, dict):
                label = s.get("title") or s.get("seed") or s.get("text") or str(s)
                tags = s.get("tags") or s.get("competency") or ""
                tags = ", ".join(tags) if isinstance(tags, list) else tags
                L.append(f"- {label}" + (f"  `{tags}`" if tags else ""))
            else:
                L.append(f"- {s}")
        L.append("")
    L.append(f"### 제안 액션 아이템 ({len(r['actions'])}개)\n")
    for i, a in enumerate(r["actions"], 1):
        L.append(f"{i}. **{a['title']}**  `{', '.join(a.get('tags',[]))}`")
        L.append(f"   - {a['description']}")
    L.append("")

    L.append("## ③ 페르소나의 선택\n")
    sel = r["selection"]
    L.append(f"- 선택한 방향 카드: **[{r['chosen_card_slot']}] {r['chosen_card_title']}**")
    L.append(f"- 선택한 액션: {', '.join(r['chosen_action_titles']) or '(없음)'}")
    if sel.get("narrative"):
        L.append(f"- 이유(1인칭): \"{sel['narrative']}\"")
    L.append("")
    wr = r["week_report"]
    L.append(f"### 1주차 실행 후 자가 회고\n")
    L.append(f"- 완료: {wr.get('done_count')} / {len(r['chosen_action_titles'])}개 액션")
    L.append(f"- 회고: \"{wr.get('weekly_retro','')}\"\n")

    L.append("## ④ 회고 코칭 인터뷰\n")
    for t in r["reflect_interview"]:
        who = "🧑‍🏫 코치" if t["role"] == "coach" else f"🙋 {r['nickname']}"
        L.append(f"**{who}**: {t['content']}\n")
    L.append(f"> 회고 종료: {'정상 클로징' if r['reflect_closed_by_keyword'] else '턴 상한 도달'}\n")
    ins = r.get("reflect_insight", {})
    L.append("### 회고에서 도출된 다음 주 액션\n")
    L.append(f"- 다음 액션(원표현): {ins.get('next_action_raw') or '(없음)'}")
    L.append(f"- 다듬은 제목: **{ins.get('next_action_title') or '(없음)'}**")
    L.append(f"- 이유: {ins.get('next_action_reason') or '(없음)'}")
    if ins.get("strength_link"):
        L.append(f"- 강점 연결: {ins['strength_link']}")
    L.append(f"- 한 줄 요약: {r.get('reflect_summary') or '(없음)'}\n")

    u = r.get("coach_usage", {})
    L.append("---")
    L.append(f"_경과 {r.get('elapsed_sec',0):.1f}s · 코치 API {u.get('calls')}회 "
             f"(in={u.get('input')}, out={u.get('output')}, cache_read={u.get('cache_read')})_")
    return "\n".join(L)
