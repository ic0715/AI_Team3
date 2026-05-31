'use client';

/**
 * OnboardingRedirectModal
 * 온보딩 가드가 이전 단계 미완료를 감지했을 때 표시하는 확인 모달.
 * 사용자가 "이동하기"를 누르면 confirmRedirect()를 호출해 실제 이동한다.
 */

interface Props {
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function OnboardingRedirectModal({ title, message, onConfirm }: Props) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)',
      padding: '0 24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        background: 'var(--surface)',
        borderRadius: '20px',
        padding: '28px 24px 24px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* 아이콘 */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'var(--accent-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* 제목 */}
        <h2 style={{
          margin: 0,
          fontSize: '17px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          lineHeight: 1.35,
          letterSpacing: '-.025em',
        }}>
          {title}
        </h2>

        {/* 메시지 */}
        <p style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          lineHeight: 1.65,
          letterSpacing: '-.005em',
          whiteSpace: 'pre-line',
        }}>
          {message}
        </p>

        {/* 버튼 */}
        <button
          onClick={onConfirm}
          style={{
            marginTop: '4px',
            width: '100%',
            minHeight: '48px',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 800,
            letterSpacing: '-.02em',
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(45,91,255,.3)',
          }}
        >
          이동하기 →
        </button>
      </div>
    </div>
  );
}
