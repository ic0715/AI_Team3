import { describe, expect, it } from 'vitest';
import {
  buildFeedbackPayload,
  canSubmitFeedback,
  FEEDBACK_NO_RATING_ERROR,
  feedbackRatingError,
  ratingLabel,
} from './feedback';

// ─────────────────────────────────────────────────────────────
// canSubmitFeedback — 제출 게이트 (disabled = submitting || rating === 0 의 부정)
// ─────────────────────────────────────────────────────────────
describe('canSubmitFeedback', () => {
  it('별점 있고 제출 중 아님 → true', () => {
    expect(canSubmitFeedback(1, false)).toBe(true);
    expect(canSubmitFeedback(5, false)).toBe(true);
  });

  it('별점 0(미선택) → false', () => {
    expect(canSubmitFeedback(0, false)).toBe(false);
  });

  it('제출 중 → false', () => {
    expect(canSubmitFeedback(5, true)).toBe(false);
  });

  it('별점 0 + 제출 중 → false', () => {
    expect(canSubmitFeedback(0, true)).toBe(false);
  });

  it('disabled 식(submitting || rating===0)의 정확한 부정과 일치', () => {
    for (const rating of [0, 1, 2, 3, 4, 5]) {
      for (const submitting of [true, false]) {
        const disabled = submitting || rating === 0;
        expect(canSubmitFeedback(rating, submitting)).toBe(!disabled);
      }
    }
  });

  it('boolean 반환(truthy 누출 없음)', () => {
    expect(canSubmitFeedback(3, false)).toBe(true);
    expect(canSubmitFeedback(0, false)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// feedbackRatingError — 제출 직전 별점 검증
// ─────────────────────────────────────────────────────────────
describe('feedbackRatingError', () => {
  it('별점 0 → 에러 메시지', () => {
    expect(feedbackRatingError(0)).toBe(FEEDBACK_NO_RATING_ERROR);
    expect(feedbackRatingError(0)).toBe('별점을 선택해주세요');
  });

  it('별점 1~5 → null', () => {
    for (const r of [1, 2, 3, 4, 5]) {
      expect(feedbackRatingError(r)).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────
// ratingLabel — 별점 → 표시 라벨
// ─────────────────────────────────────────────────────────────
describe('ratingLabel', () => {
  it('1~5 라벨 매핑', () => {
    expect(ratingLabel(1)).toBe('아쉬워요');
    expect(ratingLabel(2)).toBe('조금 아쉬워요');
    expect(ratingLabel(3)).toBe('보통이에요');
    expect(ratingLabel(4)).toBe('좋아요');
    expect(ratingLabel(5)).toBe('최고예요!');
  });

  it('0(미선택) → 빈 라벨', () => {
    expect(ratingLabel(0)).toBe('');
  });

  it('범위 밖 → 빈 라벨(undefined 노출 방지)', () => {
    expect(ratingLabel(6)).toBe('');
    expect(ratingLabel(-1)).toBe('');
    expect(ratingLabel(100)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
// buildFeedbackPayload — insert 페이로드
// ─────────────────────────────────────────────────────────────
describe('buildFeedbackPayload', () => {
  it('정상 텍스트 → trim 후 보존', () => {
    expect(buildFeedbackPayload('u1', 4, '  좋았어요  ', '  개선점  ', 'profile')).toEqual({
      user_id: 'u1',
      rating: 4,
      liked: '좋았어요',
      improved: '개선점',
      source: 'profile',
    });
  });

  it('빈 문자열/공백만 → null', () => {
    expect(buildFeedbackPayload('u1', 5, '', '', 'home_modal')).toEqual({
      user_id: 'u1',
      rating: 5,
      liked: null,
      improved: null,
      source: 'home_modal',
    });
    expect(buildFeedbackPayload('u1', 5, '   ', '\t\n', 'profile')).toEqual({
      user_id: 'u1',
      rating: 5,
      liked: null,
      improved: null,
      source: 'profile',
    });
  });

  it('한쪽만 입력 → 입력한 쪽만 보존, 나머지 null', () => {
    expect(buildFeedbackPayload('u1', 3, '좋아요', '   ', 'profile')).toEqual({
      user_id: 'u1',
      rating: 3,
      liked: '좋아요',
      improved: null,
      source: 'profile',
    });
  });

  it('DB 계약 키만 포함', () => {
    const payload = buildFeedbackPayload('u1', 1, 'a', 'b', 'profile');
    expect(Object.keys(payload).sort()).toEqual([
      'improved', 'liked', 'rating', 'source', 'user_id',
    ]);
  });

  it('source 그대로 전달(profile/home_modal)', () => {
    expect(buildFeedbackPayload('u1', 1, '', '', 'profile').source).toBe('profile');
    expect(buildFeedbackPayload('u1', 1, '', '', 'home_modal').source).toBe('home_modal');
  });
});
