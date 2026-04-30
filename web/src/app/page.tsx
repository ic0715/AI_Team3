'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
      } else {
        setEmail(data.user.email ?? '')
      }
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex justify-center" style={{ background: '#F7F7F5' }}>
      <div className="w-[390px] min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-4">
        <div className="w-12 h-12 rounded-[14px] bg-[#2D5BFF] flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#1A1A18]">로그인 성공!</h1>
        <p className="text-sm text-[#6B6B65]">{email}</p>
        <p className="text-xs text-[#A8A8A0] text-center">
          여기에 앞으로 온보딩/메인 화면이 연결될 예정이에요.
        </p>
        <button
          onClick={handleLogout}
          className="mt-4 px-6 py-2.5 border border-[#E4E4DF] rounded-lg text-sm text-[#6B6B65] hover:bg-[#F7F7F5] transition-colors"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
