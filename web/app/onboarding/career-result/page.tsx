'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useOnboardingGuard } from '@/lib/hooks/useOnboardingGuard';
import { COMPETENCIES, COMPETENCY_BY_ID, COMPETENCY_BY_CODE } from '@/lib/constants/competencies';
import type { Domain } from '@/lib/constants/strengths';

// ─────────────────────────────────────────────────────────────
// 🤖 AI 연동 인터페이스 (AI 개발자가 여기만 수정하면 됩니다)
//
// 현재: mock 구현 (1.5초 fake delay 후 정적 텍스트 반환)
// 교체: generatePersonalizedTexts 함수 본문을 Claude API 호출로 변경
//
// 함수 시그니처:
//   generatePersonalizedTexts(params: PersonalizationParams)
//     => Promise<PersonalizationResult>
//
// PersonalizationParams:
//   - userStrengths: 사용자 강점 Top 5 ({ name_ko, name_en, domain }[])
//   - userProfile: { nickname, jobField, careerLevel, mainConcern }
//   - interviewInsights: 08 인터뷰의 key_insights JSONB
//                        (현재는 08 mock이라 placeholder 내용)
//   - matchedSlots: Step1 결정적 매칭 결과 (5개 슬롯)
//
// PersonalizationResult:
//   - slots: 각 슬롯에 personalized_text 추가된 5개 객체
//
// 자세한 인계 내용은 docs/HANDOFF_AI.md 참조.
// ─────────────────────────────────────────────────────────────

// 12역량의 id (slug). lib/constants/competencies.ts에서 정의됨.
type CompetencyId = string;

type BadgeKey = 'strength_match' | 'user_interest' | 'growth_potential';
type FitLabel = '추천' | '강점 연계 높음' | '성장 잠재력 높음';

interface UserStrength {
  name_ko: string;
  name_en: string;
  domain: string;
  rank?: number;
}

interface UserProfileLite {
  nickname: string;
  jobField: string;
  careerLevel: string;
  mainConcern: string;
}

interface MatchedSlot {
  slot: number;          // 1~5
  competencyId: CompetencyId;
  goalTitle: string;
  domain: Domain;
  badge: BadgeKey;
  fitLabel: FitLabel;
  tags: string[];
  emoji: string;
}

interface RecommendedSlot extends MatchedSlot {
  personalizedText: string;
}

interface PersonalizationParams {
  userStrengths: UserStrength[];
  userProfile: UserProfileLite;
  interviewInsights: unknown;
  aiSummary?: string;
  matchedSlots: MatchedSlot[];
}

interface PersonalizationResult {
  slots: RecommendedSlot[];
}

// 슬롯 1~3: strength_match / 슬롯 4: user_interest / 슬롯 5: growth_potential
// 단, fallback 시(slot 4의 mentioned가 비었거나 slot 5가 도메인 전부 커버 시) badge가 strength_match로 다운그레이드 됨 (04 spec §4.1)
const BADGE_TO_FIT: Record<BadgeKey, FitLabel> = {
  strength_match: '강점 연계 높음',
  user_interest: '추천',
  growth_potential: '성장 잠재력 높음',
};

// 슬러그(competencies.ts id) → DB CHECK constraint 코드 매핑은 COMPETENCY_BY_ID에서 가져옴
function getCompetencyCode(id: string): string {
  return COMPETENCY_BY_ID[id]?.code ?? id;
}

// domain 컬럼도 T/I/R/E 단일 문자 CHECK. 갤럽 도메인명 → 코드 매핑.
const DOMAIN_CODE_BY_NAME: Record<Domain, string> = {
  strategic:    'T',
  influencing:  'I',
  relationship: 'R',
  executing:    'E',
};

// 로컬 timezone 기준 오늘 날짜 (KST 새벽에 UTC 변환으로 어제 표기되는 버그 회피)
function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── 🤖 AI 개인화 함수 (Claude API) ─────────────────────────────
async function generatePersonalizedTexts(
  params: PersonalizationParams,
): Promise<PersonalizationResult> {
  const res = await fetch('/api/career-personalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'AI personalization failed');
  }
  return res.json();
}
// ─────────────────────────────────────────────────────────────

