'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';

// ────────────────────────────────────────────────────────────
// NEW07 비밀번호 변경 (스펙 v1.3)
//
// 진입: 14 프로필 [비밀번호 변경] 메뉴
// 동작: 현재 비밀번호 재인증 → 새 비밀번호로 업데이트
// 진입 차단: OAuth 전용 사용자 (app_metadata.providers에 'email' 미포함)
//   → "Google 계정 비밀번호는 Google에서 관리해주세요" 안내 후 14 복귀
// 변경 완료 시: 11 홈으로
// ────────────────────────────────────────────────────────────

type StrengthLevel = 'weak' | 'medium' | 'strong';

function evaluateStrength(pwd: string): StrengthLevel {
  if (pwd.length < 8) return 'weak';
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);
  if (pwd.length >= 12 && hasLetter && hasNumber && hasSpecial) return 'strong';
  if (hasLetter && hasNumber) return 'medium';
  return 'weak';
}

const STRENGTH_LABEL: Record<StrengthLevel, string> = {
  weak: '약함',
  medium: '보통',
  strong: '강함',
};

const STRENGTH_COLOR: Record<StrengthLevel, string> = {
  weak: '#dc2626',
  medium: '#F59E0B',
  strong: '#10B981',
};

// ────────────────────────────────────────────────────────────

export default function PasswordChangePage() {
  return (
    <Suspense fallback={<LoadingScreen text="잠시만요..." />}>
      <PasswordChangeContent />
    </Suspense>
  );
}

