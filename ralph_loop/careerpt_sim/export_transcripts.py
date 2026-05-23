"""Export each persona's session as a human-readable Markdown file.

Output: ~/.careerpt-sim/round_{N}/persona_{NN}/session.md

Includes:
  - persona profile + selected goal/secret_goal
  - full interview transcript (coach/persona alternating, with Layer A label per coach turn)
  - finalize extract (key_insights + summary)
  - 5 cards with personalized_text
  - 3-5 action items with seed source
  - persona's final self-score message
  - all 3 layer scores + composite

Usage:
    python -m careerpt_sim.export_transcripts --round 0          # all personas in round
    python -m careerpt_sim.export_transcripts --round 0 -p 1     # one persona
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import round_dir


def _load(p: Path):
    if not p.exists():
        return None
    if p.suffix == ".jsonl":
        with p.open(encoding="utf-8") as f:
            return [json.loads(l) for l in f]
    return json.loads(p.read_text(encoding="utf-8"))


def export_one(persona_dir: Path) -> Path | None:
    if not (persona_dir / "input.json").exists():
        return None

    input_p = _load(persona_dir / "input.json")
    transcript = _load(persona_dir / "transcript_interview.jsonl") or []
    extract = _load(persona_dir / "interview_extract.json") or {}
    recs = _load(persona_dir / "recommendations.json") or {}
    acts = _load(persona_dir / "actions.json") or {}
    la = _load(persona_dir / "scores_layer_a.json") or {}
    lb = _load(persona_dir / "scores_layer_b.json") or {}
    lc = _load(persona_dir / "scores_layer_c.json") or {}
    comp = _load(persona_dir / "session_score.json") or {}

    g = input_p.get("selected_goal", {})
    md = []
    md.append(f"# {input_p.get('nickname')} (#{input_p.get('persona_id')}) — 1차 세션 기록")
    md.append("")
    if comp:
        md.append(
            f"**Session Score: {comp.get('session_score',0):.2f}**  "
            f"(A={comp.get('layer_a_normalized',0):.2f} · "
            f"B={comp.get('layer_b_normalized',0):.2f} · "
            f"C={comp.get('layer_c_normalized',0):.2f})  "
            f"· 인터뷰 턴: {comp.get('interview_turns','?')}  "
            f"· 자연 종료: {'예' if comp.get('closed_by_keyword') else '아니오 (안전캡)'}"
        )
        md.append("")

    # Profile
    md.append("## 페르소나 프로파일")
    md.append(f"- **직무/경력**: {input_p.get('current_job_field','')} / {input_p.get('career_years','')}")
    md.append(f"- **Top5 강점**: {' · '.join(input_p.get('top5_strengths',[]))}")
    md.append(f"- **사전 고민**: {input_p.get('current_concern','')}")
    md.append(f"- **성격**: {input_p.get('personality','')}")
    md.append(f"- **강점조합 핵심**: {input_p.get('strength_combo_core','')}")
    md.append(f"- **Trigger**: {input_p.get('trigger_type','')} — {input_p.get('trigger_event','')}")
    if input_p.get("remarks"):
        md.append(f"- **비고**: {input_p['remarks']}")
    md.append("")
    md.append("### 이번 세션 목표 (페르소나만 안다)")
    md.append(f"- **표면 goal** ({g.get('axis_code','')}, {g.get('specificity_level','')}, {g.get('emotional_tone','')}):  ")
    md.append(f"  > {g.get('goal','')}")
    md.append(f"- **secret_goal** (코치는 모름):  ")
    md.append(f"  > {g.get('secret_goal','')}")
    md.append("")

    # Transcript
    md.append("## 인터뷰 대화")
    md.append("")
    # Build {turn_id → label} index for Layer A
    label_by_tid = {t.get("turn_id"): t for t in (la.get("turn_labels") or [])}
    for t in transcript:
        speaker = "🧑‍🏫 **코치**" if t["role"] == "coach" else "🙋 **페르소나**"
        md.append(f"### {speaker}")
        # Layer A label on coach turn
        if t["role"] == "coach":
            lab = label_by_tid.get(t.get("turn_id"))
            if lab:
                primary = lab.get("primary", "?")
                sec = ", ".join(lab.get("secondary") or []) or "—"
                md.append(f"> _Layer A: **{primary}** · 부: {sec}_  ")
                if lab.get("rationale"):
                    md.append(f"> _rationale: {lab['rationale']}_")
        md.append("")
        md.append(t["content"])
        md.append("")

    # Extract
    if extract.get("raw"):
        md.append("## Finalize 추출 결과")
        raw = extract["raw"]
        md.append(f"- **presenting_issue**: {raw.get('presenting_issue','')}")
        md.append(f"- **agreed_focus**: {raw.get('agreed_focus','')}")
        if raw.get("agreement_evolution"):
            md.append(f"- **agreement_evolution**: {raw['agreement_evolution']}")
        md.append(f"- **user_takeaway**: {raw.get('user_takeaway','')}")
        md.append(f"- **session_duration_choice**: {raw.get('session_duration_choice','')}")
        ki = raw.get("key_insights", {}) or {}
        if ki:
            md.append("- **key_insights**:")
            for k, v in ki.items():
                if v:
                    md.append(f"  - `{k}`: {v if not isinstance(v, list) else ', '.join(v)}")
        if raw.get("mentioned_competencies"):
            md.append(f"- **mentioned_competencies**: {', '.join(raw['mentioned_competencies'])}")
        if extract.get("ai_summary"):
            md.append(f"- **한 줄 요약**: {extract['ai_summary']}")
        if extract.get("meta", {}).get("retry_count"):
            md.append(f"- _finalize retry: {extract['meta']}_")
        md.append("")

    # Cards
    md.append("## 추천 5장 카드")
    md.append("")
    for c in recs.get("cards", []):
        md.append(
            f"### 슬롯 {c['slot']} · {c.get('title','')}  "
            f"`{c.get('badge','')}` · code={c.get('code','')} · match_score={c.get('match_score','?')}"
        )
        if c.get("personalized_text"):
            md.append(c["personalized_text"])
        md.append("")
    if recs.get("step2_meta", {}).get("fallback_triggered"):
        md.append("> ⚠️ Step 2 fallback 발동 (정적 텍스트)")
        md.append("")

    # Actions
    md.append("## 이번 주 액션 아이템")
    md.append("")
    for a in acts.get("actions", []):
        md.append(f"### {a.get('title','')}")
        md.append(f"_(source_seed_id = `{a.get('source_seed_id','')}`)_  ")
        md.append(a.get("description", ""))
        md.append(f"태그: {' · '.join(a.get('tags', []))}")
        md.append("")
    if acts.get("meta", {}).get("fallback_triggered"):
        md.append("> ⚠️ 액션 결정적 fallback 발동")
        md.append("")
    if acts.get("seed_pool"):
        md.append(f"_노출된 시드 풀 ({len(acts['seed_pool'])}개)_: " + ", ".join(s["source_seed_id"] for s in acts["seed_pool"]))
        md.append("")

    # Scores detail
    md.append("## 점수 세부")
    md.append("")
    md.append("### Layer A (발화 품질)")
    if la.get("judge_invalid"):
        md.append(f"⚠️ judge_invalid: {la.get('reason','')}")
    else:
        md.append(f"- coaching_ratio: {la.get('coaching_ratio',0):.3f} (목표 ≥0.80)")
        md.append(f"- anti_pattern_rate: {la.get('anti_pattern_rate',0):.3f} (목표 ≤0.10)")
        md.append(f"- question_density: {la.get('question_density',0):.3f} (목표 ≥0.40)")
        md.append(f"- mixed_turn_rate: {la.get('mixed_turn_rate',0):.3f} (목표 ≤0.15)")
        md.append(f"- **LayerA_normalized**: {la.get('layer_a_normalized',0):.3f}")
    md.append("")
    md.append("### Layer B (출력 품질)")
    if lb:
        md.append(f"- score_3 (카드): {lb.get('cards',{}).get('score_3',0):.3f}")
        md.append(f"- score_4 (액션): {lb.get('actions',{}).get('score_4',0):.3f}")
        md.append(f"  - score_seed: {lb.get('actions',{}).get('score_seed',0):.3f} (위반: {lb.get('actions',{}).get('violations',[])})")
        md.append(f"  - retry={lb.get('actions',{}).get('retry_count',0)} fallback={lb.get('actions',{}).get('fallback_triggered',False)}")
        md.append(f"- **LayerB_normalized**: {lb.get('layer_b_normalized',0):.3f}")
    md.append("")
    md.append("### Layer C (페르소나 자가평가)")
    if lc and lc.get("axes"):
        for k, v in lc["axes"].items():
            md.append(f"- {k}: {v}")
        if lc.get("narrative"):
            md.append(f"- **narrative**: {lc['narrative']}")
        md.append(f"- **LayerC_normalized**: {lc.get('layer_c_normalized',0):.3f}")
    md.append("")

    out = persona_dir / "session.md"
    out.write_text("\n".join(md), encoding="utf-8")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", type=int, required=True)
    ap.add_argument("-p", "--persona", type=int, default=None)
    args = ap.parse_args()

    rdir = round_dir(args.round)
    targets = []
    if args.persona is not None:
        targets = [rdir / f"persona_{args.persona:02d}"]
    else:
        targets = sorted(rdir.glob("persona_*"))

    for d in targets:
        out = export_one(d)
        if out:
            print(f"wrote {out}")
        else:
            print(f"skipped {d} (no input.json)")


if __name__ == "__main__":
    main()
