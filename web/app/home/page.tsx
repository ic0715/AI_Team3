'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useOnboardingGuard } from '@/lib/hooks/useOnboardingGuard';

interface HomeData {
  nickname: string;
  strengths: Array<{ name_ko: string; name_en: string; domain: string; rank?: number }>;
  goalTitle: string;
  startedAt: string; // ISO date
  actionTitle: string;
}

// ────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingScreen text="불러오는 중..." />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  // 11 홈도 모든 단계 완료 후 진입 가능 → 'complete'와 동일 조건
  const { ready } = useOnboardingGuard('complete');

  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [profileRes, strengthRes, goalRes, actionRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('strength_analyses')
            .select('strengths')
            .eq('user_id', user.id)
            .eq('is_latest', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('goals')
            .select('goal_title, started_at')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('action_items')
            .select('title')
            .eq('user_id', user.id)
            .eq('week_number', 1)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (!goalRes.data) {
          // 활성 goal 없음 → 진입 조건 위반 (스펙 6번)
          // 일반 오류 화면 대체로 첫 단계로 보냄
          router.replace('/error/network');
          return;
        }

        setData({
          nickname: profileRes.data?.nickname ?? '',
          strengths: strengthRes.data?.strengths ?? [],
          goalTitle: goalRes.data.goal_title ?? '',
          startedAt: goalRes.data.started_at ?? new Date().toISOString().split('T')[0],
          actionTitle: actionRes.data?.title ?? '',
        });
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError('정보를 불러오지 못했어요.');
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [ready, router]);

  const handleRestart = useCallback(() => {
    if (restarting) return; // 중복 클릭 방지 (스펙 6번)
    setRestarting(true);
    // ⚠️ 미결 사항 (스펙 9번): 기존 goals/action_items/strength_analyses 처분 정책 미정.
    // 일단 04로 이동만. 정책 확정되면 여기에 처리 로직 추가.
    router.push('/onboarding/strengths');
  }, [router, restarting]);

  if (!ready || loading) return <LoadingScreen text="홈을 준비하고 있어요..." />;
  if (!data) return <LoadingScreen text={error ?? '데이터를 찾을 수 없어요.'} />;

  const startDate = new Date(data.startedAt);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 83);

  return (
    <div style={wrapStyle}>
      {/* 상단 바 (뒤로가기 없음 — 종착점) */}
      <header style={headerStyle}>
        <div style={brandStyle}>
          CareerPT
          <span style={brandDotStyle}>·</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={completePillStyle}>✅ 완료</span>
      </header>

      {/* 본문 */}
      <main style={mainStyle}>
        {/* 인사 영역 */}
        <section style={{ marginBottom: '20px' }}>
          <h1
            style={{
              margin: '0 0 6px',
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-.02em',
              lineHeight: 1.3,
            }}
          >
            안녕하세요,{' '}
            {data.nickname ? (
              <>
                <span style={{ color: 'var(--accent)' }}>{data.nickname}</span>님
              </>
            ) : (
              ''
            )}{' '}
            👋
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            커리어 방향 설정이 완료되었어요!
          </p>
        </section>

        {/* 커리어 방향 요약 카드 (그라데이션, 스펙 3.3) */}
        <section style={directionCardStyle}>
          {/* 우상단 장식 원 */}
          <div aria-hidden="true" style={decorCircleStyle} />

          <div style={directionLabelStyle}>🎯 나의 커리어 방향</div>
          <h2 style={directionTitleStyle}>
            {`"${data.goalTitle}"`}
          </h2>

          {data.strengths.length > 0 && (
            <div
              role="list"
              aria-label="강점 Top 5"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginTop: '14px',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {data.strengths.slice(0, 5).map((s, i) => (
                <span key={`${s.name_en}-${i}`} role="listitem" style={strengthChipStyle}>
                  {s.name_ko}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 첫 번째 액션 카드 (스펙 3.4) */}
        <section style={actionCardStyle}>
          <div style={actionLabelStyle}>✅ 첫 번째 액션</div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              letterSpacing: '-.01em',
              marginBottom: '8px',
            }}
          >
            {data.actionTitle || '액션이 설정되지 않았어요'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            매일 작은 실행이 커리어를 바꿔요 💪
          </div>
        </section>

        {/* 정보 행 (2-column grid, 스펙 3.5) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <InfoCard label="📅 시작일" value={data.startedAt ? formatDate(startDate) : '—'} dateTime={data.startedAt} />
          <InfoCard label="🏁 종료일" value={formatDate(endDate)} dateTime={endDate.toISOString().split('T')[0]} />
        </div>

        {/* 안내 메시지 (스펙 3.6) */}
        <div style={hintBoxStyle}>
          💡 강점과 커리어 방향을 바탕으로 액션 아이템이 설계되었어요.
          꾸준한 실행으로 원하는 커리어를 만들어가세요!
        </div>

        {/* 재시작 CTA (스펙 3.7) */}
        <button
          type="button"
          onClick={handleRestart}
          disabled={restarting}
          aria-label="처음부터 다시 분석하기 — 강점 선택 화면으로 돌아갑니다"
          style={{
            ...restartBtnStyle,
            opacity: restarting ? 0.5 : 1,
            cursor: restarting ? 'not-allowed' : 'pointer',
          }}
        >
          🔄 처음부터 다시 분석하기
        </button>

        <div style={{ height: '20px' }} />
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ────────────────────────────────────────────────────────────

function InfoCard({
  label,
  value,
  dateTime,
}: {
  label: string;
  value: string;
  dateTime?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: '12px',
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: '11.5px',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          marginBottom: '4px',
          letterSpacing: '.01em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-.01em',
        }}
      >
        {dateTime ? <time dateTime={dateTime}>{value}</time> : value}
      </div>
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
  width: '390px',
  minHeight: '100dvh',
  background: 'var(--bg)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflowX: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '14px 20px',
  gap: '12px',
  position: 'sticky',
  top: 0,
  background: 'rgba(247,247,245,.85)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  zIndex: 10,
  flexShrink: 0,
};

const brandStyle: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: 800,
  color: 'var(--text-primary)',
  letterSpacing: '-.02em',
  display: 'inline-flex',
  alignItems: 'center',
};

const brandDotStyle: React.CSSProperties = {
  color: 'var(--accent)',
  marginLeft: '1px',
  fontSize: '17px',
};

const completePillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: '11.5px',
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: '999px',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  letterSpacing: '-.005em',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '20px',
};

const directionCardStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  background: 'linear-gradient(135deg, #1e3a8a, #2D5BFF)',
  color: '#fff',
  borderRadius: '20px',
  padding: '22px 20px',
  marginBottom: '14px',
};

const decorCircleStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-50px',
  right: '-40px',
  width: '160px',
  height: '160px',
  borderRadius: '50%',
  background: 'rgba(255,255,255,.08)',
  pointerEvents: 'none',
};

const directionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  opacity: 0.8,
  marginBottom: '10px',
  position: 'relative',
  zIndex: 1,
};

const directionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '19px',
  fontWeight: 800,
  lineHeight: 1.4,
  letterSpacing: '-.02em',
  position: 'relative',
  zIndex: 1,
  wordBreak: 'keep-all',
};

const strengthChipStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,.18)',
  color: '#fff',
};

const actionCardStyle: React.CSSProperties = {
  background: 'var(--accent-light)',
  border: '1.5px solid rgba(45,91,255,.18)',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '14px',
};

const actionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--accent)',
  letterSpacing: '.08em',
  marginBottom: '8px',
};

const hintBoxStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  fontSize: '13px',
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
  marginBottom: '16px',
};

const restartBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  background: 'var(--surface)',
  color: 'var(--text-secondary)',
  border: '1.5px solid var(--border-strong)',
  fontSize: '14px',
  fontWeight: 600,
  fontFamily: 'inherit',
  transition: 'background .15s',
};
