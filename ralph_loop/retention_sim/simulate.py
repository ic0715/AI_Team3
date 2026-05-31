"""12주 retention 시뮬레이션 오케스트레이터.

데이터 소스 우선순위:
  1. 실제 ralph_loop round 결과 (~/.careerpt-sim/round_{N}/)
  2. 합성 스코어 (실제 데이터 없을 때 — 방법 B는 분석이 주목적이므로 허용)

출력:
  retention_results/
    scenario_{name}.json       — 페르소나별 12주 잔존율
    summary.json               — 시나리오 비교 + 이탈 위험 TOP-N
"""
from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Iterator

from .churn_model import (
    SCENARIOS,
    PersonaWeeklyResult,
    Scenario,
    simulate_persona,
)

# ---------------------------------------------------------------------------
# 세션 스코어 로더
# ---------------------------------------------------------------------------

def _load_round_scores(round_dir: Path) -> dict[int, dict]:
    """실제 ralph_loop 라운드 결과에서 Layer C + session_score 추출."""
    scores: dict[int, dict] = {}
    for persona_dir in sorted(round_dir.glob("persona_*")):
        pid_str = persona_dir.name.split("_")[1]
        try:
            pid = int(pid_str)
        except ValueError:
            continue

        sc_path = persona_dir / "session_score.json"
        lc_path = persona_dir / "scores_layer_c.json"
        inp_path = persona_dir / "input.json"
        if not (sc_path.exists() and lc_path.exists() and inp_path.exists()):
            continue

        sc = json.loads(sc_path.read_text(encoding="utf-8"))
        lc = json.loads(lc_path.read_text(encoding="utf-8"))
        inp = json.loads(inp_path.read_text(encoding="utf-8"))

        scores[pid] = {
            "persona_id": pid,
            "nickname": inp.get("nickname", f"persona_{pid:02d}"),
            "session_score": sc.get("session_score", 7.5),
            "desire_to_return": lc.get("desire_to_return", 6.0),
            "emotional_safety": lc.get("emotional_safety", 7.0),
            "insight_novelty": lc.get("insight_novelty", 6.0),
        }
    return scores


def _synthetic_scores(personas_jsonl: Path, seed: int = 42) -> dict[int, dict]:
    """personas_with_goals.jsonl → 합성 스코어 생성.

    방법 B에서 실제 세션 데이터 없이 이탈 분석을 돌릴 때 사용.
    emotional_tone, specificity_level 으로 현실적인 분포를 모사.
    """
    rng = random.Random(seed)
    scores: dict[int, dict] = {}

    # emotional_tone → 기대 desire_to_return 분포
    dtr_by_tone = {
        "motivated":   (7.5, 1.0),
        "curious":     (7.2, 1.0),
        "frustrated":  (5.8, 1.2),
        "anxious":     (5.5, 1.3),
        "exhausted":   (4.8, 1.4),
        "defiant":     (4.5, 1.5),
        "withdrawn":   (4.2, 1.5),
        "neutral":     (6.5, 1.1),
    }
    es_by_tone = {
        "motivated":   (8.0, 0.8),
        "curious":     (7.8, 0.8),
        "frustrated":  (6.2, 1.1),
        "anxious":     (5.8, 1.3),
        "exhausted":   (5.5, 1.3),
        "defiant":     (5.0, 1.4),
        "withdrawn":   (5.2, 1.4),
        "neutral":     (7.0, 1.0),
    }

    if not personas_jsonl.exists():
        # fallback: 34명 완전 합성
        for pid in range(1, 35):
            scores[pid] = {
                "persona_id": pid,
                "nickname": f"persona_{pid:02d}",
                "session_score": rng.gauss(7.8, 0.9),
                "desire_to_return": rng.gauss(6.5, 1.3),
                "emotional_safety": rng.gauss(7.0, 1.1),
                "insight_novelty":  rng.gauss(6.2, 1.2),
            }
        return scores

    with personas_jsonl.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            p = json.loads(line)
            pid = int(p["persona_id"])
            tone = (p.get("selected_goal") or {}).get("emotional_tone", "neutral")
            tone = tone.lower()

            dtr_mu, dtr_sd = dtr_by_tone.get(tone, (6.5, 1.2))
            es_mu, es_sd   = es_by_tone.get(tone, (7.0, 1.1))

            # specificity_level 보정: low → 약간 낮은 novelty
            spec = (p.get("selected_goal") or {}).get("specificity_level", "medium")
            nov_mu = 6.5 if spec == "high" else (6.0 if spec == "medium" else 5.4)

            dtr = max(1.0, min(10.0, rng.gauss(dtr_mu, dtr_sd)))
            es  = max(1.0, min(10.0, rng.gauss(es_mu,  es_sd)))
            nov = max(1.0, min(10.0, rng.gauss(nov_mu,  1.2)))
            ss  = max(1.0, min(10.0, 0.35 * dtr + 0.25 * es + 0.20 * nov + rng.gauss(2.5, 0.5)))

            scores[pid] = {
                "persona_id": pid,
                "nickname": p.get("nickname", f"persona_{pid:02d}"),
                "session_score": round(ss, 2),
                "desire_to_return": round(dtr, 2),
                "emotional_safety": round(es, 2),
                "insight_novelty":  round(nov, 2),
            }
    return scores


