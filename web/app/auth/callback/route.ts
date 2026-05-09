import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Google OAuth 완료 후 Supabase가 이 URL로 리다이렉트해요.
// code를 세션으로 교환하고 사용자 상태에 따라 라우팅합니다.
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

  // 세션 교환 성공 → 로그인 페이지에서 상태 기반 라우팅 처리
  // (클라이언트에서 handlePostAuthRouting이 실행됨)
  return NextResponse.redirect(`${origin}/login?oauth=success`)
}