// Step1: 결정적 매칭 (코드, AI 미사용)
// 04 spec §4.1 알고리즘:
//   match_score = 사용자 Top 5 강점과 각 역량의 연계 강점 5개의 교집합 크기 (0~5)
//   슬롯 1~3: 점수 내림차순, 도메인 분산 우선 (새 도메인 먼저, 동점 시 코드 순)
//   슬롯 4: mentioned[0] 중 1~3에 없는 첫 항목 (없으면 결정적 4위로 fallback, badge='strength_match')
//   슬롯 5: 1~4와 다른 도메인 중 score 최고 (4도메인 다 커버되면 fallback)
function deterministicMatch(
  userStrengths: UserStrength[],
  mentioned: string[],
): MatchedSlot[] {
  // 사용자 강점 한글명 set (예: {"화합", "절친", ...})
  const userStrengthNames = new Set(userStrengths.map((s) => s.name_ko));

  // 12역량 각각의 score 계산
  type Scored = {
    competencyId: string;
    code: string;
    goalTitle: string;
    domain: Domain;
    tags: string[];
    emoji: string;
    score: number;
  };
  const scored: Scored[] = COMPETENCIES.map((c) => ({
    competencyId: c.id,
    code: c.code,
    goalTitle: c.title,
    domain: c.domain,
    tags: c.tags,
    emoji: c.emoji,
    score: c.linkedStrengths.filter((name) => userStrengthNames.has(name)).length,
  }));

  // 점수 내림차순, 동점 시 code 사전순 (안정 정렬 보장)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.code.localeCompare(b.code);
  });

  // 슬롯 1~3 선택: 도메인 분산 우선 (04 spec select_top3)
  function selectTop3(): Scored[] {
    const chosen: Scored[] = [];
    const usedDomains = new Set<Domain>();
    const groupedByScore = new Map<number, Scored[]>();
    for (const item of scored) {
      if (!groupedByScore.has(item.score)) groupedByScore.set(item.score, []);
      groupedByScore.get(item.score)!.push(item);
    }
    const sortedScores = [...groupedByScore.keys()].sort((a, b) => b - a);
    for (const score of sortedScores) {
      const bucket = groupedByScore.get(score)!;
      // 새 도메인 먼저, 같은 도메인은 뒤
      const newDomain = bucket.filter((b) => !usedDomains.has(b.domain));
      const sameDomain = bucket.filter((b) => usedDomains.has(b.domain));
      const ordered = [
        ...newDomain.sort((a, b) => a.code.localeCompare(b.code)),
        ...sameDomain.sort((a, b) => a.code.localeCompare(b.code)),
      ];
      for (const item of ordered) {
        if (chosen.length === 3) return chosen;
        chosen.push(item);
        usedDomains.add(item.domain);
      }
    }
    return chosen;
  }

  const slots1to3 = selectTop3();
  const chosenCodes = new Set(slots1to3.map((s) => s.code));

  // 슬롯 4: mentioned 중 chosen에 없는 첫 항목
  let slot4: Scored & { badge: BadgeKey };
  let slot4Picked: Scored | undefined;
  for (const code of mentioned) {
    const item = scored.find((s) => s.code === code);
    if (item && !chosenCodes.has(item.code)) {
      slot4Picked = item;
      break;
    }
  }
  if (slot4Picked) {
    slot4 = { ...slot4Picked, badge: 'user_interest' };
  } else {
    // fallback: 결정적 매칭에서 1~3에 없는 첫 항목 (4위에 해당)
    const fallback = scored.find((s) => !chosenCodes.has(s.code));
    if (!fallback) throw new Error('슬롯 4 fallback 실패 (12역량 모두 슬롯 1~3에 차지 못함)');
    slot4 = { ...fallback, badge: 'strength_match' };
  }
  chosenCodes.add(slot4.code);

  // 슬롯 5: 1~4와 다른 도메인 중 score 최고
  const slots1to4Domains = new Set<Domain>(
    [...slots1to3, slot4].map((s) => s.domain),
  );
  let slot5: Scored & { badge: BadgeKey };
  if (slots1to4Domains.size === 4) {
    // 4도메인 다 커버됨 → fallback: 다음 순위
    const fallback = scored.find((s) => !chosenCodes.has(s.code));
    if (!fallback) throw new Error('슬롯 5 fallback 실패');
    slot5 = { ...fallback, badge: 'strength_match' };
  } else {
    const otherDomainPool = scored.filter(
      (s) => !chosenCodes.has(s.code) && !slots1to4Domains.has(s.domain),
    );
    const pick = otherDomainPool[0];
    if (!pick) throw new Error('슬롯 5 다른 도메인 없음');
    slot5 = { ...pick, badge: 'growth_potential' };
  }

  const finalSlots: Array<Scored & { badge: BadgeKey }> = [
    ...slots1to3.map((s) => ({ ...s, badge: 'strength_match' as const })),
    slot4,
    slot5,
  ];

  return finalSlots.map((s, i) => ({
    slot: i + 1,
    competencyId: s.competencyId,
    goalTitle: s.goalTitle,
    domain: s.domain,
    badge: s.badge,
    fitLabel: BADGE_TO_FIT[s.badge],
    tags: s.tags,
    emoji: s.emoji,
  }));
}

