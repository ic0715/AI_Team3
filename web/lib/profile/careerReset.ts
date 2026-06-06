/**
 * 마이페이지(app/profile/page.tsx) — 커리어 방향 재설정 순수 로직.
 *
 * "커리어 방향 재설정" 선택지(ResetChoiceDialog)의 이동 목적지를 단위 테스트
 * 가능하도록 분리. 인라인 magic string router.push 경로를 상수/리졸버로 추출.
 *
 * 중요한 도메인 규칙(회귀 방지):
 * - 여기서는 goal의 abandoned 처리를 절대 하지 않는다. goal abandoned는
 *   09 career-result에서 새 goal insert 직전에 수행한다. 프로필에서 미리
 *   abandoned 처리하면 인터뷰 도중 뒤로 가기 시 goal이 사라져 홈이 broken
 *   state가 된다. → 따라서 이 모듈은 "어디로 이동할지"만 결정하는 순수 함수다.
 * - active goal 유무와 무관하게 이동 가능해야 한다(이동을 막는 early-return 없음).
 */

/** ResetChoiceDialog의 3개 선택지 중 이동을 발생시키는 2개. */
export type ResetChoice = 'redoInterview' | 'redoGoals';

/** 인터뷰 전체 다시하기 → 07 career-intro부터 재진입. */
export const RESET_REDO_INTERVIEW_PATH = '/onboarding/career-intro';

/** 역량목표 & 액션아이템만 다시 설정 → 09 career-result부터 재진입. */
export const RESET_REDO_GOALS_PATH = '/onboarding/career-result';

/**
 * 재설정 선택지 → 이동 목적지 경로.
 * - 'redoInterview' → 07 career-intro
 * - 'redoGoals'     → 09 career-result
 *
 * active goal 유무를 인자로 받지 않는다(의도적): goal이 없어도 항상 이동 가능.
 */
export function resetChoiceDestination(choice: ResetChoice): string {
  return choice === 'redoInterview'
    ? RESET_REDO_INTERVIEW_PATH
    : RESET_REDO_GOALS_PATH;
}
