'use client';
// p01 랜딩 — swipe deck 6장 (spec 01_landing.md v1.8)
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CSSProperties } from 'react';

const TOTAL_CARDS = 6;

export default function LandingPage() {
  const router = useRouter();
  const deckRef = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);

  // ── 로그인 페이지 미리 로드 ─────────────────────────────────
  useEffect(() => {
    router.prefetch('/login');
  }, [router]);

  // v1.8: 로그인 상태 auto-redirect 제거.
  //   팀 결정 — 랜딩 페이지는 모든 사용자에게 항상 노출 (게스트도 로그인 사용자도).
  //   로그인 사용자가 자기 상태(홈/온보딩)로 가려면 CTA(`/login?tab=signup`)를
  //   거치거나 직접 URL 입력. 이전에 있던 상태 기반 자동 리다이렉트 useEffect는
  //   삭제됨 (spec 01_landing.md §2 참조).

  // ── deck 스크롤 → 현재 카드 추적 ──────────────────────────
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    let t: number | undefined;
    const onScroll = () => {
      if (t !== undefined) clearTimeout(t);
      t = window.setTimeout(() => {
        const i = Math.round(deck.scrollLeft / deck.clientWidth);
        setCur(Math.max(0, Math.min(TOTAL_CARDS - 1, i)));
      }, 60);
    };
    deck.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      deck.removeEventListener('scroll', onScroll);
      if (t !== undefined) clearTimeout(t); // unmount 시 pending timeout 정리
    };
  }, []);

  const goTo = useCallback((i: number) => {
    const deck = deckRef.current;
    if (!deck) return;
    const clamped = Math.max(0, Math.min(TOTAL_CARDS - 1, i));
    deck.scrollTo({ left: clamped * deck.clientWidth, behavior: 'smooth' });
  }, []);

  // ── 키보드 ← → ───────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(cur - 1);
      else if (e.key === 'ArrowRight') goTo(cur + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur, goTo]);

  return (
    <div style={shellStyle}>
      {/* ── 브랜드 헤더 (고정) ── */}
      <header style={brandbarStyle}>
        <div aria-hidden="true" style={logoStyle}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,12 7,12 9.5,6 13,18 15.5,12 22,12" />
          </svg>
        </div>
        <div>
          <div style={brandTitleStyle}>CareerPT</div>
          <div style={brandSubStyle}>내 강점으로 커리어 방향을 찾는 AI 코치</div>
        </div>
      </header>

      {/* ── Swipe Deck (5장) ── */}
      <div ref={deckRef} style={deckStyle}>
        {/* 1. HERO 캐치프레이즈 */}
        <section style={{ ...cardStyle, justifyContent: 'center' }}>
          <h2 style={heroH2Style}>
            검색해도<br />
            안 나오는 답은,<br />
            <span style={hlStyle}>당신 안에</span> 있어요.
          </h2>
          <p style={subStyle}>
            막막한 커리어,<br />
            정답 대신 <strong style={subBStyle}>좋은 질문</strong>으로 함께 찾아요.
          </p>
        </section>

        {/* 2. 강점에서 시작 */}
        <section style={{ ...cardStyle, justifyContent: 'center' }}>
          <div style={emojiStyle}>👀</div>
          <h2 style={h2Style}>
            거창할 필요 없어요.<br />
            <span style={hlStyle}>강점 5가지</span>부터<br />
            시작해요.
          </h2>
          <p style={subStyle}>
            어려운 검사 용어는 없어요.<br />
            잘하는 것에서 출발하면 돼요.
          </p>
        </section>

        {/* 3. TRUST */}
        <section style={{ ...cardStyle, justifyContent: 'center' }}>
          <div style={kickerStyle}>그런데, 믿을 만해요</div>
          <h2 style={{ ...h2Style, marginTop: '10px' }}>
            아무 말이나 하는<br />
            AI는 <span style={hlStyle}>아니에요</span> 🙅
          </h2>
          <div style={trustListStyle}>
            {TRUST_POINTS.map((tp) => (
              <div key={tp.id} style={trustItemStyle}>
                <span style={trustChkStyle}>
                  <CheckSvg color="var(--accent)" size={11} />
                </span>
                <div style={trustTxStyle}>{tp.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. 왜 코칭? (v1.7.2 신규 — careerpt-slide-coaching 시안 반영) */}
        <section style={{ ...cardStyle, justifyContent: 'center' }}>
          <h2 style={h2Style}>
            왜 컨설팅이 아닌<br />
            <span style={hlStyle}>12주 코칭</span>일까요?
          </h2>
          <p style={subStyle}>
            답을 주고 끝내는 컨설팅이 아니라,<br />
            내 안에서 답을 찾아 <strong style={subBStyle}>지속가능한 성장</strong>을 만들어요.
          </p>
          <p style={subStyle}>
            마치 PT를 받는 것처럼,<br />
            아는 것을 진짜로 해내는{' '}
            <strong style={{ ...subBStyle, color: 'var(--accent)' }}>‘실천 근육’</strong>을 12주간 길러나가요.
          </p>
        </section>

        {/* 5. JOURNEY */}
        <section style={{ ...cardStyle, justifyContent: 'center' }}>
          <div style={kickerStyle}>이렇게 진행돼요</div>
          <h2 style={{ ...h2Style, marginTop: '10px' }}>
            강점에서 시작해,<br />
            <span style={hlStyle}>12주 뒤</span>엔<br />
            달라져 있어요.
          </h2>
          <div style={flowStyle}>
            {JOURNEY_STEPS.map((step, i) => (
              <div key={i}>
                <div style={i === 3 ? flowItemHiStyle : flowItemStyle}>
                  <span style={i === 3 ? flowNumHiStyle : flowNumStyle}>{i + 1}</span>
                  <div>
                    <div style={flowTitleStyle}>{step.title}</div>
                    <div style={flowDescStyle}>{step.desc}</div>
                  </div>
                </div>
                {i < JOURNEY_STEPS.length - 1 && <div style={flowArrowStyle}>↓</div>}
              </div>
            ))}
          </div>
        </section>

        {/* 6. OUTCOME + CTA */}
        <section style={{ ...cardStyle, justifyContent: 'center' }}>
          <div style={emojiStyle}>🚀</div>
          <h2 style={h2Style}>
            이제 <span style={hlStyle}>시작</span>해볼까요?
          </h2>
          <div style={outListStyle}>
            {OUTCOMES.map((txt, i) => (
              <div key={i} style={outItemStyle}>
                <span style={outChkStyle}>
                  <CheckSvg color="#fff" size={13} />
                </span>
                {txt}
              </div>
            ))}
          </div>
          <Link href="/login?tab=signup" prefetch={true} style={ctaStyle}>
            로그인하고 시작하기 →
          </Link>
        </section>
      </div>

      {/* ── Floating 화살표 (vertical center, v1.7.2) ── */}
      {cur > 0 && (
        <button
          type="button"
          onClick={() => goTo(cur - 1)}
          aria-label="이전 카드"
          style={floatingPrevStyle}
        >
          ‹
        </button>
      )}
      {cur < TOTAL_CARDS - 1 && (
        <button
          type="button"
          onClick={() => goTo(cur + 1)}
          aria-label="다음 카드"
          style={floatingNextStyle}
        >
          ›
        </button>
      )}
    </div>
  );
}

// ── 데이터 ────────────────────────────────────────────────
// TRUST 카드 — JSX 구조 (dangerouslySetInnerHTML 미사용)
const trustBoldStyle: CSSProperties = { fontWeight: 700, color: 'var(--text-primary)' };

const TRUST_POINTS: { id: string; body: ReactNode }[] = [
  {
    id: 'cert',
    body: (
      <>
        <strong style={trustBoldStyle}>Gallup 인증 강점 코치</strong> ·{' '}
        <strong style={trustBoldStyle}>ICF 인증 코치</strong>가 함께 만들었어요
      </>
    ),
  },
  {
    id: 'icf',
    body: (
      <>
        AI 코치는 <strong style={trustBoldStyle}>ICF 최고 등급 코치</strong>의 코칭 방식을 학습했어요
      </>
    ),
  },
  {
    id: 'advisory',
    body: (
      <>
        설계 전 과정에서 <strong style={trustBoldStyle}>전문 코치진의 자문</strong>을 받았어요
      </>
    ),
  },
];

const JOURNEY_STEPS = [
  { title: '강점 고르기', desc: '내가 가진 것에서 출발' },
  { title: '코치와 대화', desc: '스스로 답을 꺼내는 과정' },
  { title: '방향 & 액션 아이템 제안', desc: '나에 대한 이해 기반' },
  { title: '12주 실천 & 회고', desc: '매주 행동하고 돌아보며 진짜 변화로' },
];

const OUTCOMES = [
  '내 고민에 맞춘 목표 5가지',
  '바로 할 수 있는 첫 액션 1개',
  '12주 실천 & 회고 루틴',
];

// ── 작은 SVG 컴포넌트 ─────────────────────────────────────
function CheckSvg({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <title>체크</title>
      <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── 스타일 ────────────────────────────────────────────────
const shellStyle: CSSProperties = {
  width: 'min(430px, 100vw)',
  minHeight: '100dvh',
  background: 'var(--surface)',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative', // v1.7.2: floating 화살표 absolute 기준
};

const brandbarStyle: CSSProperties = {
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '18px 22px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface)',
};

const logoStyle: CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '13px',
  background: 'var(--accent)',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  boxShadow: '0 5px 14px rgba(45,91,255,.32)',
};

const brandTitleStyle: CSSProperties = {
  fontSize: '19px',
  fontWeight: 800,
  lineHeight: 1.15,
  letterSpacing: '-.01em',
  color: 'var(--text-primary)',
};

const brandSubStyle: CSSProperties = {
  marginTop: '3px',
  fontSize: '12px',
  color: 'var(--text-muted)',
};

const deckStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollSnapType: 'x mandatory',
  scrollBehavior: 'smooth',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  minHeight: 0,
};

const cardStyle: CSSProperties = {
  flex: 'none',
  width: '100%',
  scrollSnapAlign: 'center',
  padding: '30px 28px 22px',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  scrollbarWidth: 'none',
};

const heroH2Style: CSSProperties = {
  fontSize: '32px',
  fontWeight: 800,
  letterSpacing: '-.025em',
  lineHeight: 1.26,
  color: 'var(--text-primary)',
  marginTop: '14px',
};

const h2Style: CSSProperties = {
  fontSize: '27px',
  fontWeight: 800,
  letterSpacing: '-.025em',
  lineHeight: 1.3,
  color: 'var(--text-primary)',
  marginTop: '14px',
};

const hlStyle: CSSProperties = {
  color: 'var(--accent)',
};

const subStyle: CSSProperties = {
  marginTop: '18px',
  color: 'var(--text-secondary)',
  fontSize: '15.5px',
  lineHeight: 1.6,
};

const subBStyle: CSSProperties = {
  color: 'var(--text-primary)',
  fontWeight: 700,
};

const emojiStyle: CSSProperties = {
  fontSize: '44px',
  lineHeight: 1,
};

const kickerStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 800,
  color: 'var(--accent)',
  letterSpacing: '.04em',
};

const trustListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '22px',
};

const trustItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  background: 'var(--bg)',
  borderRadius: '12px',
  padding: '10px 12px',
};

const trustChkStyle: CSSProperties = {
  flex: 'none',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  background: 'var(--accent-light)',
  display: 'grid',
  placeItems: 'center',
};

const trustTxStyle: CSSProperties = {
  fontSize: '12.5px',
  color: 'var(--text-secondary)',
  lineHeight: 1.45,
  flex: 1,
  minWidth: 0,
};

const flowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginTop: '20px',
};

const flowItemStyle: CSSProperties = {
  background: 'var(--bg)',
  borderRadius: '14px',
  padding: '14px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '13px',
};

const flowItemHiStyle: CSSProperties = {
  ...flowItemStyle,
  background: 'var(--accent-light)',
  boxShadow: 'inset 0 0 0 1.5px var(--accent)',
};

const flowNumStyle: CSSProperties = {
  flex: 'none',
  width: '26px',
  height: '26px',
  borderRadius: '8px',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  fontWeight: 800,
  fontSize: '13px',
  display: 'grid',
  placeItems: 'center',
};

const flowNumHiStyle: CSSProperties = {
  ...flowNumStyle,
  background: 'var(--accent)',
  color: '#fff',
};

const flowTitleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: '15px',
  color: 'var(--text-primary)',
};

const flowDescStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '12.5px',
  marginTop: '2px',
};

const flowArrowStyle: CSSProperties = {
  alignSelf: 'center',
  color: 'var(--accent-light)',
  fontSize: '15px',
  fontWeight: 800,
  margin: '-3px 0',
};

const outListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  marginTop: '22px',
};

const outItemStyle: CSSProperties = {
  background: 'var(--accent-light)',
  borderRadius: '14px',
  padding: '15px 17px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: '15.5px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  boxShadow: 'inset 0 0 0 1.5px var(--accent)',
};

const outChkStyle: CSSProperties = {
  flex: 'none',
  width: '23px',
  height: '23px',
  borderRadius: '50%',
  background: '#15a861',
  display: 'grid',
  placeItems: 'center',
};

const ctaStyle: CSSProperties = {
  marginTop: '24px',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  borderRadius: '14px',
  background: 'var(--accent)',
  color: '#fff',
  fontFamily: 'inherit',
  fontSize: '17px',
  fontWeight: 700,
  padding: '18px',
  boxShadow: '0 6px 20px rgba(45,91,235,.38)',
};

// v1.8: Floating 화살표 — 하단 band (텍스트 안 가림)
//   이전 v1.7.2의 `top: 50%`는 세로 가운데 정렬된 카드 콘텐츠와 겹치는 문제로
//   `bottom: max(32px, env(safe-area-inset-bottom)+16px)` 위치로 이동.
//   원래 nav bar(60px)보다는 위, 카드 본문보다는 아래.
const floatingArrowBaseStyle: CSSProperties = {
  position: 'absolute',
  bottom: 'max(28px, calc(env(safe-area-inset-bottom) + 16px))',
  width: '38px',
  height: '38px',
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(255, 255, 255, 0.85)',
  color: 'var(--text-primary)',
  fontSize: '20px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  fontFamily: 'inherit',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.18)',
  zIndex: 10,
  lineHeight: 1,
  paddingBottom: '3px', // ‹› 시각적 가운데 보정
  backdropFilter: 'blur(4px)',
};

const floatingPrevStyle: CSSProperties = {
  ...floatingArrowBaseStyle,
  left: '12px',
};

const floatingNextStyle: CSSProperties = {
  ...floatingArrowBaseStyle,
  right: '12px',
};