// ────────────────────────────────────────────────────────────
// 컴포넌트
// ────────────────────────────────────────────────────────────

export default function CareerResultPage() {
  return (
    <Suspense fallback={<LoadingScreen text="불러오는 중..." />}>
      <CareerResultContent />
    </Suspense>
  );
}

function CareerResultContent() {
  const router = useRouter();
  const { ready } = useOnboardingGuard('career-result');

  const [slots, setSlots] = useState<RecommendedSlot[] | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRedoConfirm, setShowRedoConfirm] = useState(false);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Step1 + Step2 자동 트리거 (스펙 4번)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        setLoadingMatch(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return; // guard에서 /login 리다이렉트

        const [profileRes, strengthRes, interviewRes] = await Promise.all([
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
            .select('id, key_insights, ai_summary, recommended_competencies')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (profileRes.error) console.error('[09] profiles query error:', profileRes.error);
        if (strengthRes.error) console.error('[09] strength_analyses query error:', strengthRes.error);
        if (interviewRes.error) console.error('[09] career_interview_results query error:', interviewRes.error);

        if (!interviewRes.data) {
          throw new Error('인터뷰 결과를 불러올 수 없어요.');
        }
        setInterviewId(interviewRes.data.id);

        // 새로고침 복원: recommended_competencies 이미 저장돼 있으면 그대로 사용
        const existing = interviewRes.data
          .recommended_competencies as RecommendedSlot[] | null;
        if (existing && Array.isArray(existing) && existing.length > 0) {
          if (!cancelled) {
            setSlots(existing);
            setLoadingMatch(false);
          }
          return;
        }

        // Step1: 결정적 매칭
        const userStrengths: UserStrength[] =
          (strengthRes.data?.strengths as UserStrength[] | undefined) ?? [];
        const mentioned: CompetencyId[] =
          (interviewRes.data.key_insights as {
            mentioned_competencies?: CompetencyId[];
          } | null)?.mentioned_competencies ?? [];
        const matched = deterministicMatch(userStrengths, mentioned);

        // Step2: AI 개인화 (mock — TODO: Claude API)
        const result = await generatePersonalizedTexts({
          userStrengths,
          userProfile: {
            nickname: profileRes.data?.nickname ?? '',
            jobField: profileRes.data?.job_field ?? '',
            careerLevel: profileRes.data?.career_level ?? '',
            mainConcern: profileRes.data?.main_concern ?? '',
          },
          interviewInsights: interviewRes.data.key_insights,
          aiSummary: (interviewRes.data as { ai_summary?: string | null }).ai_summary ?? undefined,
          matchedSlots: matched,
        });

        if (cancelled) return;

        // recommended_competencies UPDATE
        const { error: updateError } = await supabase
          .from('career_interview_results')
          .update({ recommended_competencies: result.slots })
          .eq('id', interviewRes.data.id);

        if (updateError) {
          // UPDATE 실패해도 표시는 진행 (다음 새로고침 시 재계산)
          console.error('recommended_competencies UPDATE 실패', updateError);
        }

        setSlots(result.slots);
        setLoadingMatch(false);
      } catch (e) {
        console.error('[09 load] error object:', e);
        console.error('[09 load] error JSON:', JSON.stringify(e, Object.getOwnPropertyNames(e ?? {})));
        const errAny = e as { message?: string; details?: string; code?: string; hint?: string };
        const detail = errAny?.message || errAny?.details || errAny?.hint || (typeof e === 'object' ? JSON.stringify(e) : String(e));
        if (!cancelled) {
          setError(`역량 추천 분석 실패: ${detail}`);
          setLoadingMatch(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [ready, retryKey]);

  const handleSelect = useCallback((slot: number) => {
    setSelectedSlot((prev) => (prev === slot ? null : slot));
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setSlots(null);
    setLoadingMatch(true);
    setRetryKey((k) => k + 1);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedSlot || saving || !slots || !interviewId) return;
    setSaving(true);
    setError(null);

    try {
      const chosen = slots.find((s) => s.slot === selectedSlot);
      if (!chosen) throw new Error('선택한 역량을 찾을 수 없어요.');

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요.');

      const today = todayLocalISO(); // YYYY-MM-DD (로컬 timezone 기준)

      // 재시작 안전망: 기존 active goal abandoned 처리
      await supabase
        .from('goals')
        .update({ status: 'abandoned' })
        .eq('user_id', user.id)
        .eq('status', 'active');

      const { error: insertError } = await supabase.from('goals').insert({
        user_id: user.id,
        competency_code: getCompetencyCode(chosen.competencyId),
        domain: DOMAIN_CODE_BY_NAME[chosen.domain] ?? chosen.domain,
        goal_title: chosen.goalTitle,
        career_interview_id: interviewId,
        status: 'active',
        started_at: today,
      });

      if (insertError) throw insertError;

      // 새 cycle 시작 → NEW02(complete) 재진입 차단 플래그 리셋
      // 이렇게 해야 새 결과로 진행 시 NEW02가 다시 1회성 안내로 노출됨
      try { localStorage.removeItem('mvp_completed'); } catch { /* ignore */ }

      router.push('/onboarding/action-items');
    } catch (e) {
      // Supabase 에러는 message/details/code/hint 필드를 가짐. JSON으로도 한번 더 찍어 정확한 원인 파악.
      console.error('[09 handleConfirm] error object:', e);
      console.error('[09 handleConfirm] error JSON:', JSON.stringify(e, Object.getOwnPropertyNames(e ?? {})));
      const errAny = e as { message?: string; details?: string; code?: string; hint?: string };
      const detail = errAny?.message || errAny?.details || errAny?.hint || (typeof e === 'object' ? JSON.stringify(e) : String(e));
      setError(`저장 실패: ${detail}`);
      setSaving(false);
    }
  }, [selectedSlot, saving, slots, interviewId, router]);

  const handleRedoInterview = useCallback(() => {
    // 08 인터뷰 sessionStorage 초기화 후 재진입
    try {
      sessionStorage.removeItem('career_interview_session');
    } catch {
      /* ignore */
    }
    router.push('/onboarding/career-interview');
  }, [router]);

  if (!ready) return <LoadingScreen text="확인 중..." />;

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
          <span style={pageTitleStyle}>커리어 방향 결과</span>
          <span style={{ width: '44px' }} />
        </header>

        {/* 본문 */}
        <main style={mainStyle}>
        {/* 결과 배너 (스펙 3.2) */}
        <div style={bannerStyle}>
          <div style={bannerEyebrowStyle}>🎯 AI 분석 완료</div>
          <h1 style={bannerTitleStyle}>지금 집중해야 할 역량 목표예요</h1>
          <p style={bannerSubStyle}>
            강점 · 가치관 · 현재 상황을 종합 분석한 결과예요
          </p>
        </div>

        {/* 선택 안내 (스펙 3.3) */}
        <h2 style={sectionTitleStyle}>
          키우고 싶은 역량을{' '}
          <strong style={{ color: 'var(--accent)' }}>1개</strong> 골라주세요
        </h2>

        {/* 5개 카드 (스펙 3.4) */}
        {loadingMatch ? (
          <SkeletonCards />
        ) : error && !slots ? (
          <ErrorRetry message={error} onRetry={handleRetry} onBackToInterview={handleRedoInterview} />
        ) : slots ? (
          <div
            role="radiogroup"
            aria-label="추천 역량 5개"
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {slots.map((slot) => (
              <CompetencyCard
                key={slot.slot}
                slot={slot}
                selected={selectedSlot === slot.slot}
                onClick={() => handleSelect(slot.slot)}
              />
            ))}
          </div>
        ) : null}

        <div style={{ height: '8px' }} />
      </main>

      {/* 하단 CTA */}
      <footer style={footerStyle}>
        {error && slots && (
          <div role="alert" style={errorAlertStyle}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedSlot || saving}
          style={{
            ...primaryBtnStyle,
            background: selectedSlot && !saving ? 'var(--accent)' : 'var(--border)',
            color: selectedSlot && !saving ? '#fff' : 'var(--text-muted)',
            cursor: selectedSlot && !saving ? 'pointer' : 'not-allowed',
            boxShadow:
              selectedSlot && !saving ? '0 4px 16px rgba(45,91,255,.3)' : 'none',
          }}
        >
          {saving ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{
                width: '16px', height: '16px', borderRadius: '50%',
                border: '2.5px solid rgba(255,255,255,0.35)',
                borderTopColor: 'white',
                animation: 'spin 0.75s linear infinite',
                display: 'inline-block', flexShrink: 0,
              }} />
              저장 중...
            </span>
          ) : '액션 아이템 받기 →'}
        </button>

        {/* 점선 구분선 */}
        <div style={dottedDividerStyle} aria-hidden="true" />

        <button
          type="button"
          onClick={() => setShowRedoConfirm(true)}
          style={secondaryTextBtnStyle}
        >
          원하는 목표가 없어요! 커리어 인터뷰 다시하기
        </button>
      </footer>

      {/* 인터뷰 다시하기 확인 다이얼로그 (스펙 4번) */}
      {showRedoConfirm && (
        <ConfirmDialog
          title="인터뷰를 다시 진행할까요?"
          desc="현재 분석 결과가 사라지고, 처음부터 인터뷰를 다시 진행해요."
          confirmText="다시하기"
          cancelText="취소"
          onConfirm={handleRedoInterview}
          onCancel={() => setShowRedoConfirm(false)}
        />
      )}
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
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '3.5px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.75s linear infinite',
        }} />
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          {text}
        </div>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div
      aria-busy="true"
      aria-label="추천 역량 분석 중"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            ...cardStyle,
            pointerEvents: 'none',
            opacity: 0.55,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                background: 'var(--border)',
                borderRadius: '6px',
              }}
            />
            <div
              style={{
                height: '16px',
                flex: 1,
                background: 'var(--border)',
                borderRadius: '4px',
                maxWidth: '60%',
              }}
            />
          </div>
          <div
            style={{
              height: '12px',
              background: 'var(--border)',
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          />
          <div
            style={{
              height: '12px',
              background: 'var(--border)',
              borderRadius: '4px',
              width: '70%',
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ErrorRetry({
  message,
  onRetry,
  onBackToInterview,
}: {
  message: string;
  onRetry: () => void;
  onBackToInterview: () => void;
}) {
  return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
      <div
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '16px',
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}
      >
        {message}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '12px 18px',
            background: 'var(--accent-light)',
            color: 'var(--accent)',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          다시 시도하기
        </button>
        <button
          type="button"
          onClick={onBackToInterview}
          style={{
            padding: '12px 18px',
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            border: '1.5px solid var(--border-strong)',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          인터뷰 다시하기
        </button>
      </div>
    </div>
  );
}

function CompetencyCard({
  slot,
  selected,
  onClick,
}: {
  slot: RecommendedSlot;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      aria-label={`${slot.goalTitle}. ${slot.fitLabel}`}
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
      {/* 우상단: fit badge */}
      <span
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          fontSize: '11px',
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: '999px',
          ...badgeStyle(slot.badge),
        }}
      >
        {slot.fitLabel}
      </span>

      {/* 좌상단: 슬롯 번호 + 제목 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '8px',
          paddingRight: '96px',
        }}
      >
        <div aria-hidden="true" style={slotBadgeStyle}>
          {slot.slot}
        </div>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-.02em',
            lineHeight: 1.3,
          }}
        >
          {slot.emoji} {slot.goalTitle}
        </div>
      </div>

      {/* personalized text */}
      <p
        style={{
          margin: '0 0 10px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.65,
        }}
      >
        {slot.personalizedText}
      </p>

      {/* tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {slot.tags.map((tag) => (
          <span key={tag} style={tagStyle}>
            {tag}
          </span>
        ))}
      </div>

      {/* 선택 체크 (우측 하단) */}
      {selected && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(45,91,255,.4)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </button>
  );
}

function ConfirmDialog({
  title,
  desc,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: {
  title: string;
  desc: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="redo-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '20px',
          padding: '24px',
          width: '100%',
          maxWidth: '340px',
        }}
      >
        <div
          id="redo-dialog-title"
          style={{
            fontSize: '17px',
            fontWeight: 700,
            marginBottom: '8px',
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </div>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          {desc}
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ ...dialogBtnStyle, ...dialogCancelStyle }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ ...dialogBtnStyle, ...dialogConfirmStyle }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 스타일
// ────────────────────────────────────────────────────────────

function badgeStyle(badge: BadgeKey): React.CSSProperties {
  switch (badge) {
    case 'strength_match':
      return { background: '#ECFDF5', color: '#059669' };
    case 'user_interest':
      return { background: 'var(--accent-light)', color: 'var(--accent)' };
    case 'growth_potential':
      return { background: '#EFF6FF', color: '#2563EB' };
  }
}

const wrapStyle: React.CSSProperties = {
  width: '390px',
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

const bannerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #111827, #1f2f5a)',
  borderRadius: 'var(--radius-lg)',
  padding: '22px 20px',
  color: '#fff',
  marginBottom: '20px',
};

const bannerEyebrowStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  opacity: 0.8,
  marginBottom: '8px',
};

const bannerTitleStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: '20px',
  fontWeight: 800,
  lineHeight: 1.35,
  letterSpacing: '-.02em',
};

const bannerSubStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  opacity: 0.75,
  lineHeight: 1.55,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  letterSpacing: '-.02em',
};

const cardStyle: React.CSSProperties = {
  border: '1.5px solid var(--border)',
  borderRadius: '16px',
  padding: '16px',
  background: 'var(--surface)',
  width: '100%',
};

const slotBadgeStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 800,
  borderRadius: '6px',
  flexShrink: 0,
};

const tagStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  padding: '4px 9px',
  borderRadius: '999px',
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

const dottedDividerStyle: React.CSSProperties = {
  marginTop: '12px',
  borderTop: '1px dashed var(--border)',
};

const secondaryTextBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  marginTop: '6px',
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
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

const dialogBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '13px',
  borderRadius: '12px',
  border: 'none',
  fontSize: '14px',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const dialogCancelStyle: React.CSSProperties = {
  background: 'var(--bg)',
  color: 'var(--text-secondary)',
};

const dialogConfirmStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: '#fff',
};
