'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// 비밀번호 강도 계산
function getPasswordStrength(password: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (password.length === 0) return { level: 0, label: '', color: '' };
  if (password.length < 8) return { level: 1, label: '약함', color: '#EF4444' };
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (hasLetter && hasNumber && password.length >= 12) return { level: 3, label: '강함', color: '#10B981' };
  if (hasLetter && hasNumber) return { level: 2, label: '보통', color: '#F59E0B' };
  return { level: 1, label: '약함', color: '#EF4444' };
}

// 만 14세 이상 검증
function isOver14(birthdate: string): boolean {
  if (!birthdate) return false;
  const birth = new Date(birthdate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) return age - 1 >= 14;
  return age >= 14;
}

type TabType = 'login' | 'signup';
type PanelType = 'tabs' | 'reset' | 'verify-email';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('login');

  // Google OAuth / 이메일 인증 콜백에서 돌아왔을 때 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // 랜딩 CTA "동의하고 시작하기"에서 ?tab=signup 으로 진입한 경우 → 회원가입 탭 활성화
    if (params.get('tab') === 'signup') {
      setActiveTab('signup');
    }

    // Google OAuth 완료 콜백 감지:
    // - PKCE flow:     auth/callback → /login?code=XXX&source=oauth
    // - Implicit flow: auth/callback → /login?source=oauth#access_token=XXX
    // 두 경우 모두 source=oauth 가 붙어서 오므로 이것만 체크.
    const hasCode = !!params.get('code');
    const hasHash = window.location.hash.includes('access_token');
    const isOAuthCallback = params.get('source') === 'oauth';

    if (hasCode || hasHash) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          authListener.subscription.unsubscribe();

          if (isOAuthCallback) {
            // Google OAuth: 세션 유지 → 상태 기반 라우팅
            await handlePostAuthRouting();
          } else {
            // 이메일 인증 완료: 자동 로그인 방지 → 수동 로그인 유도
            await supabase.auth.signOut();
            setLoginEmail(session.user.email ?? '');
            setVerifiedSuccess(true);
            setPanel('tabs');
            setActiveTab('login');
          }
        }
      });
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [panel, setPanel] = useState<PanelType>('tabs');

  // 로그인 폼
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // 회원가입 폼
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupBirthdate, setSignupBirthdate] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // 동의 항목
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentAge, setConsentAge] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

  // 이메일 인증 대기
  const [pendingEmail, setPendingEmail] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  // 비밀번호 재설정
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const passwordStrength = getPasswordStrength(signupPassword);

  // 전체 동의 토글
  const allChecked = consentPrivacy && consentTerms && consentAge && consentMarketing;
  const handleAllConsent = (checked: boolean) => {
    setConsentPrivacy(checked);
    setConsentTerms(checked);
    setConsentAge(checked);
    setConsentMarketing(checked);
  };

  // 회원가입 버튼 활성화 조건
  const signupEnabled = consentPrivacy && consentTerms && consentAge &&
    signupEmail && signupPassword.length >= 8 && signupBirthdate;

  // 로그인 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginEmail) { setLoginError('이메일을 입력해주세요'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) { setLoginError('올바른 이메일 형식이 아니에요'); return; }
    if (!loginPassword) { setLoginError('비밀번호를 입력해주세요'); return; }
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoginLoading(false);
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setLoginError('이메일 또는 비밀번호가 올바르지 않아요');
      } else if (error.message.includes('Email not confirmed')) {
        setPendingEmail(loginEmail);
        setPanel('verify-email');
      } else {
        setLoginError('로그인에 실패했어요. 다시 시도해주세요');
      }
      return;
    }
    // 로그인 성공 → 사용자 상태 기반 라우팅
    await handlePostAuthRouting();
  };

  // 회원가입 처리
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    if (!signupEmail) { setSignupError('이메일을 입력해주세요'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) { setSignupError('올바른 이메일 형식이 아니에요'); return; }
    if (signupPassword.length < 8) { setSignupError('비밀번호는 최소 8자 이상이어야 해요'); return; }
    if (!isOver14(signupBirthdate)) { setSignupError('만 14세 이상만 가입할 수 있어요'); return; }
    if (!consentPrivacy || !consentTerms || !consentAge) { setSignupError('필수 항목에 동의해주세요'); return; }
    setSignupLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          birthdate: signupBirthdate,
          consent_marketing: consentMarketing,
        },
      },
    });
    setSignupLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setSignupError('이미 가입된 이메일이에요. 로그인을 시도해보세요');
        setActiveTab('login');
      } else if (msg.includes('rate limit') || msg.includes('only request this once') || msg.includes('too many')) {
        setSignupError('잠시 후 다시 시도해주세요 (이메일 발송 횟수 제한)');
      } else if (msg.includes('invalid email') || msg.includes('unable to validate')) {
        setSignupError('올바른 이메일 형식이 아니에요');
      } else if (msg.includes('password') && msg.includes('weak')) {
        setSignupError('비밀번호가 너무 간단해요. 영문+숫자 조합으로 바꿔주세요');
      } else {
        // 개발 중 실제 에러 확인용 (나중에 제거해도 됨)
        console.error('[Signup error]', error.message);
        setSignupError('가입에 실패했어요. 잠시 후 다시 시도해주세요');
      }
      return;
    }
    // 가입 성공 → 이메일 인증 안내 패널로 전환 (페이지 이동 없음)
    setPendingEmail(signupEmail);
    setPanel('verify-email');
  };

  // 비밀번호 재설정 처리
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    if (!resetEmail) return;
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      setResetMessage('오류가 발생했어요. 다시 시도해주세요');
    } else {
      setResetMessage('재설정 링크를 이메일로 보냈어요 ✅');
    }
  };

  // 인증 성공 후 라우팅 (02_login.md 5번 라우팅 로직)
  const handlePostAuthRouting = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. 이메일 인증 미완료
    if (!user.email_confirmed_at) {
      setPendingEmail(user.email ?? '');
      setPanel('verify-email');
      return;
    }

    // 2. 온보딩 완료 여부 먼저 확인 (온보딩 미완료 → goals 체크 생략)
    const { data: profile } = await supabase
      .from('profiles')
      .select('profile_completed')
      .eq('id', user.id)
      .single();

    if (!profile?.profile_completed) { router.push('/onboarding/profile'); return; }

    const { data: strengths } = await supabase
      .from('strength_analyses')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_latest', true)
      .limit(1);

    if (!strengths?.length) { router.push('/onboarding/strengths'); return; }

    const { data: interviews } = await supabase
      .from('career_interview_results')
      .select('id, recommended_competencies')
      .eq('user_id', user.id)
      .limit(1);

    if (!interviews?.length) { router.push('/onboarding/career-intro'); return; }
    if (!interviews[0].recommended_competencies) { router.push('/onboarding/career-result'); return; }

    // 3. 온보딩 완료 → goals 상태 확인
    const { data: goals } = await supabase
      .from('goals')
      .select('status, current_week, total_weeks')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const activeGoal = goals?.find((g) => g.status === 'active');
    const pausedGoal = goals?.find((g) => g.status === 'paused');
    const completedGoal = goals?.find(
      (g) => g.status === 'completed' && g.current_week >= g.total_weeks
    );

    if (activeGoal || pausedGoal) { router.push('/home'); return; }
    if (completedGoal && !activeGoal) { router.push('/cycle-complete'); return; }

    // 4. 온보딩은 끝났지만 아직 goal 없음 → 액션 아이템 선택
    router.push('/onboarding/action-items');
  };

  return (
    <div
      style={{
        width: 'min(430px, 100vw)',
        minHeight: '100dvh',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        margin: '0 auto',
        boxShadow: '0 0 40px rgba(0,0,0,.18)',
        overflowX: 'hidden',
      }}
    >
      {/* 헤더 */}
      <div style={{ padding: '48px 24px 28px' }}>
        {/* 로고 아이콘 */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-.5px', marginBottom: '6px' }}>
          CareerPT
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          방향이 없는 당신을 위한<br />AI 커리어 코치
        </div>
      </div>

      {/* 비밀번호 재설정 패널 */}
      {panel === 'reset' && (
        <div style={{ flex: 1, padding: '0 24px 40px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>비밀번호 재설정</div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              가입한 이메일 주소를 입력하면 재설정 링크를 보내드려요.
            </div>
          </div>

          {resetMessage && (
            <div style={{
              padding: '12px 14px', borderRadius: 'var(--radius-md)',
              background: '#ecfdf5', border: '1.5px solid #6ee7b7',
              fontSize: '14px', color: '#065f46', marginBottom: '16px',
            }}>
              {resetMessage}
            </div>
          )}

          <form onSubmit={handleReset}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                이메일
              </div>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="example@email.com"
                style={inputStyle}
              />
            </div>
            <button type="submit" disabled={resetLoading || !resetEmail} style={{ ...primaryBtnStyle, opacity: resetEmail ? 1 : 0.4, cursor: resetEmail ? 'pointer' : 'not-allowed' }}>
              {resetLoading ? '전송 중...' : '재설정 링크 보내기'}
            </button>
          </form>

          <button
            onClick={() => { setPanel('tabs'); setActiveTab('login'); setResetMessage(''); }}
            style={{ width: '100%', marginTop: '12px', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '12px', fontFamily: 'inherit' }}
          >
            ← 로그인으로 돌아가기
          </button>
        </div>
      )}

      {/* 이메일 인증 대기 패널 */}
      {panel === 'verify-email' && (
        <div style={{ flex: 1, padding: '0 24px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {/* 이메일 아이콘 */}
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#EEF2FF', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: '20px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
            이메일을 확인해주세요
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '8px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pendingEmail}</span>으로<br />
            인증 링크를 보냈어요.
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '32px' }}>
            링크를 클릭하면 가입이 완료돼요.<br />
            메일이 안 보이면 스팸함을 확인해주세요.
          </div>
          <button
            onClick={() => { setPanel('tabs'); setActiveTab('login'); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '12px', fontFamily: 'inherit' }}
          >
            ← 로그인으로 돌아가기
          </button>
        </div>
      )}

      {/* 탭 + 폼 패널 */}
      {panel === 'tabs' && (
        <>
          {/* 탭 네비게이션 */}
          <div style={{
            display: 'flex', margin: '0 24px 24px',
            background: '#F0F0EC', borderRadius: 'var(--radius-sm)',
            padding: '3px', flexShrink: 0,
          }}>
            {(['login', 'signup'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setLoginError(''); setSignupError(''); router.replace(`/login?tab=${tab}`); }}
                style={{
                  flex: 1, padding: '9px', textAlign: 'center', borderRadius: '6px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', border: 'none',
                  fontFamily: 'inherit', transition: 'all .15s',
                  background: activeTab === tab ? 'var(--surface)' : 'none',
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                }}
              >
                {tab === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: '0 24px 40px', overflowY: 'auto' }}>

            {/* 로그인 패널 */}
            {/* 이메일 인증 완료 배너 */}
            {verifiedSuccess && (
              <div style={{
                padding: '14px 16px', borderRadius: 'var(--radius-md)',
                background: '#ecfdf5', border: '1.5px solid #6ee7b7',
                fontSize: '14px', color: '#065f46', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>이메일 인증이 완료되었습니다. 로그인해주세요.</span>
              </div>
            )}

            {activeTab === 'login' && (
              <form onSubmit={handleLogin}>
                {loginError && <ErrorBox message={loginError} />}

                <FieldRow label="이메일">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => { setLoginEmail(e.target.value); setLoginError(''); }}
                    placeholder="example@email.com"
                    autoComplete="username"
                    style={inputStyle}
                  />
                </FieldRow>

                <FieldRow label="비밀번호">
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                      placeholder="비밀번호 입력"
                      autoComplete="current-password"
                      style={{ ...inputStyle, paddingRight: '44px' }}
                    />
                    <button
                      type="button"
                      aria-pressed={showLoginPassword}
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      style={eyeBtnStyle}
                    >
                      {showLoginPassword ? (
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
                </FieldRow>

                <button type="submit" disabled={loginLoading} style={primaryBtnStyle}>
                  {loginLoading ? '로그인 중...' : '로그인'}
                </button>

                <button
                  type="button"
                  onClick={() => setPanel('reset')}
                  style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  비밀번호를 잊으셨나요?
                </button>

                <Divider />

                <GoogleButton />
              </form>
            )}

            {/* 회원가입 패널 */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignup}>
                {signupError && <ErrorBox message={signupError} />}

                <FieldRow label="이메일">
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="example@email.com"
                    autoComplete="email"
                    style={inputStyle}
                  />
                </FieldRow>

                <FieldRow label="비밀번호">
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="8자 이상 (영문+숫자)"
                      autoComplete="new-password"
                      style={{ ...inputStyle, paddingRight: '44px' }}
                    />
                    <button
                      type="button"
                      aria-pressed={showSignupPassword}
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      style={eyeBtnStyle}
                    >
                      {showSignupPassword ? (
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
                  {/* 비밀번호 강도 표시 */}
                  {signupPassword.length > 0 && (
                    <div style={{ marginTop: '8px' }} aria-live="polite">
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1, height: '4px', borderRadius: '999px',
                              background: i <= passwordStrength.level ? passwordStrength.color : 'var(--border)',
                              transition: 'background .2s',
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize: '12px', color: passwordStrength.color, fontWeight: 600 }}>
                        {passwordStrength.label}
                      </div>
                    </div>
                  )}
                </FieldRow>

                <FieldRow label="생년월일">
                  <input
                    type="date"
                    value={signupBirthdate}
                    onChange={(e) => {
                      setSignupBirthdate(e.target.value);
                      // 생년월일과 만 14세 동의 자동 연동
                      if (isOver14(e.target.value)) setConsentAge(true);
                      else setConsentAge(false);
                    }}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 14)).toISOString().split('T')[0]}
                    style={inputStyle}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    만 14세 이상만 가입할 수 있어요
                  </div>
                </FieldRow>

                {/* 분리 동의 영역 */}
                <div style={{
                  border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)',
                  padding: '14px 16px', marginBottom: '14px',
                }}>
                  {/* 전체 동의 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => handleAllConsent(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>전체 동의</span>
                  </label>

                  <ConsentRow
                    checked={consentPrivacy}
                    onChange={setConsentPrivacy}
                    label="[필수] 개인정보 수집 및 이용 동의"
                    showView
                  />
                  <ConsentRow
                    checked={consentTerms}
                    onChange={setConsentTerms}
                    label="[필수] 서비스 이용약관 동의"
                    showView
                  />
                  <ConsentRow
                    checked={consentAge}
                    onChange={setConsentAge}
                    label="[필수] 만 14세 이상 확인"
                  />
                  <ConsentRow
                    checked={consentMarketing}
                    onChange={setConsentMarketing}
                    label="[선택] 마케팅 정보 수신 동의"
                    showView
                    last
                  />
                </div>

                <button
                  type="submit"
                  disabled={!signupEnabled || signupLoading}
                  style={{
                    ...primaryBtnStyle,
                    opacity: signupEnabled ? 1 : 0.4,
                    cursor: signupEnabled ? 'pointer' : 'not-allowed',
                  }}
                >
                  {signupLoading ? '처리 중...' : '시작하기 →'}
                </button>

                <Divider />

                <GoogleButton label="Google로 시작하기" />
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── 공통 컴포넌트 ──────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        padding: '12px 14px', borderRadius: 'var(--radius-md)',
        background: '#FEF2F2', border: '1.5px solid #FECACA',
        fontSize: '13px', color: '#DC2626', marginBottom: '16px',
      }}
    >
      {message}
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>또는</div>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

function GoogleButton({ label = 'Google로 계속하기' }: { label?: string }) {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      style={{
        width: '100%', padding: '12px 16px', background: 'var(--surface)',
        color: 'var(--text-primary)', border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600,
        fontFamily: 'inherit', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: '10px',
      }}
    >
      {/* Google 아이콘 */}
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
        <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" />
      </svg>
      {label}
    </button>
  );
}

function ConsentRow({
  checked, onChange, label, showView = false, last = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  showView?: boolean;
  last?: boolean;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: last ? 0 : '8px' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: '15px', height: '15px', accentColor: 'var(--accent)', flexShrink: 0 }}
      />
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
      {showView && (
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
          보기
        </span>
      )}
    </label>
  );
}

// ── 공통 스타일 상수 ────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '16px', // iOS Safari: 16px 미만이면 포커스 시 자동 확대됨
  lineHeight: '1.5', // date input 높이를 text input과 동일하게 맞춤
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
