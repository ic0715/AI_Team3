'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

function getPasswordStrength(password: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (password.length === 0) return { level: 0, label: '', color: '' };
  if (password.length < 8) return { level: 1, label: '약함', color: '#EF4444' };
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (hasLetter && hasNumber && password.length >= 12) return { level: 3, label: '강함', color: '#10B981' };
  if (hasLetter && hasNumber) return { level: 2, label: '보통', color: '#F59E0B' };
  return { level: 1, label: '약함', color: '#EF4444' };
}

type Status = 'loading' | 'form' | 'success' | 'error';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordStrength = getPasswordStrength(newPassword);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // PKCE flow: code를 세션으로 교환
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setStatus('error');
        else setStatus('form');
      });
      return;
    }

    // Implicit flow: Supabase가 hash를 자동 처리 → PASSWORD_RECOVERY 이벤트 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('form');
      }
    });

    // 이미 복구 세션이 있는 경우 (페이지 새로고침 등)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus('form');
    });

    // 3초 후에도 세션이 없으면 링크 만료/오류로 처리
    const timeout = setTimeout(() => {
      setStatus((s) => (s === 'loading' ? 'error' : s));
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (newPassword.length < 8) { setFormError('비밀번호는 최소 8자 이상이어야 해요'); return; }
    if (newPassword !== confirmPassword) { setFormError('비밀번호가 일치하지 않아요'); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      setFormError('비밀번호 변경에 실패했어요. 링크가 만료됐을 수 있어요');
    } else {
      await supabase.auth.signOut();
      setStatus('success');
    }
  };

  return (
    <div style={{
      width: 'min(430px, 100vw)',
      minHeight: '100dvh',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,.18)',
    }}>
      {/* 헤더 */}
      <div style={{ padding: '48px 24px 28px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px',
          background: 'var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-.5px', marginBottom: '6px' }}>
          CareerPT
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          새 비밀번호 설정
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 24px 40px' }}>

        {/* 로딩 */}
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '16px' }}>
            <div style={{ fontSize: '24px' }}>🔑</div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>링크를 확인하는 중이에요...</div>
          </div>
        )}

        {/* 링크 오류/만료 */}
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#FEF2F2', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '20px',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
              링크가 만료되었어요
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '32px' }}>
              비밀번호 재설정 링크가 유효하지 않거나<br />
              만료되었어요. 다시 요청해주세요.
            </div>
            <button
              onClick={() => router.push('/login')}
              style={primaryBtnStyle}
            >
              로그인으로 돌아가기
            </button>
          </div>
        )}

        {/* 비밀번호 입력 폼 */}
        {status === 'form' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>새 비밀번호 설정</div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                사용할 새 비밀번호를 입력해주세요.
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {formError && (
                <div role="alert" style={{
                  padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  background: '#FEF2F2', border: '1.5px solid #FECACA',
                  fontSize: '13px', color: '#DC2626', marginBottom: '16px',
                }}>
                  {formError}
                </div>
              )}

              {/* 새 비밀번호 */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  새 비밀번호
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setFormError(''); }}
                    placeholder="8자 이상 (영문+숫자)"
                    autoComplete="new-password"
                    style={{ ...inputStyle, paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={eyeBtnStyle}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                {/* 비밀번호 강도 */}
                {newPassword.length > 0 && (
                  <div style={{ marginTop: '8px' }} aria-live="polite">
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                      {[1, 2, 3].map((i) => (
                        <div key={i} style={{
                          flex: 1, height: '4px', borderRadius: '999px',
                          background: i <= passwordStrength.level ? passwordStrength.color : 'var(--border)',
                          transition: 'background .2s',
                        }} />
                      ))}
                    </div>
                    <div style={{ fontSize: '12px', color: passwordStrength.color, fontWeight: 600 }}>
                      {passwordStrength.label}
                    </div>
                  </div>
                )}
              </div>

              {/* 비밀번호 확인 */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  비밀번호 확인
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setFormError(''); }}
                  placeholder="비밀번호를 다시 입력해주세요"
                  autoComplete="new-password"
                  style={{
                    ...inputStyle,
                    borderColor: confirmPassword && confirmPassword !== newPassword ? '#FECACA' : 'var(--border)',
                  }}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>
                    비밀번호가 일치하지 않아요
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                style={{
                  ...primaryBtnStyle,
                  opacity: (!loading && newPassword.length >= 8 && newPassword === confirmPassword) ? 1 : 0.4,
                  cursor: (!loading && newPassword.length >= 8 && newPassword === confirmPassword) ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? '변경 중...' : '비밀번호 변경하기'}
              </button>
            </form>
          </>
        )}

        {/* 변경 완료 */}
        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#ecfdf5', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '20px',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
              비밀번호가 변경되었어요!
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '32px' }}>
              새 비밀번호로 다시 로그인해주세요.
            </div>
            <button onClick={() => router.push('/login')} style={primaryBtnStyle}>
              로그인하러 가기 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '16px',
  lineHeight: '1.5',
  padding: '12px 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1.5px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  marginTop: '6px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(45,91,255,.3)',
};

const eyeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
};
