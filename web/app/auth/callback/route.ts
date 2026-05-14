import { NextRequest, NextResponse } from 'next/server'

// Google OAuth 완료 후 Supabase가 이 URL로 리다이렉트해요.
//
// ⚠️ 서버 라우트에서 createClient로 exchangeCodeForSession을 하면
//    쿠키/localStorage에 세션이 저장되지 않습니다 (@supabase/ssr 필요).
//    대신 code를 클라이언트(/login)로 그대로 전달해서
//    브라우저에서 세션 교환을 처리합니다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  // code를 클라이언트로 포워드 — 브라우저에서 exchangeCodeForSession 처리
  return NextResponse.redirect(`${origin}/login?code=${code}&source=oauth`)
}
