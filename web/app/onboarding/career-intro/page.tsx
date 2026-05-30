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

        {/* ── FIXED top (STEP 2 + 강점 Top 5) ── */}
        <div className="flex-none px-6 pt-[18px] pb-4 text-center border-b border-[var(--border)]">
          <div className="text-[13px] font-extrabold text-[var(--accent)] tracking-[0.06em]">
            STEP 2
          </div>
          <div className="text-[21px] font-extrabold leading-[1.3] mt-[5px] tracking-[-0.01em] text-[var(--text-primary)]">
            이제 커리어 방향을 찾아볼 차례예요
          </div>
          <div className="mt-2 text-[13.5px] text-[var(--text-secondary)]">
            강점을 어디에 어떻게 쓸지 함께 정리해요.
          </div>

          {/* 강점 카드 */}
          <div className="bg-[var(--accent-light)] rounded-[14px] px-4 py-[14px] mt-[15px] text-left border border-[var(--accent)]/30">
            <div className="font-bold text-[13.5px] text-[var(--text-primary)]">
              내 강점 Top 5
            </div>
            <div className="flex flex-wrap gap-[6px] mt-[9px]">
              {strengths.length > 0 ? (
                strengths.map((s) => (
                  <span
                    key={s}
                    className="bg-white text-[var(--accent)] font-bold text-[12.5px] px-[11px] py-[5px] rounded-full"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-[12px] text-[var(--text-muted)]">
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
            <h2 className="text-[23px] font-extrabold tracking-[-0.02em] leading-[1.3] text-[var(--text-primary)]">
              잠깐, 이건 <span className="text-[var(--accent)]">코칭</span>이에요
            </h2>
            <p className="mt-[11px] text-[14.5px] text-[var(--text-secondary)]">
              코치는 정답 대신 질문을 던져요.{' '}
              <strong className="text-[var(--text-primary)] font-bold">
                답은 이미 당신 안에
              </strong>{' '}
              있어요.
            </p>
            <div className="flex flex-col gap-2 mt-[15px]">
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
            <h2 className="text-[23px] font-extrabold tracking-[-0.02em] leading-[1.3] text-[var(--text-primary)]">
              역량은 스킬, <span className="text-[var(--accent)]">그 이상</span>이에요
            </h2>
            <div className="flex items-center justify-center flex-wrap gap-2 mt-4 bg-[var(--bg)] rounded-[14px] px-[14px] py-5">
              <span className="font-extrabold text-[16px] text-[var(--text-primary)] mr-[2px]">
                역량 =
              </span>
              <span className="bg-white border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 font-bold text-[14.5px] text-[var(--text-secondary)]">
                지식
              </span>
              <span className="text-[var(--text-muted)] font-extrabold text-[14px]">+</span>
              <span className="bg-white border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 font-bold text-[14.5px] text-[var(--text-secondary)]">
                스킬
              </span>
              <span className="text-[var(--text-muted)] font-extrabold text-[14px]">+</span>
              <span className="bg-white border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 font-bold text-[14.5px] text-[var(--text-secondary)]">
                태도
              </span>
            </div>
            <p className="mt-[15px] text-[14.5px] text-[var(--text-secondary)]">
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
            <h2 className="text-[23px] font-extrabold tracking-[-0.02em] leading-[1.3] text-[var(--text-primary)]">
              이렇게 진행돼요
            </h2>
            <div className="flex flex-col gap-[9px] mt-[15px]">
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
                warn="⚠️ 단기간에 풀리지 않아요. 충분히 들여다볼 수 있게 30분 이상을 권장해요."
              />
            </div>
          </ConfirmCard>

          {/* Card 4 — 준비됐어요! (FINAL) */}
          <section className="flex-none w-full snap-center px-6 pt-5 pb-4 flex flex-col items-center justify-center text-center overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <h2 className="text-[23px] font-extrabold tracking-[-0.02em] leading-[1.3] text-[var(--text-primary)]">
              준비됐어요!
            </h2>
            <p className="mt-[11px] text-[14.5px] text-[var(--text-secondary)] leading-[1.55]">
              솔직하게 답할수록 더 깊은 답이 나와요.
              <br />
              이제 코치와 시작해볼까요?
            </p>

            {/* 확인 progress chips — 안 한 카드는 빨간색 강조, 클릭하면 해당 카드로 이동 */}
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="text-[12.5px] font-semibold text-[var(--text-muted)]">
                카드별 확인 상태
              </div>
              <div className="flex gap-2">
                {[0, 1, 2].map((idx) => {
                  const done = confirmed.has(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => goTo(idx)}
                      aria-label={`카드 ${idx + 1} ${done ? '확인 완료' : '확인 필요'} — 이동`}
                      className={`flex items-center gap-[5px] px-[11px] py-[6px] rounded-full text-[12.5px] font-bold border-[1.5px] cursor-pointer transition-all ${
                        done
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-white text-[#e0524f] border-[#e0524f]'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      <span>{done ? '✓' : '✗'}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-[12px] text-[var(--text-muted)]">
                {allConfirmed
                  ? '모두 확인했어요'
                  : '안 한 카드를 누르면 해당 카드로 이동해요'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={!allConfirmed}
              className={`mt-5 w-full border-none rounded-[13px] font-bold text-[16px] py-4 font-inherit transition-all duration-200 ${
                allConfirmed
                  ? 'bg-[var(--accent)] text-white cursor-pointer shadow-[0_6px_18px_rgba(47,84,235,0.35)] active:scale-[0.985]'
                  : 'bg-[#c9c9d2] text-white cursor-not-allowed'
              }`}
            >
              인터뷰 시작하기 →
            </button>
            <div
              className={`mt-[11px] text-[12.5px] font-semibold text-[#e0524f] transition-opacity ${
                hintShown && !allConfirmed ? 'opacity-100' : 'opacity-0'
              }`}
              aria-live="polite"
            >
              ← 아직 확인하지 않은 카드가 있어요
            </div>
          </section>
        </div>

        {/* ── Bottom 네비게이션 ── */}
        <nav
          className="flex-none h-14 border-t border-[var(--border)] flex items-center justify-between px-5 bg-[var(--surface)]"
          aria-label="카드 네비게이션"
        >
          <button
            type="button"
            onClick={() => goTo(cur - 1)}
            disabled={cur === 0}
            aria-label="이전 카드"
            className={`w-9 h-9 rounded-full border-none bg-[var(--bg)] text-[var(--text-primary)] text-lg grid place-items-center cursor-pointer ${
              cur === 0 ? 'opacity-35 cursor-default' : ''
            }`}
          >
            ‹
          </button>
          <div className="flex gap-[7px]">
            {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`카드 ${i + 1}로 이동`}
                className={`h-[7px] rounded-full border-none p-0 cursor-pointer transition-all duration-[250ms] ${
                  i === cur
                    ? 'w-5 bg-[var(--accent)]'
                    : 'w-[7px] bg-[var(--border)]'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(cur + 1)}
            disabled={cur === TOTAL_CARDS - 1}
            aria-label="다음 카드"
            className={`w-9 h-9 rounded-full border-none bg-[var(--bg)] text-[var(--text-primary)] text-lg grid place-items-center cursor-pointer ${
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
    <section className="flex-none w-full snap-center px-6 pt-5 pb-4 flex flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* 확인 eyebrow — "이 카드는 확인이 필요하다"는 사실을 사용자가 한눈에 알도록 */}
      <div
        className={`inline-flex items-center gap-[6px] self-start px-[10px] py-[4px] rounded-full text-[11.5px] font-extrabold tracking-[0.04em] mb-[10px] transition-colors ${
          confirmed
            ? 'bg-[var(--accent)] text-white'
            : 'bg-[var(--accent-light)] text-[var(--accent)]'
        }`}
      >
        {confirmed ? '✓ 확인 완료' : `확인이 필요해요 · ${stepIndex} / 3`}
      </div>
      {children}
      <div className="flex-1 min-h-3" />
      {/* 확인 안 한 경우 버튼 위에 안내 한 줄 — 발견성 보강 */}
      {!confirmed && (
        <div className="mt-[12px] text-center text-[12.5px] text-[var(--text-muted)]">
          👇 이해되셨다면 아래 버튼을 눌러주세요
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className={`mt-[10px] w-full border-[1.5px] rounded-[12px] font-bold text-[14.5px] py-[13px] font-inherit transition-all duration-200 cursor-pointer ${
          confirmed
            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
            : 'bg-white text-[var(--accent)] border-[var(--accent)] shadow-[0_0_0_4px_rgba(47,84,235,0.08)]'
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
      className={`flex items-center gap-[11px] rounded-[12px] px-[14px] py-[11px] ${
        highlight
          ? 'bg-[var(--accent-light)] border-[1.5px] border-[var(--accent)]'
          : 'bg-[var(--bg)]'
      }`}
    >
      <span
        className={`flex-none w-[21px] h-[21px] rounded-full grid place-items-center text-[11px] font-extrabold text-white ${
          type === 'no' ? 'bg-[#e0524f]' : 'bg-[var(--accent)]'
        }`}
      >
        {type === 'no' ? '✕' : '✓'}
      </span>
      <span
        className={`font-bold text-[14.5px] min-w-[50px] ${
          highlight ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
        }`}
      >
        {who}
      </span>
      <span
        className={`text-[13.5px] ${
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
    <div className="bg-[var(--bg)] rounded-[12px] px-[14px] py-3 flex gap-[11px] items-start">
      <span className="flex-none w-6 h-6 rounded-lg bg-[var(--accent-light)] text-[var(--accent)] font-extrabold text-[12.5px] grid place-items-center">
        {n}
      </span>
      <div>
        <div className="font-bold text-[14.5px] text-[var(--text-primary)]">{title}</div>
        <div className="text-[var(--text-secondary)] text-[13px] mt-[2px]">{desc}</div>
        {warn && (
          <div className="text-[#e0524f] text-[12.5px] font-semibold mt-[6px] leading-[1.45]">
            {warn}
          </div>
        )}
      </div>
    </div>
  );
}