function PasswordChangeContent() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [currentError, setCurrentError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // ── 진입 시 OAuth 사용자 차단 ─────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        if (cancelled) return;

        // app_metadata는 Supabase 버전에 따라 provider(단일) 또는 providers(배열) 형태 가능 — 둘 다 허용
        const meta =
          (user.app_metadata as { provider?: string; providers?: string[] } | undefined) ?? {};
        const hasEmailProvider =
          (Array.isArray(meta.providers) && meta.providers.includes('email')) ||
          meta.provider === 'email';

        if (!hasEmailProvider) {
          // OAuth 전용 사용자
          alert('Google 계정 비밀번호는 Google에서 관리해주세요.');
          router.replace('/profile');
          return;
        }

        setUserEmail(user.email ?? null);
        setLoadingAuth(false);
      } catch (e) {
        console.error('[NEW07] auth check:', e);
        if (!cancelled) {
          setGlobalError('계정 정보를 확인할 수 없어요. 잠시 후 다시 시도해주세요.');
          setLoadingAuth(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [router]);

  const strength = evaluateStrength(newPwd);

  // ── 입력 검증 ─────────────────────────────────────────────
  const validateFields = useCallback((): boolean => {
    let ok = true;
    setCurrentError(null);
    setNewError(null);
    setConfirmError(null);

    if (!currentPwd) {
      setCurrentError('현재 비밀번호를 입력해주세요');
      ok = false;
    }
    if (newPwd.length < 8) {
      setNewError('비밀번호는 최소 8자 이상이어야 해요');
      ok = false;
    } else if (newPwd === currentPwd) {
      setNewError('현재 비밀번호와 다른 비밀번호를 사용해주세요');
      ok = false;
    }
    if (newPwd !== confirmPwd) {
      setConfirmError('비밀번호가 일치하지 않아요');
      ok = false;
    }
    return ok;
  }, [currentPwd, newPwd, confirmPwd]);

  // ── 제출 ───────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitting || !userEmail) return;
    setGlobalError(null);
    if (!validateFields()) return;

    setSubmitting(true);
    try {
      // 1. 현재 비밀번호 재인증
      const { error: signinErr } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPwd,
      });
      if (signinErr) {
        const msg = signinErr.message?.toLowerCase() ?? '';
        if (msg.includes('rate') || msg.includes('limit')) {
          setGlobalError('잠시 후 다시 시도해주세요 (요청이 너무 많아요).');
        } else if (msg.includes('invalid') || msg.includes('credentials')) {
          setCurrentError('현재 비밀번호가 일치하지 않아요');
        } else {
          setGlobalError('재인증에 실패했어요. 다시 시도해주세요.');
        }
        setSubmitting(false);
        return;
      }

      // 2. 새 비밀번호로 업데이트
      const { error: updErr } = await supabase.auth.updateUser({ password: newPwd });
      if (updErr) {
        setGlobalError('변경에 실패했어요. 잠시 후 다시 시도해주세요.');
        setSubmitting(false);
        return;
      }

      // 3. 성공 — 토스트 대신 alert로 안내 후 11 홈
      alert('비밀번호가 변경되었어요');
      router.push('/home');
    } catch (e) {
      console.error('[NEW07] submit:', e);
      setGlobalError('변경에 실패했어요. 잠시 후 다시 시도해주세요.');
      setSubmitting(false);
    }
  }, [submitting, userEmail, currentPwd, newPwd, router, validateFields]);

  // ── 취소 / 뒤로가기 ───────────────────────────────────────
  const hasInput = !!(currentPwd || newPwd || confirmPwd);

  const handleBack = useCallback(() => {
    if (hasInput) {
      setShowCancelConfirm(true);
    } else {
      router.push('/profile');
    }
  }, [hasInput, router]);

  // ── 렌더 ──────────────────────────────────────────────────
  if (loadingAuth) return <LoadingScreen text="잠시만요..." />;

  const canSubmit =
    !!currentPwd && newPwd.length >= 8 && newPwd === confirmPwd && !submitting;

  return (
    <div style={wrapStyle}>
      {/* 상단 바 */}
      <header style={topbarStyle}>
        <button type="button" onClick={handleBack} aria-label="뒤로 가기" style={backBtnStyle}>
          ←
        </button>
        <span style={titleStyle}>비밀번호 변경</span>
        <span style={{ width: '40px' }} />
      </header>

      <main style={screenStyle}>
        {/* 안내 메시지 */}
        <section style={{ marginBottom: '20px' }}>
          <h1 style={pageHeadingStyle}>안전한 비밀번호로 변경해주세요</h1>
          <p style={pageSubStyle}>변경 후 다른 디바이스에서는 자동으로 로그아웃돼요.</p>
        </section>

        {/* 현재 비밀번호 */}
        <PasswordField
          label="현재 비밀번호"
          value={currentPwd}
          onChange={(v) => {
            setCurrentPwd(v);
            if (currentError) setCurrentError(null);
          }}
          show={showCurrent}
          onToggleShow={() => setShowCurrent((s) => !s)}
          autoComplete="current-password"
          error={currentError}
        />

        {/* 새 비밀번호 + 강도 */}
        <PasswordField
          label="새 비밀번호"
          value={newPwd}
          onChange={(v) => {
            setNewPwd(v);
            if (newError) setNewError(null);
            if (confirmError && v === confirmPwd) setConfirmError(null);
          }}
          show={showNew}
          onToggleShow={() => setShowNew((s) => !s)}
          autoComplete="new-password"
          error={newError}
          hint="8자 이상, 영문+숫자 혼합 권장"
        />

        {newPwd.length > 0 && (
          <div style={strengthRowStyle} aria-live="polite">
            <span style={{ fontSize: '11px', color: 'var(--ink-mute)', fontWeight: 600 }}>
              강도
            </span>
            <div style={strengthBarTrack}>
              <div
                style={{
                  ...strengthBarFill,
                  width:
                    strength === 'weak'
                      ? '33%'
                      : strength === 'medium'
                        ? '66%'
                        : '100%',
                  background: STRENGTH_COLOR[strength],
                }}
              />
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: STRENGTH_COLOR[strength],
              }}
            >
              {STRENGTH_LABEL[strength]}
            </span>
          </div>
        )}

        {/* 새 비밀번호 확인 */}
        <PasswordField
          label="새 비밀번호 확인"
          value={confirmPwd}
          onChange={(v) => {
            setConfirmPwd(v);
            if (confirmError) setConfirmError(null);
          }}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((s) => !s)}
          autoComplete="new-password"
          error={confirmError}
        />

        {globalError && (
          <div role="alert" style={errorAlertStyle}>
            {globalError}
          </div>
        )}

        <div style={{ height: '8px' }} />
      </main>

      {/* Bottom CTA */}
      <footer style={footerStyle}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            ...primaryBtnStyle,
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? '변경 중...' : '비밀번호 변경'}
        </button>
        <button type="button" onClick={handleBack} style={secondaryBtnStyle}>
          취소
        </button>
      </footer>

      {/* 취소 확인 다이얼로그 */}
      {showCancelConfirm && (
        <div role="dialog" aria-modal="true" style={dialogOverlayStyle}>
          <div style={dialogBoxStyle}>
            <div style={dialogTitleStyle}>변경사항이 사라져요</div>
            <p style={dialogDescStyle}>입력한 내용을 저장하지 않고 나갈까요?</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                style={dialogBtnCancelStyle}
              >
                계속 작성
              </button>
              <button
                type="button"
                onClick={() => router.push('/profile')}
                style={dialogBtnPrimaryStyle}
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트 — PasswordField
// ────────────────────────────────────────────────────────────

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete: string;
  error?: string | null;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={fieldLabelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          style={{
            ...inputStyle,
            borderColor: error ? 'var(--danger)' : 'var(--border)',
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${label}-error` : undefined}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-pressed={show}
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
          style={eyeBtnStyle}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
      {error ? (
        <div id={`${label}-error`} role="alert" style={fieldErrorStyle}>
          {error}
        </div>
      ) : hint ? (
        <div style={fieldHintStyle}>{hint}</div>
      ) : null}
    </div>
  );
}

function LoadingScreen({ text }: { text: string }) {
  return (
    <div style={wrapStyle}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{text}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────────────────────

const wrapStyle: CSSProperties = {
  width: 'min(430px, 100vw)',
  minHeight: '100dvh',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflowX: 'hidden',
  position: 'relative',
};

const topbarStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px 1fr 40px',
  alignItems: 'center',
  padding: '14px 20px',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--line)',
  position: 'sticky',
  top: 0,
  zIndex: 50,
  flexShrink: 0,
};

const backBtnStyle: CSSProperties = {
  width: '40px',
  height: '40px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '22px',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  textAlign: 'left',
  padding: 0,
};

const titleStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--ink)',
  textAlign: 'center',
  letterSpacing: '-.01em',
};

const screenStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '24px 22px',
};

const pageHeadingStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: 800,
  color: 'var(--ink)',
  marginBottom: '6px',
  letterSpacing: '-.02em',
  lineHeight: 1.3,
};

const pageSubStyle: CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: 'var(--ink-soft)',
  lineHeight: 1.6,
};

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12.5px',
  fontWeight: 600,
  color: 'var(--ink-soft)',
  marginBottom: '6px',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 44px 12px 14px',
  border: '1.5px solid var(--border)',
  borderRadius: '12px',
  fontSize: '15px',
  fontFamily: 'inherit',
  color: 'var(--ink)',
  background: 'var(--surface)',
  outline: 'none',
};

const eyeBtnStyle: CSSProperties = {
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '32px',
  height: '32px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '16px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const fieldErrorStyle: CSSProperties = {
  marginTop: '4px',
  fontSize: '12px',
  color: 'var(--danger)',
};

const fieldHintStyle: CSSProperties = {
  marginTop: '4px',
  fontSize: '11.5px',
  color: 'var(--ink-mute)',
};

const strengthRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginTop: '-8px',
  marginBottom: '14px',
};

const strengthBarTrack: CSSProperties = {
  flex: 1,
  height: '4px',
  background: 'var(--line)',
  borderRadius: '2px',
  overflow: 'hidden',
};

const strengthBarFill: CSSProperties = {
  height: '100%',
  transition: 'width .25s ease, background .25s ease',
};

const errorAlertStyle: CSSProperties = {
  padding: '10px 14px',
  marginTop: '8px',
  background: '#FEF2F2',
  border: '1.5px solid #FECACA',
  borderRadius: '10px',
  fontSize: '13px',
  color: 'var(--danger)',
};

const footerStyle: CSSProperties = {
  padding: '14px 22px',
  paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
  background: 'var(--surface)',
  borderTop: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  flexShrink: 0,
};

const primaryBtnStyle: CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: 'inherit',
  boxShadow: '0 4px 14px -4px rgba(45,91,255,.3)',
};

const secondaryBtnStyle: CSSProperties = {
  width: '100%',
  padding: '12px',
  background: 'var(--bg-soft)',
  color: 'var(--ink-soft)',
  border: '1px solid var(--line-strong)',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

// Dialog
const dialogOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: '24px',
};

const dialogBoxStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '20px',
  padding: '24px',
  width: '100%',
  maxWidth: '340px',
};

const dialogTitleStyle: CSSProperties = {
  fontSize: '17px',
  fontWeight: 700,
  marginBottom: '8px',
  color: 'var(--ink)',
};

const dialogDescStyle: CSSProperties = {
  margin: '0 0 20px',
  fontSize: '14px',
  color: 'var(--ink-soft)',
  lineHeight: 1.6,
};

const dialogBtnCancelStyle: CSSProperties = {
  flex: 1,
  padding: '13px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--bg-soft)',
  color: 'var(--ink-soft)',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
};

const dialogBtnPrimaryStyle: CSSProperties = {
  flex: 1,
  padding: '13px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: '14px',
  cursor: 'pointer',
};
