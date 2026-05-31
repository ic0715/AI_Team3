'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useOnboardingGuard } from '@/lib/hooks/useOnboardingGuard';
import OnboardingRedirectModal from '@/components/OnboardingRedirectModal';

const MVP_COMPLETED_KEY = 'mvp_completed';

interface CompleteData {
  strengths: Array<{ name_ko: string; name_en: string; domain: string; rank?: number }>;
  goalTitle: string;
  startedAt: string; // ISO date string
  actionTitle: string;
}

// ────────────────────────────────────────────────────────────

export default function CompletePage() {
  return (
    <Suspense fallback={<LoadingScreen text="불러오는 중..." />}>
      <CompleteContent />
    </Suspense>
  );
}

function CompleteContent() {
  const router = useRouter();
  const { ready, pendingRedirect, confirmRedirect } = useOnboardingGuard('complete');

  const [data, setData] = useState<CompleteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 재방문 차단: 이미 한 번 통과한 사용자는 /home으로 (스펙 2번)
  useEffect(() => {
    try {
      if (localStorage.getItem(MVP_COMPLETED_KEY) === '1') {
        router.replace('/home');
      }
    } catch {
      /* localStorage 접근 실패는 무시 */
    }
  }, [router]);

  // 데이터 로드
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1차: strengths/goal 병렬 fetch
        const [strengthRes, goalRes] = await Promise.all([
          supabase
            .from('strength_analyses')
            .select('strengths')
            .eq('user_id', user.id)
            .eq('is_latest', true)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('goals')
            .select('id, goal_title, started_at')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (strengthRes.error) console.error('[NEW02] strength_analyses query error:', strengthRes.error);
        if (goalRes.error) console.error('[NEW02] goals query error:', goalRes.error);

        if (!goalRes.data) throw new Error('목표 데이터를 찾을 수 없어요.');

        // 2차: action_items를 활성 goal_id로 필터링 (테스트 계정에 누적된 옛 row 회피)
        const actionRes = await supabase
          .from('action_items')
          .select('title')
          .eq('user_id', user.id)
          .eq('goal_id', goalRes.data.id)
          .eq('week_number', 1)
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (actionRes.error) console.error('[NEW02] action_items query error:', actionRes.error);

        setData({
          strengths: strengthRes.data?.strengths ?? [],
          goalTitle: goalRes.data.goal_title ?? '',
          startedAt: goalRes.data.started_at ?? new Date().toISOString().split('T')[0],
          actionTitle: actionRes.data?.title ?? '',
        });
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError('요약 정보를 불러오지 못했어요.');
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [ready]);

  const handleGoHome = () => {
    try {
      localStorage.setItem(MVP_COMPLETED_KEY, '1');
    } catch {
      /* ignore */
    }
    router.push('/home');
  };

  if (pendingRedirect) return <OnboardingRedirectModal title={pendingRedirect.title} message={pendingRedirect.message} onConfirm={confirmRedirect} />;
  if (!ready || loading) return <LoadingScreen text="정리하고 있어요..." />;
  if (!data) return <LoadingScreen text={error ?? '데이터를 찾을 수 없어요.'} />;

  const startDate = new Date(data.startedAt);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 83); // 12주 후
  const startLabel = formatDate(startDate);
  const endLabel = formatDate(endDate);

  return (
    <div style={wrapStyle}>
      {/* 상단 바 */}
      <header style={headerStyle}>
          <span style={{ width: '36px' }} />
          <span style={pageTitleStyle}>커리어 방향 설정 완료</span>
          <span style={{ width: '36px' }} />
        </header>

        {/* 본문 */}
        <main style={mainStyle}>
        {/* Hero (스펙 3.2) */}
        <section style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '56px', lineHeight: 1, marginBottom: '14px' }} aria-hidden="true">
            🚀
          </div>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              letterSpacing: '-.025em',
            }}
          >
            준비 완료!
            <br />
            실행을 시작해요
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            지금까지 선택한 내용을 정리했어요.
          </p>
        </section>

        {/* 요약 카드 4행 (스펙 3.3) */}
        <div style={summaryCardStyle}>
          <SummaryRow label="🎯 강점">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                rowGap: '5px',
                justifyContent: 'flex-end',
              }}
            >
              {data.strengths.length === 0 ? (
                <span style={fallbackTextStyle}>—</span>
              ) : (
                data.strengths.slice(0, 5).map((s, i) => (
                  <span key={`${s.name_en}-${i}`} style={strengthChipStyle}>
                    {s.name_ko}
                  </span>
                ))
              )}
            </div>
          </SummaryRow>

          <SummaryRow label="🗺 방향">
            <span style={valueTextStyle}>{data.goalTitle || '—'}</span>
          </SummaryRow>

          <SummaryRow label="✅ 액션">
            <span style={{ ...valueTextStyle, textAlign: 'right' }}>
              {data.actionTitle || '—'}
            </span>
          </SummaryRow>

          <SummaryRow label="📅 일정" isLast>
            <span style={valueTextStyle}>
              <time dateTime={data.startedAt}>{startLabel}</time>
              <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>→</span>
              <time dateTime={endDate.toISOString().split('T')[0]}>{endLabel}</time>
            </span>
          </SummaryRow>
        </div>

        {/* 권유 메시지 박스 (스펙 3.4) */}
        <div style={cheerBoxStyle}>
          💡 매일 작은 실행과 회고를 반복하며 커리어를 바꿔가요.
        </div>
      </main>

      {/* CTA */}
      <footer style={footerStyle}>
        <button type="button" onClick={handleGoHome} style={primaryBtnStyle}>
          홈으로 가기 →
        </button>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  isLast,
  children,
}: {
  label: string;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
      }}
    >
      <span
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          minWidth: '56px',
          flexShrink: 0,
          letterSpacing: '-.01em',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>{children}</div>
    </div>
  );
}

function LoadingScreen({ text }: { text: string }) {
  return (
    <div style={wrapStyle}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{text}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// ────────────────────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  width: 'min(430px, 100vw)',
  minHeight: '100dvh',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 16px',
  gap: '12px',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  flex: 1,
  textAlign: 'center',
};

const mainStyle: React.CSSProperties = {
  padding: '28px 20px 16px',
};

const summaryCardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  marginBottom: '16px',
};

const valueTextStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  lineHeight: 1.5,
  letterSpacing: '-.01em',
  wordBreak: 'keep-all',
};

const fallbackTextStyle: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--text-muted)',
};

const strengthChipStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: '999px',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const cheerBoxStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  borderRadius: '12px',
  fontSize: '13.5px',
  fontWeight: 700,
  lineHeight: 1.55,
  letterSpacing: '-.01em',
};

const footerStyle: React.CSSProperties = {
  position: 'sticky',
  bottom: 0,
  padding: '16px 20px',
  paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
  borderTop: '1px solid var(--border)',
  background: 'var(--surface)',
  zIndex: 20,
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px',
  borderRadius: '12px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(45,91,255,.3)',
};
