'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useOnboardingGuard } from '@/lib/hooks/useOnboardingGuard';
import OnboardingRedirectModal from '@/components/OnboardingRedirectModal';
import { ACTION_SEEDS_BY_COMPETENCY, type ActionItem } from '@/lib/constants/seeds';
import {
  CUSTOM_MAX,
  CUSTOM_MIN,
  isCustomActionReady,
  validateCustomAction,
} from '@/lib/actionItems/customAction';
import {
  buildSourceSeedId,
  competencyCodeToSlug,
  mergeAiActions,
} from '@/lib/actionItems/seedMapping';
import { localISODate } from '@/lib/utils/localDate';

// 커스텀 액션 선택 상태를 표현하는 sentinel id (시드 id와 구분)
const CUSTOM_SELECTED_ID = '__custom__';

// 시드 5개 표시용 타입
interface DisplaySeed extends ActionItem {
  sourceSeedId: string; // `{competencyId}-{careerLevel}-{index}`
}

// goals row (간략)
interface ActiveGoal {
  id: string;
  goal_title: string;
  competency_code: string;
  domain: string;
}

// ────────────────────────────────────────────────────────────

export default function ActionItemsPage() {
  return (
    <Suspense fallback={<LoadingScreen text="불러오는 중..." />}>
      <ActionItemsContent />
    </Suspense>
  );
}

interface UserContextForAI {
  nickname: string;
  jobField: string;
  careerLevel: string;
  mainConcern: string;
  strengths: Array<{ id: string; name_ko: string; name_en: string; domain: string }>;
  interviewInsights: unknown;
}

