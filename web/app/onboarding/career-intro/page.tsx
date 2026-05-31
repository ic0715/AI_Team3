'use client';

// 07 커리어 인터뷰 인트로 — 상단 고정 + swipe deck 4장 + gating (spec v1.8)
// v1.8: 다른 온보딩 페이지(action-items 등)와 동일하게 inline style + design token으로 통일.
//       swipe deck 로직, gating, 발견성 보강(eyebrow/hint/glow/chip)은 유지.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const TOTAL_CARDS = 4;
const REQUIRED_CONFIRMS = 3;

export default function CareerIntroPage() {
  const router = useRouter();
  const deckRef = useRef<HTMLDivElement>(null);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [nickname, setNickname] = useState<string>(''); // v1.10: 카드 1 본문 개인화용
  const [cur, setCur] = useState(0);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [hintShown, setHintShown] = useState(false);

  // ── 강점 + 닉네임 fetch ──────────────────────────────────
  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 강점과 닉네임 병렬 fetch
      const [strengthRes, profileRes] = await Promise.all([
        supabase
          .from('strength_analyses')
          .select('strengths')
          .eq('user_id', user.id)
          .eq('is_latest', true)
          .single(),
        supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .single(),
      ]);

      if (strengthRes.data?.strengths) {
        const names = (strengthRes.data.strengths as { name_ko: string }[]).map((s) => s.name_ko);
        setStrengths(names);
      }
      if (profileRes.data?.nickname) {
        setNickname(profileRes.data.nickname as string);
      }
    };
    fetchUserData();
  }, []);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(cur - 1);
      else if (e.key === 'ArrowRight') goTo(cur + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cur, goTo]);

  // ── 확인 토글 (gating) ────────────────────────────────────
  // v1.9: 처음 확인했을 때 자동으로 다음 카드로 이동 (사용자 경험 매끄럽게).
  //   재클릭으로 확인 해제하는 경우엔 이동 안 함 (사용자가 의도적으로 머무름).
  const toggleConfirm = (cardIndex: number) => {
    const wasConfirmed = confirmed.has(cardIndex);
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(cardIndex)) next.delete(cardIndex);
      else next.add(cardIndex);
      return next;
    });
    if (hintShown) setHintShown(false);
    if (!wasConfirmed) {
      // 250ms 후 다음 카드로 — "✓ 확인 완료" 토글 애니메이션 보일 시간 확보
      window.setTimeout(() => goTo(cardIndex + 1), 250);
    }
  };

  const allConfirmed = confirmed.size >= REQUIRED_CONFIRMS;

  const handleStart = () => {
    if (!allConfirmed) {
      setHintShown(true);
      return;
    }
    router.push('/onboarding/career-interview');
  };

  return (
    <div style={wrapStyle}>
      {/* ── Top Bar (action-items 등 다른 페이지와 동일 패턴) ── */}
      <header style={headerStyle}>
        <button
          type="button"
          onClick={() => router.back()}
          style={backBtnStyle}
          aria-label="뒤로가기"
        >
          ←
        </button>
        <span style={pageTitleStyle}>커리어 인터뷰</span>
        <div style={{ width: '44px' }} aria-hidden="true" />
      </header>

      {/* ── FIXED top (STEP 2 + 강점 Top 5) — info panel 패턴 사용 ── */}
      <div style={fixedTopStyle}>
        <div style={stepLabelStyle}>STEP 2</div>
        <div style={fixedTopTitleStyle}>이제 커리어 방향을 찾아볼 차례예요</div>
        <div style={fixedTopSubStyle}>강점을 어디에 어떻게 쓸지 함께 정리해요.</div>

        <div style={strengthCardStyle}>
          <div style={strengthHeaderStyle}>내 강점 Top 5</div>
          <div style={strengthChipsStyle}>
            {strengths.length > 0 ? (
              strengths.map((s) => (
                <span key={s} style={strengthChipStyle}>{s}</span>
              ))
            ) : (
              <span style={strengthLoadingStyle}>강점을 불러오는 중...</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Swipe Deck (4장) ── */}
      <div ref={deckRef} style={deckStyle}>
        {/* Card 1 — 코칭 vs 컨설팅/멘토링 */}
        <ConfirmCard stepIndex={1} confirmed={confirmed.has(0)} onToggle={() => toggleConfirm(0)}>
          <h2 style={cardH2Style}>
            잠깐, 이건 <span style={hlStyle}>코칭</span>이에요
          </h2>
          <p style={cardBodyStyle}>
            코치는 정답 대신 질문을 던져요.{' '}
            <strong style={bodyStrongStyle}>
              답은 이미 {nickname ? `${nickname}님` : '당신'} 안에
            </strong>{' '}
            있어요.
          </p>
          <div style={compareListStyle}>
            <CompareRow type="no" who="컨설팅" say={'"이렇게 하세요"'} />
            <CompareRow type="no" who="멘토링" say={'"제 경험으로는…"'} />
            <CompareRow type="yes" who="코칭" say={'"어떻게 생각하세요?"'} highlight />
          </div>
        </ConfirmCard>

        {/* Card 2 — 역량 = 지식 + 스킬 + 태도 */}
        <ConfirmCard stepIndex={2} confirmed={confirmed.has(1)} onToggle={() => toggleConfirm(1)}>
          <h2 style={cardH2Style}>
            역량은 스킬, <span style={hlStyle}>그 이상</span>이에요
          </h2>
          <div style={formulaBoxStyle}>
            <span style={formulaLabelStyle}>역량 =</span>
            <span style={formulaTermStyle}>지식</span>
            <span style={formulaOpStyle}>+</span>
            <span style={formulaTermStyle}>스킬</span>
            <span style={formulaOpStyle}>+</span>
            <span style={formulaTermStyle}>태도</span>
          </div>
          <p style={cardBodyStyle}>
            자격증이나 기술 하나를 알려드리는 게 아니에요. 지식·스킬·태도를 아우르는{' '}
            <strong style={bodyStrongStyle}>역량 전체</strong>를 함께 봐요.
          </p>
        </ConfirmCard>

        {/* Card 3 — 진행 방식 + 30분 이상 권장 */}
        <ConfirmCard stepIndex={3} confirmed={confirmed.has(2)} onToggle={() => toggleConfirm(2)}>
          <h2 style={cardH2Style}>이렇게 진행돼요</h2>
          <div style={procListStyle}>
            <ProcCard n={1} title="주제 합의" desc="오늘 다룰 주제를 함께 정해요" />
            <ProcCard n={2} title="자유로운 대화" desc="정해진 질문지 없이, 큰 고민부터" />
            <ProcCard
              n={3}
              title="원하는 시간으로"
              desc="보통 30~45분 · 길게 50분+"
              warn="⚠️ 단기간에 풀리지 않아요. 30분 이상 권장."
            />
          </div>
        </ConfirmCard>

        {/* Card 4 — 준비됐어요! (FINAL) */}
        <section style={{ ...cardSectionStyle, justifyContent: 'center', textAlign: 'center', alignItems: 'center' }}>
          <h2 style={cardH2Style}>준비됐어요!</h2>
          <p style={{ ...cardBodyStyle, textAlign: 'center' }}>
            솔직하게 답할수록 더 깊은 답이 나와요.
            <br />
            이제 코치와 시작해볼까요?
          </p>

          {/* 확인 progress chips — 안 한 카드는 빨간색, 클릭하면 해당 카드로 이동 */}
          <div style={progressWrapStyle}>
            <div style={progressHeaderStyle}>카드별 확인 상태</div>
            <div style={progressChipsStyle}>
              {[0, 1, 2].map((idx) => {
                const done = confirmed.has(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => goTo(idx)}
                    aria-label={`카드 ${idx + 1} ${done ? '확인 완료' : '확인 필요'} — 이동`}
                    style={done ? progressChipDoneStyle : progressChipPendingStyle}
                  >
                    <span>{idx + 1}</span>
                    <span>{done ? '✓' : '✗'}</span>
                  </button>
                );
              })}
            </div>
            <div style={progressFooterStyle}>
              {allConfirmed ? '모두 확인했어요' : '안 한 카드를 누르면 해당 카드로 이동해요'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={!allConfirmed}
            style={allConfirmed ? startBtnActiveStyle : startBtnDisabledStyle}
          >
            인터뷰 시작하기 →
          </button>
          <div
            style={{
              ...hintStyle,
              opacity: hintShown && !allConfirmed ? 1 : 0,
            }}
            aria-live="polite"
          >
            ← 아직 확인하지 않은 카드가 있어요
          </div>
        </section>
      </div>

      {/* ── Bottom 네비게이션 (prev / dots / next) ── */}
      <nav style={navStyle} aria-label="카드 네비게이션">
        <button
          type="button"
          onClick={() => goTo(cur - 1)}
          disabled={cur === 0}
          aria-label="이전 카드"
          style={{ ...arrowBtnStyle, ...(cur === 0 ? arrowDisabledStyle : null) }}
        >
          ‹
        </button>
        <div style={dotsStyle}>
          {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`카드 ${i + 1}로 이동`}
              style={i === cur ? dotActiveStyle : dotStyle}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo(cur + 1)}
          disabled={cur === TOTAL_CARDS - 1}
          aria-label="다음 카드"
          style={{ ...arrowBtnStyle, ...(cur === TOTAL_CARDS - 1 ? arrowDisabledStyle : null) }}
        >
          ›
        </button>
      </nav>
    </div>
  );
}

