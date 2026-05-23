'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useOnboardingGuard } from '@/lib/hooks/useOnboardingGuard';
import { TabBar } from '@/components/ui/TabBar';

// ────────────────────────────────────────────────────────────
// 12 회고 — 단일 회고 화면 (스펙 v1.3)
//
// 매일 동일한 화면. weekly_retros INSERT + AI 코치 CTA 카드.
// (이전 v1.2의 평일/주말 분기 폐지 — daily_memos UI 미사용)
// ────────────────────────────────────────────────────────────

interface ActiveGoal {
  id: string;
  current_week: number;
}

const WEEKDAY_KO_FULL = ['일', '월', '화', '수', '목', '금', '토'];

// ────────────────────────────────────────────────────────────
// 유틸
// ────────────────────────────────────────────────────────────

function formatLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ────────────────────────────────────────────────────────────
// 페이지 export
// ────────────────────────────────────────────────────────────

export default function ReflectPage() {
  return (
    <Suspense fallback={<LoadingScreen text="회고 데이터를 불러오는 중..." />}>
      <ReflectContent />
    </Suspense>
  );
}

function ReflectContent() {
  const router = useRouter();
  const { ready } = useOnboardingGuard('complete');

  const [goal, setGoal] = useState<ActiveGoal | null>(null);
  const [actionTitle, setActionTitle] = useState<string>('');
  const [doneCountWeek, setDoneCountWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 회고 입력 상태 (v1.3 — 단일 화면, 매일 동일)
  const [retroText, setRetroText] = useState('');
  const [savingRetro, setSavingRetro] = useState(false);
  const [retroSaved, setRetroSaved] = useState(false);

  const today = new Date();
  const monday = startOfWeekMonday(today);
  const sundayISO = formatLocalISO(addDays(monday, 6));
  const mondayISO = formatLocalISO(monday);

  // ── 데이터 로드 ────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const run = async () => {
      try {
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const goalRes = await supabase
          .from('goals')
          .select('id, current_week')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (!goalRes.data) {
          router.replace('/onboarding/action-items');
          return;
        }
        const g = goalRes.data as ActiveGoal;
        setGoal(g);

        const [actionRes, completionRes, retroRes] = await Promise.all([
          supabase
            .from('action_items')
            // id 포함 — action_completions 조회 FK로 사용
            .select('id, title')
            .eq('user_id', user.id)
            .eq('goal_id', g.id)
            .eq('week_number', g.current_week)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle(),
          // schema v0.8 노트: action_completions에는 goal_id 컬럼 없음.
          // user_id + 이번 주 날짜 범위만으로 충분 (주 1액션 정책).
          supabase
            .from('action_completions')
            .select('completed_date')
            .eq('user_id', user.id)
            .gte('completed_date', mondayISO)
            .lte('completed_date', sundayISO),
          // 이번 주차 weekly_retros 존재 여부 확인 (스펙 §6: 이미 저장된 경우 CTA 노출 + 저장 비활성)
          supabase
            .from('weekly_retros')
            .select('id, summary_one_line')
            .eq('user_id', user.id)
            .eq('goal_id', g.id)
            .eq('week_number', g.current_week)
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (actionRes.error) console.error('[12] action_items:', actionRes.error);
        if (completionRes.error) console.error('[12] action_completions:', completionRes.error);
        if (retroRes.error) console.error('[12] weekly_retros:', retroRes.error);

        setActionTitle(actionRes.data?.title ?? '액션이 설정되지 않았어요');
        setDoneCountWeek((completionRes.data ?? []).length);

        // 이미 저장된 회고가 있으면 표시 + 저장 비활성 + CTA 노출
        if (retroRes.data) {
          setRetroText((retroRes.data.summary_one_line as string | null) ?? '');
          setRetroSaved(true);
        }

        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError('회고 데이터를 불러올 수 없어요.');
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, router]);

  // ── 회고 저장 ─────────────────────────────────────────────
  const handleSaveRetro = useCallback(async () => {
    if (!goal || savingRetro) return;
    const trimmed = retroText.trim();
    if (!trimmed) return;

    setSavingRetro(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요해요.');

      const todayISO = formatLocalISO(today);
      const { error: insErr } = await supabase
        .from('weekly_retros')
        .insert({
          user_id: user.id,
          goal_id: goal.id,
          week_number: goal.current_week,
          retro_date: todayISO,
          summary_one_line: trimmed,
          completion_count: doneCountWeek,
          target_count: 7,
        });
      if (insErr) throw insErr;

      // 저장 완료 표시 + CTA 노출
      setRetroSaved(true);
    } catch (e) {
      console.error('[12] save retro:', e);
      // Postgres UNIQUE 위반(23505) — (user_id, goal_id, week_number) 주차별 1개
      const err = e as { code?: string; message?: string };
      if (err?.code === '23505') {
        // 이미 저장된 회고가 있음 → 화면을 저장됨 상태로 동기화 (CTA 노출)
        setRetroSaved(true);
        setError(null);
      } else {
        const detail = err?.message ? ` (${err.message})` : '';
        setError(`회고 저장에 실패했어요. 다시 시도해주세요.${detail}`);
      }
    } finally {
      setSavingRetro(false);
    }
  }, [goal, retroText, savingRetro, today, doneCountWeek]);

  // ── 렌더 분기 ─────────────────────────────────────────────
  if (!ready || loading) return <LoadingScreen text="회고를 준비하고 있어요..." />;
  if (!goal) return <LoadingScreen text={error ?? '활성 목표가 없어요.'} />;

  return (
    <div style={wrapStyle}>
      {/* 상단 바 */}
      <header style={topbarStyle}>
        <div style={brandStyle}>
          CareerPT
          <sup style={brandDotStyle}>·</sup>
        </div>
        <span style={stepPillStyle}>회고</span>
      </header>

      <main style={screenStyle}>
        <ReflectScreen
          goal={goal}
          actionTitle={actionTitle}
          doneCountWeek={doneCountWeek}
          retroText={retroText}
          setRetroText={setRetroText}
          savingRetro={savingRetro}
          retroSaved={retroSaved}
          onSaveRetro={handleSaveRetro}
          onGoCoach={() => router.push('/reflect/coach')}
          today={today}
          error={error}
        />
      </main>

      <TabBar active="reflect" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 회고 단일 화면 (v1.3 — 평일/주말 분기 폐지)
// ────────────────────────────────────────────────────────────

function ReflectScreen({
  goal,
  actionTitle,
  doneCountWeek,
  retroText,
  setRetroText,
  savingRetro,
  retroSaved,
  onSaveRetro,
  onGoCoach,
  today,
  error,
}: {
  goal: ActiveGoal;
  actionTitle: string;
  doneCountWeek: number;
  retroText: string;
  setRetroText: (v: string) => void;
  savingRetro: boolean;
  retroSaved: boolean;
  onSaveRetro: () => void;
  onGoCoach: () => void;
  today: Date;
  error: string | null;
}) {
  return (
    <div>
      <div style={subtitleStyle}>
        Week {goal.current_week} 회고 · {WEEKDAY_KO_FULL[today.getDay()]}요일
      </div>
      <h1 style={titleStyle}>
        한 주를 <em style={emAccent}>돌아봐요</em> 🌙
      </h1>

      {/* 안내 문구 */}
      <div style={noticeCardStyle}>
        <div style={noticeHeaderStyle}>
          💡 이번 주를 돌아보고, 다음 주 액션도 함께 정해요
        </div>
        <div style={noticeBodyStyle}>
          잘 됐든 안 됐든, 그 이유를 들여다보는 것이 다음 주를 바꿔요. 솔직하게 한 줄
          남기고, 다음 주에 이어갈 액션까지 코치와 함께 정해보세요.
        </div>
      </div>

      {/* 이번 주 액션 요약 카드 */}
      <div style={weeklyActionCardStyle}>
        <div style={actionLabelStyle}>이번 주 액션</div>
        <div style={{ fontSize: '17px', fontWeight: 500, marginBottom: '10px', lineHeight: 1.4 }}>
          {actionTitle}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={statChipBg}>목표 7회</span>
          <span style={statChipAccent}>실제 {doneCountWeek}회</span>
        </div>
      </div>

      {/* 회고 입력 */}
      <div style={{ marginBottom: '6px' }}>
        <label style={formLabelStyle}>한 주를 한 줄로 표현하면</label>
        <textarea
          value={retroText}
          onChange={(e) => setRetroText(e.target.value)}
          placeholder="예: 야근이 많아서 1번밖에 못했어요."
          rows={3}
          style={{ ...textareaStyle, minHeight: '80px' }}
          disabled={retroSaved}
        />
      </div>

      <button
        type="button"
        onClick={onSaveRetro}
        disabled={savingRetro || !retroText.trim() || retroSaved}
        style={{
          ...accentBtnStyle,
          opacity: savingRetro || !retroText.trim() || retroSaved ? 0.6 : 1,
          cursor:
            savingRetro || !retroText.trim() || retroSaved ? 'not-allowed' : 'pointer',
        }}
      >
        {retroSaved ? '✓ 저장 완료' : savingRetro ? '저장 중...' : '회고 저장하기'}
      </button>

      <div style={retroNoticeStyle}>
        회고를 저장하면, 다음 주 액션을 AI 코치와 함께 정해볼 수 있어요.
      </div>

      {error && (
        <div role="alert" style={errorAlertStyle}>
          {error}
        </div>
      )}

      {/* AI 코치 CTA 카드 (회고 저장 후 노출) */}
      {retroSaved && (
        <div style={{ marginTop: '20px' }}>
          <div style={dividerLineStyle} aria-hidden="true" />
          <div style={ctaLabelStyle}>다음 주 준비</div>
          <button
            type="button"
            onClick={onGoCoach}
            style={coachCtaCardStyle}
            aria-label="AI 코치와 다음 주 액션 정하기"
          >
            <div style={coachIconStyle}>🤖</div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
                AI 코치와 다음 주 액션 정하기
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                이번 주 회고를 바탕으로, 코치가 다음 주에 맞는 액션 아이템을 추천해드려요.
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={tagAccentTintStyle}>✦ 강점 기반 추천</span>
                <span style={tagBgSoftStyle}>약 3–5분 소요</span>
              </div>
            </div>
            <span style={{ fontSize: '20px', color: 'var(--accent)' }}>›</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// LoadingScreen
// ────────────────────────────────────────────────────────────

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
// 스타일
// ────────────────────────────────────────────────────────────

const wrapStyle: CSSProperties = {
  width: '390px',
  height: '100dvh',
  background: 'var(--surface)',
  display: 'flex',
  flexDirection: 'column',
  margin: '0 auto',
  boxShadow: '0 0 40px rgba(0,0,0,.18)',
  overflow: 'hidden',
  position: 'relative',
};

const topbarStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 22px 14px',
  background: 'var(--bg)',
  flexShrink: 0,
};

const brandStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: '18px',
  letterSpacing: '-.02em',
  color: 'var(--ink)',
};

const brandDotStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--accent)',
};

const stepPillStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--accent)',
  padding: '5px 12px',
  borderRadius: '999px',
  background: 'var(--accent-tint)',
  fontWeight: 700,
};

const screenStyle: CSSProperties = {
  padding: '8px 22px 24px',
  flex: 1,
  overflowY: 'auto',
};

const subtitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  marginBottom: '12px',
  color: 'var(--ink)',
};

const titleStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 800,
  letterSpacing: '-.035em',
  lineHeight: 1.25,
  margin: '0 0 14px',
  color: 'var(--ink)',
};