function ActionItemsContent() {
  const router = useRouter();
  const { ready, pendingRedirect, confirmRedirect } = useOnboardingGuard('action-items');

  const [goal, setGoal] = useState<ActiveGoal | null>(null);
  const [careerLevel, setCareerLevel] = useState<string>('junior');
  const [aiContext, setAiContext] = useState<UserContextForAI | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI 개인화 액션 (시드 → 사용자 맞춤 변형)
  const [aiActions, setAiActions] = useState<DisplaySeed[] | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  // 단일 선택 상태 (시드 id 또는 CUSTOM_SELECTED_ID)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 커스텀 액션
  const [customText, setCustomText] = useState('');
  const [customAdded, setCustomAdded] = useState<string | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // ── 초기 데이터 로드 ─────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [goalRes, profileRes, strengthRes, interviewRes] = await Promise.all([
          supabase
            .from('goals')
            .select('id, goal_title, competency_code, domain')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('nickname, job_field, career_level, main_concern')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('strength_analyses')
            .select('strengths')
            .eq('user_id', user.id)
            .eq('is_latest', true)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('career_interview_results')
            .select('key_insights')
            .eq('user_id', user.id)
            .order('interviewed_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (goalRes.error) console.error('[10] goals query error:', goalRes.error);
        if (profileRes.error) console.error('[10] profiles query error:', profileRes.error);

        if (goalRes.error) throw new Error(`목표 조회 실패: ${goalRes.error.message}`);
        if (!goalRes.data) {
          throw new Error('NO_ACTIVE_GOAL');
        }
        setGoal(goalRes.data);
        setCareerLevel(profileRes.data?.career_level ?? 'junior');
        setAiContext({
          nickname: profileRes.data?.nickname ?? '친구',
          jobField: profileRes.data?.job_field ?? '',
          careerLevel: profileRes.data?.career_level ?? 'junior',
          mainConcern: profileRes.data?.main_concern ?? '',
          strengths: (strengthRes.data?.strengths as UserContextForAI['strengths']) ?? [],
          interviewInsights: interviewRes.data?.key_insights ?? null,
        });
        setLoadingData(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg === 'NO_ACTIVE_GOAL' ? 'NO_ACTIVE_GOAL' : '데이터를 불러올 수 없어요. 다시 시도해주세요.');
          setLoadingData(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [ready]);

  // ── 시드 5개 매핑 ───────────────────────────────────────
  // DB의 competency_code(T-1 등) → 슬러그로 변환 후 시드 lookup
  const seedSlug = useMemo(
    () => (goal ? competencyCodeToSlug(goal.competency_code) : null),
    [goal],
  );

  // 베이스 시드 (constants에서 lookup) — AI 실패 시 fallback으로 사용
  // 시드 없는 역량(예: R-1, R-2)은 빈 placeholder 5개로 채워서 AI가 처음부터 생성하게 함.
  const baseSeeds: DisplaySeed[] = useMemo(() => {
    if (!goal || !seedSlug) return [];
    const seedSet = ACTION_SEEDS_BY_COMPETENCY[seedSlug];
    const items = seedSet?.items;
    if (items && items.length > 0) {
      return items.map((item, idx) => ({
        ...item,
        // source_seed_id 형식은 스펙 코드 그대로 유지 (예: "T-1-junior-1")
        sourceSeedId: buildSourceSeedId(goal.competency_code, careerLevel, idx),
      }));
    }
    // 시드 데이터 없는 역량 — AI가 처음부터 생성하도록 빈 placeholder 5개
    return Array.from({ length: 5 }, (_, idx) => ({
      id: `${seedSlug}-placeholder-${idx + 1}`,
      title: '',
      description: '',
      tags: [],
      sourceSeedId: buildSourceSeedId(goal.competency_code, careerLevel, idx),
    }));
  }, [goal, seedSlug, careerLevel]);

  // ── AI 개인화 호출 ─────────────────────────────────────────
  useEffect(() => {
    if (!goal || !aiContext || baseSeeds.length === 0) return;
    let cancelled = false;
    setAiLoading(true);

    const run = async () => {
      try {
        const res = await fetch('/api/career-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userProfile: {
              nickname: aiContext.nickname,
              jobField: aiContext.jobField,
              careerLevel: aiContext.careerLevel,
              mainConcern: aiContext.mainConcern,
            },
            userStrengths: aiContext.strengths,
            interviewInsights: aiContext.interviewInsights,
            selectedGoal: {
              goal_title: goal.goal_title,
              competency_code: goal.competency_code,
            },
            seeds: baseSeeds.map((s) => ({
              sourceSeedId: s.sourceSeedId,
              title: s.title,
              description: s.description,
              tags: s.tags,
            })),
          }),
        });
        if (!res.ok) throw new Error('AI action generation failed');
        const data = (await res.json()) as {
          actions: Array<{ sourceSeedId: string; title: string; description: string; tags: string[]; isAiModified: boolean }>;
        };
        if (cancelled) return;
        // baseSeeds 형식에 맞춰 id 보존 (sourceSeedId 기준 병합)
        setAiActions(mergeAiActions(baseSeeds, data.actions));
      } catch (e) {
        console.error('[10 AI personalize] failed, falling back to seeds:', e);
        // 폴백: 시드 그대로 사용 (사용자에게는 AI 실패가 안 보임)
        if (!cancelled) setAiActions(baseSeeds);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [goal, aiContext, baseSeeds]);

  // 실제 화면에 표시될 시드 (AI 결과 또는 fallback)
  const seeds: DisplaySeed[] = aiActions ?? baseSeeds;

  const seedEmoji = useMemo(() => {
    if (!seedSlug) return '🎯';
    return ACTION_SEEDS_BY_COMPETENCY[seedSlug]?.emoji ?? '🎯';
  }, [seedSlug]);

  // ── 선택 핸들러 ─────────────────────────────────────────
  const handleSelectSeed = useCallback((seedId: string) => {
    setSelectedId((prev) => (prev === seedId ? null : seedId));
  }, []);

  const handleAddCustom = useCallback(() => {
    const result = validateCustomAction(customText);
    if (!result.ok) {
      setCustomError(result.error);
      return;
    }
    setCustomError(null);
    setCustomAdded(result.value);
    setCustomText('');
    // 추가 시 자동 선택, 추천 선택 자동 해제 (스펙 4번)
    setSelectedId(CUSTOM_SELECTED_ID);
  }, [customText]);

  const handleSelectCustom = useCallback(() => {
    setSelectedId((prev) => (prev === CUSTOM_SELECTED_ID ? null : CUSTOM_SELECTED_ID));
  }, []);

  const handleRemoveCustom = useCallback(() => {
    setCustomAdded(null);
    setSelectedId((prev) => (prev === CUSTOM_SELECTED_ID ? null : prev));
  }, []);

  // ── 시작하기 (action_items INSERT) ──────────────────────
  const handleStart = useCallback(async () => {
    if (!selectedId || saving || !goal) return;
    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요.');

      // v0.8: action_items.strength_link — 11 홈 "오늘의 액션" 카드의 강점 표시용
      // Top 1 강점 name_ko를 자유 텍스트로 저장 (없으면 null)
      const strengthLink = aiContext?.strengths?.[0]?.name_ko ?? null;

      let payload: {
        user_id: string;
        goal_id: string;
        week_number: number;
        title: string;
        description: string | null;
        tags: string[];
        is_custom: boolean;
        source_seed_id: string | null;
        strength_link: string | null;
      };

      if (selectedId === CUSTOM_SELECTED_ID) {
        if (!customAdded) throw new Error('커스텀 액션이 없어요.');
        payload = {
          user_id: user.id,
          goal_id: goal.id,
          week_number: 1,
          title: customAdded,
          description: null,
          tags: [],
          is_custom: true,
          source_seed_id: null,
          strength_link: strengthLink,
        };
      } else {
        const seed = seeds.find((s) => s.id === selectedId);
        if (!seed) throw new Error('선택한 액션을 찾을 수 없어요.');
        payload = {
          user_id: user.id,
          goal_id: goal.id,
          week_number: 1,
          title: seed.title,
          description: seed.description,
          tags: seed.tags,
          is_custom: false,
          source_seed_id: seed.sourceSeedId,
          strength_link: strengthLink,
        };
      }

      const { error: insertError } = await supabase
        .from('action_items')
        .insert(payload);

      if (insertError) throw insertError;

      // 시작 날짜 = "시작하기 🚀" 클릭 시점 (스펙 10 4번)
      // 이전 cycle/테스트의 stale started_at을 오늘로 갱신
      const today = localISODate();
      const { error: updateError } = await supabase
        .from('goals')
        .update({ started_at: today })
        .eq('id', goal.id);

      if (updateError) {
        console.error('[10] goals.started_at update error:', updateError);
        // 갱신 실패해도 NEW02 흐름은 진행 (display는 stale 가능성 있지만 핵심 흐름 유지)
      }

      router.push('/onboarding/complete');
    } catch (e) {
      console.error('[10 handleStart] error object:', e);
      console.error('[10 handleStart] error JSON:', JSON.stringify(e, Object.getOwnPropertyNames(e ?? {})));
      const errAny = e as { message?: string; details?: string; code?: string; hint?: string };
      const detail = errAny?.message || errAny?.details || errAny?.hint || (typeof e === 'object' ? JSON.stringify(e) : String(e));
      setError(`저장 실패: ${detail}`);
      setSaving(false);
    }
  }, [selectedId, saving, goal, customAdded, seeds, router]);

  if (pendingRedirect) return <OnboardingRedirectModal title={pendingRedirect.title} message={pendingRedirect.message} onConfirm={confirmRedirect} />;
  if (!ready || loadingData) return <LoadingScreen text="액션 아이템을 준비 중이에요..." />;
  if (!goal) {
    if (error === 'NO_ACTIVE_GOAL') {
      return (
        <div style={wrapStyle}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: '16px' }}>
            <div style={{ fontSize: '40px' }}>🔍</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
              선택된 목표가 없어요
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
              역량 방향 결과 화면에서<br />목표를 먼저 선택해주세요.
            </div>
            <button
              type="button"
              onClick={() => router.replace('/onboarding/career-result')}
              style={{ marginTop: '8px', padding: '13px 28px', borderRadius: '12px', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              역량 방향 선택하러 가기
            </button>
          </div>
        </div>
      );
    }
    return <LoadingScreen text={error ?? '목표를 찾을 수 없어요.'} />;
  }
  if (aiLoading) return <LoadingScreen text="AI가 당신에게 맞는 액션을 만들고 있어요..." />;

  return (
    <div style={wrapStyle}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      {/* 상단 바 */}
      <header style={headerStyle}>
          <button
            onClick={() => router.back()}
            aria-label="뒤로 가기"
            style={backBtnStyle}
          >
            ←
          </button>
          <span style={pageTitleStyle}>액션 아이템 선택</span>
          <span style={{ width: '44px' }} />
        </header>

        {/* 본문 */}
        <main style={mainStyle}>
        {/* 안내 패널 (스펙 3.3) — 선택한 목표 + 액션 선택 안내 */}
        <div style={infoPanelStyle}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '.06em', marginBottom: '6px', opacity: 0.75 }}>
            내가 선택한 목표
          </div>
          <div style={infoTitleStyle}>
            {seedEmoji} {goal.goal_title}
          </div>
          <div style={{ borderTop: '1px solid rgba(45,91,255,0.15)', margin: '10px 0' }} />
          <div style={infoDescStyle}>
            AI가 추천하는 액션 아이템이에요.
            <br />
            지금 시작할 수 있는 것{' '}
            <strong style={{ color: 'var(--accent)' }}>1개</strong>를 골라주세요.
          </div>
        </div>

        {/* 추천 액션 5개 (스펙 3.4) */}
        {seeds.length === 0 ? (
          <EmptySeeds />
        ) : (
          <div
            role="radiogroup"
            aria-label="추천 액션 5개"
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {seeds.map((seed) => (
              <ActionCard
                key={seed.id}
                seed={seed}
                selected={selectedId === seed.id}
                onClick={() => handleSelectSeed(seed.id)}
              />
            ))}
          </div>
        )}

        {/* 커스텀 액션 영역 (스펙 3.5) */}
        <div style={customWrapStyle}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
            나만의 액션 만들기
          </div>

          {/* 추가된 커스텀 항목 (있을 때만 표시) */}
          {/* HTML 스펙상 <button> 안에 <button>을 둘 수 없어 외부는 div + radio 패턴 */}
          {customAdded && (
            <div
              role="radio"
              aria-checked={selectedId === CUSTOM_SELECTED_ID}
              aria-label={`${customAdded}, 직접 입력`}
              tabIndex={0}
              onClick={handleSelectCustom}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectCustom();
                }
              }}
              style={{
                ...cardStyle,
                textAlign: 'left',
                cursor: 'pointer',
                marginBottom: '10px',
                background:
                  selectedId === CUSTOM_SELECTED_ID
                    ? 'var(--accent-light)'
                    : 'var(--surface)',
                borderColor:
                  selectedId === CUSTOM_SELECTED_ID
                    ? 'var(--accent)'
                    : 'var(--border)',
                position: 'relative',
                fontFamily: 'inherit',
                paddingRight: '40px',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                {/* 라디오버튼 */}
                <div
                  aria-hidden="true"
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: `2px solid ${selectedId === CUSTOM_SELECTED_ID ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'border-color .15s',
                  }}
                >
                  {selectedId === CUSTOM_SELECTED_ID && (
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)' }} />
                  )}
                </div>
                <span style={customBadgeStyle}>직접 입력</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                {customAdded}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveCustom();
                }}
                aria-label="커스텀 액션 삭제"
                style={removeBtnStyle}
              >
                ×
              </button>
            </div>
          )}

          {/* 입력 영역 (이미 추가된 항목이 있어도 다시 추가 가능 — 단, 동시에 1개만 가능하게 막거나 덮어쓰기) */}
          {!customAdded && (
            <>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => {
                    setCustomText(e.target.value);
                    if (customError) setCustomError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustom();
                    }
                  }}
                  placeholder={`나만의 액션 (${CUSTOM_MIN}~${CUSTOM_MAX}자)`}
                  maxLength={CUSTOM_MAX}
                  aria-label="나만의 액션 아이템 추가"
                  style={customInputStyle}
                />
                <span style={customCountStyle}>
                  {customText.length}/{CUSTOM_MAX}
                </span>
              </div>

              {/* 입력 가이드 (항상 표시) */}
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '11.5px',
                  color: isCustomActionReady(customText)
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
                  textAlign: 'right',
                  minHeight: '14px',
                }}
                aria-live="polite"
              >
                {customText.trim().length === 0
                  ? `${CUSTOM_MIN}자 이상 입력하면 [추가] 버튼이 활성화돼요`
                  : customText.trim().length < CUSTOM_MIN
                  ? `${CUSTOM_MIN - customText.trim().length}자 더 입력해주세요 (현재 ${customText.trim().length}/${CUSTOM_MIN})`
                  : '✓ 추가 가능 — 아래 버튼 또는 Enter'}
              </div>

              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!isCustomActionReady(customText)}
                style={{
                  ...customAddBtnStyle,
                  opacity: isCustomActionReady(customText) ? 1 : 0.5,
                  cursor: isCustomActionReady(customText) ? 'pointer' : 'not-allowed',
                }}
              >
                추가
              </button>
              {customError && (
                <div role="alert" style={{ marginTop: '6px', fontSize: '12px', color: 'var(--danger)' }}>
                  {customError}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ height: '4px' }} />
      </main>

      {/* 하단 CTA */}
      <footer style={footerStyle}>
        {error && (
          <div role="alert" style={errorAlertStyle}>
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleStart}
          disabled={!selectedId || saving}
          aria-disabled={!selectedId || saving}
          style={{
            ...primaryBtnStyle,
            background: selectedId && !saving ? 'var(--accent)' : 'var(--border)',
            color: selectedId && !saving ? '#fff' : 'var(--text-muted)',
            cursor: selectedId && !saving ? 'pointer' : 'not-allowed',
            boxShadow:
              selectedId && !saving ? '0 4px 16px rgba(45,91,255,.3)' : 'none',
          }}
        >
          {saving ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{
                width: '16px', height: '16px', borderRadius: '50%',
                border: '2.5px solid rgba(128,128,128,0.35)',
                borderTopColor: 'var(--text-muted)',
                animation: 'spin 0.75s linear infinite',
                display: 'inline-block', flexShrink: 0,
              }} />
              저장 중...
            </span>
          ) : '시작하기'}
        </button>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ────────────────────────────────────────────────────────────

function LoadingScreen({ text }: { text: string }) {
  return (
    <div style={wrapStyle}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '3.5px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.75s linear infinite',
        }} />
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{text}</div>
      </div>
    </div>
  );
}

function EmptySeeds() {
  return (
    <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
        이 역량의 추천 액션이 아직 준비되지 않았어요.
        <br />
        아래에서 직접 입력해주세요.
      </div>
    </div>
  );
}

function ActionCard({
  seed,
  selected,
  onClick,
}: {
  seed: DisplaySeed;
  selected: boolean;
  onClick: () => void;
}) {
  const descRef = useRef<HTMLParagraphElement>(null);
  // 설명이 2줄을 넘겨 잘리는지 측정 → 잘리는 카드에만 "더보기" 신호를 띄운다.
  // (펼친 상태에선 clamp가 풀려 측정이 불가하므로 직전 값을 유지)
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    const measure = () => {
      if (selected) return;
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [selected, seed.description]);

  return (
    <button
      role="radio"
      aria-checked={selected}
      aria-label={seed.title}
      onClick={onClick}
      style={{
        ...cardStyle,
        textAlign: 'left',
        cursor: 'pointer',
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        background: selected ? 'var(--accent-light)' : 'var(--surface)',
        position: 'relative',
        fontFamily: 'inherit',
        transition: 'background .15s, border-color .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* 라디오버튼 */}
        <div
          aria-hidden="true"
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: `2px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
            transition: 'border-color .15s',
          }}
        >
          {selected && (
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--accent)',
              }}
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.45,
              marginBottom: '4px',
              letterSpacing: '-.01em',
            }}
          >
            {seed.title}
          </div>
          <p
            ref={descRef}
            style={{
              margin: '0 0 6px',
              fontSize: '12.5px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              // 선택된 카드는 전문 표시, 나머지는 2줄 미리보기(말줄임)
              ...(selected
                ? { display: 'block', overflow: 'visible' }
                : {
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                  }),
            }}
          >
            {seed.description}
          </p>

          {/* 펼침 신호 — 잘리는 카드에만 표시. 카드 전체가 클릭 영역이라 시각 신호만 둔다. */}
          {overflowing && (
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'var(--accent)',
                marginBottom: '8px',
              }}
            >
              {selected ? '접기' : '더보기'}
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                style={{
                  transform: selected ? 'rotate(180deg)' : 'none',
                  transition: 'transform .18s',
                }}
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function SelectedDot() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'var(--accent)',
        display: 'inline-block',
      }}
    />
  );
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
};

