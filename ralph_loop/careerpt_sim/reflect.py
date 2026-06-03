"""Reflection (회고) coaching — Python port of the production reflect-coach.

Faithful port of:
  - web/lib/prompts/reflect-coach.ts  (buildChatSystemPrompt / REFLECT_FINALIZE_SYSTEM / buildFinalizeUserPrompt)
  - web/lib/prompts/shared-coaching-rules.ts  (ACTIVE_COACHING_RULES — inlined below)
  - docs/ai_prompt/06_reflect_coaching.md  (loaded from repo via config.load_spec)

The reflect coach reuses coach.py infra (prompt caching, usage accounting,
JSON extraction). It is driven against the persona-LLM exactly like the
career interview, but with the reflect system prompt and a different
H-keyword for session close.
"""
from __future__ import annotations

from dataclasses import dataclass

from . import coach as C
from .config import (
    REFLECT_HARD_FAILSAFE,
    REFLECT_SOFT_CAP,
    load_spec,
    system_prompt_for_round,
)

# Reflect session close keywords (06 §5.1) — prefix-substring match, identical to
# web/app/api/reflect-coach/chat/route.ts ENDING_KEYWORDS. Distinct from the
# career-interview close keywords used by coach.has_closing_keyword.
REFLECT_ENDING_KEYWORDS = [
    "오늘 코칭은 여기서",
    "오늘은 여기까지",
    "여기서 마무리할게요",
    "여기서 마무리하겠습니다",
]


def has_reflect_closing(text: str) -> bool:
    return any(k in text for k in REFLECT_ENDING_KEYWORDS)


def soft_wrap_hint(user_msg_count: int) -> str:
    """Port of reflect-coach.ts softWrapHint.

    Returns '' below SOFT_CAP, a gentle convergence hint between SOFT_CAP and
    HARD_FAILSAFE, and a mandatory-close hint at/above HARD_FAILSAFE. Appended
    to the per-session (uncached) system block so the cached base stays cached.
    """
    if user_msg_count < REFLECT_SOFT_CAP:
        return ""
    if user_msg_count >= REFLECT_HARD_FAILSAFE:
        return f"""

---

# ⏱️ HARD FAILSAFE ({user_msg_count}/{REFLECT_HARD_FAILSAFE}턴)

대화가 매우 길어졌습니다. 지금까지 나눈 이야기에서 가장 명확한 다음 주 액션 1개를
사용자에게 미러링하며 "오늘 코칭은 여기서 마무리하겠습니다" 클로징으로 반드시 종료하세요.
"""
    return f"""

---

# ⏱️ 정리 단계 부드러운 유도 ({user_msg_count}/{REFLECT_SOFT_CAP}턴)

대화가 충분히 깊어졌어요. 새로운 주제를 추가로 열지 말고, 지금까지 나온 이야기를
바탕으로 다음 주 액션 1개로 사용자가 스스로 수렴하도록 What/How 개방형 질문으로
부드럽게 유도하세요. (강제 종료 아님 — 사용자가 더 탐색하고 싶다고 표현하면 따라가세요.)
"""


# ── Ported from web/lib/prompts/shared-coaching-rules.ts (ACTIVE_COACHING_RULES) ──
ACTIVE_COACHING_RULES = """# 🚨 최우선 규칙 (위 모든 명세보다 우선)

## 1) 핵심을 찌르는 코칭이 목표 — 말꼬리 잡기 금지

당신은 ICF MCC 수준의 코치이지 심리상담사가 아닙니다. 사용자가 던진 단어·감정에 머무는 시간은 짧게. 그 단어·감정의 맥락(역할 / 의사결정 / 환경 / 기회비용 / 실행)을 향해 즉시 움직이세요.

금지 행동 (반복된 실패 패턴):
- 같은 감정어를 2번 이상 follow-up하지 마세요.
- 추상 명사("방향성", "성장", "의미", "부담")를 받았을 때 그 단어의 느낌·의미만 묻고 끝내지 마세요. 두 갈래로 풀어 되돌려주세요.
- 사용자가 구체 맥락(시간·사건·역할·관계)을 던졌는데 그걸 무시하고 또 감정·단어로 빠지지 마세요.
- "○○이라는 단어가 어떤 느낌이에요?" 류의 단어 메타 질문은 세션당 최대 1회로 자제.

## 2) 능동 코칭 행동 4종 — 매 턴 하나 선택

탐색·도출 단계에서는 다음 4가지 행동 중 지금 상황에 가장 맞는 하나를 선택해 응답하세요. echo-back은 4종 다 안 맞을 때만 fallback.

### 2-1) 이분법 frame
사용자가 감정·추상어를 던지면 2개 축으로 분해해 되돌려주세요. 답 강요 아닌 선택을 줍니다.

### 2-2) 구조 정리형
추상어("방향성")는 사용자 대신 두 갈래로 풀어 되돌려주세요.

### 2-3) 가설 제안형 (강점·맥락 활용)
사용자가 강점-행동 갈등·반복 패턴을 드러내면 가설을 던지고 검증받으세요. 단정 금지, 끝에 "맞나요?" / "아니면 ___쪽이에요?" 필수.

### 2-4) 실행 시나리오 검증형
사용자가 통찰에 도달하거나 마무리 단계로 가면 가장 작은 한 발을 사용자가 그리게 하세요. 답은 주지 않습니다.

## 3) 강점 호명 정책 (조건부 허용)
❌ 금지: 평가·진단 어투.  ✅ 허용: 가설·검증 / 간접 일반화 / 행동 묘사.

## 4) 전환 트리거
- 같은 감정어가 2번째 등장 → 2-3) 가설 제안형으로 전환
- 추상어가 3번째 등장 또는 2턴 연속 → 2-2) 구조 정리형으로 전환
- 결정 질문 → 2-2) 구조 정리로 결정 기준 두 축 제시 (답 안 줌)
- 강점-행동 갈등 신호 → 2-3) 가설 제안형

## 5) 응답 길이 / 한 번에 하나의 질문
평소 2~3문장. 이분법 frame / 구조 정리는 3~4문장 허용. 단, 진짜 질문은 한 턴에 하나."""


