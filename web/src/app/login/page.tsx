'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ── 타입 ──────────────────────────────────────────
type Tab = 'login' | 'signup' | 'forgot'

// ── 메인 컴포넌트 ──────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 로그인 폼
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // 회원가입 폼
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [consentError, setConsentError] = useState(false)

  // 비밀번호 찾기 폼
  const [forgotEmail, setForgotEmail] = useState('')

  // 비밀번호 표시/숨기기
  const [showLoginPw, setShowLoginPw] = useState(false)
  const [showSignupPw, setShowSignupPw] = useState(false)

  const reset = () => { setError(''); setSuccess(''); setConsentError(false) }

  // ── 로그인 ──────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    reset()
    if (!loginEmail || !loginPassword) return setError('이메일과 비밀번호를 입력해주세요.')

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })
    setLoading(false)

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않아요. 다시 확인해주세요.')
    } else {
      router.push('/')
    }
  }

  // ── 회원가입 ─────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    reset()

    if (!signupName || !signupEmail || !signupPassword) return setError('모든 항목을 입력해주세요.')
    if (signupPassword.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.')
    if (!consentPrivacy) {
      setConsentError(true)
      return setError('개인정보 수집 및 이용 동의(필수)에 체크해주세요.')
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          name: signupName,
          consent_privacy: true,
          consent_privacy_at: new Date().toISOString(),
          consent_marketing: consentMarketing,
          consent_marketing_at: consentMarketing ? new Date().toISOString() : null,
        },
      },
    })
    setLoading(false)

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        setError('이미 사용 중인 이메일이에요. 로그인을 시도해보세요.')
      } else {
        setError(`오류: ${error.message}`)
      }
    } else {
      setSuccess('✓ 가입 완료! 받은 편지함(스팸함도 확인)의 인증 이메일을 클릭해주세요.')
    }
  }

  // ── 비밀번호 찾기 ────────────────────────────────
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    reset()
    if (!forgotEmail) return setError('이메일을 입력해주세요.')

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)

    if (error) {
      setError(`오류: ${error.message}`)
    } else {
      setSuccess('재설정 링크를 이메일로 보냈어요. 스팸함도 확인해주세요.')
    }
  }

  // ── Google 로그인 ────────────────────────────────
  async function handleGoogle() {
    reset()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) setError('Google 로그인 중 오류가 발생했어요. 다시 시도해주세요.')
  }

  // ── 전체 동의 토글 ───────────────────────────────
  function toggleAll() {
    const next = !(consentPrivacy && consentMarketing)
    setConsentPrivacy(next)
    setConsentMarketing(next)
    if (next) setConsentError(false)
  }

  return (
    <div className="min-h-screen flex justify-center" style={{ background: '#F7F7F5' }}>
      <div className="w-[390px] min-h-screen bg-white flex flex-col">

        {/* 헤더 */}
        <div className="px-6 pt-[60px] pb-7">
          <div className="w-12 h-12 rounded-[14px] bg-[#2D5BFF] flex items-center justify-center mb-6">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight mb-1">CareerPT</h1>
          <p className="text-sm text-[#6B6B65] leading-relaxed">
            방향이 없는 당신을 위한<br />AI 커리어 코치
          </p>
        </div>

        {/* 탭 */}
        {tab !== 'forgot' && (
          <div className="mx-6 mb-6 flex bg-[#F0F0EC] rounded-lg p-[3px]">
            {(['login', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); reset() }}
                className={`flex-1 py-[9px] text-sm font-semibold rounded-md transition-all ${
                  tab === t
                    ? 'bg-white text-[#1A1A18] shadow-sm'
                    : 'text-[#6B6B65]'
                }`}
              >
                {t === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 px-6 pb-10">
          {/* 에러/성공 메시지 */}
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-[#DC2626] bg-[#FEE2E2] border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg text-sm text-[#16A34A] bg-[#DCFCE7] border border-green-200">
              {success}
            </div>
          )}

          {/* ── 로그인 폼 ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <Field label="이메일">
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="mb-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#6B6B65]">비밀번호</span>
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); reset() }}
                    className="text-xs text-[#2D5BFF]"
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    placeholder="비밀번호 입력"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={inputCls + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw(!showLoginPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A8A0] hover:text-[#6B6B65]"
                    aria-label={showLoginPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showLoginPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
              <AuthBtn loading={loading} label="로그인" loadingLabel="로그인 중..." />
              <Divider />
              <GoogleBtn onClick={handleGoogle} label="Google로 계속하기" />
            </form>
          )}

          {/* ── 회원가입 폼 ── */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup}>
              <Field label="이름">
                <input
                  type="text"
                  placeholder="홍길동"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="이메일">
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="비밀번호">
                <div className="relative">
                  <input
                    type={showSignupPw ? 'text' : 'password'}
                    placeholder="8자 이상"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className={inputCls + ' pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPw(!showSignupPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A8A0] hover:text-[#6B6B65]"
                    aria-label={showSignupPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showSignupPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </Field>

              {/* 동의 체크박스 */}
              <div
                className={`mt-4 border rounded-lg overflow-hidden transition-colors ${
                  consentError ? 'border-[#DC2626]' : 'border-[#E4E4DF]'
                }`}
              >
                {/* 전체 동의 */}
                <div
                  role="checkbox"
                  aria-checked={consentPrivacy && consentMarketing}
                  aria-label="전체 동의"
                  tabIndex={0}
                  onClick={toggleAll}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleAll() } }}
                  className="flex items-center gap-2.5 px-3.5 py-3 bg-[#F0F0EC] cursor-pointer"
                >
                  <Checkbox checked={consentPrivacy && consentMarketing} />
                  <span className="text-[13px] font-bold text-[#1A1A18]">전체 동의</span>
                </div>

                <div className="h-px bg-[#E4E4DF]" />

                {/* 필수 동의 */}
                <ConsentRow
                  checked={consentPrivacy}
                  label="개인정보 수집 및 이용 동의"
                  ariaLabel="개인정보 수집 및 이용 동의 (필수)"
                  badge="필수"
                  badgeColor="text-[#DC2626] bg-[#FEE2E2]"
                  detail="이름, 이메일, 직무 정보를 커리어 코칭 서비스 제공 목적으로 수집합니다. 보유 기간: 회원 탈퇴 시까지."
                  onToggle={() => {
                    setConsentPrivacy(!consentPrivacy)
                    if (consentError && !consentPrivacy) setConsentError(false)
                  }}
                />

                {/* 선택 동의 */}
                <ConsentRow
                  checked={consentMarketing}
                  label="마케팅 정보 수신 동의"
                  ariaLabel="마케팅 정보 수신 동의 (선택)"
                  badge="선택"
                  badgeColor="text-[#A8A8A0] bg-[#F0F0EC]"
                  detail="커리어 성장 팁, 서비스 업데이트를 이메일로 받아요. 언제든지 수신 거부 가능."
                  onToggle={() => setConsentMarketing(!consentMarketing)}
                />
              </div>

              <AuthBtn loading={loading} label="시작하기 →" loadingLabel="가입 중..." />
              <Divider />
              <GoogleBtn onClick={handleGoogle} label="Google로 시작하기" />
            </form>
          )}

          {/* ── 비밀번호 찾기 ── */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgot}>
              <button
                type="button"
                onClick={() => { setTab('login'); reset() }}
                className="text-sm text-[#2D5BFF] mb-6 block"
              >
                ← 로그인으로 돌아가기
              </button>
              <h2 className="text-xl font-bold mb-1">비밀번호 재설정</h2>
              <p className="text-sm text-[#6B6B65] mb-6 leading-relaxed">
                가입하신 이메일 주소를 입력하시면<br />재설정 링크를 보내드려요.
              </p>
              <Field label="이메일">
                <input
                  type="email"
                  placeholder="가입하신 이메일 주소"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <AuthBtn loading={loading} label="재설정 링크 보내기" loadingLabel="전송 중..." />
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 공통 스타일 상수 ──────────────────────────────
const inputCls = `
  w-full text-sm px-3.5 py-3 rounded-lg border-[1.5px] border-[#E4E4DF]
  bg-white text-[#1A1A18] outline-none transition-colors
  placeholder:text-[#A8A8A0]
  focus:border-[#2D5BFF] focus:ring-2 focus:ring-blue-100
`.trim()

