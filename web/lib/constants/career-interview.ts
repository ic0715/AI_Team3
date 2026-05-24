// CONTRACT_v2.md §4 클라이언트 텍스트 매칭 키워드
// AI 트랙(/api/career-interview/chat/route.ts)의 ENDING_KEYWORDS와 정확히 동일하게 유지해야 함.

/** Path A — 코치 발화 자연 종료 키워드 */
export const COACH_CLOSING_KEYWORDS = [
  '오늘 인터뷰는 여기서',
  '오늘은 여기까지',
  '여기서 마무리할게요',
] as const;

/** Path B — 사용자 주도 종료 키워드 */
export const USER_EXIT_KEYWORDS = [
  '여기까지 할게요',
  '그만하고 싶어요',
  '이제 됐어요',
  '오늘은 여기까지',
] as const;

/** Path C — 정서 위기 키워드 (클라이언트 측 백업 가드) */
export const CRISIS_RED_KEYWORDS = [
  '죽고 싶다',
  '사라지고 싶다',
  '끝내고 싶다',
  '이 세상에서 없어졌으면',
  '스스로 다치게',
  '해치고 싶다',
] as const;

export function detectCoachClosing(text: string): boolean {
  return COACH_CLOSING_KEYWORDS.some((k) => text.includes(k));
}

export function detectUserExit(text: string): boolean {
  return USER_EXIT_KEYWORDS.some((k) => text.includes(k));
}

export function detectCrisisRed(text: string): boolean {
  return CRISIS_RED_KEYWORDS.some((k) => text.includes(k));
}

export type SessionDurationLabel = 'short' | 'medium' | 'long';

/** 사용자의 첫 시간 응답을 short/medium/long으로 분류 (Running State 주입용 추정치).
 *  실제 DB 저장값은 AI 추출 결과(finalize)가 source of truth. */
export function classifySessionDuration(userFirstAnswer: string): SessionDurationLabel {
  const t = userFirstAnswer;
  if (/15분|20분|짧게|급해/.test(t)) return 'short';
  if (/1시간|충분히|시간 많/.test(t)) return 'long';
  if (/30분|40분|보통/.test(t)) return 'medium';
  return 'medium'; // 모호 시 기본값
}

export type Phase = 'opening' | 'echo_agreement' | 'exploration' | 'closing';

/** Running State <현재_상태> 블록 빌더 (CONTRACT_v2 §5).
 *  매 턴 user 메시지의 prefix로 붙임. */
export function buildRunningStatePrefix(opts: {
  phase: Phase;
  agreedFocus: string;
  turnCount: number;
  sessionDuration: SessionDurationLabel;
}): string {
  return `<현재_상태>
phase: ${opts.phase}
agreed_focus: "${opts.agreedFocus}"
turn_count: ${opts.turnCount}
session_duration: ${opts.sessionDuration}
</현재_상태>
`;
}

/** Phase 자동 전환 (chat 응답을 받은 직후 호출).
 *  AI는 phase를 *단서*로만 쓰므로 100% 정확할 필요 없음. */
export function inferPhase(
  current: Phase,
  coachResponseText: string,
  userMsgCount: number,
): { phase: Phase; agreedFocus?: string } {
  // Phase 4: 코치 종료 발화 감지
  if (detectCoachClosing(coachResponseText)) {
    return { phase: 'closing' };
  }

  // Phase 2 → 3: 합의 미러링 발화 ("그럼 오늘은 ○○를 같이 다뤄볼게요" 패턴)
  if (current === 'echo_agreement') {
    const mirrorMatch = coachResponseText.match(/그럼 오늘은\s+([^"]{2,80}?)[을를]\s*(?:같이\s*)?(?:다뤄|봐볼게요|볼게요)/);
    if (mirrorMatch) {
      return { phase: 'exploration', agreedFocus: mirrorMatch[1].trim() };
    }
  }

  // Phase 1 → 2: 첫 사용자 응답 이후 (user 메시지 1개 이상)
  if (current === 'opening' && userMsgCount >= 1) {
    return { phase: 'echo_agreement' };
  }

  // G 패턴 (마무리 직전 질문) → closing 직전 신호
  if (
    current === 'exploration' &&
    /오늘 어떤 게 손에 잡|또렷해진 게|새롭게 알게 된/.test(coachResponseText)
  ) {
    return { phase: 'closing' };
  }

  return { phase: current };
}