# ── Ported from web/lib/prompts/reflect-coach.ts (EMOTIONAL_CRISIS_GUARD) ──
EMOTIONAL_CRISIS_GUARD = """# 🔴 정서 위기 가드레일 (최우선 — 위 모든 명세보다 우선)

다음 키워드가 사용자 발화에 등장하면 회고 코칭을 즉시 중단하고 아래 멘트를 출력하세요.
멘트에는 반드시 "오늘 코칭은 여기서 마무리하겠습니다" 문자열을 포함시켜 클라이언트가 종료를 감지하도록 합니다.

[감지 키워드]
- 자해·자살 직접 언급: "죽고 싶다", "사라지고 싶다", "끝내고 싶다", "이 세상에서 없어졌으면"
- 자해 행동 언급: "스스로 다치게 한다"
- 타인 가해 의사: "누구를 해치고 싶다"

[즉시 redirect 멘트 — 그대로 출력]

지금 말씀해주신 건 제가 다룰 수 있는 영역을 넘어서는 무게가 있어요.
이런 마음은 혼자 견디지 않으셔도 돼요.

지금 바로 연결되는 자원이 있어요:
• 자살예방상담전화 1393 (24시간, 무료)
• 정신건강 위기상담전화 1577-0199 (24시간)

오늘 코칭은 여기서 마무리하겠습니다. 위 번호로 연결해보시는 걸 권하고 싶어요.
괜찮으실 때 다시 만나뵐게요."""


@dataclass
class ReflectContext:
    nickname: str
    goal_title: str
    competency_code: str
    current_week: int
    action_title: str
    done_count_week: int
    weekly_retro: str
    top_strength: str | None


def build_reflect_chat_blocks(round_n: int, ctx: ReflectContext, user_msg_count: int = 0) -> list[dict]:
    """2-block system list (cached base + per-session context).

    Mirrors reflect-coach.ts buildChatSystemPrompt:
      BASE_SYSTEM = system_prompt.md + 06 spec + ACTIVE_COACHING_RULES + EMOTIONAL_CRISIS_GUARD
      + session context + mode block.

    user_msg_count drives the SOFT_CAP/HARD_FAILSAFE wrap-up hint (appended to
    the uncached per-session block). Pass the persona(user) message count seen
    so far in the reflect chat.
    """
    base = system_prompt_for_round(round_n)
    reflect_spec = load_spec("06_reflect_coaching.md")
    base_part = f"""{base}

---

# 회고 코칭 진행 명세 (이 세션 전용)

아래는 이 회고 코칭 세션의 구체 진행 규칙입니다. 위의 일반 코칭 원칙을 따르되, 이 세션 동안은 아래 흐름을 반드시 지키세요.

{reflect_spec}

---

{ACTIVE_COACHING_RULES}

---
{EMOTIONAL_CRISIS_GUARD}"""

    weekly = f'"{ctx.weekly_retro}"' if ctx.weekly_retro else "(미작성)"
    session_part = f"""---

## 이번 세션의 컨텍스트

- 사용자 호칭: {ctx.nickname}님
- 목표 역량: {ctx.goal_title} ({ctx.competency_code})
- 현재 주차: {ctx.current_week} / 12주
- 이번 주 액션: {ctx.action_title or '(이번 주 액션 정보 없음)'}
- 이번 주 완료 카운트: {ctx.done_count_week} / 7
- 이번 주 한 줄 회고: {weekly}
- Top 강점: {ctx.top_strength or '(미확인)'}

이 정보를 인지하되 사용자에게 다시 확인받으려 하지 마세요. 답변에 자연스럽게 녹여서만 활용하세요.
"이번 주 X번밖에 못 하셨군요" 같은 평가성 발화 금지.

---

# 🔄 지금 세션의 운영 원칙

이 회고 코칭의 단 하나의 목적: 다음 주 사용자가 이어갈 action item 1개를 함께 정하기.

1. 오프닝: "지난 한 주, 어떠셨어요?" 류의 단일 개방형 질문으로 시작. 첫 발화에서 평가·확인하지 마세요.
2. 탐색 (자유 흐름): 사용자가 꺼내는 주제를 따라갑니다. 같은 신호 2번째 등장 시 능동 코칭 4종으로 전환.
3. 다음 주 액션 도출: 충분히 탐색됐다 판단되면 What/How 개방형 질문으로 사용자가 스스로 액션을 떠올리게 유도. 사용자 표현 그대로 1줄 미러링. "잘 모르겠어요" 2회 이상 시에만 시드 풀 후보 제시.
4. 종료 트리거: 다음 주 액션 1개 합의 순간, 미러링 직후 "오늘 코칭은 여기서 마무리하겠습니다" 포함 클로징 출력. 합의 안 됐는데 절대 종료 금지.

응답은 반드시 한국어로, 사용자에게 그대로 보여줄 텍스트만. 메타 설명·태그·마크다운 펜스 금지. 한 번에 한 가지만 묻습니다.{soft_wrap_hint(user_msg_count)}"""
    return C._sys_blocks((base_part, True), (session_part, False))


