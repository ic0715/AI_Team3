"""retention_results/summary.json → retention_report.html 빌드.

실행:
  python -m retention_sim.build_scenario_report

산출물:
  ~/.careerpt-sim/retention_results/retention_report.html
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_RALPH_ROOT = Path(__file__).resolve().parents[1]
if str(_RALPH_ROOT) not in sys.path:
    sys.path.insert(0, str(_RALPH_ROOT))

from careerpt_sim.config import SIM_HOME

RESULTS_DIR = SIM_HOME / "retention_results"

SC_META = {
    "pessimistic": {"label": "비관 시나리오",  "desc": "session_score ~7점 (프롬프트 품질 저하)", "color": "#f87171"},
    "current":     {"label": "현재 시나리오",  "desc": "실측 기준 (합성 스코어)",               "color": "#60a5fa"},
    "target":      {"label": "목표 시나리오",  "desc": "session_score ≥ 9.0 달성",              "color": "#34d399"},
}


def build_html(summary: dict, out_path: Path) -> None:
    scenarios = summary["scenarios"]
    weeks = list(range(1, summary["n_weeks"] + 1))
    week_labels = [f"Week {w}" for w in weeks]

    # ── 라인 차트: 시나리오별 전체 평균 잔존율
    line_datasets = []
    for sc in scenarios:
        m = SC_META.get(sc["scenario"], {"label": sc["scenario"], "color": "#94a3b8"})
        curve = list(sc["mean_retention_by_week"].values())
        line_datasets.append({
            "label": m["label"],
            "data": [round(v * 100, 1) for v in curve],
            "borderColor": m["color"],
            "backgroundColor": m["color"] + "20",
            "tension": 0.35,
            "fill": False,
            "pointRadius": 4,
        })

    # ── 비정형 라인 차트
    atypical_datasets = []
    for sc in scenarios:
        m = SC_META.get(sc["scenario"], {"label": sc["scenario"], "color": "#94a3b8"})
        curve = list(sc["atypical_retention_by_week"].values())
        atypical_datasets.append({
            "label": m["label"] + " (비정형 7명)",
            "data": [round(v * 100, 1) for v in curve],
            "borderColor": m["color"],
            "borderDash": [5, 3],
            "backgroundColor": m["color"] + "15",
            "tension": 0.35,
            "fill": False,
            "pointRadius": 3,
        })

    # ── 이탈 위험 테이블 데이터 (current 기준)
    current = next((s for s in scenarios if s["scenario"] == "current"), scenarios[0])
    at_risk = current.get("at_risk_personas", [])

    # ── 이탈 위험 페르소나의 시나리오별 12주 잔존율 (risk 비교 차트용)
    # scenario_{name}.json 에서 개별 페르소나 데이터 조회
    at_risk_ids = [p["persona_id"] for p in at_risk]
    risk_cross: dict[str, list[float]] = {}  # scenario_name → [week12 per at-risk persona]
    for sc in scenarios:
        sc_name = sc["scenario"]
        sc_file = RESULTS_DIR / f"scenario_{sc_name}.json"
        if sc_file.exists():
            sc_personas = {
                r["persona_id"]: r
                for r in json.loads(sc_file.read_text(encoding="utf-8"))
            }
            risk_cross[sc_name] = [
                round(sc_personas[pid]["week12_retention"] * 100, 1) if pid in sc_personas else 0.0
                for pid in at_risk_ids
            ]
        else:
            risk_cross[sc_name] = [0.0] * len(at_risk_ids)

    # ── 시나리오 간 12주 잔존율 델타
    sc_map = {s["scenario"]: s for s in scenarios}
    delta_pt = 0.0
    delta_atyp = 0.0
    risk_drop = 0.0
    if "target" in sc_map and "current" in sc_map:
        delta_pt   = (sc_map["target"]["week12_mean_retention"] - sc_map["current"]["week12_mean_retention"]) * 100
        delta_atyp = (sc_map["target"]["week12_atypical_retention"] - sc_map["current"]["week12_atypical_retention"]) * 100
    if "current" in sc_map and "pessimistic" in sc_map:
        risk_drop  = (sc_map["current"]["week12_mean_retention"] - sc_map["pessimistic"]["week12_mean_retention"]) * 100

    # ── 히트맵 데이터: scenario × week
    heatmap_rows = []
    for sc in scenarios:
        m = SC_META.get(sc["scenario"], {"label": sc["scenario"]})
        curve = list(sc["mean_retention_by_week"].values())
        heatmap_rows.append({"label": m["label"], "data": [round(v * 100, 1) for v in curve]})

    at_risk_rows = "".join(
        f"""<tr>
          <td>{p['nickname']} <span class="pid">#{p['persona_id']}</span></td>
          <td>{"<span class='badge-atyp'>비정형</span>" if p['is_atypical'] else ""}</td>
          <td>{p['week12_retention']*100:.1f}%</td>
          <td>{p['median_churn_week'] if p['median_churn_week'] else "12주+"}</td>
          <td>{p['desire_to_return'] or '-'}</td>
          <td>{p['emotional_safety'] or '-'}</td>
        </tr>"""
        for p in at_risk
    )

    sc_kpis = "".join(
        f"""<div class="kpi">
          <div class="kpi-dot" style="background:{SC_META.get(sc['scenario'],{}).get('color','#94a3b8')}"></div>
          <div class="kpi-body">
            <div class="kpi-label">{SC_META.get(sc['scenario'],{}).get('label', sc['scenario'])}</div>
            <div class="kpi-val">{sc['week12_mean_retention']*100:.1f}%</div>
            <div class="kpi-sub">12주 잔존율 · 비정형 {sc['week12_atypical_retention']*100:.1f}%</div>
          </div>
        </div>"""
        for sc in scenarios
    )

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CareerPT 12주 Retention — 시나리오 분석</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}}
  header{{padding:24px 32px 16px;border-bottom:1px solid #1e293b}}
  header h1{{font-size:20px;font-weight:700;color:#f8fafc}}
  header p{{font-size:13px;color:#64748b;margin-top:4px}}
  .tabs{{display:flex;padding:0 32px;border-bottom:1px solid #1e293b}}
  .tab{{padding:12px 20px;font-size:13px;cursor:pointer;border-bottom:2px solid transparent;color:#64748b;transition:all .15s}}
  .tab.active{{color:#38bdf8;border-color:#38bdf8}}
  .panel{{display:none;padding:28px 32px}}
  .panel.active{{display:block}}
  .kpi-row{{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}}
  .kpi{{display:flex;align-items:center;gap:12px;background:#1e293b;border-radius:10px;padding:14px 18px;flex:1;min-width:180px}}
  .kpi-dot{{width:10px;height:10px;border-radius:50%;flex-shrink:0}}
  .kpi-label{{font-size:11px;color:#64748b;margin-bottom:2px}}
  .kpi-val{{font-size:22px;font-weight:700;color:#f8fafc}}
  .kpi-sub{{font-size:11px;color:#475569;margin-top:2px}}
  .insight-row{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}}
  .insight{{background:#1e293b;border-radius:10px;padding:14px 16px;border-left:3px solid}}
  .insight .num{{font-size:24px;font-weight:700;margin-bottom:4px}}
  .insight .desc{{font-size:12px;color:#64748b}}
  .chart-wrap{{background:#1e293b;border-radius:12px;padding:24px;margin-bottom:20px}}
  .chart-wrap h2{{font-size:14px;font-weight:600;color:#cbd5e1;margin-bottom:3px}}
  .chart-wrap p{{font-size:12px;color:#475569;margin-bottom:16px}}
  canvas{{max-height:380px}}
  table{{width:100%;border-collapse:collapse;font-size:13px}}
  th{{text-align:left;padding:8px 12px;color:#64748b;font-weight:500;border-bottom:1px solid #1e293b;font-size:12px}}
  td{{padding:8px 12px;border-bottom:1px solid #1e293b20;color:#cbd5e1}}
  tr:hover td{{background:#1e293b40}}
  .pid{{color:#475569;font-size:11px}}
  .badge-atyp{{background:#312e81;color:#a5b4fc;font-size:10px;padding:1px 6px;border-radius:4px;font-weight:600}}
  .heatmap-wrap{{overflow-x:auto}}
  .heatmap-table{{border-collapse:collapse;font-size:11px;min-width:600px}}
  .heatmap-table th,.heatmap-table td{{padding:4px 6px;text-align:center;border:1px solid #0f172a20}}
  .heatmap-table th{{background:#1e293b;color:#64748b;font-weight:500}}
  .heatmap-table td.label-cell{{text-align:left;white-space:nowrap;color:#94a3b8;font-weight:500;background:#1e293b;padding:4px 10px}}
  .note{{font-size:11px;color:#475569;margin-top:12px;padding:10px 14px;background:#1e293b;border-radius:8px;border-left:3px solid #334155}}
</style>
</head>
<body>
<header>
  <h1>CareerPT 12주 Retention — 시나리오 분석</h1>
  <p>방법 B (이탈 시나리오 분석) · 34명 페르소나 · 12주 · 3 시나리오 비교</p>
</header>

<div class="tabs">
  <div class="tab active" onclick="switchTab(0)">개요</div>
  <div class="tab" onclick="switchTab(1)">잔존율 곡선</div>
  <div class="tab" onclick="switchTab(2)">이탈 위험 분석</div>
</div>

<!-- Panel 0: 개요 -->
<div class="panel active" id="panel-0">
  <div class="kpi-row">{sc_kpis}</div>
  <div class="insight-row">
    <div class="insight" style="border-color:#34d399">
      <div class="num" style="color:#34d399">+{delta_pt:.1f}%p</div>
      <div class="desc">목표 달성 시 전체 잔존율 개선</div>
    </div>
    <div class="insight" style="border-color:#a78bfa">
      <div class="num" style="color:#a78bfa">+{delta_atyp:.1f}%p</div>
      <div class="desc">목표 달성 시 비정형 7명 잔존율 개선</div>
    </div>
    <div class="insight" style="border-color:#f87171">
      <div class="num" style="color:#f87171">-{risk_drop:.1f}%p</div>
      <div class="desc">품질 저하 시 잔존율 하락 위험</div>
    </div>
  </div>
  <div class="chart-wrap">
    <h2>시나리오별 12주 평균 잔존율 비교 (막대)</h2>
    <p>각 시나리오의 주차별 전체 평균 잔존율</p>
    <canvas id="bar-canvas"></canvas>
  </div>
  <div class="heatmap-wrap">
    <div class="chart-wrap">
      <h2>주차별 잔존율 히트맵</h2>
      <p>셀 색상: 초록 → 높은 잔존율, 빨강 → 낮은 잔존율</p>
      <table class="heatmap-table" id="heatmap-table"></table>
    </div>
  </div>
</div>

<!-- Panel 1: 잔존율 곡선 -->
<div class="panel" id="panel-1">
  <div class="chart-wrap">
    <h2>시나리오별 전체 평균 잔존율 곡선</h2>
    <p>기울기가 완만할수록 이탈이 적음</p>
    <canvas id="line-canvas"></canvas>
  </div>
  <div class="chart-wrap">
    <h2>비정형 7명 잔존율 곡선 (점선)</h2>
    <p>이탈 위험이 높은 비정형 페르소나 그룹의 시나리오별 곡선</p>
    <canvas id="atypical-canvas"></canvas>
  </div>
</div>

<!-- Panel 2: 이탈 위험 -->
<div class="panel" id="panel-2">
  <div class="chart-wrap">
    <h2>이탈 위험 상위 5 페르소나 (current 시나리오 기준)</h2>
    <p>12주 잔존율이 가장 낮은 페르소나. emotional_safety &lt; 6이면 3주 이내 조기 이탈 위험.</p>
    <table>
      <thead><tr>
        <th>페르소나</th><th>비정형</th><th>12주 잔존율</th>
        <th>중간 이탈 주차</th><th>desire_to_return</th><th>emotional_safety</th>
      </tr></thead>
      <tbody>{at_risk_rows}</tbody>
    </table>
  </div>
  <div class="chart-wrap">
    <h2>이탈 위험 상위 5 — 시나리오별 12주 잔존율 비교</h2>
    <p>같은 페르소나가 시나리오에 따라 얼마나 달라지는지 확인</p>
    <canvas id="risk-canvas"></canvas>
  </div>
  <p class="note">
    ⚠ emotional_safety &lt; 6인 페르소나(신현수·김지원·정민호)는 Layer A 인터뷰 품질 개선이 최우선.
    session_score 개선만으로는 이 페르소나의 조기 이탈을 막기 어렵습니다.
  </p>
</div>

<script>
const WEEK_LABELS = {json.dumps(week_labels)};
const LINE_DATASETS = {json.dumps(line_datasets)};
const ATYPICAL_DATASETS = {json.dumps(atypical_datasets)};
const HEATMAP_ROWS = {json.dumps(heatmap_rows)};
const AT_RISK = {json.dumps(at_risk)};
const AT_RISK_NAMES = {json.dumps([p['nickname'] for p in at_risk])};
const SC_COLORS = {json.dumps([SC_META.get(s['scenario'], {}).get('color', '#94a3b8') for s in scenarios])};
const SC_LABELS = {json.dumps([SC_META.get(s['scenario'], {}).get('label', s['scenario']) for s in scenarios])};
const SC_WEEK12 = {json.dumps([round(s['week12_mean_retention']*100,1) for s in scenarios])};
const RISK_CROSS = {json.dumps([risk_cross.get(s['scenario'], []) for s in scenarios])};

function switchTab(idx) {{
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', i===idx));
  document.querySelectorAll('.panel').forEach((p,i) => p.classList.toggle('active', i===idx));
}}

// ── 히트맵 테이블 (CSS)
const ht = document.getElementById('heatmap-table');
let thead = '<tr><th>시나리오</th>' + WEEK_LABELS.map(l => `<th>${{l}}</th>`).join('') + '</tr>';
ht.innerHTML = '<thead>' + thead + '</thead>';
const tbody = document.createElement('tbody');
HEATMAP_ROWS.forEach(row => {{
  const tr = document.createElement('tr');
  tr.innerHTML = `<td class="label-cell">${{row.label}}</td>`;
  row.data.forEach(v => {{
    const norm = v / 100;
    const r = Math.round(220 - norm * 190);
    const g = Math.round(60 + norm * 160);
    const b = Math.round(60 + norm * 60);
    const td = document.createElement('td');
    td.style.background = `rgba(${{r}},${{g}},${{b}},0.75)`;
    td.style.color = norm > 0.4 ? '#052e16' : '#fca5a5';
    td.style.fontWeight = '600';
    td.textContent = v + '%';
    tr.appendChild(td);
  }});
  tbody.appendChild(tr);
}});
ht.appendChild(tbody);

// ── 막대 차트
new Chart(document.getElementById('bar-canvas'), {{
  type: 'bar',
  data: {{
    labels: WEEK_LABELS,
    datasets: LINE_DATASETS.map((ds, i) => ({{
      label: ds.label,
      data: ds.data,
      backgroundColor: SC_COLORS[i] + 'aa',
      borderColor: SC_COLORS[i],
      borderWidth: 1.5,
    }})),
  }},
  options: {{
    responsive: true,
    plugins: {{ legend: {{ labels: {{ color: '#94a3b8' }} }} }},
    scales: {{
      x: {{ ticks: {{ color: '#64748b' }}, grid: {{ color: '#1e293b' }} }},
      y: {{ min:0, max:100, ticks: {{ color: '#64748b', callback: v => v+'%' }}, grid: {{ color: '#1e293b' }} }},
    }},
  }},
}});

// ── 라인 차트
new Chart(document.getElementById('line-canvas'), {{
  type: 'line',
  data: {{ labels: WEEK_LABELS, datasets: LINE_DATASETS }},
  options: {{
    responsive: true,
    plugins: {{ legend: {{ labels: {{ color: '#94a3b8' }} }} }},
    scales: {{
      x: {{ ticks: {{ color: '#64748b' }}, grid: {{ color: '#1e293b' }} }},
      y: {{ min:0, max:100, ticks: {{ color: '#64748b', callback: v => v+'%' }}, grid: {{ color: '#1e293b' }} }},
    }},
  }},
}});

// ── 비정형 라인
new Chart(document.getElementById('atypical-canvas'), {{
  type: 'line',
  data: {{ labels: WEEK_LABELS, datasets: ATYPICAL_DATASETS }},
  options: {{
    responsive: true,
    plugins: {{ legend: {{ labels: {{ color: '#94a3b8' }} }} }},
    scales: {{
      x: {{ ticks: {{ color: '#64748b' }}, grid: {{ color: '#1e293b' }} }},
      y: {{ min:0, max:100, ticks: {{ color: '#64748b', callback: v => v+'%' }}, grid: {{ color: '#1e293b' }} }},
    }},
  }},
}});

// ── 이탈 위험 페르소나 시나리오 비교 (RISK_CROSS: scenario × at-risk persona)
if (AT_RISK.length) {{
  new Chart(document.getElementById('risk-canvas'), {{
    type: 'bar',
    data: {{
      labels: AT_RISK_NAMES,
      datasets: SC_LABELS.map((label, i) => ({{
        label,
        data: RISK_CROSS[i],
        backgroundColor: SC_COLORS[i] + 'aa',
        borderColor: SC_COLORS[i],
        borderWidth: 1.5,
      }})),
    }},
    options: {{
      responsive: true,
      plugins: {{
        legend: {{ labels: {{ color: '#94a3b8' }} }},
        tooltip: {{ callbacks: {{ label: ctx => ctx.dataset.label + ': ' + ctx.raw + '%' }} }},
      }},
      scales: {{
        x: {{ ticks: {{ color: '#64748b' }}, grid: {{ color: '#1e293b' }} }},
        y: {{ min:0, title: {{ display:true, text:'12주 잔존율 (%)', color:'#64748b' }}, ticks: {{ color: '#64748b', callback: v => v+'%' }}, grid: {{ color: '#1e293b' }} }},
      }},
    }},
  }});
}}
</script>
</body>
</html>"""
    out_path.write_text(html, encoding="utf-8")


def main() -> None:
    summary_path = RESULTS_DIR / "summary.json"
    if not summary_path.exists():
        print(f"오류: {summary_path} 없음. 먼저 run_retention.py를 실행하세요.")
        sys.exit(1)

    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    out_path = RESULTS_DIR / "retention_report.html"
    build_html(summary, out_path)
    print(f"[build_scenario_report] 저장: {out_path}")
    print(f"브라우저에서 열기: {out_path}")


if __name__ == "__main__":
    main()
