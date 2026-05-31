"""churn_analysis/evaluation.json 생성 + report.html 빌드.

실행:
  python -m retention_sim.build_churn_report

산출물 (~/.careerpt-sim/churn_analysis/):
  evaluation.json  — 페르소나 × hook × 12주 잔존율 + hook 요약
  report.html      — 이탈 히트맵 + hook 효과 비교 막대 차트 (Chart.js CDN)
"""
from __future__ import annotations

import json
import math
import sys
from datetime import date
from pathlib import Path

_RALPH_ROOT = Path(__file__).resolve().parents[1]
if str(_RALPH_ROOT) not in sys.path:
    sys.path.insert(0, str(_RALPH_ROOT))

from careerpt_sim.config import DATA_DIR, SIM_HOME
from retention_sim.simulate import _load_atypical_ids, _synthetic_scores
from retention_sim.churn_model import SCENARIOS, weekly_churn_prob

OUT_DIR = SIM_HOME / "churn_analysis"
N_WEEKS = 12

# ---------------------------------------------------------------------------
# Hook 정의
# ---------------------------------------------------------------------------

HOOKS: dict[str, dict] = {
    "none": {
        "label": "없음 (none)",
        "description": "아무 hook 없음 — baseline",
        "response_rate": 0.00,
        # weekly_churn_multiplier[week-1]: 이탈 확률에 곱하는 배율 (1.0 = 변화 없음)
        "churn_multipliers": [1.0] * N_WEEKS,
    },
    "push_notification": {
        "label": "푸시 알림 (매일 9시 액션 알림)",
        "description": "daily push — 초반 강함, 6주차 이후 피로 누적",
        "response_rate": 0.34,
        # 1-5주차 강한 감소, 6주차 이후 피로로 효과 약화
        "churn_multipliers": [0.72, 0.74, 0.76, 0.78, 0.80, 0.90, 0.93, 0.95, 0.97, 0.98, 0.99, 1.00],
    },
    "weekly_coaching_cta": {
        "label": "주간 코칭 CTA (AI 코치 진입 유도)",
        "description": "weekly coaching prompt — 중반(3-8주)에 가장 효과적",
        "response_rate": 0.27,
        # 초반 약함 → 중반 피크 → 후반 안정
        "churn_multipliers": [0.90, 0.85, 0.78, 0.76, 0.74, 0.73, 0.74, 0.76, 0.80, 0.83, 0.86, 0.88],
    },
    "streak_badge": {
        "label": "연속 실행 배지 (streak badge)",
        "description": "gamification streak — 초반 강함, 장기 효과 감소",
        "response_rate": 0.41,
        # 1-4주차 강한 게임화 효과, 이후 자연 감쇠
        "churn_multipliers": [0.68, 0.70, 0.73, 0.76, 0.82, 0.87, 0.90, 0.93, 0.95, 0.97, 0.98, 1.00],
    },
}


# ---------------------------------------------------------------------------
# 페르소나 데이터 로드
# ---------------------------------------------------------------------------

def _load_persona_meta(personas_jsonl: Path) -> dict[int, dict]:
    """emotional_tone, persona_type 등 메타 추출."""
    meta: dict[int, dict] = {}
    if not personas_jsonl.exists():
        return meta
    with personas_jsonl.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            p = json.loads(line)
            pid = int(p["persona_id"])
            g = p.get("selected_goal") or {}
            tone = g.get("emotional_tone", "neutral").lower()
            spec = g.get("specificity_level", "medium")

            # 페르소나 타입 분류
            if tone in ("motivated", "curious"):
                ptype = "적극형"
            elif tone in ("frustrated", "anxious"):
                ptype = "불안형"
            elif tone in ("exhausted", "defiant", "withdrawn"):
                ptype = "이탈위험형"
            else:
                ptype = "중간형"

            meta[pid] = {
                "emotional_tone": tone,
                "specificity_level": spec,
                "persona_type": ptype,
            }
    return meta


# ---------------------------------------------------------------------------
# hook별 retention curve 계산
# ---------------------------------------------------------------------------

