'use client';

// 07 커리어 인터뷰 인트로 — 상단 고정 + swipe deck 4장 + gating (spec v1.5)

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const TOTAL_CARDS = 4;
const REQUIRED_CONFIRMS = 3; // 카드 1·2·3 모두 확인해야 시작 활성화

export default function CareerIntroPage() {
  const router = useRouter();
  const deckRef = useRef<HTMLDivElement>(null);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [cur, setCur] = useState(0);
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [hintShown, setHintShown] = useState(false);

  // ── 강점 fetch ────────────────────────────────────────────
  useEffect(() => {
    const fetchStrengths = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('strength_analyses')
        .select('strengths')
        .eq('user_id', user.id)
        .eq('is_latest', true)
        .single();

      if (data?.strengths) {
        const names = (data.strengths as { name_ko: string }[]).map((s) => s.name_ko);
        setStrengths(names);
      }
    };
    fetchStrengths();
  }, []);

  // ── deck 스크롤 → 현재 카드 추적 ──────────────────────────
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    let t: number | undefined;
    const onScroll = () => {
      clearTimeout(t);
      t = window.setTimeout(() => {
        const i = Math.round(deck.scrollLeft / deck.clientWidth);
        setCur(Math.max(0, Math.min(TOTAL_CARDS - 1, i)));
      }, 60);
    };
    deck.addEventListener('scroll', onScroll, { passive: true });
    return () => deck.removeEventListener('scroll', onScroll);
  }, []);

  // ── 키보드 ← → ───────────────────────────────────────────
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
  const toggleConfirm = (cardIndex: number) => {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(cardIndex)) next.delete(cardIndex);
      else next.add(cardIndex);
      return next;
    });
    if (hintShown) setHintShown(false);
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
    <div className="min-h-screen flex justify-center items-start bg-[#e8eaee]">
      <div className="w-[390px] min-h-[100dvh] bg-[var(--surface)] flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.18)] overflow-hidden">
        {/* ── Top Bar ── */}
        <div className="flex-none flex items-center px-4 py-[10px] border-b border-[var(--border)] bg-[var(--surface)]">
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-transparent border-none text-[22px] cursor-pointer w-11 h-11 flex items-center justify-center text-[var(--text-primary)] font-inherit"
            aria-label="뒤로가기"
          >
            ←
          </button>
          <span className="flex-1 text-center text-[15px] font-bold text-[var(--text-primary)]">
            커리어 인터뷰
          </span>
          <div className="w-11" />
        </div>

        {/* ── FIXED top (STEP 2 + 강점 Top 5) — compact ── */}
        <div className="flex-none px-5 pt-[10px] pb-[10px] text-center border-b border-[var(--border)]">
          <div className="text-[11.5px] font-extrabold text-[var(--accent)] tracking-[0.06em]">
            STEP 2
          </div>
          <div className="text-[17px] font-extrabold leading-[1.3] mt-[3px] tracking-[-0.01em] text-[var(--text-primary)]">
            이제 커리어 방향을 찾아볼 차례예요
          </div>
          <div className="mt-[3px] text-[12px] text-[var(--text-secondary)]">
            강점을 어디에 어떻게 쓸지 함께 정리해요.
          </div>

          {/* 강점 카드 — 가운데 정렬 */}
          <div className="bg-[var(--accent-light)] rounded-[12px] px-3 py-[10px] mt-[10px] text-center border border-[var(--accent)]/30">
            <div className="font-bold text-[12px] text-[var(--text-primary)]">
              내 강점 Top 5
            </div>
            <div className="flex flex-wrap justify-center gap-[5px] mt-[6px]">
              {strengths.length > 0 ? (
                strengths.map((s) => (
                  <span
                    key={s}
                    className="bg-white text-[var(--accent)] font-bold text-[11.5px] px-[9px] py-[3px] rounded-full"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-[11.5px] text-[var(--text-muted)]">
                  강점을 불러오는 중...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Swipe Deck (4장) ── */}
        <div
          ref={deckRef}
          className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Card 1 — 코칭 vs 컨설팅/멘토링 */}
          <ConfirmCard
            stepIndex={1}
            confirmed={confirmed.has(0)}
            onToggle={() => toggleConfirm(0)}
          >
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em] leading-[1.3] text-[var(--text-primary)]">
              잠깐, 이건 <span className="text-[var(--accent)]">코칭</span>이에요
            </h2>
            <p className="mt-[8px] text-[13px] text-[var(--text-secondary)] leading-[1.5]">
              코치는 정답 대신 질문을 던져요.{' '}
              <strong className="text-[var(--text-primary)] font-bold">
                답은 이미 당신 안에
              </strong>{' '}
              있어요.
            </p>
            <div className="flex flex-col gap-[6px] mt-[10px]">
              <CompareRow type="no" who="컨설팅" say='"이렇게 하세요"' />
              <CompareRow type="no" who="멘토링" say='"제 경험으로는…"' />
              <CompareRow type="yes" who="코칭" say='"어떻게 생각하세요?"' highlight />
            </div>
          </ConfirmCard>

          {/* Card 2 — 역량 = 지식 + 스킬 + 태도 */}
          <ConfirmCard
            stepIndex={2}
            confirmed={confirmed.has(1)}
            onToggle={() => toggleConfirm(1)}
          >
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em] leading-[1.3] text-[var(--text-primary)]">
              역량은 스킬, <span className="text-[var(--accent)]">그 이상</span>이에요
            </h2>
            <div className="flex items-center justify-center flex-wrap gap-[6px] mt-[10px] bg-[var(--bg)] rounded-[12px] px-3 py-[12px]">
              <span className="font-extrabold text-[14px] text-[var(--text-primary)] mr-[2px]">
                역량 =
              </span>
              <span className="bg-white border-[1.5px] border-[var(--border)] rounded-[8px] px-[10px] py-[5px] font-bold text-[13px] text-[var(--text-secondary)]">
                지식
              </span>
              <span className="text-[var(--text-muted)] font-extrabold text-[13px]">+</span>
              <span className="bg-white border-[1.5px] border-[var(--border)] rounded-[8px] px-[10px] py-[5px] font-bold text-[13px] text-[var(--text-secondary)]">
                스킬
              </span>
              <span className="text-[var(--text-muted)] font-extrabold text-[13px]">+</span>
              <span className="bg-white border-[1.5px] border-[var(--border)] rounded-[8px] px-[10px] py-[5px] font-bold text-[13px] text-[var(--text-secondary)]">
                태도
              </span>
            </div>
            <p className="mt-[10px] text-[13px] text-[var(--text-secondary)] leading-[1.5]">
              자격증이나 기술 하나를 알려드리는 게 아니에요. 지식·스킬·태도를 아우르는{' '}
              <strong className="text-[var(--text-primary)] font-bold">역량 전체</strong>를
              함께 봐요.
            </p>
          </ConfirmCard>

          {/* Card 3 — 진행 방식 + 30분 이상 권장 */}
          <ConfirmCard
            stepIndex={3}
            confirmed={confirmed.has(2)}
            onToggle={() => toggleConfirm(2)}
          >
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em] leading-[1.3] text-[var(--text-primary)]">
              이렇게 진행돼요
            </h2>
            <div className="flex flex-col gap-[6px] mt-[10px]">
              <ProcCard n={1} title="주제 합의" desc="오늘 다룰 주제를 함께 정해요" />
              <ProcCard
                n={2}
                title="자유로운 대화"
                desc="정해진 질문지 없이, 큰 고민부터"
              />
              <ProcCard
                n={3}
                title="원하는 시간으로"
                desc="보통 30~45분 · 길게 50분+"
                warn="⚠️ 단기간에 풀리지 않아요. 30분 이상 권장."
              />
            </div>
          </ConfirmCard>

          {/* Card 4 — 준비됐어요! (FINAL) — compact */}
          <section className="flex-none w-full snap-center px-5 pt-4 pb-3 flex flex-col items-center justify-center text-center overflow-hidden">
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em] leading-[1.3] text-[var(--text-primary)]">
              준비됐어요!
            </h2>
            <p className="mt-[8px] text-[13px] text-[var(--text-secondary)] leading-[1.5]">
              솔직하게 답할수록 더 깊은 답이 나와요.
              <br />
              이제 코치와 시작해볼까요?
            </p>

            {/* 확인 progress chips — 안 한 카드는 빨간색 강조, 클릭하면 해당 카드로 이동 */}
            <div className="mt-3 flex flex-col items-center gap-[6px]">
              <div className="text-[11.5px] font-semibold text-[var(--text-muted)]">
                카드별 확인 상태
              </div>
              <div className="flex gap-[6px]">
                {[0, 1, 2].map((idx) => {
                  const done = confirmed.has(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => goTo(idx)}
                      aria-label={`카드 ${idx + 1} ${done ? '확인 완료' : '확인 필요'} — 이동`}
                      className={`flex items-center gap-[4px] px-[9px] py-[4px] rounded-full text-[11.5px] font-bold border-[1.5px] cursor-pointer transition-all ${
                        done
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-white text-[var(--danger)] border-[var(--danger)]'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      <span>{done ? '✓' : '✗'}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {allConfirmed
                  ? '모두 확인했어요'
                  : '안 한 카드를 누르면 해당 카드로 이동해요'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={!allConfirmed}
              className={`mt-4 w-full border-none rounded-[var(--radius-md)] font-bold text-[14.5px] py-[12px] font-inherit transition-all duration-200 ${
                allConfirmed
                  ? 'bg-[var(--accent)] text-white cursor-pointer shadow-[0_6px_18px_rgba(45,91,255,0.35)] active:scale-[0.985]'
                  : 'bg-[var(--border-strong)] text-white cursor-not-allowed'
              }`}
            >
              인터뷰 시작하기 →
            </button>
            <div
              className={`mt-[8px] text-[11.5px] font-semibold text-[var(--danger)] transition-opacity ${
                hintShown && !allConfirmed ? 'opacity-100' : 'opacity-0'
              }`}
              aria-live="polite"
            >
              ← 아직 확인하지 않은 카드가 있어요
            </div>
          </section>
        </div>

        {/* ── Bottom 네비게이션 — compact ── */}
        <nav
          className="flex-none h-11 border-t border-[var(--border)] flex items-center justify-between px-4 bg-[var(--surface)]"
          aria-label="카드 네비게이션"
        >
          <button
            type="button"
            onClick={() => goTo(cur - 1)}
            disabled={cur === 0}
            aria-label="이전 카드"
            className={`w-8 h-8 rounded-full border-none bg-[var(--bg)] text-[var(--text-primary)] text-[16px] grid place-items-center cursor-pointer ${
              cur === 0 ? 'opacity-35 cursor-default' : ''
            }`}
          >
            ‹
          </button>
          <div className="flex gap-[6px]">
            {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`카드 ${i + 1}로 이동`}
                className={`h-[6px] rounded-full border-none p-0 cursor-pointer transition-all duration-[250ms] ${
                  i === cur
                    ? 'w-[18px] bg-[var(--accent)]'
                    : 'w-[6px] bg-[var(--border)]'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(cur + 1)}
            disabled={cur === TOTAL_CARDS - 1}
            aria-label="다음 카드"
            className={`w-8 h-8 rounded-full border-none bg-[var(--bg)] text-[var(--text-primary)] text-[16px] grid place-items-center cursor-pointer ${
              cur === TOTAL_CARDS - 1 ? 'opacity-35 cursor-default' : ''
            }`}
          >
            ›
          </button>
        </nav>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ────────────────────────────────────────

/** 카드 1·2·3 공통 셸 — 상단 확인 eyebrow + 본문 + 하단 "이해했어요" 확인 버튼 */
function ConfirmCard({
  stepIndex,
  confirmed,
  onToggle,
  children,
}: {
  stepIndex: number; // 1·2·3 (UI 표시용, 사용자 확인 진행률)
  confirmed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex-none w-full snap-center px-5 pt-3 pb-3 flex flex-col overflow-hidden">
      {/* 확인 eyebrow — "이 카드는 확인이 필요하다"는 사실을 사용자가 한눈에 알도록 */}
      <div
        className={`inline-flex items-center gap-[5px] self-start px-[9px] py-[3px] rounded-full text-[11.5px] font-extrabold tracking-[0.04em] mb-[8px] transition-colors ${
          confirmed
            ? 'bg-[var(--accent)] text-white'
            : 'bg-[var(--accent-light)] text-[var(--accent)]'
        }`}
      >
        {confirmed ? '✓ 확인 완료' : `확인이 필요해요 · ${stepIndex} / 3`}
      </div>
      {children}
      <div className="flex-1 min-h-[6px]" />
      {/* 확인 안 한 경우 버튼 위에 안내 한 줄 — 발견성 보강 */}
      {!confirmed && (
        <div className="mt-[8px] text-center text-[11.5px] text-[var(--text-muted)]">
          👇 이해되셨다면 아래 버튼을 눌러주세요
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className={`mt-[6px] w-full border-[1.5px] rounded-[10px] font-bold text-[13.5px] py-[10px] font-inherit transition-all duration-200 cursor-pointer ${
          confirmed
            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
            : 'bg-white text-[var(--accent)] border-[var(--accent)] shadow-[0_0_0_3px_rgba(47,84,235,0.08)]'
        }`}
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
    <div
      className={`flex items-center gap-[9px] rounded-[10px] px-[12px] py-[8px] ${
        highlight
          ? 'bg-[var(--accent-light)] border-[1.5px] border-[var(--accent)]'
          : 'bg-[var(--bg)]'
      }`}
    >
      <span
        className={`flex-none w-[18px] h-[18px] rounded-full grid place-items-center text-[11px] font-extrabold text-white ${
          type === 'no' ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]'
        }`}
      >
        {type === 'no' ? '✕' : '✓'}
      </span>
      <span
        className={`font-bold text-[13px] min-w-[44px] ${
          highlight ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
        }`}
      >
        {who}
      </span>
      <span
        className={`text-[12.5px] ${
          highlight ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        {say}
      </span>
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
    <div className="bg-[var(--bg)] rounded-[10px] px-[12px] py-[8px] flex gap-[9px] items-start">
      <span className="flex-none w-[20px] h-[20px] rounded-md bg-[var(--accent-light)] text-[var(--accent)] font-extrabold text-[11.5px] grid place-items-center">
        {n}
      </span>
      <div>
        <div className="font-bold text-[13px] text-[var(--text-primary)]">{title}</div>
        <div className="text-[var(--text-secondary)] text-[11.5px] mt-[1px] leading-[1.4]">{desc}</div>
        {warn && (
          <div className="text-[var(--danger)] text-[11px] font-semibold mt-[4px] leading-[1.35]">
            {warn}
          </div>
        )}
      </div>
    </div>
  );
}
