import type { Phase, SessionDurationLabel } from '@/lib/constants/career-interview';

/**
 * 08 커리어 인터뷰 — 진행률(progress bar) 순수 계산.
 *
 * ⚠️ 이 인터뷰는 고정 턴 수로 끝나지 않는다. 완료(isComplete)는 오직 코치의 자연 종료
 *    (Path A)로만 일어나고 turn_count 는 종료 신호가 아니다. 따라서 '턴 수 ÷ 목표치' 식
 *    단순 진행바는 거짓말을 한다(바가 100%인데 대화가 계속되거나, 깊은데 멈춰 보임).
 *
 * 그래서 진행률을 **실제 진행 신호인 phase 에 앵커링**하고, 가장 긴 exploration 구간만
 * 턴 수로 부드럽게 보간한다. 핵심 정직성 장치:
 *  - exploration 은 EXPLORATION_CAP(85%)을 절대 넘지 않는다 → 코치가 실제 마무리에
 *    들어가기 전엔 "거의 다 됐다"고 말하지 않는다.
 *  - 100% 는 오직 isComplete(코치 자연 종료) 일 때만.
 *  - 항상 단조 증가(phase floor 가 단계마다 커지고, 보간은 floor~cap 범위).
 *
 * session_duration 은 보간 '속도'만 결정(종료를 강제하지 않음). 사람마다 가용 시간이
 * 다른 걸 페이스에 반영.
 */

/**
 * session_duration 별, exploration 진행바가 상한(EXPLORATION_CAP)에 도달하는 기준 턴 수.
 * 종료 강제가 아니라 '보간 속도'. short 는 빨리 차고 long 은 천천히 찬다.
 */
export const EXPECTED_TURNS: Record<SessionDurationLabel, number> = {
  short: 6,
  medium: 10,
  long: 16,
};

/** 각 phase 진입 시의 진행률 앵커(%). 단계가 올라갈수록 커진다. */
export const PHASE_FLOOR: Record<Phase, number> = {
  opening: 5,
  echo_agreement: 15,
  exploration: 30,
  closing: 90,
};

/** exploration 구간 상한 — closing 진입 전까지 이 값을 넘지 않는다. */
export const EXPLORATION_CAP = 85;

/** phase → 사용자에게 보여줄 현재 단계 라벨. */
export const STAGE_LABEL: Record<Phase, string> = {
  opening: '인터뷰 시작',
  echo_agreement: '다룰 주제 찾는 중',
  exploration: '깊이 탐색 중',
  closing: '마무리하는 중',
};

export interface InterviewProgress {
  /** 0~100 정수 진행률. */
  percent: number;
  /** 현재 단계 한글 라벨. */
  stageLabel: string;
  /** 마무리 임박(closing 이상) — UI 힌트("곧 마무리돼요")용. */
  isNearEnd: boolean;
}

function clampTurns(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * 현재 상태 → 진행률.
 * @param phase           현재 인터뷰 phase
 * @param userTurnCount   사용자(role:'user') 누적 메시지 수
 * @param sessionDuration short/medium/long (보간 속도)
 * @param isComplete      코치 자연 종료 여부(=100% 트리거)
 */
export function computeInterviewProgress(opts: {
  phase: Phase;
  userTurnCount: number;
  sessionDuration: SessionDurationLabel;
  isComplete: boolean;
}): InterviewProgress {
  const { phase, sessionDuration, isComplete } = opts;
  const turns = clampTurns(opts.userTurnCount);

  if (isComplete) {
    return { percent: 100, stageLabel: '인터뷰 완료', isNearEnd: true };
  }

  let percent: number;
  if (phase === 'exploration') {
    const floor = PHASE_FLOOR.exploration;
    const expected = EXPECTED_TURNS[sessionDuration] ?? EXPECTED_TURNS.medium;
    const ratio = expected > 0 ? Math.min(turns, expected) / expected : 1;
    percent = floor + ratio * (EXPLORATION_CAP - floor);
  } else {
    percent = PHASE_FLOOR[phase];
  }

  return {
    percent: Math.round(percent),
    stageLabel: STAGE_LABEL[phase],
    isNearEnd: phase === 'closing',
  };
}