const backBtnStyle: React.CSSProperties = {
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

const pageTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  flex: 1,
  textAlign: 'center',
};


const mainStyle: React.CSSProperties = {
  padding: '20px',
};

const infoPanelStyle: React.CSSProperties = {
  padding: '14px 16px',
  marginBottom: '16px',
  background: 'var(--accent-light)',
  borderRadius: '12px',
};

const infoTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  color: 'var(--accent)',
  marginBottom: '4px',
  letterSpacing: '-.01em',
};

const infoDescStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-primary)',
  lineHeight: 1.6,
};

const cardStyle: React.CSSProperties = {
  border: '1.5px solid var(--border)',
  borderRadius: '14px',
  padding: '14px',
  background: 'var(--surface)',
  width: '100%',
};

const tagStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  padding: '3px 8px',
  borderRadius: '999px',
};

const customWrapStyle: React.CSSProperties = {
  marginTop: '20px',
  padding: '16px',
  background: 'var(--bg)',
  borderRadius: '14px',
};

const customInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 56px 12px 14px',
  border: '1.5px solid var(--border)',
  borderRadius: '10px',
  fontSize: '14px',
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  background: 'var(--surface)',
  outline: 'none',
};

const customCountStyle: React.CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '11px',
  color: 'var(--text-muted)',
};