const emAccent: CSSProperties = {
  fontStyle: 'normal',
  color: 'var(--accent)',
};

const noticeCardStyle: CSSProperties = {
  background: 'var(--accent-tint)',
  borderLeft: '3px solid var(--accent)',
  borderRadius: '0 10px 10px 0',
  padding: '12px 14px',
  marginBottom: '20px',
};

const noticeHeaderStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--accent)',
  marginBottom: '4px',
};

const noticeBodyStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--ink-soft)',
  lineHeight: 1.6,
};

const actionLabelStyle: CSSProperties = {
  fontSize: '11px',
  letterSpacing: '.1em',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  marginBottom: '6px',
  fontWeight: 500,
};

const formLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--ink-mute)',
  marginBottom: '6px',
  fontWeight: 500,
};

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid var(--border)',
  borderRadius: '12px',
  fontSize: '15px',
  fontFamily: 'inherit',
  color: 'var(--ink)',
  background: 'var(--surface)',
  outline: 'none',
  resize: 'vertical',
  minHeight: '100px',
  lineHeight: 1.55,
};

const accentBtnStyle: CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: 'inherit',
  transition: 'opacity .15s',
  boxShadow: '0 4px 14px -4px rgba(45,91,255,.3)',
};

const errorAlertStyle: CSSProperties = {
  marginTop: '12px',
  padding: '10px 14px',
  background: '#FEF2F2',
  border: '1.5px solid #FECACA',
  borderRadius: '10px',
  fontSize: '13px',
  color: 'var(--danger)',
};

