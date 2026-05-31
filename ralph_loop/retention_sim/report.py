"""Markdown 리포트 생성 — summary.json → retention_report.md."""
from __future__ import annotations

import json
from pathlib import Path


def _bar(rate: float, width: int = 20) -> str:
    filled = round(rate * width)
    return "█" * filled + "░" * (width - filled) + f"  {rate*100:.1f}%"


def generate_report(summary_path: Path, out_path: Path | None = None) -> str:
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    n_weeks = summary["n_weeks"]
    scenarios = summary["scenarios"]

    lines: list[str] = []
    lines.append("# CareerPT 12주 Retention 시뮬레이션 리포트")
    lines.append("")
    lines.append(f"> 방법 B (이탈 시나리오 분석) — {n_weeks}주 시뮬레이션")
    lines.append("")

    # 시나리오별 요약 테이블
    lines.append("## 시나리오별 12주 잔존율 요약")
    lines.append("")
    lines.append("| 시나리오 | 전체 평균 (week 12) | 비정형 7명 (week 12) |")
    lines.append("|---|---:|---:|")
    for sc in scenarios:
        lines.append(
            f"| {sc['scenario']} "
            f"| {sc['week12_mean_retention']*100:.1f}% "
            f"| {sc['week12_atypical_retention']*100:.1f}% |"
        )
    lines.append("")

    # 시나리오별 상세 곡선
    for sc in scenarios:
        lines.append(f"## {sc['scenario']} 시나리오")
        lines.append("")
        lines.append("### 주별 전체 평균 잔존율")
        lines.append("")
        mean_curve = list(sc["mean_retention_by_week"].values())
        for i, rate in enumerate(mean_curve):
            label = f"Week {i+1:2d}"
            lines.append(f"  {label}  {_bar(rate)}")
        lines.append("")

        lines.append("### 이탈 위험 상위 5 페르소나")
        lines.append("")
        lines.append("| 페르소나 | 비정형 | 12주 잔존율 | 중간 이탈 주차 | desire_to_return | emotional_safety |")
        lines.append("|---|:---:|---:|:---:|---:|---:|")
        for p in sc["at_risk_personas"]:
            atypical_mark = "✓" if p["is_atypical"] else ""
            churn_week = p["median_churn_week"] if p["median_churn_week"] else "12주 이후"
            lines.append(
                f"| {p['nickname']} (#{p['persona_id']}) "
                f"| {atypical_mark} "
                f"| {p['week12_retention']*100:.1f}% "
                f"| {churn_week} "
                f"| {p['desire_to_return'] or '-'} "
                f"| {p['emotional_safety'] or '-'} |"
            )
        lines.append("")

    # 인사이트 섹션
    lines.append("## 주요 인사이트")
    lines.append("")
    _add_insights(lines, scenarios)

    report = "\n".join(lines)
    if out_path is None:
        out_path = summary_path.parent / "retention_report.md"
    out_path.write_text(report, encoding="utf-8")
    return report


def _add_insights(lines: list[str], scenarios: list[dict]) -> None:
    sc_map = {sc["scenario"]: sc for sc in scenarios}
    current = sc_map.get("current", {})
    target  = sc_map.get("target",  {})
    pessim  = sc_map.get("pessimistic", {})

    if current and target:
        delta = (target["week12_mean_retention"] - current["week12_mean_retention"]) * 100
        lines.append(
            f"- session_score 9.0 달성 시 12주 잔존율 **+{delta:.1f}%p** 개선 예상"
        )
        atypical_delta = (
            target["week12_atypical_retention"] - current["week12_atypical_retention"]
        ) * 100
        lines.append(
            f"- 비정형 7명의 12주 잔존율도 **+{atypical_delta:.1f}%p** 개선"
        )

    if current and pessim:
        risk_delta = (current["week12_mean_retention"] - pessim["week12_mean_retention"]) * 100
        lines.append(
            f"- 프롬프트 품질 저하(~7점) 시 잔존율 **-{risk_delta:.1f}%p** 하락 위험"
        )

    if current:
        at_risk = current.get("at_risk_personas", [])
        low_es = [p for p in at_risk if (p.get("emotional_safety") or 10) < 6.0]
        if low_es:
            names = ", ".join(p["nickname"] for p in low_es)
            lines.append(
                f"- emotional_safety < 6인 페르소나({names})는 조기 이탈(3주 이내) 위험 — "
                "Layer A 인터뷰 품질 개선 우선 필요"
            )

    lines.append("")
    lines.append(
        "> **해석 주의**: 본 시뮬레이션은 1차 세션 스코어 기반 모델이며,"
        " 실사용자 데이터(DAU, 재방문 로그)로 보정이 필요합니다."
    )
