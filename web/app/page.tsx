'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// ── 코칭 원칙 카드 데이터 (spec 01_landing.md 3.3 기준) ──────────
const principles = [
  {
    icon: '⭐',
    title: '강점에서 시작해요',
    text: '갤럽 클리프턴 스트렝스의 34테마 분류와 키워드를 참고했어요. CareerPT의 자체 AI 분석 기반 강점 추정이며, 갤럽 공식 진단은 아닙니다. 더 정확한 진단을 원하시면 갤럽 공식 검사를 추천드려요.',
  },
  {
    icon: '🗺️',
    title: '방향을 함께 찾아요',
    text: 'AI 코치가 먼저 결론을 내리지 않아요. 커리어 인터뷰를 통해 당신의 표현과 맥락에서 방향을 꺼내고, 5가지 선택지로 제안합니다.',
  },
  {
    icon: '🎯',
    title: '첫 번째 액션까지',
    text: '방향이 정해지면 지금 바로 시작할 수 있는 액션 아이템을 도출해요. 커리어, 성장, 역할, 목표에 집중합니다. 심리치료·법률·의료·재무 조언은 별도 전문가가 더 적합해요.',
  },
];

export default function LandingPage() {
  const router = useRouter();

  // 이미 로그인된 사용자 → 상태 기반 자동 리다이렉트 (spec 01_landing.md 2번)
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // GUEST → 랜딩 그대로 표시

      // 이메일 미인증 → 로그인 화면 (verify-email 패널)
      if (!user.email_confirmed_at) {
        router.push('/login');
        return;
      }

      // goals 상태 확인
      const { data: goals } = await supabase
        .from('goals')
        .select('status, current_week, total_weeks')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const activeGoal  = goals?.find((g) => g.status === 'active');
      const pausedGoal  = goals?.find((g) => g.status === 'paused');
      const completedGoal = goals?.find(
        (g) => g.status === 'completed' && g.current_week >= g.total_weeks
      );

      // ACTIVE / PAUSED → 홈
      if (activeGoal || pausedGoal) { router.push('/home'); return; }
      // COMPLETED (active 없음) → 12주 완료
      if (completedGoal) { router.push('/cycle-complete'); return; }

      // ONBOARDING → 마지막 완료 단계 다음 화면으로 (spec 2.1)
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

      // 온보딩 마지막 단계 → 액션 아이템 선택
      router.push('/onboarding/action-items');
    };

    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      width: '390px',
      minHeight: '100dvh',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,.18)',
      overflowX: 'hidden',
    }}>

      {/* ── 헤더 ── */}
      <header style={{
        padding: '20px 22px 18px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* 브랜드 마크 (심장 박동 SVG) */}
          <div
            aria-hidden="true"
            style={{
              width: '52px', height: '52px', borderRadius: '24%',
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 6px 16px -4px rgba(45,91,255,.4)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12 H7 L9.5 6 L12.5 18 L15 12 H21" />
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: '22px', fontWeight: 900, lineHeight: 1.1,
              letterSpacing: '-.04em', color: 'var(--text-primary)',
            }}>
              CareerPT
            </div>
            <div style={{
              marginTop: '3px', fontSize: '13px', fontWeight: 500,
              color: 'var(--text-muted)', letterSpacing: '-.01em',
            }}>
              내 강점으로 커리어 방향을 찾는 AI 코치
            </div>
          </div>
        </div>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px 22px 24px' }}>

        {/* 아이브로우 태그 */}
        <div style={{
          display: 'inline-block', marginBottom: '14px',
          padding: '5px 13px', background: 'var(--accent-light)',
          color: 'var(--accent)', borderRadius: '999px',
          fontSize: '12px', fontWeight: 700, letterSpacing: '-.005em',
        }}>
          📋 코칭 합의
        </div>

        {/* 메인 타이틀 */}
        <h1 style={{
          margin: '0 0 14px', color: 'var(--text-primary)',
          fontSize: '26px', fontWeight: 800,
          lineHeight: 1.35, letterSpacing: '-.035em',
        }}>
          강점 진단 그 다음,<br />
          <em style={{ fontStyle: 'normal', color: 'var(--accent)', fontWeight: 800 }}>
            커리어 방향까지
          </em>{' '}
          이어드립니다.
        </h1>

        {/* 설명 */}
        <p style={{
          margin: '0 0 28px', color: 'var(--text-secondary)',
          fontSize: '14px', fontWeight: 500, lineHeight: 1.7,
          letterSpacing: '-.005em',
        }}>
          코칭을 시작하기 전에 이 서비스가 무엇을 하는지 짧게 안내드려요.{' '}
          방향, 액션, 성공 기준은 모두{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            당신이 직접 선택
          </strong>
          합니다. 🙌
        </p>

        {/* 코칭 원칙 카드 3장 */}
        {principles.map((p) => (
          <section
            key={p.title}
            style={{
              padding: '18px 20px', marginBottom: '12px',
              border: '1px solid var(--border)', borderRadius: '20px',
              background: 'var(--bg)',
              display: 'grid', gridTemplateColumns: '40px 1fr',
              gap: '14px', alignItems: 'flex-start',
            }}
          >
            {/* 아이콘 */}
            <div
              aria-hidden="true"
              style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'var(--surface)', border: '1px solid var(--accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', flexShrink: 0,
              }}
            >
              {p.icon}
            </div>
            {/* 텍스트 */}
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                margin: '0 0 6px', color: 'var(--text-primary)',
                fontSize: '16px', fontWeight: 800,
                lineHeight: 1.3, letterSpacing: '-.025em',
              }}>
                {p.title}
              </h2>
              <p style={{
                color: 'var(--text-secondary)', fontSize: '13px',
                fontWeight: 500, lineHeight: 1.6,
                letterSpacing: '-.005em', margin: 0,
              }}>
                {p.text}
              </p>
            </div>
          </section>
        ))}
      </main>

      {/* ── 하단 CTA (Footer) ── */}
      <footer style={{
        padding: '16px 22px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        {/* Primary CTA: 동의하고 시작하기 → 회원가입 탭 */}
        <button
          onClick={() => router.push('/login?tab=signup')}
          style={{
            width: '100%', minHeight: '54px', padding: '16px 18px',
            borderRadius: '12px', background: 'var(--accent)',
            color: '#fff', border: 'none', fontFamily: 'inherit',
            fontSize: '15.5px', fontWeight: 800, letterSpacing: '-.02em',
            cursor: 'pointer', transition: 'background .2s, transform .1s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-deep)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.99)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          동의하고 시작하기 →
        </button>

      </footer>
    </div>
  );
}
