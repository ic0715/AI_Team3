/**
 * FeedbackSheet(components/FeedbackSheet.tsx) — 서비스 피드백 수집 순수 로직.
 *
 * 별점/텍스트 검증, 제출 게이팅, insert 페이로드 구성, 별점 라벨 매핑을
 * 단위 테스트 가능하도록 분리. (c24a02c feat: 서비스 피드백 수집 기능)
 *
 * 핵심 하드닝:
 * - buildFeedbackPayload: liked/improved 텍스트는 trim 후 빈 문자열이면 null로
 *   저장한다(공백만 입력 → null). DB nullable 컬럼 계약을 깨지 않도록 보장.
 * - ratingLabel: 0/범위 밖 인덱스 접근 시 undefined가 새어나가지 않게 '' 폴백.
 */

export type FeedbackSource = 'profile' | 'home_modal';

/** feedbacks insert 페이로드(컬럼명 = DB 계약). */
export interface FeedbackPayload {
  user_id: string;
  rating: number;
  liked: string | null;
  improved: string | null;
  source: FeedbackSource;
}

/** 별점 미선택 시 노출하는 검증 에러 메시지. */
export const FEEDBACK_NO_RATING_ERROR = '별점을 선택해주세요';

/** 별점(1~5) → 표시 라벨. 인덱스 0(미선택)/범위 밖은 표시하지 않으므로 빈 라벨. */
const RATING_LABELS = ['', '아쉬워요', '조금 아쉬워요', '보통이에요', '좋아요', '최고예요!'];

/**
 * 제출 가능 여부. 별점이 1 이상(0이면 미선택)이고 제출 중이 아니어야 한다.
 * 버튼 disabled = `submitting || rating === 0`의 부정과 동일한 의미.
 */
export function canSubmitFeedback(rating: number, submitting: boolean): boolean {
  return rating !== 0 && !submitting;
}

/**
 * 제출 직전 별점 검증. 별점 미선택(0)이면 에러 메시지, 아니면 null.
 * 호출부: rating === 0 → setError(FEEDBACK_NO_RATING_ERROR) → 조기 return.
 */
export function feedbackRatingError(rating: number): string | null {
  if (rating === 0) return FEEDBACK_NO_RATING_ERROR;
  return null;
}

/**
 * 별점 → 표시 라벨. 범위(1~5) 밖이면 '' (undefined 노출 방지).
 */
export function ratingLabel(rating: number): string {
  return RATING_LABELS[rating] ?? '';
}

/**
 * feedbacks insert 페이로드 구성.
 * liked/improved는 trim 후 빈 문자열이면 null(공백만 입력 → null).
 */
export function buildFeedbackPayload(
  userId: string,
  rating: number,
  liked: string,
  improved: string,
  source: FeedbackSource,
): FeedbackPayload {
  return {
    user_id: userId,
    rating,
    liked: liked.trim() || null,
    improved: improved.trim() || null,
    source,
  };
}
