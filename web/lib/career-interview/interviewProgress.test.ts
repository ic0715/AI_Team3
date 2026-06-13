import { describe, it, expect } from 'vitest';
import {
  computeInterviewProgress,
  EXPECTED_TURNS,
  PHASE_FLOOR,
  EXPLORATION_CAP,
} from './interviewProgress';

const base = { userTurnCount: 0, sessionDuration: 'medium' as const, isComplete: false };

describe('computeInterviewProgress — phase 앵커', () => {
  it('opening/echo_agreement/closing 은 phase floor 고정', () => {
    expect(computeInterviewProgress({ ...base, phase: 'opening' }).percent).toBe(PHASE_FLOOR.opening);
    expect(computeInterviewProgress({ ...base, phase: 'echo_agreement' }).percent).toBe(PHASE_FLOOR.echo_agreement);
    expect(computeInterviewProgress({ ...base, phase: 'closing' }).percent).toBe(PHASE_FLOOR.closing);
  });

  it('단계 라벨을 반환', () => {
    expect(computeInterviewProgress({ ...base, phase: 'opening' }).stageLabel).toBe('인터뷰 시작');
    expect(computeInterviewProgress({ ...base, phase: 'echo_agreement' }).stageLabel).toBe('다룰 주제 찾는 중');
    expect(computeInterviewProgress({ ...base, phase: 'exploration' }).stageLabel).toBe('깊이 탐색 중');
    expect(computeInterviewProgress({ ...base, phase: 'closing' }).stageLabel).toBe('마무리하는 중');
  });

  it('isNearEnd 는 closing 부터 true', () => {
    expect(computeInterviewProgress({ ...base, phase: 'exploration' }).isNearEnd).toBe(false);
    expect(computeInterviewProgress({ ...base, phase: 'closing' }).isNearEnd).toBe(true);
  });
});

describe('computeInterviewProgress — exploration 턴 보간', () => {
  it('exploration 시작(0턴)은 floor', () => {
    expect(computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: 0 }).percent).toBe(PHASE_FLOOR.exploration);
  });

  it('기대 턴 수의 절반이면 floor와 cap의 중간쯤', () => {
    const half = EXPECTED_TURNS.medium / 2; // 5
    const p = computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: half }).percent;
    const mid = Math.round(PHASE_FLOOR.exploration + 0.5 * (EXPLORATION_CAP - PHASE_FLOOR.exploration));
    expect(p).toBe(mid);
  });

  it('기대 턴 수 이상이면 EXPLORATION_CAP 에서 멈춤(절대 초과 안 함)', () => {
    expect(computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: EXPECTED_TURNS.medium }).percent).toBe(EXPLORATION_CAP);
    expect(computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: 999 }).percent).toBe(EXPLORATION_CAP);
  });

  it('session_duration 이 짧을수록 같은 턴에서 더 빨리 찬다', () => {
    const shortP = computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: 3, sessionDuration: 'short' }).percent;
    const longP = computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: 3, sessionDuration: 'long' }).percent;
    expect(shortP).toBeGreaterThan(longP);
  });

  it('진행률은 phase가 올라갈수록 단조 증가(같은 턴 기준)', () => {
    const turns = 4;
    const open = computeInterviewProgress({ ...base, phase: 'opening', userTurnCount: turns }).percent;
    const echo = computeInterviewProgress({ ...base, phase: 'echo_agreement', userTurnCount: turns }).percent;
    const expl = computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: turns }).percent;
    const close = computeInterviewProgress({ ...base, phase: 'closing', userTurnCount: turns }).percent;
    expect(open).toBeLessThan(echo);
    expect(echo).toBeLessThan(expl);
    expect(expl).toBeLessThan(close);
  });
});

describe('computeInterviewProgress — 완료/방어', () => {
  it('isComplete 면 phase와 무관하게 100% + 완료 라벨', () => {
    const r = computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: 3, isComplete: true });
    expect(r.percent).toBe(100);
    expect(r.stageLabel).toBe('인터뷰 완료');
    expect(r.isNearEnd).toBe(true);
  });

  it('완료 전에는 절대 100%가 아니다(closing 도 90%)', () => {
    expect(computeInterviewProgress({ ...base, phase: 'closing', userTurnCount: 50 }).percent).toBeLessThan(100);
  });

  it('음수/NaN 턴은 0으로 방어', () => {
    expect(computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: -5 }).percent).toBe(PHASE_FLOOR.exploration);
    expect(computeInterviewProgress({ ...base, phase: 'exploration', userTurnCount: NaN }).percent).toBe(PHASE_FLOOR.exploration);
  });
});