// ── 서브 컴포넌트 ────────────────────────────────────────

/** 카드 1·2·3 공통 셸 — 상단 확인 eyebrow + 본문 + 하단 "이해했어요" 버튼 */
function ConfirmCard({
  stepIndex,
  confirmed,
  onToggle,
  children,
}: {
  stepIndex: number;
  confirmed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section style={cardSectionStyle}>
      <div style={confirmed ? eyebrowDoneStyle : eyebrowPendingStyle}>
        {confirmed ? '✓ 확인 완료' : `확인이 필요해요 · ${stepIndex} / 3`}
      </div>
      {children}
      <div style={{ flex: 1, minHeight: '6px' }} />
      {!confirmed && (
        <div style={confirmHintStyle}>👇 이해되셨다면 아래 버튼을 눌러주세요</div>
      )}
      <button
        type="button"
        onClick={onToggle}
        style={confirmed ? confirmBtnDoneStyle : confirmBtnPendingStyle}
      >
        {confirmed ? '✓ 확인했어요' : '이해했어요'}
      </button>
    </section>
  );
}

/** 코칭 vs 컨설팅/멘토링 비교 행 */
function CompareRow({
  type,
  who,
  say,
  highlight = false,
}: {
  type: 'no' | 'yes';
  who: string;
  say: string;
  highlight?: boolean;
}) {
  return (
    <div style={highlight ? compareRowHiStyle : compareRowStyle}>
      <span style={type === 'no' ? markNoStyle : markYesStyle}>
        {type === 'no' ? '✕' : '✓'}
      </span>
      <span style={highlight ? whoHiStyle : whoStyle}>{who}</span>
      <span style={highlight ? sayHiStyle : sayStyle}>{say}</span>
    </div>
  );
}

