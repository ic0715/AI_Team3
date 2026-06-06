import type { Phase } from '@/lib/constants/career-interview';

// 종료 시 '의미있는 결과 생성' 자격 판정 — 종료 동작 분기의 단일 게이트.
//   ⚠️ exploration 진입(주제 합의)만으론 방향성이 아직 없으므로 '준비됨'으로 보지 않는다.
//   준비됨(→ 결과) = 코치가 마무리 질문을 시작(closing) OR 탐색이 충분히 깊어짐(≥N턴).
//   그 외(빈 세션·합의·얕은 탐색) = 분석 불가 → 따뜻한 안내 후 홈으로(대화는 보존, 이어가기 가능).

/** 탐색 깊이 보조선(사용자 답변 누적). 조정 가능. */
export const RESULT_READY_MIN_TURNS = 6;

/**
 * 인터뷰 종료 버튼을 눌렀을 때 '결과 생성' 분기로 갈지 판정.
 * @param phase 현재 인터뷰 phase
 * @param userTurnCount 사용자(role:'user')가 보낸 누적 메시지 수
 */
export function isReadyForResult(phase: Phase, userTurnCount: number): boolean {
  return (
    phase === 'closing' ||
    (phase === 'exploration' && userTurnCount >= RESULT_READY_MIN_TURNS)
  );
}