// ── 공통 컴포넌트 ────────────────────────────────
// label 클릭 시 input에 자동 포커스되도록 <label> 태그 사용
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-xs font-medium text-[#6B6B65] mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function AuthBtn({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3.5 mt-1.5 bg-[#2D5BFF] text-white rounded-xl text-[15px] font-bold shadow-[0_4px_16px_rgba(45,91,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed active:opacity-85 transition-all"
    >
      {loading ? loadingLabel : label}
    </button>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-[#E4E4DF]" />
      <span className="text-xs text-[#A8A8A0]">또는</span>
      <div className="flex-1 h-px bg-[#E4E4DF]" />
    </div>
  )
}

function GoogleBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-3.5 flex items-center justify-center gap-2 border-[1.5px] border-[#E4E4DF] rounded-xl text-sm font-semibold text-[#1A1A18] bg-white hover:bg-[#F7F7F5] transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      {label}
    </button>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div className={`w-[18px] h-[18px] rounded-[4px] border-[1.5px] flex items-center justify-center transition-colors shrink-0 ${
      checked ? 'bg-[#2D5BFF] border-[#2D5BFF]' : 'bg-white border-[#E4E4DF]'
    }`}>
      {checked && (
        <svg viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1.5,5 4,7.5 8.5,2.5" />
        </svg>
      )}
    </div>
  )
}

function ConsentRow({
  checked, label, ariaLabel, badge, badgeColor, detail, onToggle,
}: {
  checked: boolean
  label: string
  ariaLabel: string
  badge: string
  badgeColor: string
  detail: string
  onToggle: () => void
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle() } }}
      className="flex items-start gap-2.5 px-3.5 py-3 cursor-pointer"
    >
      <Checkbox checked={checked} />
      <div className="flex-1 text-[13px] leading-relaxed text-[#6B6B65]">
        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mr-1 ${badgeColor}`}>
          {badge}
        </span>
        <strong className="font-semibold text-[#1A1A18]">{label}</strong>
        <div className="text-[11px] text-[#A8A8A0] mt-0.5">{detail}</div>
      </div>
    </div>
  )
}
