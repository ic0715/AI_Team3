'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';

// ────────────────────────────────────────────────────────────
// FeedbackSheet — 피드백 바텀시트
//
// Props:
//   open      : 시트 표시 여부
//   onClose   : 닫기 콜백 (나중에 할게요 / X 버튼)
//   source    : 'profile' | 'home_modal' — feedbacks 테이블 source 컬럼
//   onSubmitted: 제출 완료 후 콜백 (선택)
// ────────────────────────────────────────────────────────────

interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
  source: 'profile' | 'home_modal';
  onSubmitted?: () => void;
}

export function FeedbackSheet({ open, onClose, source, onSubmitted }: FeedbackSheetProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [liked, setLiked] = useState('');
  const [improved, setImproved] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setRating(0);
    setHovered(0);
    setLiked('');
    setImproved('');
    setError('');
    setDone(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (rating === 0) { setError('별점을 선택해주세요'); return; }
    setError('');
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('로그인이 필요해요'); return; }

      const { error: insertError } = await supabase.from('feedbacks').insert({
        user_id: user.id,
        rating,
        liked: liked.trim() || null,
        improved: improved.trim() || null,
        source,
      });
      if (insertError) throw insertError;

      setDone(true);
      onSubmitted?.();
    } catch (e) {
      console.error('[FeedbackSheet] insert error:', e);
      setError('전송에 실패했어요. 다시 시도해주세요');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={sheetStyle}>
        {/* 핸들 */}
        <div style={handleStyle} />

        {/* 헤더 */}
        <div style={headerStyle}>
          <div style={headerTitleStyle}>서비스 의견 보내기</div>
          <button onClick={handleClose} style={closeBtnStyle} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div style={bodyStyle}>
          {done ? (
            /* 제출 완료 화면 */
            <div style={doneWrapStyle}>
              <div style={doneIconStyle}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={doneTitleStyle}>소중한 의견 감사해요! 🙏</div>
              <div style={doneDescStyle}>더 좋은 서비스로 발전할게요.</div>
              <button onClick={handleClose} style={primaryBtnStyle}>
                확인
              </button>
            </div>
          ) : (
            <>
              {/* 별점 */}
              <div style={sectionStyle}>
                <div style={labelStyle}>CareerPT는 어떠셨나요?</div>
                <div style={starsRowStyle}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      style={starBtnStyle}
                      aria-label={`${star}점`}
                    >
                      <svg
                        width="36" height="36" viewBox="0 0 24 24"
                        fill={(hovered || rating) >= star ? '#FBBF24' : 'none'}
                        stroke={(hovered || rating) >= star ? '#FBBF24' : '#D1D5DB'}
                        strokeWidth="1.8"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <div style={ratingLabelStyle}>
                    {['', '아쉬워요', '조금 아쉬워요', '보통이에요', '좋아요', '최고예요!'][rating]}
                  </div>
                )}
              </div>

              {/* 좋은 점 */}
              <div style={sectionStyle}>
                <label style={labelStyle}>좋았던 점</label>
                <textarea
                  value={liked}
                  onChange={(e) => setLiked(e.target.value)}
                  placeholder="어떤 점이 도움이 됐나요? (선택)"
                  maxLength={500}
                  rows={3}
                  style={textareaStyle}
                />
              </div>

              {/* 개선할 점 */}
              <div style={sectionStyle}>
                <label style={labelStyle}>개선했으면 하는 점</label>
                <textarea
                  value={improved}
                  onChange={(e) => setImproved(e.target.value)}
                  placeholder="불편하거나 아쉬운 점을 알려주세요 (선택)"
                  maxLength={500}
                  rows={3}
                  style={textareaStyle}
                />
              </div>

              {error && <div style={errorStyle}>{error}</div>}

              <button
                onClick={handleSubmit}
                disabled={submitting || rating === 0}
                style={{
                  ...primaryBtnStyle,
                  opacity: submitting || rating === 0 ? 0.45 : 1,
                  cursor: submitting || rating === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? '전송 중...' : '의견 보내기'}
              </button>

              <button onClick={handleClose} style={skipBtnStyle}>
                나중에 할게요
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────────────────────

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 300,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
};

const sheetStyle: CSSProperties = {
  width: 'min(430px, 100vw)',
  maxHeight: '88dvh',
  background: 'var(--surface)',
  borderRadius: '24px 24px 0 0',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 -8px 40px rgba(0,0,0,.18)',
  overflowY: 'auto',
};

const handleStyle: CSSProperties = {
  width: '40px',
  height: '4px',
  background: 'var(--border)',
  borderRadius: '2px',
  margin: '14px auto 0',
  flexShrink: 0,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 22px 0',
  flexShrink: 0,
};

const headerTitleStyle: CSSProperties = {
  fontSize: '17px',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const closeBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  fontFamily: 'inherit',
};

const bodyStyle: CSSProperties = {
  padding: '20px 22px 40px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const sectionStyle: CSSProperties = {
  marginBottom: '16px',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: '10px',
};

const starsRowStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
};

const starBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px',
  lineHeight: 0,
  fontFamily: 'inherit',
  transition: 'transform 0.1s',
};

const ratingLabelStyle: CSSProperties = {
  marginTop: '8px',
  fontSize: '13px',
  fontWeight: 600,
  color: '#FBBF24',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid var(--border)',
  borderRadius: '12px',
  fontSize: '14px',
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  background: 'var(--surface)',
  resize: 'none',
  outline: 'none',
  lineHeight: 1.6,
  boxSizing: 'border-box',
};

const errorStyle: CSSProperties = {
  padding: '10px 14px',
  background: '#FEF2F2',
  border: '1.5px solid #FECACA',
  borderRadius: '10px',
  fontSize: '13px',
  color: '#DC2626',
  marginBottom: '4px',
};

const primaryBtnStyle: CSSProperties = {
  width: '100%',
  minHeight: '50px',
  borderRadius: '14px',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 4px 14px rgba(45,91,255,.28)',
  marginTop: '8px',
};

const skipBtnStyle: CSSProperties = {
  width: '100%',
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  padding: '12px',
  fontFamily: 'inherit',
  marginTop: '4px',
};

// 제출 완료 화면
const doneWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  padding: '8px 0 16px',
};

const doneIconStyle: CSSProperties = {
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  background: '#ECFDF5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '20px',
};

const doneTitleStyle: CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: '8px',
};

const doneDescStyle: CSSProperties = {
  fontSize: '14px',
  color: 'var(--text-secondary)',
  lineHeight: 1.65,
  marginBottom: '28px',
};
