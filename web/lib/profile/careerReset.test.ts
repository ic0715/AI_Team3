import { describe, expect, it } from 'vitest';
import {
  RESET_REDO_GOALS_PATH,
  RESET_REDO_INTERVIEW_PATH,
  resetChoiceDestination,
  type ResetChoice,
} from './careerReset';

// ─────────────────────────────────────────────────────────────
// resetChoiceDestination — 재설정 선택지 → 이동 목적지
// ─────────────────────────────────────────────────────────────
describe('resetChoiceDestination', () => {
  it("'redoInterview' → 07 career-intro", () => {
    expect(resetChoiceDestination('redoInterview')).toBe('/onboarding/career-intro');
    expect(resetChoiceDestination('redoInterview')).toBe(RESET_REDO_INTERVIEW_PATH);
  });

  it("'redoGoals' → 09 career-result", () => {
    expect(resetChoiceDestination('redoGoals')).toBe('/onboarding/career-result');
    expect(resetChoiceDestination('redoGoals')).toBe(RESET_REDO_GOALS_PATH);
  });

  it('두 목적지는 서로 다르다(분기 회귀 방지)', () => {
    expect(RESET_REDO_INTERVIEW_PATH).not.toBe(RESET_REDO_GOALS_PATH);
  });

  it('모든 선택지가 절대 경로(/로 시작)로 매핑됨', () => {
    const choices: ResetChoice[] = ['redoInterview', 'redoGoals'];
    for (const c of choices) {
      expect(resetChoiceDestination(c).startsWith('/')).toBe(true);
    }
  });

  it('순수 함수 — active goal 인자가 없어 goal 유무와 무관하게 항상 경로 반환', () => {
    // goal 유무를 받지 않으므로 이동을 막는 분기가 존재할 수 없다(7d6e6e0 회귀 방지).
    expect(resetChoiceDestination('redoInterview')).toBeTruthy();
    expect(resetChoiceDestination('redoGoals')).toBeTruthy();
  });
});