# ---------------------------------------------------------------------------
# 비정형 페르소나 목록 로드
# ---------------------------------------------------------------------------

def _load_atypical_ids(data_dir: Path) -> set[int]:
    p = data_dir / "atypical_personas.txt"
    if not p.exists():
        return set()
    ids: set[int] = set()
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            try:
                ids.add(int(line))
            except ValueError:
                pass
    return ids


# ---------------------------------------------------------------------------
# 메인 시뮬레이션
# ---------------------------------------------------------------------------

def run_simulation(
    scores: dict[int, dict],
    atypical_ids: set[int],
    scenarios: list[Scenario] | None = None,
    n_weeks: int = 12,
) -> dict[str, list[PersonaWeeklyResult]]:
    """시나리오별 페르소나 결과를 반환한다."""
    if scenarios is None:
        scenarios = SCENARIOS

    results: dict[str, list[PersonaWeeklyResult]] = {}
    for sc in scenarios:
        persona_results: list[PersonaWeeklyResult] = []
        for pid, s in sorted(scores.items()):
            r = simulate_persona(
                persona_id=pid,
                nickname=s["nickname"],
                is_atypical=pid in atypical_ids,
                desire_to_return=s["desire_to_return"],
                emotional_safety=s["emotional_safety"],
                insight_novelty=s["insight_novelty"],
                session_score=s["session_score"],
                scenario=sc,
                n_weeks=n_weeks,
            )
            persona_results.append(r)
        results[sc.name] = persona_results
    return results


# ---------------------------------------------------------------------------
# 결과 직렬화
# ---------------------------------------------------------------------------

def _result_to_dict(r: PersonaWeeklyResult) -> dict:
    return {
        "persona_id": r.persona_id,
        "nickname": r.nickname,
        "is_atypical": r.is_atypical,
        "scenario": r.scenario_name,
        "retention_curve": r.retention_curve,
        "weekly_churn_prob": [round(p, 4) for p in r.weekly_churn_prob],
        "median_churn_week": r.median_churn_week,
        "week12_retention": r.retention_curve[-1],
    }


def save_results(
    results: dict[str, list[PersonaWeeklyResult]],
    scores: dict[int, dict],
    out_dir: Path,
    n_weeks: int = 12,
) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)

    # 시나리오별 상세 파일
    for sc_name, persona_list in results.items():
        data = [_result_to_dict(r) for r in persona_list]
        (out_dir / f"scenario_{sc_name}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # 통합 요약
    summary = _build_summary(results, scores, n_weeks)
    (out_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return out_dir


def _build_summary(
    results: dict[str, list[PersonaWeeklyResult]],
    scores: dict[int, dict],
    n_weeks: int,
) -> dict:
    week_labels = [f"week_{w}" for w in range(1, n_weeks + 1)]
    scenarios_out = []

    for sc_name, persona_list in results.items():
        n = len(persona_list)
        # 전체 평균 잔존율 곡선
        mean_curve = [
            round(sum(r.retention_curve[w] for r in persona_list) / n, 4)
            for w in range(n_weeks)
        ]
        # 비정형 평균
        atypical = [r for r in persona_list if r.is_atypical]
        if atypical:
            atypical_curve = [
                round(sum(r.retention_curve[w] for r in atypical) / len(atypical), 4)
                for w in range(n_weeks)
            ]
        else:
            atypical_curve = mean_curve

        # 이탈 위험 상위 (week12 잔존율 기준 하위)
        at_risk = sorted(persona_list, key=lambda r: r.retention_curve[-1])[:5]

        scenarios_out.append({
            "scenario": sc_name,
            "n_personas": n,
            "mean_retention_by_week": dict(zip(week_labels, mean_curve)),
            "atypical_retention_by_week": dict(zip(week_labels, atypical_curve)),
            "week12_mean_retention": mean_curve[-1],
            "week12_atypical_retention": atypical_curve[-1],
            "at_risk_personas": [
                {
                    "persona_id": r.persona_id,
                    "nickname": r.nickname,
                    "is_atypical": r.is_atypical,
                    "week12_retention": r.retention_curve[-1],
                    "median_churn_week": r.median_churn_week,
                    "session_score": scores.get(r.persona_id, {}).get("session_score"),
                    "desire_to_return": scores.get(r.persona_id, {}).get("desire_to_return"),
                    "emotional_safety": scores.get(r.persona_id, {}).get("emotional_safety"),
                }
                for r in at_risk
            ],
        })

    return {
        "n_weeks": n_weeks,
        "week_labels": week_labels,
        "scenarios": scenarios_out,
    }