/** 진행 방식 카드 (카드 3 내부) */
function ProcCard({
  n,
  title,
  desc,
  warn,
}: {
  n: number;
  title: string;
  desc: string;
  warn?: string;
}) {
  return (
    <div style={procItemStyle}>
      <span style={procNumStyle}>{n}</span>
      <div>
        <div style={procTitleStyle}>{title}</div>
        <div style={procDescStyle}>{desc}</div>
        {warn && <div style={procWarnStyle}>{warn}</div>}
      </div>
    </div>
  );
}

// ── 스타일 (다른 온보딩 페이지 컨벤션 따름) ────────────────

const wrapStyle: CSSProperties = {
  width: 'min(430px, 100vw)',
  minHeight: '100dvh',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  padding: '10px 16px',
  gap: '12px',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
};

const backBtnStyle: CSSProperties = {
  width: '44px',
  height: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  fontSize: '20px',
  fontFamily: 'inherit',
};

const pageTitleStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  flex: 1,
  textAlign: 'center',
};

// FIXED top
const fixedTopStyle: CSSProperties = {
  flex: 'none',
  padding: '14px 20px 16px',
  textAlign: 'center',
  borderBottom: '1px solid var(--border)',
};

const stepLabelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  color: 'var(--accent)',
  letterSpacing: '.06em',
};