const customAddBtnStyle: React.CSSProperties = {
  marginTop: '8px',
  width: '100%',
  padding: '10px',
  borderRadius: '10px',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  border: 'none',
  fontSize: '13px',
  fontWeight: 700,
  fontFamily: 'inherit',
  transition: 'opacity .15s',
};

const customBadgeStyle: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: '999px',
  background: 'var(--accent-light)',
  color: 'var(--accent)',
  letterSpacing: '.02em',
};

const removeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: '10px',
  right: '10px',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  border: 'none',
  background: 'var(--bg)',
  color: 'var(--text-secondary)',
  fontSize: '16px',
  lineHeight: '1',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};


const footerStyle: React.CSSProperties = {
  position: 'sticky',
  bottom: 0,
  padding: '14px 20px',
  paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
  borderTop: '1px solid var(--border)',
  background: 'var(--surface)',
  zIndex: 20,
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '15px',
  borderRadius: '12px',
  border: 'none',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: 'inherit',
  transition: 'background .15s, transform .1s',
};

const errorAlertStyle: React.CSSProperties = {
  padding: '10px 14px',
  marginBottom: '10px',
  background: '#FEF2F2',
  border: '1.5px solid #FECACA',
  borderRadius: '10px',
  fontSize: '13px',
  color: 'var(--danger)',
};
