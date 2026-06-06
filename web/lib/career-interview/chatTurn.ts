// app/api/career-interview/chat/route.ts 의 턴/종료 판정 순수 로직.
// 라우트에서 verbatim 추출 — 동작 보존.
//
// ⚠️ 고정 턴 기반 '강제 종료'는 두지 않는다. 세션 완료(isComplete)는 오직 코치의
// 자연 종료 키워드(Path A)로만 일어난다. turn_count 자체는 완료 신호가 아니다.
// 대신 FORCE_CLOSE_FROM 이후부터 매 턴 forceClose 지시를 프롬프트에 주입해, 코치가
// 스스로 따뜻하게 마무리하도록 '강하게 유도'한다(끊는 게 아니라 유도).

export const FORCE_CLOSE_FROM = 63;

/** 관측 경고를 띄우는 추가 여유 턴 — FORCE_CLOSE_FROM + 이 값 이후에도 안 닫히면 warn. */
export const STILL_OPEN_WARN_MARGIN = 7;

// LLM의 종료 신호 키워드 — CONTRACT_v2.md §4.1 COACH_CLOSING_KEYWORDS와 정확히 동일.
export const ENDING_KEYWORDS = [
  '오늘 인터뷰는 여기서',
  '오늘은 여기까지',
  '여기서 마무리할게요',
];

export function detectEnding(text: string): boolean {
  return ENDING_KEYWORDS.some((k) => text.includes(k));
}

/** messages 배열에서 user 역할 메시지 수를 센다. */
export function countUserMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): number {
  return messages.filter((m) => m.role === 'user').length;
}

/** FORCE_CLOSE_FROM 이상이면 프롬프트에 종료 유도 지시를 주입. */
export function shouldForceClose(userMsgCount: number): boolean {
  return userMsgCount >= FORCE_CLOSE_FROM;
}

/**
 * 매우 길어졌는데도(margin 초과) 코치가 아직 안 닫혔으면 관측 경고를 띄울지 판정.
 * (완료를 강제하지는 않음 — 로그만 남김)
 */
export function shouldWarnStillOpen(userMsgCount: number, isComplete: boolean): boolean {
  return !isComplete && userMsgCount >= FORCE_CLOSE_FROM + STILL_OPEN_WARN_MARGIN;
}
