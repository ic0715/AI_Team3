"""방법 B 이탈 시나리오 분석 — 주별 이탈 확률 모델.

입력: 1차 세션 스코어 (Layer C 4축 + session_score)
출력: 12주 × 페르소나 주별 이탈 확률 행렬

이탈 위험 요인 3가지:
  1. desire_to_return  — 세션 직후 재방문 의향 (즉시 이탈 지표)
  2. emotional_safety  — 신뢰 실패 시 즉시·조기 이탈
  3. insight_novelty   — 낮으면 4-6주차 "질림" 이탈 유발
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence


# ---------------------------------------------------------------------------
# 시나리오 정의
# ---------------------------------------------------------------------------

@dataclass
class Scenario:
    """세션 스코어에 적용할 시나리오 배율."""
    name: str
    label: str
    score_multiplier: float   # session_score 전체 배율 (1.0 = 실측 그대로)
    dtr_delta: float          # desire_to_return 가산 (0 = 실측 그대로)
    novelty_decay_factor: float  # insight_novelty 시간 감쇠 가속 (1.0 = 기본)


SCENARIOS: list[Scenario] = [
    Scenario("pessimistic", "비관 (session_score ~7)", score_multiplier=0.78, dtr_delta=-1.5, novelty_decay_factor=1.4),
    Scenario("current",     "현재 (실측)",              score_multiplier=1.00, dtr_delta=0.0,  novelty_decay_factor=1.0),
    Scenario("target",      "목표 (session_score ≥9)",  score_multiplier=1.00, dtr_delta=+1.8, novelty_decay_factor=0.75),
]


# ---------------------------------------------------------------------------
# 핵심 모델
# ---------------------------------------------------------------------------

def _clamp(v: float, lo: float = 1.0, hi: float = 10.0) -> float:
    return max(lo, min(hi, v))


def weekly_churn_prob(
    week: int,
    desire_to_return: float,
    emotional_safety: float,
    insight_novelty: float,
    session_score: float,
    scenario: Scenario,
) -> float:
    """주 k(1-indexed)에서 이탈할 확률을 반환한다 (0.0~1.0).

    모델 설계 근거:
    - desire_to_return: 재방문 의향 — p_stay 기저를 직접 결정
    - emotional_safety: 신뢰 지표 — 낮으면 1-3주차 이탈 가속
    - insight_novelty:  콘텐츠 신선도 — 4주차 이후 감쇠 적용
    - session_score:    종합 품질 — 보정 항으로 사용
    """
    # 시나리오 보정
    dtr = _clamp(desire_to_return + scenario.dtr_delta)
    es  = _clamp(emotional_safety)
    nov = _clamp(insight_novelty)
    ss  = _clamp(session_score * scenario.score_multiplier, lo=0.0, hi=10.0)

    # 1) 기저 이탈률: desire_to_return 역함수
    #    dtr=10 → p_churn_base ≈ 0.04, dtr=1 → ≈ 0.70
    p_churn_base = 0.80 * math.exp(-0.28 * dtr) + 0.02

    # 2) emotional_safety 보정 (1-3주차에만 강하게 작용)
    if week <= 3:
        es_penalty = max(0.0, (6.0 - es) * 0.04)  # es<6이면 최대 +0.20
    else:
        es_penalty = max(0.0, (6.0 - es) * 0.01)

    # 3) insight_novelty 감쇠 (4주차 이후 "질림" 곡선)
    if week >= 4:
        decay_weeks = (week - 3) * scenario.novelty_decay_factor
        novelty_decay = max(0.0, (6.5 - nov) * 0.012 * decay_weeks)
    else:
        novelty_decay = 0.0

    # 4) session_score 품질 보정 (전 구간 완충)
    quality_buffer = (ss - 5.0) * 0.012  # ss>5이면 이탈률 경감

    p_churn = p_churn_base + es_penalty + novelty_decay - quality_buffer
    return max(0.0, min(0.95, p_churn))


# ---------------------------------------------------------------------------
# 페르소나 단위 시뮬레이션
# ---------------------------------------------------------------------------

@dataclass
class PersonaWeeklyResult:
    persona_id: int
    nickname: str
    is_atypical: bool
    scenario_name: str
    # week → p_churn 이 주에 이탈할 확률 (조건부: 이 주까지 살아남았다면)
    weekly_churn_prob: list[float]
    # week → p_retained 이 주말 기준 누적 생존 확률
    retention_curve: list[float]
    # 이탈 기대 주차 (E[churn week] 혹은 None — 12주 내 50% 이하로 안 떨어지면)
    median_churn_week: int | None


def simulate_persona(
    persona_id: int,
    nickname: str,
    is_atypical: bool,
    desire_to_return: float,
    emotional_safety: float,
    insight_novelty: float,
    session_score: float,
    scenario: Scenario,
    n_weeks: int = 12,
) -> PersonaWeeklyResult:
    probs: list[float] = []
    curve: list[float] = []
    p_retained = 1.0

    for week in range(1, n_weeks + 1):
        p_c = weekly_churn_prob(
            week=week,
            desire_to_return=desire_to_return,
            emotional_safety=emotional_safety,
            insight_novelty=insight_novelty,
            session_score=session_score,
            scenario=scenario,
        )
        probs.append(p_c)
        p_retained *= (1.0 - p_c)
        curve.append(round(p_retained, 4))

    # 중간값 이탈 주차 (누적 잔존율이 0.50 이하로 최초 하락하는 주)
    median_week: int | None = None
    for i, r in enumerate(curve):
        if r <= 0.50:
            median_week = i + 1
            break

    return PersonaWeeklyResult(
        persona_id=persona_id,
        nickname=nickname,
        is_atypical=is_atypical,
        scenario_name=scenario.name,
        weekly_churn_prob=probs,
        retention_curve=curve,
        median_churn_week=median_week,
    )