def _apply_hook(
    base_churn_probs: list[float],
    multipliers: list[float],
) -> tuple[list[float], list[float]]:
    """hook 이탈 배율 적용 → (hook별 이탈확률 리스트, 잔존율 곡선)."""
    churn_probs: list[float] = []
    curve: list[float] = []
    p_retained = 1.0
    for w, (base, mult) in enumerate(zip(base_churn_probs, multipliers)):
        p_c = max(0.0, min(0.95, base * mult))
        churn_probs.append(round(p_c, 4))
        p_retained *= (1.0 - p_c)
        curve.append(round(p_retained, 4))
    return churn_probs, curve


# ---------------------------------------------------------------------------
# evaluation.json 생성
# ---------------------------------------------------------------------------

def build_evaluation() -> dict:
    personas_jsonl = DATA_DIR / "personas_with_goals.jsonl"
    atypical_ids = _load_atypical_ids(DATA_DIR)
    scores = _synthetic_scores(personas_jsonl, seed=42)
    meta = _load_persona_meta(personas_jsonl)

    # current 시나리오 (실측 기준)
    current_sc = next(s for s in SCENARIOS if s.name == "current")

    persona_records: list[dict] = []
    for pid, s in sorted(scores.items()):
        m = meta.get(pid, {"emotional_tone": "neutral", "specificity_level": "medium", "persona_type": "중간형"})

        # 기저 이탈 확률 (hook 없을 때)
        base_churn = [
            weekly_churn_prob(
                week=w,
                desire_to_return=s["desire_to_return"],
                emotional_safety=s["emotional_safety"],
                insight_novelty=s["insight_novelty"],
                session_score=s["session_score"],
                scenario=current_sc,
            )
            for w in range(1, N_WEEKS + 1)
        ]

        hooks_data: dict[str, dict] = {}
        for hook_key, hook_def in HOOKS.items():
            churn_probs, curve = _apply_hook(base_churn, hook_def["churn_multipliers"])
            hooks_data[hook_key] = {
                "weekly_churn_prob": churn_probs,
                "retention_curve": curve,
                "week12_retention": curve[-1],
            }

        persona_records.append({
            "persona_id": pid,
            "nickname": s["nickname"],
            "is_atypical": pid in atypical_ids,
            "persona_type": m["persona_type"],
            "emotional_tone": m["emotional_tone"],
            "session_score": s["session_score"],
            "desire_to_return": s["desire_to_return"],
            "emotional_safety": s["emotional_safety"],
            "insight_novelty": s["insight_novelty"],
            "hooks": hooks_data,
        })

    # hook별 요약
    n = len(persona_records)
    hook_summary: dict[str, dict] = {}
    for hook_key, hook_def in HOOKS.items():
        curves = [p["hooks"][hook_key]["retention_curve"] for p in persona_records]
        atypical_curves = [p["hooks"][hook_key]["retention_curve"] for p in persona_records if p["is_atypical"]]
        mean_curve = [round(sum(c[w] for c in curves) / n, 4) for w in range(N_WEEKS)]
        atyp_curve = [round(sum(c[w] for c in atypical_curves) / len(atypical_curves), 4) for w in range(N_WEEKS)] if atypical_curves else mean_curve
        hook_summary[hook_key] = {
            "label": hook_def["label"],
            "description": hook_def["description"],
            "response_rate": hook_def["response_rate"],
            "mean_retention_curve": mean_curve,
            "atypical_retention_curve": atyp_curve,
            "week12_mean_retention": mean_curve[-1],
            "week12_atypical_retention": atyp_curve[-1],
        }

    return {
        "generated_at": str(date.today()),
        "n_weeks": N_WEEKS,
        "n_personas": n,
        "hooks": list(HOOKS.keys()),
        "hook_summary": hook_summary,
        "personas": persona_records,
    }


# ---------------------------------------------------------------------------
# report.html 생성
# ---------------------------------------------------------------------------

