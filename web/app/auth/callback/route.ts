import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Google OAuth 완료 후 Supabase가 이 URL로 리다이렉트해요.
// code를 세션으로 교환하고 로그인 페이지에서 상태 기반 라우팅 처리합니다.
// (이메일 인증은 /login 페이지에서 클라이언트 사이드로 처리)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }

  return NextResponse.redirect(`${origin}/login?oauth=success`)
}