const fixedTopTitleStyle: CSSProperties = {
  fontSize: '18px',
  fontWeight: 800,
  color: 'var(--text-primary)',
  lineHeight: 1.3,
  marginTop: '4px',
  letterSpacing: '-.01em',
};

const fixedTopSubStyle: CSSProperties = {
  marginTop: '4px',
  fontSize: '13px',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
};

// 강점 카드 — info panel 패턴(accent-light bg + radius 12)
const strengthCardStyle: CSSProperties = {
  marginTop: '12px',
  padding: '12px 14px',
  background: 'var(--accent-light)',
  borderRadius: '12px',
  textAlign: 'center',
};

const strengthHeaderStyle: CSSProperties = {
  fontSize: '12.5px',
  fontWeight: 700,
  color: 'var(--accent)',
  letterSpacing: '-.01em',
};

const strengthChipsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  marginTop: '8px',
  justifyContent: 'center',
};

const strengthChipStyle: CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--accent)',
  fontWeight: 700,
  fontSize: '12px',
  padding: '4px 10px',
  borderRadius: '999px',
};

const strengthLoadingStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-muted)',
};

// Swipe deck container
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

// 각 카드 섹션
const cardSectionStyle: CSSProperties = {
  flex: 'none',
  width: '100%',
  scrollSnapAlign: 'center',
  padding: '16px 20px 12px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const cardH2Style: CSSProperties = {
  margin: 0,
  fontSize: '20px',
  fontWeight: 800,
  letterSpacing: '-.02em',
  lineHeight: 1.3,
  color: 'var(--text-primary)',
};

const hlStyle: CSSProperties = {
  color: 'var(--accent)',
};

const cardBodyStyle: CSSProperties = {
  margin: 0,
  marginTop: '10px',
  fontSize: '13.5px',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
};

const bodyStrongStyle: CSSProperties = {
  color: 'var(--text-primary)',
  fontWeight: 700,
};

// Confirm eyebrow (gating 발견성)
const eyebrowPendingStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  padding: '4px 10px',
  borderRadius: '999px',
  fontSize: '11.5px',
  fontWeight: 800,
  letterSpacing: '.04em',
  marginBottom: '10px',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
};

const eyebrowDoneStyle: CSSProperties = {
  ...eyebrowPendingStyle,
  background: 'var(--accent)',
  color: '#fff',
};

// Confirm hint + button
const confirmHintStyle: CSSProperties = {
  marginTop: '10px',
  textAlign: 'center',
  fontSize: '12px',
  color: 'var(--text-muted)',
};

const confirmBtnPendingStyle: CSSProperties = {
  marginTop: '8px',
  width: '100%',
  border: '1.5px solid var(--accent)',
  borderRadius: '12px',
  background: 'var(--surface)',
  color: 'var(--accent)',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: '14px',
  padding: '11px',
  cursor: 'pointer',
  boxShadow: '0 0 0 3px rgba(45,91,255,.08)',
  transition: 'all .2s',
};

const confirmBtnDoneStyle: CSSProperties = {
  ...confirmBtnPendingStyle,
  background: 'var(--accent)',
  color: '#fff',
  boxShadow: 'none',
};

// CompareRow — bg + border 1.5px var(--border) (다른 페이지 cardStyle 패턴)
const compareRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  borderRadius: '12px',
  background: 'var(--bg)',
  border: '1.5px solid var(--border)',
};

const compareRowHiStyle: CSSProperties = {
  ...compareRowStyle,
  background: 'var(--accent-light)',
  borderColor: 'var(--accent)',
};

const compareListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  marginTop: '12px',
};

