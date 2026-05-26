import type { CSSProperties } from 'react';

const wrapStyle: CSSProperties = {
  width: '390px',
  height: '100dvh',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflow: 'hidden',
  position: 'relative',
};

export function LoadingScreen({ text }: { text: string }) {
  return (
    <div style={wrapStyle}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{text}</div>
      </div>
    </div>
  );
}
