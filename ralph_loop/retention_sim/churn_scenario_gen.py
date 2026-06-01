"""Claude API로 이탈 시나리오 N개를 생성한다.

사용법:
  python -m retention_sim.churn_scenario_gen --count 5

산출물:
  ~/.careerpt-sim/churn_b/scenarios.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_RALPH_ROOT = Path(__file__).resolve().parents[1]
if str(_RALPH_ROOT) not in sys.path:
    sys.path.insert(0, str(_RALPH_ROOT))

# coach_turn import 시도 — 없으면 직접 클라이언트 생성
try:
    from careerpt_sim.coach import coach_turn as _coach_turn
    _USE_COACH_TURN = True
except ImportError:
    _USE_COACH_TURN = False

from careerpt_sim.config import ANTHROPIC_API_KEY, SIM_HOME
from retention_sim.prompts.scenario_gen import SCENARIO_GEN_SYSTEM

# ---------------------------------------------------------------------------
# 상수
# ---------------------------------------------------------------------------

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 500
TEMPERATURE = 0.8

OUT_DIR = SIM_HOME / "churn_b"

# 생성할 시나리오 템플릿 (집중 주차 × 페르소나 타입)
SCENARIO_TEMPLATES: list[dict] = [
    {
        "persona_type": "야근_과부하_주니어",
        "week": 3,
        "hint": "입사 2년차, 야근이 잦아 액션 아이템을 3주 연속 못 했다. 앱을 열 시간도 없고 죄책감만 쌓인다.",
    },
    {
        "persona_type": "목표_재고_미드레벨",
        "week": 5,
        "hint": "5년차 마케터, 처음엔 열심히 했지만 '내 강점이 이게 맞나?' 의문이 생겼다. 액션은 하는데 의미를 모르겠다.",
    },
    {
        "persona_type": "고원현상_시니어",
        "week": 8,
        "hint": "10년차 시니어, 인사이트는 좋았는데 8주째 비슷한 내용 반복 같다. 새로운 자극이 없다.",
    },
    {
        "persona_type": "강점_불일치_신입",
        "week": 3,
        "hint": "취준생, 분석 강점으로 나왔는데 하라는 액션이 발표·소통 위주라 맞지 않는 느낌이다.",
    },
    {
        "persona_type": "일상_바쁨_직장인",
        "week": 5,
        "hint": "육아+직장 병행 중, 앱 자체는 좋은데 5주째 여유가 없다. 언젠가 다시 하겠다는 생각뿐.",
    },
]


# ---------------------------------------------------------------------------
# Claude 호출 레이어
# ---------------------------------------------------------------------------

def _call(system: str, user: str) -> str:
    """coach_turn 또는 직접 anthropic 클라이언트로 호출."""
    if _USE_COACH_TURN:
        # coach_turn은 COACH_MODEL 고정이므로 model 파라미터 없음
        # → haiku를 쓰려면 직접 호출 경로 사용
        pass  # fall through to direct call

    # 직접 호출 (haiku 모델 + temperature 지정)
    try:
        import anthropic
    except ImportError:
        raise RuntimeError("anthropic 패키지가 설치되지 않았습니다. pip install anthropic")

    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY가 .env에 설정되지 않았습니다.")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    resp = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return resp.content[0].text.strip()


# ---------------------------------------------------------------------------
# 시나리오 생성
# ---------------------------------------------------------------------------

def _build_user_message(template: dict) -> str:
    return (
        f"페르소나 타입: {template['persona_type']}\n"
        f"이탈 집중 주차: week {template['week']}\n"
        f"상황 힌트: {template['hint']}\n\n"
        "위 정보를 바탕으로 이탈 시나리오 JSON을 생성하라. "
        "scenario_id는 페르소나 타입을 축약해 사용하라."
    )


def _parse_json(text: str) -> dict | None:
    """응답 텍스트에서 JSON 객체를 추출한다."""
    import re
    # ```json ... ``` 블록 우선
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    raw = m.group(1) if m else text
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        return None
    try:
        return json.loads(raw[start:end])
    except json.JSONDecodeError:
        return None


def generate_scenarios(count: int = 5) -> list[dict]:
    """시나리오 템플릿에서 count개를 선택해 생성한다."""
    templates = SCENARIO_TEMPLATES[:count]
    results: list[dict] = []

    print(f"[churn_scenario_gen] 모델: {MODEL}  count: {count}")
    for i, tmpl in enumerate(templates, 1):
        print(f"  [{i}/{count}] {tmpl['persona_type']} (week {tmpl['week']}) ...", end=" ", flush=True)
        user_msg = _build_user_message(tmpl)
        try:
            raw = _call(SCENARIO_GEN_SYSTEM, user_msg)
            parsed = _parse_json(raw)
            if parsed is None:
                print("JSON 파싱 실패 — raw 저장")
                parsed = {"parse_error": True, "raw": raw}
            else:
                # 템플릿 메타를 보강 (Claude가 누락할 경우 대비)
                parsed.setdefault("week", tmpl["week"])
                parsed.setdefault("persona_type", tmpl["persona_type"])
                print(f"완료  churn_prob={parsed.get('churn_probability', '?')}")
        except Exception as e:
            print(f"오류: {e}")
            parsed = {"error": str(e), "persona_type": tmpl["persona_type"], "week": tmpl["week"]}

        results.append(parsed)

    return results


# ---------------------------------------------------------------------------
# 저장
# ---------------------------------------------------------------------------

def save(scenarios: list[dict]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "scenarios.json"
    out_path.write_text(
        json.dumps(scenarios, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return out_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="이탈 시나리오 생성 (Claude Haiku)")
    parser.add_argument(
        "--count", type=int, default=5,
        help=f"생성할 시나리오 수 (최대 {len(SCENARIO_TEMPLATES)}, 기본 5)",
    )
    args = parser.parse_args()

    count = min(args.count, len(SCENARIO_TEMPLATES))
    scenarios = generate_scenarios(count)
    out_path = save(scenarios)

    print(f"\n[churn_scenario_gen] {len(scenarios)}개 저장: {out_path}")
    print("\n-- 결과 요약 --")
    for sc in scenarios:
        if sc.get("parse_error") or sc.get("error"):
            print(f"  [FAIL] {sc.get('persona_type','?')}  오류")
        else:
            print(
                f"  [OK]   {sc.get('persona_type','?'):<24}"
                f"  week={sc.get('week','?')}"
                f"  churn_prob={sc.get('churn_probability','?')}"
            )
    print("---------------")


if __name__ == "__main__":
    main()
