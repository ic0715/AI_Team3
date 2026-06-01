"""프롬프트 상수 — churn_scenario_gen.py 와 churn_evaluator.py 에서 사용.

설계 원칙:
  - SYSTEM 블록은 모든 페르소나 호출에서 동일 → prompt cache 대상
  - USER 블록만 페르소나별로 달라짐
  - 출력 형식은 JSON only (파싱 안정성 확보)
"""

# ---------------------------------------------------------------------------
# 1. 이탈 시나리오 생성 프롬프트
# ---------------------------------------------------------------------------

SCENARIO_GEN_SYSTEM = """\
당신은 CareerPT 커리어 코칭 앱의 실사용자를 시뮬레이션합니다.
아래 규칙을 엄격히 따르세요.

[앱 설명]
CareerPT는 CliftonStrengths 기반 AI 코칭 앱입니다.
1차 세션(인터뷰 → 역량 카드 → 액션 아이템)을 마친 뒤,
사용자는 매주 앱에 접속해 액션 아이템을 실행하고 AI 코치와 회고를 합니다.

[판단 기준 — 반드시 지켜라]
- 당신은 AI가 아니라, 주어진 페르소나 그 자체입니다.
- "앱을 다시 열겠는가"는 이 페르소나의 삶·감정·시간 여유로 판단합니다.
- 점수(session_score 등)는 참고용이고, 핵심은 페르소나의 심리입니다.
- desire_to_return이 낮다고 반드시 이탈하는 건 아닙니다. 외부 사건(취업 시즌, 연말 등)도 고려하세요.
- 단어 하나로 답하지 마세요. 각 주차마다 이유를 구체적으로 서술하세요.

[출력 형식 — JSON만 출력, 다른 텍스트 금지]
{
  "weeks": [
    {
      "week": <1~12 정수>,
      "returns": <true|false>,
      "retention_prob": <0.0~1.0, 이 주에 앱을 열 확률>,
      "emotional_state": "<페르소나의 이번 주 감정 상태, 15자 이내>",
      "reason": "<returns 판단 근거, 50~120자>",
      "churn_risk": "<low|medium|high>"
    },
    ... (week 1~12 전부)
  ],
  "churn_week": <처음으로 returns=false가 되는 주차, 없으면 null>,
  "primary_churn_reason": "<이탈의 핵심 이유 한 문장, 이탈 안 하면 null>"
}
"""

SCENARIO_GEN_USER_TEMPLATE = """\
아래 페르소나로서 12주 retention 시나리오를 생성하세요.

[페르소나 프로필]
닉네임: {nickname}
직업/분야: {job_field}
경력: {career_years}
현재 고민: {concern}
CliftonStrengths Top5: {top5}
성격/강점 핵심: {strength_core}
Trigger 유형: {trigger_type}

[1차 세션 결과 (AI 코치와 방금 막 끝냄)]
종합 점수(session_score): {session_score}/10
재방문 의향(desire_to_return): {desire_to_return}/10
심리적 안전감(emotional_safety): {emotional_safety}/10
인사이트 신선도(insight_novelty): {insight_novelty}/10
추천받은 역량 카드: {top_cards}
이번 주 액션 아이템: {action_items}

[시뮬레이션 조건]
- 오늘은 2026-06-01 (월요일). Week 1 = 이번 주.
- 비정형 페르소나 여부: {is_atypical}
- 추가 맥락: {simulation_note}

JSON만 출력하세요.
"""


# ---------------------------------------------------------------------------
# 2. Hook 효과 평가 프롬프트
# ---------------------------------------------------------------------------

HOOK_EVAL_SYSTEM = """\
당신은 CareerPT 앱의 특정 사용자를 시뮬레이션합니다.
아래 상황에서 앱이 보내는 재방문 유도 메시지(hook)를 받았을 때,
당신이 실제로 앱을 다시 열지 판단하세요.

[판단 원칙]
- 당신은 이미 이탈 위기이거나 이탈한 상태입니다.
- hook의 문구·시점이 페르소나의 심리와 맞는지를 판단하세요.
- "어떤 hook이라도 효과 있다"거나 "어떤 hook도 효과 없다"는 극단적 답변은 금지.
- 각 hook마다 독립적으로 평가하세요. 다른 hook과 비교하지 마세요.

[출력 형식 — JSON만 출력, 다른 텍스트 금지]
{
  "hooks": [
    {
      "hook_id": "<hook 식별자>",
      "would_reopen": <true|false>,
      "reopen_prob": <0.0~1.0>,
      "reaction": "<페르소나가 hook을 받았을 때의 첫 반응, 30~80자>",
      "reason": "<효과 있음/없음 근거, 40~100자>"
    }
  ]
}
"""

HOOK_EVAL_USER_TEMPLATE = """\
[페르소나 현황]
닉네임: {nickname}
이탈/위기 주차: Week {churn_week}
이 시점의 감정 상태: {emotional_state}
이탈 이유: {churn_reason}
desire_to_return (1차 세션 기준): {desire_to_return}/10
emotional_safety: {emotional_safety}/10

[평가할 hook 목록]
{hooks_block}

각 hook에 대해 이 페르소나가 앱을 다시 열지 판단하세요.
JSON만 출력하세요.
"""

# hook_id → 사용자에게 실제 노출되는 메시지
HOOK_MESSAGES: dict[str, str] = {
    "none":                "없음 (아무 메시지도 받지 않음)",
    "push_notification":   "🔔 [CareerPT] '{nickname}'님, 오늘 액션 아이템 확인하셨나요? 3분이면 충분해요.",
    "weekly_coaching_cta": "💬 AI 코치가 '{nickname}'님의 이번 주를 기다리고 있어요. 5분 회고 시작할까요?",
    "streak_badge":        "🏅 '{nickname}'님, {streak}일 연속 실행 중! 오늘도 이어가면 배지를 받아요.",
}
