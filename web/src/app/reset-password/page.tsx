'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const inputCls = `
  w-full text-sm px-3.5 py-3 rounded-lg border-[1.5px] border-[#E4E4DF]
  bg-white text-[#1A1A18] outline-none transition-colors
  placeholder:text-[#A8A8A0]
  focus:border-[#2D5BFF] focus:ring-2 focus:ring-blue-100
`.trim()

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPw, setShowPw] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!password || !confirm) return setError('모든 항목을 입력해주세요.')
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.')
    if (password !== confirm) return setError('비밀번호가 일치하지 않아요.')

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(`오류: ${error.message}`)
    } else {
      setSuccess('✓ 비밀번호가 변경됐어요! 잠시 후 로그인 페이지로 이동합니다.')
      setTimeout(() => router.push('/login'), 2500)
    }
  }

  return (
    <div className="min-h-screen flex justify-center" style={{ background: '#F7F7F5' }}>
      <div className="w-[390px] min-h-screen bg-white flex flex-col px-6 pt-[60px]">

        {/* 헤더 */}
        <div className="mb-8">
          <div className="w-12 h-12 rounded-[14px] bg-[#2D5BFF] flex items-center justify-center mb-6">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight mb-1">새 비밀번호 설정</h1>
          <p className="text-sm text-[#6B6B65] leading-relaxed">
            8자 이상의 새 비밀번호를 입력해주세요.
          </p>
        </div>

        {/* 에러/성공 */}
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

        <form onSubmit={handleSubmit}>
          {/* 새 비밀번호 */}
          <label className="block mb-3.5">
            <span className="block text-xs font-medium text-[#6B6B65] mb-1.5">새 비밀번호</span>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="8자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + ' pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A8A0] hover:text-[#6B6B65]"
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          {/* 비밀번호 확인 */}
          <label className="block mb-6">
            <span className="block text-xs font-medium text-[#6B6B65] mb-1.5">비밀번호 확인</span>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="비밀번호 재입력"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#2D5BFF] text-white rounded-xl text-[15px] font-bold shadow-[0_4px_16px_rgba(45,91,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
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
