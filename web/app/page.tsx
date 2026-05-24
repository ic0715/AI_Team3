'use client';
// p01 랜딩 페이지
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// ── 코칭 원칙 카드 데이터 (spec 01_landing.md 3.3 기준) ──────────
const principles = [
  {
    step: 'STEP 1',
    title: '강점에서 시작해요',
    text: '갤럽 클리프턴 스트렝스 34테마 중 나의 Top 5 강점을 직접 선택해요. 이미 갤럽 리포트가 있다면 그 결과를, 없다면 스스로 느끼는 강점을 골라주세요.',
  },
  {
    step: 'STEP 2',
    title: '방향을 함께 찾아요',
    text: 'AI 코치가 먼저 결론을 내리지 않아요. 지금의 상황, 고민, 방향에 대해 자유롭게 이야기하다 보면 본인에 대해 스스로도 알아가게 됩니다.',
  },
  {
    step: 'STEP 3',
    title: '목표와 첫 번째 액션 선택까지',
    text: '인터뷰 결과를 바탕으로 목표로 삼으면 좋을 5가지 방향이 제안돼요. 그 중 하나를 선택하고, 지금 바로 시작할 수 있는 액션 아이템을 고릅니다.',
  },
];

export default function LandingPage() {
  const router = useRouter();

  // 로그인 페이지 미리 로드 — 클릭 즉시 이동하도록
  useEffect(() => {
    router.prefetch('/login');
  }, [router]);

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

      // active 목표가 없으면 career-result로 돌려보냄
      // (recommended_competencies는 있지만 goals INSERT가 안 된 경우 대비)
      if (!activeGoal) { router.push('/onboarding/career-result'); return; }

      // 온보딩 마지막 단계 → 액션 아이템 선택
      router.push('/onboarding/action-items');
    };

    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      width: '390px',
      background: 'var(--surface)',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0,0,0,.18)',
    }}>

      {/* ── 헤더 ── */}
      <header style={{
        padding: '18px 22px 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            aria-hidden="true"
            style={{
              width: '44px', height: '44px', borderRadius: '24%',
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 6px 16px -4px rgba(45,91,255,.4)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12 H7 L9.5 6 L12.5 18 L15 12 H21" />
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: '20px', fontWeight: 900, lineHeight: 1.1,
              letterSpacing: '-.04em', color: 'var(--text-primary)',
            }}>
              CareerPT
            </div>
            <div style={{
              marginTop: '2px', fontSize: '12px', fontWeight: 500,
              color: 'var(--text-muted)', letterSpacing: '-.01em',
            }}>
              내 강점으로 커리어 방향을 찾는 AI 코치
            </div>
          </div>
        </div>
      </header>

      {/* ── 메인 콘텐츠 + 버튼 ── */}
      <main style={{
        padding: '20px 22px',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
      }}>

        {/* 아이브로우 태그 */}
        <div style={{
          display: 'inline-block', marginBottom: '12px',
          padding: '5px 13px', background: 'var(--accent-light)',
          color: 'var(--accent)', borderRadius: '999px',
          fontSize: '12px', fontWeight: 700, letterSpacing: '-.005em',
        }}>
          📋 코칭 합의
        </div>

        {/* 메인 타이틀 */}
        <h1 style={{
          margin: '0 0 12px', color: 'var(--text-primary)',
          fontSize: '24px', fontWeight: 800,
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
          margin: '0 0 20px', color: 'var(--text-secondary)',
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
              padding: '16px 18px', marginBottom: '10px',
              border: '1px solid var(--border)', borderRadius: '16px',
              background: 'var(--bg)',
            }}
          >
            {/* STEP 배지 + 제목 한 줄 */}
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: '10px', marginBottom: '8px',
            }}>
              <div style={{
                flexShrink: 0,
                padding: '3px 10px', background: 'var(--accent-light)',
                color: 'var(--accent)', borderRadius: '999px',
                fontSize: '11px', fontWeight: 800, letterSpacing: '.06em',
              }}>
                {p.step}
              </div>
              <h2 style={{
                margin: 0, color: 'var(--text-primary)',
                fontSize: '15px', fontWeight: 800,
                lineHeight: 1.3, letterSpacing: '-.025em',
              }}>
                {p.title}
              </h2>
            </div>
            {/* 설명 텍스트 (전체 너비) */}
            <p style={{
              color: 'var(--text-secondary)', fontSize: '13px',
              fontWeight: 500, lineHeight: 1.65,
              letterSpacing: '-.005em', margin: 0,
            }}>
              {p.text}
            </p>
          </section>
        ))}

        {/* ── CTA 버튼 (본문 하단 인라인) ── */}
        <div style={{ marginTop: '24px' }}>
          <Link
            href="/login?tab=signup"
            prefetch={true}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', minHeight: '52px', padding: '14px 18px',
              borderRadius: '12px', background: 'var(--accent)',
              color: '#fff', textDecoration: 'none', fontFamily: 'inherit',
              fontSize: '15.5px', fontWeight: 800, letterSpacing: '-.02em',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(45,91,255,.3)',
            }}
          >
            동의하고 시작하기 →
          </Link>
        </div>
      </main>
    </div>
  );
}