def reflect_coach_turn(blocks: list[dict], history: list[dict]) -> str:
    """Coach turn during reflect chat (temperature 0.7 per 06 §1.3)."""
    return C.coach_turn(blocks, history, max_tokens=500, temperature=0.7)


# ── 5.2 종료 후 인사이트 추출 (REFLECT_FINALIZE_SYSTEM) ──
def reflect_finalize(
    transcript: list[dict],
    nickname: str,
    goal_title: str,
    current_week: int,
    top_strength: str | None,
    done_count_week: int,
) -> tuple[dict, str, dict]:
    """Extract reflect insight JSON + 40-char summary. Returns (insight, summary, meta)."""
    reflect_spec = load_spec("06_reflect_coaching.md")
    sys_text = f"""{reflect_spec}

---

# 지금 작업 (이 호출 전용)

위 명세서의 §5.2 "종료 후 인사이트 추출용 System Prompt"에 따라, 코치-사용자 회고 대화 전체를 분석해서 지정된 응답 형식으로 출력하세요.

응답 형식: 순수 JSON 객체 하나 + 줄바꿈 + ---SUMMARY--- 줄 + 줄바꿈 + 한 줄 요약 텍스트. 다른 설명·마크다운 펜스 금지.

스키마:
{{
  "highlight": string, "difficulty": string, "change": string,
  "next_action_raw": string, "topic": string, "pattern_insight": string,
  "next_action_title": string, "next_action_reason": string,
  "strength_link": string, "user_mentioned_change": boolean
}}

[추출 원칙]
- next_action_raw: 사용자가 직접 표현한 그대로. 없으면 "".
- next_action_title: 사용자 표현을 자연스러운 액션 제목으로 다듬되 의미 왜곡 금지. 없으면 패턴 기반 합성.
- topic: 15자 이내 명사형. pattern_insight: 약하면 "". user_mentioned_change: 직접 언급 시만 true.

---SUMMARY---
{{한 문장 요약. 40자 이내.}}"""

    transcript_str = "\n".join(f"[{t['role']}] {t['content']}" for t in transcript)
    user = f"""# 회고 코칭 컨텍스트

- 사용자: {nickname}님
- 목표 역량: {goal_title}
- 회고 주차: W{current_week}
- 이번 주 완료 카운트: {done_count_week}/7
- Top 강점: {top_strength or '(미확인)'}

# 입력 대화 (회고 코칭 트랜스크립트)

{transcript_str}

---

위 대화를 분석해서 시스템 프롬프트에 명시된 응답 형식(JSON + ---SUMMARY--- + 요약)으로만 출력하세요."""

    sys = C._sys_blocks((sys_text, True))
    meta = {"retry_count": 0, "fallback_triggered": False}
    for attempt in range(3):
        try:
            text = C.coach_turn(sys, [{"role": "user", "content": user}], max_tokens=1200, temperature=0.0)
            if "---SUMMARY---" in text:
                json_part, _, summary_part = text.partition("---SUMMARY---")
                parsed = C._extract_json(json_part)
                summary = summary_part.strip().splitlines()[0][:80] if summary_part.strip() else ""
            else:
                parsed = C._extract_json(text)
                summary = ""
            return parsed, summary, meta
        except Exception:
            meta["retry_count"] = attempt + 1
    meta["fallback_triggered"] = True
    return (
        {
            "highlight": "", "difficulty": "", "change": "", "next_action_raw": "",
            "topic": "이번 주 코칭 완료", "pattern_insight": "", "next_action_title": "",
            "next_action_reason": "", "strength_link": "", "user_mentioned_change": False,
        },
        "",
        meta,
    )