const markNoStyle: CSSProperties = {
  flex: 'none',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  fontSize: '11px',
  fontWeight: 800,
  color: '#fff',
  background: 'var(--danger)',
};

const markYesStyle: CSSProperties = {
  ...markNoStyle,
  background: 'var(--accent)',
};

const whoStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: '13.5px',
  minWidth: '48px',
  color: 'var(--text-primary)',
};

const whoHiStyle: CSSProperties = {
  ...whoStyle,
  color: 'var(--accent)',
};

const sayStyle: CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
};

const sayHiStyle: CSSProperties = {
  ...sayStyle,
  color: 'var(--text-primary)',
};

// 역량 공식 박스 (카드 2)
const formulaBoxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: '6px',
  marginTop: '12px',
  padding: '14px 12px',
  background: 'var(--bg)',
  border: '1.5px solid var(--border)',
  borderRadius: '14px',
};

const formulaLabelStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: '14px',
  color: 'var(--text-primary)',
  marginRight: '2px',
};

const formulaTermStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: '8px',
  padding: '6px 11px',
  fontWeight: 700,
  fontSize: '13px',
  color: 'var(--text-secondary)',
};

const formulaOpStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontWeight: 800,
  fontSize: '13px',
};

// 진행 카드 (카드 3)
const procListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '12px',
};

const procItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '10px 12px',
  background: 'var(--bg)',
  border: '1.5px solid var(--border)',
  borderRadius: '12px',
};

const procNumStyle: CSSProperties = {
  flex: 'none',
  width: '22px',
  height: '22px',
  borderRadius: '8px',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  fontWeight: 800,
  fontSize: '12px',
  display: 'grid',
  placeItems: 'center',
};

const procTitleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: '13.5px',
  color: 'var(--text-primary)',
};

const procDescStyle: CSSProperties = {
  marginTop: '1px',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  lineHeight: 1.45,
};

const procWarnStyle: CSSProperties = {
  marginTop: '4px',
  fontSize: '11.5px',
  fontWeight: 600,
  color: 'var(--danger)',
  lineHeight: 1.4,
};

// 카드 4 진행 상태 chips
const progressWrapStyle: CSSProperties = {
  marginTop: '14px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
};

const progressHeaderStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)',
};

const progressChipsStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
};

const progressChipPendingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  border: '1.5px solid var(--danger)',
  background: 'var(--surface)',
  color: 'var(--danger)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const progressChipDoneStyle: CSSProperties = {
  ...progressChipPendingStyle,
  borderColor: 'var(--accent)',
  background: 'var(--accent)',
  color: '#fff',
};

const progressFooterStyle: CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--text-muted)',
};

// 시작 버튼
const startBtnActiveStyle: CSSProperties = {
  marginTop: '16px',
  width: '100%',
  border: 'none',
  borderRadius: '12px',
  background: 'var(--accent)',
  color: '#fff',
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: '15px',
  padding: '13px',
  cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(45,91,255,.35)',
  transition: 'all .2s',
};

const startBtnDisabledStyle: CSSProperties = {
  ...startBtnActiveStyle,
  background: 'var(--border-strong)',
  cursor: 'not-allowed',
  boxShadow: 'none',
};

const hintStyle: CSSProperties = {
  marginTop: '8px',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--danger)',
  transition: 'opacity .2s',
};

// Bottom nav (deck 화살표 + dots)
const navStyle: CSSProperties = {
  flex: 'none',
  height: '48px',
  borderTop: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  background: 'var(--surface)',
};

const arrowBtnStyle: CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  border: 'none',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  fontSize: '17px',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  fontFamily: 'inherit',
};

const arrowDisabledStyle: CSSProperties = {
  opacity: 0.35,
  cursor: 'default',
};

const dotsStyle: CSSProperties = {
  display: 'flex',
  gap: '7px',
};

const dotStyle: CSSProperties = {
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  background: 'var(--border)',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  transition: 'all .25s',
};

const dotActiveStyle: CSSProperties = {
  ...dotStyle,
  width: '18px',
  borderRadius: '999px',
  background: 'var(--accent)',
};