def build_html(ev: dict, out_path: Path) -> None:
    hooks = ev["hooks"]
    hook_summary = ev["hook_summary"]
    personas = ev["personas"]
    weeks = list(range(1, N_WEEKS + 1))

    # ── 히트맵 데이터: 페르소나 × 주차 × hook별 이탈확률
    # Y축 = 페르소나 닉네임, X축 = 주차, 색 = 이탈확률(none 기준)
    heatmap_labels_y = [p["nickname"] for p in personas]
    heatmap_data = []
    for pi, p in enumerate(personas):
        for wi, w in enumerate(weeks):
            heatmap_data.append({
                "x": w,
                "y": p["nickname"],
                "v": p["hooks"]["none"]["weekly_churn_prob"][wi],
                "atypical": p["is_atypical"],
            })

    # ── hook 비교 막대 차트
    hook_labels = [hook_summary[h]["label"] for h in hooks]
    hook_week12 = [round(hook_summary[h]["week12_mean_retention"] * 100, 1) for h in hooks]
    hook_response = [round(hook_summary[h]["response_rate"] * 100, 1) for h in hooks]
    hook_atypical = [round(hook_summary[h]["week12_atypical_retention"] * 100, 1) for h in hooks]

    # ── 라인 차트: hook별 평균 잔존율 곡선
    line_colors = ["#94a3b8", "#3b82f6", "#10b981", "#f59e0b"]
    line_datasets = []
    for i, h in enumerate(hooks):
        line_datasets.append({
            "label": hook_summary[h]["label"],
            "data": [round(v * 100, 1) for v in hook_summary[h]["mean_retention_curve"]],
            "borderColor": line_colors[i],
            "backgroundColor": line_colors[i] + "20",
            "tension": 0.3,
            "fill": False,
        })

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CareerPT 12주 Retention — Hook 효과 분석</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-chart-matrix@1.3.0/dist/chartjs-chart-matrix.min.js"></script>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }}
  header {{ padding: 24px 32px 16px; border-bottom: 1px solid #1e293b; }}
  header h1 {{ font-size: 20px; font-weight: 700; color: #f8fafc; }}
  header p  {{ font-size: 13px; color: #64748b; margin-top: 4px; }}
  .tabs {{ display: flex; gap: 0; padding: 0 32px; border-bottom: 1px solid #1e293b; }}
  .tab {{ padding: 12px 20px; font-size: 13px; cursor: pointer; border-bottom: 2px solid transparent; color: #64748b; transition: all .15s; }}
  .tab.active {{ color: #38bdf8; border-color: #38bdf8; }}
  .panel {{ display: none; padding: 28px 32px; }}
  .panel.active {{ display: block; }}
  .chart-wrap {{ background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 24px; }}
  .chart-wrap h2 {{ font-size: 14px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px; }}
  .chart-wrap p  {{ font-size: 12px; color: #475569; margin-bottom: 16px; }}
  canvas {{ max-height: 420px; }}
  #heatmap-canvas {{ max-height: 560px; }}
  .summary-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }}
  .kpi {{ background: #1e293b; border-radius: 10px; padding: 16px; }}
  .kpi .label {{ font-size: 11px; color: #64748b; margin-bottom: 6px; }}
  .kpi .value {{ font-size: 22px; font-weight: 700; color: #f8fafc; }}
  .kpi .sub {{ font-size: 11px; color: #475569; margin-top: 2px; }}
  .badge {{ display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-left: 6px; }}
  .badge-best {{ background: #064e3b; color: #34d399; }}
  .badge-worst {{ background: #4c0519; color: #f87171; }}
  .note {{ font-size: 11px; color: #475569; margin-top: 12px; padding: 10px 14px; background: #1e293b; border-radius: 8px; border-left: 3px solid #334155; }}
</style>
</head>
<body>
<header>
  <h1>CareerPT 12주 Retention — Hook 효과 분석</h1>
  <p>생성일 {ev['generated_at']} · {ev['n_personas']}명 페르소나 · {ev['n_weeks']}주 시뮬레이션 (방법 B)</p>
</header>

<div class="tabs">
  <div class="tab active" onclick="switchTab(0)">이탈 히트맵</div>
  <div class="tab" onclick="switchTab(1)">Hook 효과 비교</div>
  <div class="tab" onclick="switchTab(2)">잔존율 곡선</div>
</div>

<!-- Panel 0: 히트맵 -->
<div class="panel active" id="panel-0">
  <div class="chart-wrap">
    <h2>페르소나별 주간 이탈 확률 히트맵 (hook=none 기준)</h2>
    <p>X축: 주차(1~12) · Y축: 페르소나 · 색상: 진할수록 이탈 위험 높음</p>
    <canvas id="heatmap-canvas"></canvas>
  </div>
  <p class="note">⚠ hook=none(아무 개입 없음) 시나리오 기준. 붉은 셀이 많은 페르소나는 조기 이탈 위험군.</p>
</div>

<!-- Panel 1: Hook 비교 -->
<div class="panel" id="panel-1">
  <div class="summary-grid" id="kpi-grid"></div>
  <div class="chart-wrap">
    <h2>Hook 종류별 12주 잔존율 & 반응률 비교</h2>
    <p>잔존율: 12주 후 앱을 계속 사용 중인 페르소나 비율 · 반응률: hook에 실제 반응하는 비율</p>
    <canvas id="bar-canvas"></canvas>
  </div>
  <div class="chart-wrap">
    <h2>비정형 7명 12주 잔존율</h2>
    <p>이탈 위험이 높은 비정형 페르소나에서의 hook 효과 차이</p>
    <canvas id="atypical-canvas"></canvas>
  </div>
</div>

<!-- Panel 2: 잔존율 곡선 -->
<div class="panel" id="panel-2">
  <div class="chart-wrap">
    <h2>Hook별 평균 잔존율 곡선 (전체 {ev['n_personas']}명)</h2>
    <p>주차별 누적 잔존율. 기울기가 완만할수록 hook 효과가 큼.</p>
    <canvas id="line-canvas"></canvas>
  </div>
</div>

<script>
const WEEKS = {json.dumps(weeks)};
const HOOK_LABELS = {json.dumps(hook_labels)};
const HOOK_WEEK12 = {json.dumps(hook_week12)};
const HOOK_RESPONSE = {json.dumps(hook_response)};
const HOOK_ATYPICAL = {json.dumps(hook_atypical)};
const HEATMAP_Y = {json.dumps(heatmap_labels_y)};
const HEATMAP_DATA = {json.dumps(heatmap_data)};
const LINE_DATASETS = {json.dumps(line_datasets)};
const HOOK_COLORS = ["#94a3b8","#3b82f6","#10b981","#f59e0b"];

// ── 탭 전환
function switchTab(idx) {{
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', i===idx));
  document.querySelectorAll('.panel').forEach((p,i) => p.classList.toggle('active', i===idx));
}}

// ── KPI 카드
const kpiGrid = document.getElementById('kpi-grid');
const bestIdx = HOOK_WEEK12.indexOf(Math.max(...HOOK_WEEK12));
const worstIdx = HOOK_WEEK12.indexOf(Math.min(...HOOK_WEEK12));
HOOK_LABELS.forEach((label, i) => {{
  const isBest = i === bestIdx, isWorst = i === worstIdx;
  kpiGrid.innerHTML += `
    <div class="kpi">
      <div class="label">${{label}}${{isBest ? '<span class="badge badge-best">BEST</span>' : ''}}${{isWorst ? '<span class="badge badge-worst">BASE</span>' : ''}}</div>
      <div class="value">${{HOOK_WEEK12[i]}}%</div>
      <div class="sub">12주 잔존율 · 반응률 ${{HOOK_RESPONSE[i]}}%</div>
    </div>`;
}});

// ── 히트맵
new Chart(document.getElementById('heatmap-canvas'), {{
  type: 'matrix',
  data: {{
    datasets: [{{
      label: '이탈 확률',
      data: HEATMAP_DATA,
      backgroundColor(ctx) {{
        const v = ctx.dataset.data[ctx.dataIndex]?.v ?? 0;
        const r = Math.round(20 + v * 220);
        const g = Math.round(220 - v * 190);
        const b = Math.round(60 - v * 50);
        return `rgba(${{r}},${{g}},${{b}},0.85)`;
      }},
      width(ctx) {{ return (ctx.chart.chartArea?.width ?? 400) / 12 - 1; }},
      height(ctx) {{ return (ctx.chart.chartArea?.height ?? 600) / HEATMAP_Y.length - 1; }},
    }}],
  }},
  options: {{
    responsive: true,
    plugins: {{
      legend: {{ display: false }},
      tooltip: {{
        callbacks: {{
          title: (items) => `주차 ${{items[0].raw.x}} · ${{items[0].raw.y}}`,
          label: (item) => `이탈 확률: ${{(item.raw.v * 100).toFixed(1)}}%${{item.raw.atypical ? ' ★비정형' : ''}}`,
        }},
      }},
    }},
    scales: {{
      x: {{
        type: 'linear', min: 0.5, max: 12.5,
        ticks: {{ stepSize: 1, callback: v => `W${{v}}`, color: '#64748b' }},
        grid: {{ color: '#0f172a' }},
      }},
      y: {{
        type: 'category', labels: HEATMAP_Y,
        ticks: {{ color: '#64748b', font: {{ size: 10 }} }},
        grid: {{ color: '#0f172a' }},
      }},
    }},
  }},
}});

// ── 막대 차트
new Chart(document.getElementById('bar-canvas'), {{
  type: 'bar',
  data: {{
    labels: HOOK_LABELS,
    datasets: [
      {{
        label: '12주 잔존율 (%)',
        data: HOOK_WEEK12,
        backgroundColor: HOOK_COLORS.map(c => c + 'cc'),
        borderColor: HOOK_COLORS,
        borderWidth: 1.5,
        yAxisID: 'y',
      }},
      {{
        label: '반응률 (%)',
        data: HOOK_RESPONSE,
        type: 'line',
        borderColor: '#e2e8f0',
        backgroundColor: '#e2e8f020',
        pointRadius: 5,
        tension: 0.3,
        yAxisID: 'y2',
      }},
    ],
  }},
  options: {{
    responsive: true,
    plugins: {{ legend: {{ labels: {{ color: '#94a3b8' }} }} }},
    scales: {{
      x: {{ ticks: {{ color: '#64748b' }}, grid: {{ color: '#1e293b' }} }},
      y: {{ title: {{ display: true, text: '12주 잔존율 (%)', color: '#64748b' }}, ticks: {{ color: '#64748b' }}, grid: {{ color: '#1e293b' }} }},
      y2: {{ position: 'right', title: {{ display: true, text: '반응률 (%)', color: '#64748b' }}, ticks: {{ color: '#64748b' }}, grid: {{ display: false }} }},
    }},
  }},
}});

// ── 비정형 막대
new Chart(document.getElementById('atypical-canvas'), {{
  type: 'bar',
  data: {{
    labels: HOOK_LABELS,
    datasets: [{{
      label: '비정형 7명 12주 잔존율 (%)',
      data: HOOK_ATYPICAL,
      backgroundColor: HOOK_COLORS.map(c => c + 'bb'),
      borderColor: HOOK_COLORS,
      borderWidth: 1.5,
    }}],
  }},
  options: {{
    responsive: true,
    plugins: {{ legend: {{ labels: {{ color: '#94a3b8' }} }} }},
    scales: {{
      x: {{ ticks: {{ color: '#64748b' }}, grid: {{ color: '#1e293b' }} }},
      y: {{ ticks: {{ color: '#64748b' }}, grid: {{ color: '#1e293b' }} }},
    }},
  }},
}});

// ── 라인 차트
new Chart(document.getElementById('line-canvas'), {{
  type: 'line',
  data: {{
    labels: WEEKS.map(w => `Week ${{w}}`),
    datasets: LINE_DATASETS,
  }},
  options: {{
    responsive: true,
    plugins: {{ legend: {{ labels: {{ color: '#94a3b8' }} }} }},
    scales: {{
      x: {{ ticks: {{ color: '#64748b' }}, grid: {{ color: '#1e293b' }} }},
      y: {{ min: 0, max: 100, title: {{ display: true, text: '잔존율 (%)', color: '#64748b' }}, ticks: {{ color: '#64748b', callback: v => v + '%' }}, grid: {{ color: '#1e293b' }} }},
    }},
  }},
}});
</script>
</body>
</html>"""
    out_path.write_text(html, encoding="utf-8")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("[build_churn_report] evaluation.json 생성 중 ...")
    ev = build_evaluation()
    ev_path = OUT_DIR / "evaluation.json"
    ev_path.write_text(json.dumps(ev, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  저장: {ev_path}  ({ev['n_personas']}명 × {ev['n_weeks']}주 × {len(ev['hooks'])} hooks)")

    print("[build_churn_report] report.html 빌드 중 ...")
    html_path = OUT_DIR / "report.html"
    build_html(ev, html_path)
    print(f"  저장: {html_path}")

    print("\n── hook 요약 ─────────────────────────────────")
    for h, s in ev["hook_summary"].items():
        print(f"  {h:<25}  12주 잔존율 {s['week12_mean_retention']*100:5.1f}%  반응률 {s['response_rate']*100:.0f}%")
    print("─────────────────────────────────────────────")
    print(f"\n브라우저에서 열기: {html_path}")


if __name__ == "__main__":
    main()