const weeklyActionCardStyle: CSSProperties = {
  background: 'var(--bg-soft)',
  border: '1px solid var(--line)',
  borderRadius: '14px',
  padding: '14px 16px',
  marginBottom: '18px',
};

const statChipBg: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '4px 10px',
  background: 'var(--bg)',
  color: 'var(--ink-soft)',
  borderRadius: '999px',
};

const statChipAccent: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '4px 10px',
  background: 'var(--accent-tint)',
  color: 'var(--accent)',
  borderRadius: '999px',
};

const retroNoticeStyle: CSSProperties = {
  marginTop: '10px',
  fontSize: '12px',
  color: 'var(--ink-mute)',
  textAlign: 'center',
  lineHeight: 1.55,
};

const dividerLineStyle: CSSProperties = {
  borderTop: '1px solid var(--line)',
  marginBottom: '14px',
};

const ctaLabelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--ink-mute)',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  marginBottom: '10px',
};

const coachCtaCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  background: '#fff',
  border: '1.5px solid var(--line-strong)',
  borderRadius: '18px',
  padding: '16px',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  transition: 'border-color .15s',
};

const coachIconStyle: CSSProperties = {
  width: '46px',
  height: '46px',
  borderRadius: '14px',
  background: 'var(--accent-tint)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '22px',
  flexShrink: 0,
};

const tagAccentTintStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 9px',
  background: 'var(--accent-tint)',
  color: 'var(--accent)',
  borderRadius: '999px',
};

const tagBgSoftStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  padding: '3px 9px',
  background: 'var(--bg-soft)',
  color: 'var(--ink-soft)',
  borderRadius: '999px',
};
